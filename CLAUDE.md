@AGENTS.md

# Estado del proyecto (diagnóstico 2026-07-21)

> Este resumen se generó explorando el código real (no solo los nombres de archivos). Sirve como referencia rápida para no re-explorar todo el proyecto en cada sesión nueva. Si algo de lo que dice acá cambia (se agrega auth por middleware, cambian reglas de CasaTalentos, etc.), actualizar esta sección.

## Stack
- Next.js 16.2.0 (App Router) + React 19.2.4 + TypeScript 5 (`strict`) + Tailwind CSS v4.
- Auth: NextAuth v4, provider único `CredentialsProvider`, sesión JWT. No usa Supabase Auth ni Google login (Google solo se usa para Calendar, vía OAuth propio).
- DB: Supabase (Postgres), acceso exclusivo desde el backend con `service_role` (RLS habilitado sin policies = deny-by-default para `anon`/`authenticated`).
- Pagos: MercadoPago integrado a mano con `fetch` (no el SDK oficial `mercadopago`).
- Mail: Resend. Sin zod, sin react-hook-form, sin UI kit — proyecto deliberadamente liviano en dependencias.
- Package manager: npm. Scripts clave: `dev`, `dev:lan`, `build`, `start`, `lint`, `typecheck`.

## Carpetas clave
- `app/` — páginas (una carpeta por módulo) + `app/api/` (route handlers, ~20 subcarpetas).
- `lib/` — lógica de negocio y server-side: `auth.ts` (NextAuth), `authz.ts` (roles/permisos/acceso por actividad — 3 capas), `supabase.ts` (cliente anon) / `supabase-admin.ts` (cliente service_role), `payment-pricing.ts`/`billing.ts` (MP), `google-calendar.ts`, etc.
- `sql/` — ~29 scripts SQL fechados a mano (no hay carpeta `supabase/migrations/` ni tooling de migraciones formal; varias tablas núcleo no tienen su `CREATE TABLE` versionado, se crearon directo en el dashboard).
- No existe `/types` central (tipos inline por archivo) ni `middleware.ts` (protección de rutas 100% a nivel de componente/API, no de edge).

## Arquitectura de permisos (confirmada, funciona como se espera en AGENTS.md)
`lib/authz.ts` separa correctamente: **rol global** (admin/colaborador/participante) → **acceso por actividad** (`resolveActivityAccess`, chequea inscripción + estado de pago mensual, no asume que participante = acceso a todo) → **permiso por acción** (`Permission` granular, `hasPermission`/`requirePermission`). Cada API route revalida server-side independientemente del cliente.

## Riesgos activos a tener en cuenta
1. **Alto (pendiente, decisión 2026-07-21: se atiende más adelante)** — `lib/auth.ts` tiene 3 usuarios de prueba hardcodeados (`admin@escuela.com` / `colaborador@escuela.com` / `participante@escuela.com`, password `"1234"`), deshabilitados solo si `process.env.NODE_ENV === "production"`. Verificar que esto quede realmente desactivado antes de cualquier despliegue público. Nicolás decidió no priorizarlo ahora; retomar antes de cualquier despliegue público.
2. **Medio** — Webhooks de MercadoPago (`app/api/mp-webhook/route.ts`, `app/api/pagos-mensuales/mp-webhook/route.ts`) no verifican la firma (`x-signature`) de MP, no validan el monto recibido contra el esperado, y no son idempotentes (pueden recrear eventos duplicados en Google Calendar si MP reenvía la notificación).
3. **Medio** — No hay `middleware.ts`: la seguridad de cada endpoint nuevo depende de que el desarrollador recuerde llamar a `requireAuthenticatedActor`/`requirePermission` de `lib/authz.ts`.
4. **Bajo** — `normalizarRole` degrada silenciosamente cualquier rol desconocido/con error a `"participante"` en vez de fallar o loguear.

## Discrepancias CasaTalentos — resueltas (decisión 2026-07-21)
El código es la fuente de verdad; se corrigió AGENTS.md para que coincida:
1. **Días de video**: **lunes y miércoles** (el martes es día de aportes escritos/comentarios, no de video).
2. **Ventana de votación**: **jueves, hasta las 17:00 hs** (sin hora de inicio).

Resto de la lógica de CasaTalentos (ranking top 3, empates sin ganador automático, "ganador" requiere subir ambos días de video + haber elegido, comentarios con nombre/fecha, referentes generales y semanales, grabación de video estilo WhatsApp con `MediaRecorder` + fallback a `<input capture>`) está completa y bien implementada.

## Rutas vestigiales — RESUELTO (ver sesión 2026-07-26 más abajo)
~~`/admin/casatalentos` y `/admin/conectando-sentidos` son redirects de 5 líneas hacia las páginas reales; `/admin/grabaciones` se autodeclara "legado".~~ Las 3 carpetas se eliminaron del código en la sesión del 2026-07-26. La navegación de admin apunta ahora directo a `/casatalentos` y `/conectando-sentidos`.

## Convenciones de código
- Componentes `PascalCase.tsx`, funciones/variables `camelCase`, lógica de negocio nombrada **en español** (`autenticarUsuarioPlataforma`, `crearPreferenciaMercadoPago`, `asegurarActividadBase`).
- Casi todas las páginas son `"use client"` de punta a punta; cargan datos con `useEffect` + `fetch` hacia sus propios route handlers (no Server Components para data fetching, no Server Actions).
- Supabase se llama directo con `@supabase/supabase-js` (sin ORM/wrapper), tipado a mano con `type ...Row` local en cada archivo.
- Sin design system de componentes (no hay `Button.tsx`/`Card.tsx` genéricos); el estilo se resuelve con clases utilitarias propias en `app/globals.css` (`workspace-hero`, `workspace-panel-soft`, etc.) + Tailwind inline.
- Errores de API siempre en español, formato `{ error: "mensaje" }` + status HTTP, a veces con campo `detalle` para debug.
- Sesión en frontend vía hook propio `useAppSession()` (`components/auth/AppSessionProvider.tsx`), no el `useSession` estándar de next-auth/react.

---

# Sesión de trabajo 2026-07-21 → 2026-07-26

## 1. Objetivo de la sesión
Arrancó como el diagnóstico inicial del proyecto (sección de arriba) y se extendió, a lo largo de varios días de trabajo continuo, a: (a) parejar funciones de administrador que estaban desparejas entre los 4 módulos de actividad (CasaTalentos, Conectando Sentidos, Mentorías, Terapia), y (b) reorganizar y arreglar el circuito de Administración/Pagos, que Nicolás describió como "muy engorroso". Se trabajó **por fases**, cada una probada en vivo contra la base de producción real (con datos descartables creados y borrados por completo) antes de subir, y pusheada a `main` con confirmación explícita en cada paso.

## 2. Qué se hizo, por fase (orden cronológico)

**Diagnóstico "por qué Agostina/Cuchulain no ven tal cosa"** (2 casos puntuales investigados, sin bug de código): el límite de "1 mensaje por día" en mentorías/terapia SÍ era un bug real → se sacó (`app/api/espacios/mensajes/route.ts`, `EspacioAcompanamiento.tsx`). El caso de "no veo los links de recursos" resultó ser dato faltante (5 recursos viejos sin URL cargada desde el seed inicial de marzo), no bug — quedó documentado, no se tocó código.

**Auditoría "ordenar funciones de admin"**: se relevaron los 4 módulos de actividad y se armó un roadmap de 5 fases. Implementadas:
- **Fase 1** (commit `97a094c`): arregló el botón "limpiar todo" de CasaTalentos (estaba invertido: solo lo veía un no-admin en modo prueba), le agregó confirmación; conectó el borrado individual de video (endpoint ya existía, sin UI); sacó el endpoint muerto `marcar-realizada` de Terapia; agregó "eliminar grabación" a CasaTalentos y Conectando Sentidos (antes solo se podía ocultar).
- **Fase 2** (commit `cf6d863`): edición y borrado real de Recursos (antes solo se podía mostrar/ocultar) en los 3 módulos que los tienen.
- **Fase 3** (commit `c58f41c`): agregó edición de mensajes en Mentorías/Terapia (ya existía en CasaTalentos/Conectando Sentidos).
- Deshabilitar reserva propia de Terapia y biblioteca de grabaciones para participantes (commit `cebeb40`): ojo, la primera versión también ocultó el panel admin de grabaciones — Nicolás corrigió que el admin lo necesita seguir viendo (para una futura suscripción a la biblioteca), así que quedó oculto **solo para el participante**, con flags booleanas fáciles de revertir (`RESERVA_NUEVA_SESION_TERAPIA_HABILITADA`, `BIBLIOTECA_GRABACIONES_HABILITADA`).
- Sacar la solapa "Accesos" para participantes de mentorías (commit `d8acb43`): quedó admin-only en los dos módulos (mentorías y terapia), unificando un criterio que antes era distinto entre las dos.
- **"Fase 5" (la estructural grande)**: investigada a fondo (embeber gestión de agenda en Mentorías/Terapia, panel admin único) pero **descartada por decisión de Nicolás** — prefiere manejar todo desde `/agenda`, y no le vio función a un panel único. Sin cambios de código.

**Reorganización Administración/Pagos** (a partir de una charla sobre 4 grupos: Administración, Actividades, Comunicaciones, Agenda — con diagnóstico completo de cada uno):
- **"Fase 1" nueva** (commit `ed109c7`): Terapia ahora tiene honorario base automático igual que CasaTalentos/Conectando Sentidos (antes solo se configuraba a mano). Se agregó la sección "Configuración de pagos" a `/admin/usuarios`. `/admin/pagos` pasó a ser un simple redirect a `/admin/usuarios` (su "Tablero por participante" resultó ser 100% redundante con lo que ya existía en la ficha de cada persona en Admin Usuarios). Se eliminaron las 3 carpetas fósiles (`app/admin/grabaciones`, `app/admin/casatalentos`, `app/admin/conectando-sentidos`) y se actualizó `components/AppNav.tsx`.
- **Precios combinados** (pendiente de push al momento de escribir esto — ver más abajo): Nicolás pasó la tabla real de honorarios (link de Canva) y pidió que "Actividades combinadas" (CasaTalentos + Conectando Sentidos juntas) y "Sesiones con descuento" (Terapia cuando hay combo) se vieran como conceptos propios. Se corrigió además un bug de la fase anterior: el honorario automático de Terapia quedó en modalidad `"proceso"` en vez de `"sesion"`, lo cual significaba que las sesiones nunca se cobraban de verdad.

## 3. Archivos tocados (resumen, no exhaustivo — ver `git log` para el detalle línea por línea)
- `app/admin/usuarios/page.tsx` — el más tocado de la sesión: sección "Configuración de pagos" (con el bloque nuevo de combo), resumen "Actividades combinadas" y etiqueta "Sesiones con descuento" en la ficha de cada persona, soporte de `?participante=` en la URL, quitó links redundantes a `/admin/pagos`.
- `lib/admin-activity-sync.ts` — `asegurarHonorarioYPagoAdmin` extendida a Terapia (con el bug de modalidad corregido a `"sesion"`); nueva función `sincronizarPrecioComboSiCorresponde`.
- `lib/payment-pricing.ts` / `app/api/admin/configuracion/pagos/route.ts` — 4 claves nuevas en `configuracion_plataforma`: `terapia_honorario_base`, `combo_ct_cs_honorario_base`, `combo_terapia_sesion_precio` (y ya existían `casatalentos_honorario_base`/`conectando_sentidos_honorario_base`/`mercado_pago_recargo_porcentaje`).
- `app/api/admin/usuario-actividades/route.ts` — llama a `sincronizarPrecioComboSiCorresponde` al final de cada alta/baja de actividad.
- `app/admin/pagos/page.tsx` — ahora es un redirect de 3 líneas a `/admin/usuarios`.
- Eliminados: `app/admin/grabaciones/page.tsx`, `app/admin/casatalentos/page.tsx`, `app/admin/conectando-sentidos/page.tsx`.
- `components/AppNav.tsx`, `app/campus/page.tsx`, `app/pagos/page.tsx`, `components/agenda/AdminAgendaCalendar.tsx` — links actualizados para no apuntar más a las rutas eliminadas.
- Recursos (3 módulos): `app/api/casatalentos/recursos/route.ts`, `app/api/conectando-sentidos/recursos/route.ts`, `app/api/espacios/recursos/route.ts` + sus páginas — PATCH ampliado y DELETE nuevo.
- Mensajes: `app/api/espacios/mensajes/route.ts` + `components/espacios/EspacioAcompanamiento.tsx` — PATCH nuevo (editar) y el límite de 1 mensaje/día eliminado.
- `components/casatalentos/CasaTalentosAdminPanel.tsx`, `components/conectando/ConectandoAdminPanel.tsx` — CRUD de grabaciones con "Eliminar" agregado; flags de biblioteca (luego revertidas para admin).

## 4. Decisiones clave y el porqué
- **No se creó una "actividad" nueva en la base para el combo CT+CS.** `ActivitySlug` es un union type de TypeScript usado en decenas de archivos, incluido `resolveActivityAccess` (el que decide si alguien puede entrar a `/casatalentos`). Crear una actividad nueva para facturar el combo como una sola cosa hubiera obligado a tocar el motor de acceso real de participantes — riesgo alto para un beneficio que se podía lograr más liviano. En cambio, CasaTalentos y Conectando Sentidos siguen siendo dos honorarios/pagos separados (para no tocar el acceso), pero con el monto repartido automáticamente (mitad y mitad) y una presentación visual ("Actividades combinadas") que los muestra como un concepto conjunto.
- **`/admin/pagos` se convirtió en redirect en vez de borrarse** — por si Nicolás lo tiene guardado en favoritos/costumbre, es más amable que un 404.
- **Reversión automática del precio combo solo si el valor actual coincide con el valor de combo** (no revierte si el admin ya lo editó a mano a otra cosa mientras el combo estaba activo) — para no pisar una edición manual intencional.
- **Todo se probó contra la base real de producción** (no hay entorno de staging separado — `.env.local` apunta a la única base que existe), siempre con usuarios/datos descartables creados y borrados por completo al final, nunca dejando residuos.
- Patrón de trabajo establecido y repetido en toda la sesión: implementar → `typecheck` + `lint` → probar en vivo (por API cuando el DOM resultaba frágil, con Playwright) → limpiar datos de prueba → pedir confirmación → commit + push (solo los archivos de esa fase, nunca `git add -A`).

## 5. Pendiente / a medio hacer
- ~~Posible inconsistencia de precio CT/CS $150k vs $160k~~ **RESUELTO 2026-07-26**: Nicolás confirmó que la tabla de Canva es la vigente. Se actualizó `casatalentos_honorario_base`/`conectando_sentidos_honorario_base` a $160.000 (antes $150.000), y se actualizó también el honorario ya asignado de la única persona que tenía el valor viejo (`interlegerensa@gmail.com`, cuenta que parece interna/de staff, ambas actividades) a $160.000. Importante para el futuro: **subir el precio base NO actualiza retroactivamente los honorarios ya asignados a participantes existentes** — solo aplica a altas nuevas de ahí en adelante; si se vuelve a cambiar el precio base, revisar a mano si hay que actualizar a alguien más (`honorarios_participante` filtrando por el valor viejo).
- **Pack de 4 sesiones de Terapia ($200.000)**: fuera de alcance a pedido de Nicolás — necesita trackear consumo de sesiones prepagas (no existe hoy el concepto de "crédito"/paquete). Evaluar como fase aparte.
- **Comunicaciones**: diagnosticado (5 puntos: envío masivo secuencial sin límite de tiempo, sin emails automáticos de aprobación/rechazo de pago, tabla de plantillas fantasma sin CRUD, sin tracking de apertura/rebote, deuda de código menor) pero **sin implementar todavía** — Nicolás pidió mejoras sobre esos puntos + UX de uso, pendiente de arrancar.
- **Agenda**: diagnosticada (5 puntos, Nicolás respondió a cada uno) pero **sin implementar todavía**:
  1. Sacar la conciliación de pago de Terapia del calendario de Agenda (duplicada con Admin Usuarios) — acordado.
  2. Corregir el bug de advertencias de cancelación que se pierden silenciosamente — acordado, corregir.
  3. Acotar la consulta sin límite de `reservas` en `listarAgendaUnificada` — Nicolás no entendía el tecnicismo pero pidió que se mejore igual.
  4. Agregar filtro por participante y por "sin Meet generado" — acordado si es viable.
  5. Revisar qué botones ya existentes no funcionan + **bug nuevo reportado**: el calendario mensual no muestra eventos de días del mes siguiente que aparecen en la grilla del mes actual (ej. parado en julio, no se ven eventos de agosto aunque esos días ya se ven en la grilla).
- **Fase 4 del roadmap original** (comentarios de video en CasaTalentos: hoy sin editar/eliminar/rich text) — todavía no arrancada.
- ~~El commit de "Precios combinados" (combo CT+CS + sesiones con descuento) está probado y listo pero el usuario pidió actualizar este archivo **antes** de confirmar el push — confirmar si ya se subió mirando `git log`.~~ **RESUELTO**: sí se subió (commit `501a65f`), y también el ajuste de precio $160k (commit `a80f59b`).

## 6. Próximo paso (superado, ver sesión 2026-07-26 más abajo)
~~Nicolás confirmó seguir "por fases, del 1 al 5" sobre el segundo roadmap (Administración ✅ → Actividades/Agenda-embebida-en-CT-CS ⏳ → Comunicaciones ⏳ → Agenda ⏳ → Perfil ✅ ya resuelto). El siguiente bloque de trabajo pendiente más inmediato es la Fase 2 de ese roadmap: sacar la gestión de agenda embebida (editar/cancelar/generar Meet) de CasaTalentos y Conectando Sentidos, dejándola de solo lectura con link a `/agenda`, igual que ya funciona en Mentorías/Terapia — esto había quedado confirmado ("Sí, acuerdo con la recomendación") pero aún no implementado.~~ En la práctica, antes de arrancar esa Fase 2, Nicolás pidió un cambio de fondo en el modelo de pagos (ver sesión siguiente) — la Fase 2 de agenda embebida sigue pendiente, no se tocó.

---

# Sesión de trabajo 2026-07-26 (continuación) — Pago uniforme + prórroga configurable

## 1. Objetivo
Nicolás pidió sacar de raíz el concepto de `becado`/`invitado`/`sin_cobro` en `honorarios_participante.modalidad_pago`, calificándolo como "un parche". Decisión: el honorario pasa a ser **el mismo para todos** en cada actividad (precio estándar configurado en "Configuración de pagos"), con la única excepción de **Mentoría** (que ya era 100% manual/personalizada y sigue así). Lo que reemplaza al acceso gratuito es una **prórroga en días, configurable por actividad**, que ya existía como mecanismo (día límite del mes, hardcodeado en `paymentGraceDay`) pero no era configurable desde la UI.

Hallazgo crítico antes de tocar código: un relevamiento en vivo mostró que "invitado" no era una excepción — era la modalidad más común en las 4 actividades (6/8 CasaTalentos, 5/6 Conectando Sentidos, 8/10 Mentorías, 6/7 Terapia). Se confirmó con Nicolás antes de migrar nada: las personas que hoy son "invitado" pasan a pagar el precio estándar, pero **recién a partir de agosto** (julio no se tocó, para no cortarle el acceso a nadie de un día para el otro).

## 2. Qué se hizo
- **Prórroga configurable**: `lib/payment-pricing.ts` tiene ahora `obtenerDiasGraciaPorActividadConfigurado`/`obtenerDiasGraciaConfigurados`, que leen 3 claves nuevas de `configuracion_plataforma` (`casatalentos_gracia_dias`, `conectando_sentidos_gracia_dias`, `membresia_gracia_dias`, default 10 = el valor que ya estaba hardcodeado, así que el cambio no modificó el comportamiento de nadie que ya paga). `lib/activity-rules.ts` perdió el campo `paymentGraceDay` de `ACTIVITY_RULES`; `estaDentroDeGraciaMensual` ahora recibe el día de gracia ya resuelto como parámetro en vez de mirar una tabla hardcodeada. `lib/authz.ts` (`resolveActivityAccess`, el gate real de acceso) y `lib/economy-engine.ts` (`obtenerEconomiaActividadActual`) resuelven el valor configurado antes de llamar a la función. Terapia sigue sin prórroga (se cobra por sesión reservada) y Mentoría sigue con acceso incondicional sin importar el pago (sin cambios en ninguno de los dos).
- **Se sacó el concepto especial de todo el código**: `esModalidadEspecial` (`lib/admin-activity-sync.ts`), `modalidadEspecialSinCobro` (`lib/economy-engine.ts`), y las ramas `becado`/`invitado`/`sin_cobro`/`bonificado` en `lib/admin-person-summary.ts`, `lib/payment-ui.ts`, `lib/espacios.ts`, `components/pagos/PagoPendienteItem.tsx`, `app/admin/pagos-mensuales/honorarios/route.ts` (incluyendo `permiteMontoCero`, que ya no existe: el honorario siempre debe ser mayor a 0) y `app/api/pagos-mensuales/obtener-o-crear/route.ts`.
- **UI de `/admin/usuarios`**: se sacaron los 3 botones "Becado"/"Invitado"/"Sin cobro" y el selector de esas modalidades. La ficha "Economía" (que mostraba y dejaba editar el honorario de las 4 actividades por persona) se **eliminó para CasaTalentos/Conectando Sentidos/Terapia/Membresía** — ya no hay nada que configurar 1 a 1, usan el precio estándar. Se **conservó, renombrada a "Honorario de Mentoría"**, solo para esa actividad (sigue siendo edición manual de monto/moneda/medio, como siempre). "Configuración de pagos" ganó una sección nueva "Días de prórroga" con un input por actividad (CasaTalentos/Conectando Sentidos/Membresía).
- **Migración de datos real** (una sola vez, vía Supabase REST con `service_role`, no quedó como código): se actualizaron los **25 honorarios activos** que tenían modalidad especial — 6 CasaTalentos, 5 Conectando Sentidos y 6 Terapia pasaron a modalidad estándar con el precio base configurado (o el precio de combo si la persona ya tenía CasaTalentos+Conectando Sentidos simultáneas); las **8 de Mentorías** pasaron a modalidad `mensual` pero con el monto sin definir (0), quedan para que Nicolás les cargue el monto real a mano cuando pueda — como Mentoría da acceso incondicional, no hay apuro. El `pagos_mensuales` de julio de estas personas no se tocó (sigue "pagado" como ya estaba); agosto se genera normal, con precio nuevo y gracia estándar, la primera vez que alguien entre a `/pagos` o el admin genere el cobro.
- Quedó un registro huérfano sin migrar a propósito: `honorarios_participante.id=60` (Terapia de `agosrimoldi@gmail.com`) tiene `modalidad_pago: "invitado"` pero está `activo: false` (dado de baja hace tiempo) — no otorga acceso ni afecta nada, no formaba parte de la lista confirmada, se dejó intacto.

## 3. Decisiones clave y el porqué
- **El día de gracia se resuelve upstream, no se hizo async `estaDentroDeGraciaMensual`/`resolverEconomiaActividad`**: esta última es una función pura muy usada (incluida en checks del lado del participante); en vez de tocar su firma a async (con el ripple que eso implica en todos sus callers), los 2 lugares que ya eran async (`resolveActivityAccess` en `authz.ts`, `obtenerEconomiaActividadActual` en `economy-engine.ts`) resuelven el valor configurado antes y lo pasan como dato ya calculado.
- **No se migraron los `pagos_mensuales` de julio**: la decisión explícita de Nicolás fue que el cambio de precio "invitado → estándar" entre en vigencia recién en agosto. Como el pago de julio de estas personas ya estaba marcado `pagado` por la lógica vieja (que forzaba `estado: "pagado"` para modalidades especiales), no tocarlo alcanza para lograr esa transición sin escribir lógica de fecha de corte especial.
- Mismo patrón de trabajo que el resto de la sesión: Plan Mode con investigación primero (incluyendo relevamiento en vivo contra la base real antes de proponer nada), confirmación explícita del usuario antes de escribir código dado el impacto real sobre ~20 personas, prueba en vivo con usuario descartable + limpieza total, y la lista exacta de personas/montos afectados mostrada a Nicolás **antes** de tocar datos reales de producción.

## 4. Pendiente
- Cargar a mano el honorario real de Mentoría para las 8 personas que quedaron en 0 (Agostina Rimoldi, Alex Bohorquez, Alexis Alexandroff, Ana Felicia Payares Galvis, Cristian Ruggiero, Cuchulain Mago, Lucas Britos, Verónica Alejandra Saracho).
- ~~Todo lo demás pendiente de la sesión anterior (Fase 2 de agenda embebida en CT/CS, Comunicaciones, Agenda, Fase 4 de comentarios de video) sigue igual, sin arrancar.~~ **Fase 2 (agenda embebida en CT/CS) ya se hizo** — ver sesión siguiente. Comunicaciones, resto de Agenda y Fase 4 siguen sin arrancar.

---

# Sesión de trabajo 2026-07-27 — Fase 2 (agenda embebida), bug de Mentorías, y comprobación con Google Calendar

## 1. Fase 2: agenda embebida sacada de CasaTalentos y Conectando Sentidos
Se implementó lo que había quedado confirmado: `components/agenda/AgendaActividad.tsx` (usado solo por CasaTalentos y Conectando Sentidos) dejó de permitir editar/cancelar/generar Meet directamente — esas acciones vivían duplicadas ahí y en `/agenda` (`AdminAgendaCalendar` + `EditarEncuentroModal`, que no se tocaron). Ahora el admin ve un cartel "se administra desde la agenda unificada" con link a `/agenda`, igual que ya pasaba en Mentorías/Terapia; la lista de próximos encuentros de solo lectura no cambió para nadie. Un solo archivo tocado, probado en vivo (Playwright) como admin y participante. Commit `ad9e720`.

## 2. Diagnóstico: "no veo la reunión de Alex Bohorquez de hoy en Mentorías"
Investigado a fondo contra la base real: **no era un bug de filtrado**. La reunión de Alex Bohorquez del 27/7 no existía en la tabla `disponibilidades` en absoluto — Nicolás la había agendado directo en Google Calendar, no desde la plataforma. `/agenda` y la ficha de Mentorías leen exclusivamente `disponibilidades`, nunca Google, así que ninguna de las dos podía mostrarla. De paso se detectó que varias series recurrentes de Mentorías (Ana Felicia Payares Galvis, Lucas Britos, Verónica Saracho, Agostina Rimoldi) también tienen su última ocurrencia generada en el pasado sin nada cargado para adelante — mismo patrón que Alex, sin resolver todavía.

## 3. Comprobación Agenda vs Google Calendar (nueva función)
A partir del diagnóstico anterior, se agregó una herramienta de solo lectura para que Nicolás pueda comparar por su cuenta qué hay de un lado y del otro mientras termina de migrar todo a agendarse desde la plataforma:
- `lib/google-calendar.ts`: nueva función `listarEventosGoogleCalendarEnRango` (reutiliza el mismo cliente OAuth ya usado para sincronizar Meets — no hizo falta pedir permisos nuevos, el scope ya cubre lectura).
- `lib/agenda-reconciliacion.ts` (nuevo): `compararAgendaConGoogle`, cruza `disponibilidades` activas contra los eventos de Google por `google_event_id` primero y por fecha+hora después, sin mostrar los que sí matchean.
- `app/api/agenda/admin/comprobar-google/route.ts` (nuevo) + botón "Comprobar con Google Calendar" en `/agenda` (admin-only). No automatiza ninguna acción, es solo un reporte.

**Hallazgo real al probarlo en vivo** (no simulado): la conexión de Google Calendar apuntaba a la cuenta vieja `nicolasbusico.psi@gmail.com` (con el token vencido, `invalid_grant`) en vez de `nicolasbusico@entheosescuela.com`, que es la cuenta que Nicolás usa hoy de verdad para agendar. Se corrigió `GOOGLE_CALENDAR_OWNER_EMAIL` en `.env.local` (**pendiente sincronizar este valor también en las variables de entorno de Vercel**, igual que con `CRON_SECRET` — todavía no confirmado si ya se hizo). Una vez apuntando a la cuenta correcta, la comprobación mostró **19 eventos "solo en Google Calendar"** en las próximas ~3 semanas — no solo la reunión de Alex: la reunión semanal de CasaTalentos y varias mentorías individuales (Tato Fuentes, Alexis Alexandroff) aparecen ahí *todas las semanas*, lo que sugiere que buena parte de la agenda real se está cargando directo en Google y no en la plataforma. También aparecieron 2 eventos personales de Nicolás ("Natación") mezclados — esperable, la comprobación no filtra por tipo de evento a propósito.

## 4. Pendiente
- ~~Confirmar en Vercel que `GOOGLE_CALENDAR_OWNER_EMAIL` ya esté actualizado~~ **RESUELTO**: ya sincronizado y redeployado en producción.
- Revisar y migrar a la plataforma las series recurrentes que hoy solo existen en Google Calendar (CasaTalentos semanal, varias mentorías) — usar el botón nuevo de `/agenda` para ir chequeando.
- Mismo pendiente de la sesión anterior: series de Mentorías que se quedaron sin ocurrencias futuras generadas (Ana Felicia Payares Galvis, Lucas Britos, Verónica Saracho, Agostina Rimoldi, y ahora confirmado también Alex Bohorquez).

---

# Sesión de trabajo 2026-07-28 — Comunicaciones, Fase 1

## 1. Objetivo
De los 5 problemas diagnosticados en Comunicaciones (envío masivo sin límite, sin emails automáticos de pago, tabla de plantillas fantasma, sin tracking de apertura/rebote, UX general confusa), Nicolás confirmó arrancar por los dos de menor riesgo y mayor valor concreto: emails automáticos de aprobación/rechazo de pago, y sacar el código muerto de plantillas. El resto (envío masivo con pausas, tracking de apertura/rebote vía webhook de Resend, UX general del compositor) queda para fases siguientes, ya diagnosticado y con plan claro cuando se retome.

## 2. Qué se hizo
- **Emails automáticos de pago**: `app/admin/pagos-mensuales/resolver/route.ts` (antes hacía un `update` ciego sin leer nada) y `app/api/terapia/admin/resolver-pago-reserva/route.ts` ahora envían un mail al participante al aprobar o rechazar, con monto/actividad/período (y el motivo si el admin cargó una observación al rechazar). Nueva función `enviarResolucionPagoIndividual` en `lib/comunicaciones.ts`, con `tipo: "pago_aprobado"`/`"pago_rechazado"` (nuevos, no pisan el `tipo: "pago"` de los recordatorios manuales — se pueden distinguir en el historial). El envío va en su propio `try/catch`: si Resend falla, el pago se resuelve igual, solo se agrega una `advertencia` a la respuesta.
- **Plantillas muertas**: se confirmó que `comunicacion_plantillas` era 100% inalcanzable (sin CRUD, sin seed, ninguna fila podía existir nunca), así que el fallback en `enviarComunicacionIndividual` nunca se activaba. Se sacó `obtenerPlantillaPorClave`, el tipo `PlantillaRow`, y el parámetro `plantillaClave` de todos los call sites reales. La tabla en Supabase se dejó intacta (vacía, sin código que la consulte) — no valía la pena un `DROP TABLE` para esto.
- Probado en vivo con usuario descartable: aprobar/rechazar generó los 2 registros esperados en `comunicacion_envios` con datos correctos; el único "error" fue Resend rechazando una dirección `@example.com` de prueba (esperado, no bug). Se confirmó además que `/admin/comunicaciones` sigue cargando sin errores tras sacar el código de plantillas.

## 3. Pendiente
- Envío masivo con pausas/límite de tiempo (hoy secuencial sin cap, riesgo de límites de Resend/timeout de Vercel en listas grandes — el volumen real actual es bajo, no urgente).
- Tracking de apertura/rebote: requiere un webhook nuevo de Resend con verificación de firma (ojo con no repetir el mismo error sin validar que ya se marcó en los webhooks de MercadoPago) + columnas nuevas en `comunicacion_envios`.
- ~~UX general del compositor: contenido que queda pegado al cambiar de segmento, confirmación poco diferenciada entre prueba y envío real, historial sin registrar qué segmento se usó, opción "Pagos al día" muerta en el dropdown.~~ **RESUELTO, ver Fase 2 abajo.**

## Fase 2 (mismo día): arreglos de UX en el compositor
Los 6 puntos concretos de UX de `app/admin/comunicaciones/page.tsx`, todos resueltos en un solo archivo, sin cambios de backend/SQL (el historial ya traía `metadata` con el `segmento` sin necesitar nada nuevo de la API):
- El efecto que precargaba asunto/contenido para "Usuarios con pago pendiente" reaccionaba a cada tecla y nunca limpiaba al salir del segmento — ahora reacciona solo al cambio de segmento, con un aviso visual, y limpia el contenido autocompletado (no editado a mano) al salir.
- Aviso inline nuevo cuando se elige tipo "pago" con un segmento de contactos externos, antes de intentar enviar (antes solo se enteraban al fallar el envío).
- El botón de envío ahora siempre muestra la cantidad real de destinatarios ("Enviar a N destinatarios") en vez de un label que variaba por segmento y podía sugerir un alcance más chico del real.
- El historial ahora muestra el segmento usado (`metadata.segmento`) como chip, cuando está presente.
- Se sacó la opción muerta "Usuarios con pago al día" ("Próximamente", nunca implementada) del desplegable de segmentos.
- **Hallazgo durante la verificación**: el "preview desactualizado al cambiar el filtro" que se había diagnosticado **ya estaba resuelto por el código existente** (el efecto de carga inicial ya reacciona a cambios de segmento/filtro porque depende de `cargarPreview`, cuya identidad cambia con esos valores) — confirmado en vivo con logs de red, no hizo falta agregar nada.
- Probado en vivo con Playwright: precarga/limpieza de contenido, aviso inline, label del botón con cantidad real ("Enviar a 18 destinatarios"), auto-actualización del preview, y que la opción muerta ya no aparece. El chip de segmento en historial se verificó por código/API — no había ningún envío de segmento real todavía en el historial para verlo con datos reales, y no se mandó un mail masivo real solo para probar esto.

### Pendiente (sin cambios)
- Envío masivo con pausas/límite de tiempo.
- Tracking de apertura/rebote (webhook de Resend + columnas nuevas).

## Fase 3 (mismo día): rediseño wizard + envíos programados y recurrentes
Pedido de Nicolás: que Comunicaciones sea "profesional pero simple" para cubrir newsletters, recordatorios de eventos y de pago, con la posibilidad de **programar envíos a futuro y recurrentes**. Confirmado con él: wizard de 3 pasos, recurrencia (una vez / semanal / mensual / cada N días), y el modo de disparo (automático vs. requiere aprobación) configurable por cada envío programado.

**Modelo de datos**: tabla nueva `comunicaciones_programadas` (`sql/2026-07-28_comunicaciones_programadas.sql` — Nicolás la corrió a mano en el SQL Editor de Supabase, como el resto de los `.sql` del proyecto). Guarda los mismos parámetros de segmentación que ya usaba el compositor, más la regla de recurrencia (`recurrencia`, `fecha_una_vez`, `dia_semana`, `dia_mes`, `intervalo_dias`, `hora`), `modo_disparo`, `activo`, `proxima_ejecucion` (única fuente de verdad de "cuándo corresponde") y `pendiente_aprobacion`.

**Cálculo de próxima ejecución**: `lib/comunicaciones-programadas.ts` → `calcularProximaEjecucion`, función pura en horario Argentina (mismo patrón que `lib/fechas.ts`). Probada en vivo para los 4 tipos de recurrencia, incluido el cálculo de "próximo día de la semana" (dio la fecha correcta).

**Sin duplicar el envío**: se extrajo el loop que antes vivía inline en `enviar-segmento/route.ts` a una función compartida, `ejecutarEnvioMasivo` en `lib/comunicaciones.ts` — la usan tanto el envío interactivo como el cron nuevo y el endpoint de "aprobar y enviar".

**Cron nuevo**: `app/api/comunicaciones/procesar-programadas/route.ts`. Por cada programación vencida: si es automática, envía y recalcula/desactiva; si requiere aprobación, solo marca `pendiente_aprobacion` sin enviar nada — queda esperando que Nicolás la confirme desde la UI ("Aprobar y enviar ahora"). **Ver incidente e integración del cron en la sección siguiente** — este endpoint terminó sin cron propio en `vercel.json`, se lo llama desde el cron diario unificado.

**Endpoints nuevos**: `app/api/admin/comunicaciones/programadas/route.ts` (listar/crear) y `.../programadas/accion/route.ts` (pausar/reanudar/eliminar/aprobar_y_enviar).

**UI**: `app/admin/comunicaciones/page.tsx` reorganizado en un wizard de 3 pasos (Destinatarios → Mensaje → Enviar o programar) reutilizando todo el estado y los handlers que ya existían — no se reescribió lógica de negocio, solo se reorganizó la presentación y se agregó la vista de programación. El botón real de "Enviar a N destinatarios" se movió del paso 1 al paso 3 (donde ahora también vive "Enviar prueba" y el formulario de programar). Nueva sección "Programados" (pausar/reanudar/eliminar/aprobar) al mismo nivel que "Base externa" e "Historial", que siguen sin cambios.

Probado en vivo con datos descartables: los 3 casos (automática ya vencida, requiere-aprobación ya vencida, semanal) se comportaron exactamente como se diseñó; recorrido completo del wizard por Playwright (captura de pantalla revisada); confirmado que un envío inmediato real sigue funcionando idéntico a antes del refactor (llamada directa a `enviar-segmento` con éxito). Todo el ruido de prueba se limpió de `comunicaciones_programadas` y `comunicacion_envios`.

### Pendiente
- Envío masivo con pausas/límite de tiempo (sigue igual, no se tocó en esta fase).
- Tracking de apertura/rebote (webhook de Resend + columnas nuevas).

## Incidente: deploy silencioso roto + límite de crons de Vercel Hobby
Después de pushear el commit de esta fase, Nicolás avisó que el deploy en Vercel no se había disparado. Investigando: el commit sí estaba en `main` de GitHub (confirmado con `git ls-remote`), pero **no aparecía ningún intento de deploy en Vercel, ni siquiera fallido** — a diferencia de los commits anteriores, que sí generaban un deploy (aunque cada uno con un curioso segundo deploy en estado "Error" en paralelo, aparentemente un ambiente duplicado preexistente, no relacionado con este incidente).

**Causa real**: el proyecto de Vercel (`escuela-talento-platform`, team "interlegere's projects") está en **plan Hobby**, no Pro (el Pro que tiene Nicolás es de Supabase, no de Vercel — confusión aclarada en la charla). El plan Hobby limita a **2 cron jobs como máximo, y cada uno solo puede correr 1 vez por día**. El commit de esta fase agregó un tercer cron (`procesar-programadas`, cada 15 minutos), superando ambos límites a la vez — lo más probable es que Vercel rechazara el deploy en la validación de `vercel.json`, antes de generar ningún registro de intento.

**Decisión de Nicolás**: en vez de upgradear el proyecto a Vercel Pro, unificar los 3 crons en uno solo.

**Solución implementada**: `app/api/cron/diario/route.ts`, un único cron (`vercel.json`: `0 3 * * *`, 3am UTC = medianoche Argentina, todos los días) que decide internamente qué corresponde ese día y llama por HTTP a los endpoints ya existentes (sin duplicar lógica, mismo patrón de autenticación con `CRON_SECRET`):
- Comunicaciones programadas (`/api/comunicaciones/procesar-programadas`): se llama todos los días.
- Limpieza de CasaTalentos (`/api/casatalentos/limpiar-antiguos`): solo si es domingo.
- Cobros mensuales (`/api/pagos-mensuales/generar-cobros-mensuales`): solo si es el día 1 del mes.

Los 3 endpoints originales no se tocaron (siguen funcionando igual si se llaman directo) — `vercel.json` quedó con una sola entrada apuntando al cron nuevo.

**Trade-off aceptado explícitamente por Nicolás**: las comunicaciones programadas ya no se procesan cada 15 minutos sino una vez por día. Si alguien programa un envío para "hoy a las 09:00" y ya pasaron las 09:00 cuando corre el cron diario (medianoche), se manda recién en la corrida del día siguiente — la hora elegida al programar deja de respetarse al minuto, se respeta "una vez por día calendario".

Probado en vivo (local): el cron diario nuevo detectó correctamente el día de la semana/mes real y solo ejecutó la rama de comunicaciones programadas (no era domingo ni día 1), devolviendo el resultado esperado.

### Pendiente
- ~~Confirmar que el deploy en Vercel funciona una vez subido este fix~~ **RESUELTO**: el problema real era otro — el campo "Root Directory" del proyecto en Vercel tenía cargado `./` (no vacío), y para el detector de Next.js de Vercel eso no es equivalente a dejarlo en blanco. Nicolás lo vació y el deploy funcionó. Documentado para no perder tiempo la próxima vez que un deploy de este proyecto falle con "No Next.js version detected".
- Si en el futuro se necesita más precisión horaria en las comunicaciones programadas, la opción real es upgradear este proyecto de Vercel a Pro — ya evaluado y descartado por ahora.

## Fase 4 (mismo día, sesión 2026-07-29/30): Bandeja de entrada (Resend Inbound) — REVERTIDA, ver sesión 2026-08-04 más abajo

~~Todo lo de esta sección (tabla `comunicacion_recibidos`, `lib/webhooks.ts`, el webhook `app/api/webhooks/resend-inbound/route.ts`, los endpoints de recibidos, la sección "Bandeja de entrada" en la UI) se sacó del código el 2026-08-04.~~ **Motivo**: al intentar configurarlo en vivo, se descubrió que la cuenta de Resend de Nicolás ya tiene su único dominio del plan gratuito ocupado por `entheosescuela.com` (usado para envío) — agregar el subdominio de recepción como un segundo dominio pide upgrade a Resend Pro, **$20/mes**, algo que Nicolás no había aceptado pagar y explícitamente no quería. El supuesto "$0 costo adicional" de esta sección no contemplaba el límite de *cantidad de dominios* del plan (solo contemplaba que la función de recibir mail en sí no tuviera costo, que es cierto, pero no alcanza). Se mantiene el resto de esta sección tal cual se escribió en su momento, como registro de lo investigado y por qué se había elegido este camino — la funcionalidad real que se dejó funcionando es otra, más simple, documentada en la sesión de abajo.

### Objetivo (histórico, ver nota de arriba)
Nicolás quería ver y responder desde ENTHEOS las respuestas que la gente manda a sus mails — hoy caen en su Gmail personal (invisibles para el sistema) y, al responder desde ahí, pierden el formato de marca de ENTHEOS (Gmail no sabe que existe esa plantilla HTML). Antes de construir nada se investigó el costo: **Resend Inbound** (mismo proveedor que ya se usa para enviar) incluye recepción de mail por webhook en todos sus planes, **incluido el gratuito** — sin costo adicional mientras el volumen total (envío + recepción) siga dentro del plan actual. Se descartaron alternativas con costo (Postmark, Mailgun) y Cloudflare Email Routing (gratis pero suma un proveedor nuevo sin necesidad).

### Qué se hizo
- **Tabla nueva** `comunicacion_recibidos` (`sql/2026-07-29_comunicacion_recibidos.sql`, Nicolás la corre a mano como el resto de los `.sql` del proyecto).
- **`lib/webhooks.ts`** (nuevo): `verificarFirmaSvix`, verificación manual de firma HMAC-SHA256 al estilo Svix (que es lo que usa Resend para firmar sus webhooks) — **sin agregar los paquetes `resend` ni `svix` como dependencia nueva**, coherente con que todo el resto de las integraciones del proyecto (Mercado Pago, el propio Resend de salida) se hacen a mano sin SDK oficial. Probado con 5 casos (firma válida, payload alterado, secret incorrecto, timestamp vencido, múltiples firmas en el header) — los 5 dieron el resultado esperado.
- **`app/api/webhooks/resend-inbound/route.ts`** (nuevo): primer webhook de todo el proyecto que **sí verifica firma** (el de Mercado Pago, ya documentado como riesgo, no lo hace — acá no se repite ese error). Lee el body crudo, verifica firma, si es válida busca el cuerpo completo del mail en la API de Resend (el webhook solo manda metadata), matchea el remitente contra `usuarios_plataforma`/`comunicacion_contactos`, e inserta con `upsert` por `resend_email_id` (idempotente — evita duplicar si Resend reintenta la entrega del webhook, otra cosa que Mercado Pago no hace bien).
- **`enviarRespuestaEntheos`/`crearHtmlRespuestaEntheos`** en `lib/comunicaciones.ts`: mismo patrón que `enviarResolucionPagoIndividual`, reutilizando exactamente el mismo layout visual de ENTHEOS (header, tarjeta, botón) que ya usan todos los demás mails transaccionales del sistema.
- **Endpoints**: `app/api/admin/comunicaciones/recibidos/route.ts` (listar) y `.../recibidos/accion/route.ts` (marcar leído / responder).
- **UI**: nueva sección "Bandeja de entrada" en `/admin/comunicaciones` (entre "Programados" y "Base externa") — lista de recibidos con nombre (si matchea a alguien conocido) o email, asunto, chip "No leído"/"Respondido", y al expandir un textarea para responder con el formato de ENTHEOS.
- **A propósito, sin threading complejo**: no se intenta enlazar cada respuesta con el mail exacto que la originó (headers `In-Reply-To`/`References`) — la bandeja es una lista simple "quién escribió, qué asunto, cuándo", más simple y confiable que armar un hilo de conversación.

### Configuración manual pendiente (la hace Nicolás, no se puede hacer desde acá)
- En Resend: dar de alta un **subdominio** de recepción (nunca el dominio raíz `entheosescuela.com` — cortaría la casilla real de Google Workspace) y cargar los MX que Resend indique.
- En Resend: crear el endpoint de webhook apuntando a `https://<dominio>/api/webhooks/resend-inbound`, copiar el secreto `whsec_...`.
- Variables de entorno nuevas en Vercel: `RESEND_WEBHOOK_SECRET` (el `whsec_...`) y opcionalmente `MAIL_INBOUND_DOMAIN`.
- Sin esta configuración el webhook devuelve 500 controladamente ("RESEND_WEBHOOK_SECRET no configurado") — confirmado en vivo, no falla en silencio ni acepta payloads sin verificar.

### Pendiente (histórico, superado por la reversión de abajo)
~~- Probar el flujo real de punta a punta (mandar un mail de verdad a la dirección de recepción) recién cuando el subdominio y el secret estén configurados en Resend/Vercel.~~
~~- Verificar contra la documentación real de Resend el endpoint exacto de "traer el cuerpo completo del email" (`GET /emails/receiving/{id}`) la primera vez que llegue un mail real — se implementó según la documentación pública disponible, pero no se pudo probar en vivo por no tener todavía el dominio conectado.~~

---

# Sesión de trabajo 2026-08-04 — Reversión de la Bandeja de entrada automática y reemplazo por composer manual

## 1. Qué pasó
Al guiar a Nicolás paso a paso para configurar el subdominio de recepción en Resend (`respuestas.entheosescuela.com`), la pantalla real de su cuenta mostró dos cosas nuevas que no se habían podido ver antes de tener acceso en vivo:
1. Su dominio ya cargado en Resend (`entheosescuela.com`, usado hoy para *enviar*) tenía un intento de "Enable Receiving" con el MX apuntando al host `@` (la raíz) en estado "Failed" — no llegó a tocar el DNS real (el registro nunca se cargó), así que el Google Workspace real de Nicolás nunca estuvo en riesgo, pero confirmó en la práctica el motivo por el que este proyecto siempre evitó tocar el dominio raíz.
2. Al intentar agregar `respuestas.entheosescuela.com` como dominio nuevo (necesario para recibir sin tocar la raíz), Resend mostró un paywall: el plan actual de Nicolás permite **1 solo dominio**, y agregar un segundo pide upgrade a **Resend Pro, $20/mes**.

Esto contradice la premisa con la que se había diseñado toda la Fase 4 ("$0 costo adicional") — esa premisa era cierta para la *función* de recibir mail (Resend Inbound no tiene costo por sí sola en ningún plan), pero no contempló el límite de *cantidad de dominios* del plan gratuito, algo que solo se pudo confirmar mirando la cuenta real de Nicolás, no la documentación pública de precios. Nicolás, con la condición explícita de no sumar costos por el momento, eligió no pagar el upgrade.

## 2. Decisión (elegida por Nicolás entre 4 opciones presentadas)
Se le presentaron 4 caminos: pagar Resend Pro, migrar a Cloudflare Email Routing (gratis pero suma un proveedor nuevo + requiere delegar el subdominio vía NS + reescribir la captura como Email Worker, bastante más trabajo), una versión simple sin captura automática, o pausar todo. Eligió la **versión simple sin captura automática**.

## 3. Qué se hizo
- **Se sacó todo el código de la Fase 4** que dependía de recibir mail automáticamente: tabla `sql/2026-07-29_comunicacion_recibidos.sql` (el archivo se borró del repo; la tabla puede seguir existiendo vacía en Supabase si Nicolás llegó a correr ese SQL — no confirmado, no vale la pena un `DROP TABLE` para esto, mismo criterio ya usado antes con `comunicacion_plantillas`), `lib/webhooks.ts` (`verificarFirmaSvix`, sin otros usos en el código), `app/api/webhooks/resend-inbound/route.ts`, `app/api/admin/comunicaciones/recibidos/route.ts` y `.../recibidos/accion/route.ts`.
- **Se reemplazó la sección "Bandeja de entrada" de `/admin/comunicaciones`** por una sección más simple, "Responder con formato Entheos": un formulario (email destinatario, nombre opcional, asunto, mensaje) que arma y manda la respuesta con el mismo layout visual de ENTHEOS de siempre. Nicolás sigue viendo las respuestas de la gente solo en su Gmail personal (eso no cambió), pero ahora puede contestarlas desde el portal con el formato de marca en vez de hacerlo en texto plano desde Gmail — resuelve la mitad original del pedido (responder con marca) sin necesitar recibir mail automáticamente.
- **Se conservó** `enviarRespuestaEntheos`/`crearHtmlRespuestaEntheos` en `lib/comunicaciones.ts` (no dependen de la tabla de recibidos, se les cambiaron los call sites) y el endpoint nuevo que los usa, `app/api/admin/comunicaciones/responder-entheos/route.ts` (toma `{destinatarioEmail, destinatarioNombre?, asunto, cuerpo}` directo del formulario, sin buscar nada en base).
- `typecheck` y `lint` verificados limpios (el único error de lint del proyecto, en `hooks/useSessionDraft.ts`, es preexistente y no relacionado).

## 4. Pendiente
- Si en algún momento cambia el presupuesto o la prioridad, la opción de Cloudflare Email Routing sigue disponible como camino gratuito hacia la bandeja automática real — implica delegar el subdominio de recepción a Cloudflare (vía NS en Namecheap, sin tocar el resto del DNS del dominio raíz) y armar la captura con un Email Worker en vez del webhook de Resend.
- Confirmar si `comunicacion_recibidos` llegó a crearse en Supabase (Nicolás nunca confirmó explícitamente haber corrido ese SQL) — si existe, se puede dejar vacía sin problema, ningún código la usa.

---

# Sesión de trabajo 2026-08-04 (continuación) — Encuentros sin sincronizar a Google Calendar + reintento automático

## 1. Diagnóstico: "no se me sincronizaron los eventos generados desde Entheos"
Relevamiento en vivo contra la base real: de 36 encuentros futuros en `disponibilidades`, **6 nunca habían llegado a Google Calendar** — 3 sesiones de Terapia de Cecilia Reynoso (`sync_status: "pendiente"`), la Mentoría de Lucas Britos (quedó en `"error"` de un intento previo), la Mentoría de Ale Alexandroff (quedó trabada a mitad de camino en `"sincronizando"`, nunca terminó) y la sesión de Terapia de Maru Arrieta de ese mismo día (tenía el evento creado en Google pero la plataforma nunca guardó `sync_status: "sincronizado"`).

**Causa de fondo**: la sincronización a Google (`sincronizarDisponibilidadConGoogle` en `lib/google-calendar.ts`) solo se dispara manualmente, al tocar el botón correspondiente en `/agenda` — no hay ningún cron ni reintento automático. Si esa sincronización falla (o el proceso se corta a mitad de camino, dejando `sync_status` en `"sincronizando"` para siempre), queda así en silencio hasta que alguien lo note y reintente a mano.

Se sincronizaron los 6 manualmente (mismo endpoint que usa el botón de la UI, `/api/google/sync-disponibilidad`) y se confirmó con la herramienta de comprobación de `/agenda` (agregada en la sesión del 27/7) que no quedó nada del lado de la plataforma sin sincronizar. Quedan otros 12 registros en `"pendiente"` que son reuniones semanales de CasaTalentos/Conectando Sentidos **ya canceladas** — está bien que no tengan evento en Google, no son parte del problema.

## 2. Reintento automático (lo pedido: "que esto no vuelva a pasar en silencio")
- **`app/api/agenda/admin/reintentar-sync-pendientes/route.ts`** (nuevo): mismo patrón de auth que el resto de endpoints llamados por cron (`CRON_SECRET` en el header `Authorization`, no sesión de usuario). Busca `disponibilidades` con fecha futura y `sync_status` en `"pendiente"` / `"error"` / `"sincronizando"`, **excluyendo `estado: "cancelada"`** (a propósito — sincronizar un encuentro cancelado recrearía un evento que no debería existir), y llama a `sincronizarDisponibilidadConGoogle` por cada uno. Reintentar es seguro/idempotente: si ya existe `google_event_id`, la función actualiza ese evento en vez de crear uno duplicado (confirmado en vivo forzando un registro real a `"pendiente"` y viendo que el `google_event_id` no cambió después del reintento).
- **`app/api/cron/diario/route.ts`**: se agregó una llamada más, todos los días (mismo cron único de las 3am ARG que ya corre comunicaciones programadas / limpieza semanal / cobros mensuales — límite de 2 crons/1 vez por día del plan Hobby de Vercel, ver incidente documentado más arriba).
- Probado en vivo: la ejecución real no encontró nada pendiente (ya se habían arreglado los 6 a mano); una prueba forzada (marcar un registro real como `"pendiente"` temporalmente) confirmó que el reintento lo vuelve a dejar `"sincronizado"` sin duplicar el evento en Google. También se confirmó que el endpoint rechaza pedidos sin el `CRON_SECRET` correcto (401).

## 3. Pendiente
- Mismo hallazgo de la sesión del 27/7 sigue sin resolver: hay reuniones que existen **solo en Google Calendar** y no en la plataforma (CasaTalentos semanal, Mentoría Tato Fuentes, entre otras) — el reintento nuevo no las toca, porque no son un problema de sincronización fallida sino de que nunca se cargaron desde la plataforma. Sigue pendiente migrarlas.
