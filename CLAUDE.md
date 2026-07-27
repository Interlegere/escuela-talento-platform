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
- **Confirmar en Vercel** que `GOOGLE_CALENDAR_OWNER_EMAIL` ya esté actualizado a `nicolasbusico@entheosescuela.com` en producción (se cambió solo en `.env.local` local).
- Revisar y migrar a la plataforma las series recurrentes que hoy solo existen en Google Calendar (CasaTalentos semanal, varias mentorías) — usar el botón nuevo de `/agenda` para ir chequeando.
- Mismo pendiente de la sesión anterior: series de Mentorías que se quedaron sin ocurrencias futuras generadas (Ana Felicia Payares Galvis, Lucas Britos, Verónica Saracho, Agostina Rimoldi, y ahora confirmado también Alex Bohorquez).
