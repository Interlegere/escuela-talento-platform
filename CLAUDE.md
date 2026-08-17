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

---

# Sesión de trabajo 2026-08-04 (continuación 2) — Invitar al participante como asistente del evento de Google Calendar (BLOQUEADO por Google Workspace)

## 1. Pedido
Nicolás pidió que cada evento agendado desde Entheos no solo quede en su propio Google Calendar, sino que también se agregue a la agenda del participante (sea que use Google, Outlook, u otro).

## 2. Diseño (correcto, implementado, pero sin efecto todavía — ver bloqueo abajo)
La solución estándar para esto **no requiere integrar Outlook ni ningún otro proveedor por separado**: agregando al participante como `attendee` (invitado) del evento de Google Calendar, Google le manda automáticamente una invitación por mail con adjunto `.ics` — eso lo entienden nativamente Outlook, Apple Calendar, Yahoo, y cualquier cliente de calendario, no hace falta que el participante tenga Gmail. Si además tiene cuenta de Google, el evento le aparece directo en su Google Calendar (con RSVP pendiente) sin que tenga que hacer nada.

Se agregó `attendees: [{ email, displayName }]` (con el `participante_email`/`participante_nombre` ya guardado en `disponibilidades`/`reservas`) y `sendUpdates: "all"` (para que Google efectivamente mande el mail de invitación) en los 3 lugares donde se crea/actualiza un evento:
- `lib/google-calendar.ts` → `sincronizarDisponibilidadConGoogle` (encuentros 1 a 1 cargados por el admin).
- `lib/google-calendar.ts` → `crearEventoGoogleDesdeReserva` (reservas que hace el propio participante desde `/agenda`).
- `app/api/google/sync-serie/route.ts` → `sincronizarDisponibilidad` (series recurrentes, ej. Mentoría semanal).

No se tocó la sincronización de las reuniones grupales (CasaTalentos semanal, Conectando Sentidos) — esas no tienen un único `participante_email` en `disponibilidades` (son para todo el grupo), invitar a un grupo grande como asistentes formales de un evento es una decisión de producto aparte (expone los emails de todos entre sí en la invitación) que no se tomó sin consultar.

## 3. Bloqueo real encontrado al probar en vivo
Se probó de punta a punta (disponibilidad de prueba descartable + llamada real a la API de Google + lectura del evento creado + limpieza total) y también con una llamada mínima directa a la API de Google sin pasar por el código del proyecto, para descartar un bug propio. **En ambos casos, Google acepta la petición (200 OK, evento creado con Meet) pero devuelve el evento con el `attendee` externo silenciosamente eliminado** — solo queda el organizador (`nicolasbusico@entheosescuela.com`). No es un error de la plataforma: el mismo comportamiento ocurre con una llamada cruda a la API, con el token OAuth que ya tenía todos los permisos necesarios (`scope: https://www.googleapis.com/auth/calendar`).

Esto es consistente con una restricción a **nivel de cuenta/dominio de Google Workspace** (`entheosescuela.com`) sobre invitar invitados externos a eventos de Calendar — es una configuración del lado de Google, no algo que se pueda arreglar escribiendo más código. No tengo forma de confirmar el nombre exacto del control en el admin console de Workspace desde acá (la interfaz de Google cambia con el tiempo y no tengo acceso a esa cuenta), así que queda pendiente que Nicolás (o quien administre el Workspace) revise configuración de Calendar relacionada con invitados externos, o consulte directamente con soporte de Google Workspace describiendo el síntoma exacto: *"la API de Calendar crea el evento correctamente pero elimina en silencio a los invitados externos al dominio"*.

## 4. Estado
El código quedó escrito y probado (typecheck + lint limpios, probado en vivo con limpieza total de los eventos/registros de prueba) — **no se hizo commit todavía**, a la espera de que Nicolás revise el lado de Google Workspace. En cuanto se destrabe esa configuración, el código ya va a funcionar sin tocar nada más — no hace falta ningún cambio adicional de este lado.

---

# Sesión de trabajo 2026-08-09 → 2026-08-11 — Entusiasmento: reemplazo total de CasaTalentos (Fase 1 en curso)

## 1. Objetivo y origen
Nicolás pidió una "modificación radical" de CasaTalentos, confirmada luego como **reemplazo total** (no incremental). Nombre nuevo: **"Entusiasmento"** (provisorio). Slogan provisorio: **"Entrena y dale ritmo a tus resultados"**. Compartió el documento fundacional actualizado de ENTHEOS (`ENTHEOS_Documento_Fundacional_v0_5`, Google Doc) como contexto de origen — leído completo vía `WebFetch` (truco: la URL de "compartir" no es accesible sin login, pero `https://docs.google.com/document/d/{id}/export?format=txt` sí funciona para docs con acceso de lectura por link, redirige a un host `googleusercontent.com` que hay que volver a fetchear).

**Hallazgos clave del documento** (relevantes para todo el diseño):
- ENTHEOS organiza el trabajo en 3 momentos que se repiten en espiral: Diseño y Puesta a Punto → **Entrenamiento y Desarrollo** → Conexión y Presencia. "Entusiasmento" es la forma concreta de ese segundo momento (hoy CasaTalentos, "en revisión" según la Sección 9 del propio documento — el nombre "Entusiasmento" ya estaba como candidato ahí, no es una idea nueva de esta sesión).
- Principio central citado textual: *"Producir, mostrar y mejorar lo producido es lo que permite que el entusiasmo se sostenga por fuera del vínculo con quien enseña."*
- Decisión abierta #2 de la Sección 15 del documento — *"cómo activar el entusiasmo por entrenarse, no solo por los resultados"* — es exactamente la tensión que Nicolás planteó con sus propias palabras, y terminó resuelta con el cuestionario semilla de Coordenadas (ver punto 3).
- Vocabulario de marca a sostener: talento, entusiasmo, momento, transitar, proceso, espiral, vuelta, mejor versión, Lugar Propio, decisiones, apropiación, responsabilidad, entrenamiento, producción, crecimiento, escucha, orden de los sentidos, desafío, espacio, comunidad. A evitar: lenguaje de jerarquía (nivel/etapa/"graduarse"), "reencontrar el verdadero yo", "desbloquear el potencial", éxito como cima.
- Criterio de automatización de la Sección 12: *"se automatiza todo lo que rodea a la conversación, nunca la conversación"* — se automatiza agenda, recordatorios, formularios, cobro/alta, onboarding, seguimiento; no se automatiza ubicar el momento, decidir accesos, ni intervenciones clínicas/de mentoría. Este criterio terminó siendo el que definió el alcance del agente de IA (punto 4).

## 2. Decisiones de arquitectura (blast radius investigado antes de decidir)
Se lanzaron 3 agentes Explore en paralelo para relevar: (a) la implementación actual completa de CasaTalentos, (b) cuán hardcodeado está el string `"casatalentos"` en el resto del sistema, (c) infraestructura reutilizable de comunicaciones/cron/storage/IA.

- **Se mantiene `actividad_slug: "casatalentos"` en la base de datos** — solo cambia el nombre visible a "Entusiasmento". El slug está hardcodeado (sin capa de indirección) en 15+ archivos: `lib/authz.ts` (`ActivitySlug`, `activityPermissionMap`), el combo de facturación CasaTalentos+Conectando Sentidos en `lib/admin-activity-sync.ts`/`lib/payment-pricing.ts`, whitelists duplicadas de agenda en `lib/agenda-unificada.ts`/`lib/agenda-reconciliacion.ts`, `admin/usuarios`, `AppNav.tsx`, comunicaciones, consentimientos, HDR. Crear un slug nuevo hubiera obligado a tocar todos esos puntos y decidir qué pasa con el combo — se descartó por riesgo/beneficio.
- **La URL se mantiene `/casatalentos`** — mismo criterio, cero cambios en navegación/links existentes.
- **Las tablas viejas de CasaTalentos se archivan, no se borran ni se migran**: `casatalentos_videos`, `casatalentos_votos`, `casatalentos_comentarios`, `casatalentos_mensajes`, `casatalentos_referentes_semanales` y el bucket `casatalentos-videos` quedan como registro histórico — decisión explícita de Nicolás ("el historial de CT lo archivamos... por si lo necesito en algún momento").
- **El "Dispositivo CasaTalentos" viejo (ranking/videos/votación/evaluación) no se retira todavía** — Nicolás dijo explícitamente que va a seguir usando la versión anterior mientras tanto. Estrategia elegida: **aditiva primero, retiro después** — se agregó la sección nueva de Coordenadas/Pitch sin tocar ni una línea del bloque viejo, que sigue 100% funcional debajo. El retiro del dispositivo viejo queda para una fase posterior, una vez que lo nuevo esté validado en uso real.
- **Primera integración de IA generativa del proyecto** (todavía no implementada, ver Pendiente) — no hay SDK previo, se va a armar `lib/ai.ts` con `fetch` directo a la API de Anthropic (mismo patrón hand-rolled que Resend/MercadoPago), modelo Haiku 4.5 por costo.

## 3. Diseño de producto (definido en conversación, iterativo)
Dos espacios que coexisten:
- **Personal**: **Coordenadas** (qué, para qué, problema/solución, resultado semanal/mensual/trimestral/anual, habilidad a desarrollar, qué te entusiasma — cuestionario semilla ya probado en vivo con un participante real, caso CreArté/Festival de Experiencias) + **Pitch** (carta de presentación en video/imagen, **siempre visible**, se actualiza in-place, nunca es una lista histórica) + **Producciones** categorizadas en Producto / Servicio / Institucional / Comunicación / Administración, cada una con **visibilidad on/off decidida por el participante** (default: oculta, se muestra cuando quiere recibir aportes).
- **CoFruto** (nombre provisorio — neologismo Coworking + disfrute + fruto, "con tinte de entrenamiento"): la "mesa en común", se arma automáticamente con la unión de todo lo que cada participante hizo visible. Se puede visitar a otros y dejar aportes/contactos. Admin ve siempre todo, sin importar la visibilidad marcada.
- Pensado para admitir talentos heterogéneos (no solo "emprendedores" — un deportista o un músico tienen que sentirse igual de bien representados).

## 4. El agente de IA — alcance y reglas (definidas por Nicolás, textuales)
Presupuesto confirmado: **hasta ~US$5/mes** (rechazó explícitamente un escenario de ~US$100/mes). Dos funciones, nunca conversa libremente con el participante:
1. **Recordatorio semanal por mail** (lunes): tareas, fechas de resultados, evaluaciones; ayuda a ordenar/planificar haciendo **preguntas** en vez de dar respuestas (ejemplo dado: *"¿dónde podrías trabajar en tu espacio lo que te falta hacer?"`); cierra/abre con la frase del **oráculo del día** — hallazgo en el código: ya existe `FRASES_ORACULO` en `app/campus/page.tsx` (una frase por día, elegida determinísticamente por fecha+email), se reutiliza tal cual, no hace falta inventar contenido nuevo.
2. **Diagnóstico de uso para Nicolás**: decidido como **panel on-demand en admin** (se genera solo cuando él entra a verlo, más barato que un digest forzado) **+ un mail resumen semanal** con sugerencias de mejora de una semana a la otra.

**Referentes (reglas que el agente tiene que sostener), dictadas textualmente por Nicolás**:
- No resolver lo que el participante tiene que resolver por sí mismo (metáfora: enseñar a cazar, no cazar el alimento).
- Si hay dudas reales, derivarlas a Nicolás — el agente no las contesta, así la persona va aprendiendo.
- Hacer recordatorios de tareas, fechas de resultados, evaluaciones.
- Ayudar a ordenar y planificar ofreciendo preguntas, nunca respuestas.
- Traer la frase del oráculo del campus.
- Nunca reemplaza el vínculo humano ni el rol de Nicolás — esto "no se negocia".

Canal: **mail únicamente por ahora**. WhatsApp evaluado y pospuesto (requiere WhatsApp Business API, verificación de negocio, plantillas pre-aprobadas por Meta, y un costo por conversación que el mail no tiene). El pedido de Nicolás de que "una respuesta al mail se plasme en la app" quedó marcado como bloqueado por la misma limitación de Resend documentada en la sesión anterior (plan actual = 1 dominio, agregar el de recepción pide upgrade a Resend Pro US$20/mes) — no resuelto, a definir cuándo se retoma.

## 5. Qué se construyó y probó en esta fase (commit pendiente — falta el rediseño visual antes de cerrar el paquete)
- **`sql/2026-08-10_entusiasmento.sql`** (corrido por Nicolás en Supabase): tablas `entusiasmo_proyectos` (1 fila por participante — coordenadas + campos de pitch), `entusiasmo_producciones` (categoría/tipo/visible, FK a proyecto — **todavía no tiene endpoints ni UI**, solo el schema), `entusiasmo_aportes` (ídem, sin endpoints todavía). RLS habilitado sin policies (mismo patrón deny-by-default del resto del proyecto).
- **`app/api/entusiasmo/proyecto/route.ts`** (GET/PUT): coordenadas propias, o de cualquiera si sos admin (`casatalentos.admin`). Reutiliza `requireActivityAccess("casatalentos", ...)` — mismo gate de acceso que todo CasaTalentos, sin tocar `authz.ts`.
- **`app/api/entusiasmo/pitch/preparar-upload/route.ts`** + **`.../pitch/confirmar/route.ts`**: mismo patrón de signed-upload-URL que ya usa `casatalentos-videos`/`espacios-archivos`, bucket nuevo `entusiasmo-producciones` **auto-creado por código** (no hizo falta que Nicolás lo cree a mano en Supabase — probado en vivo, el bucket se creó solo en el primer POST).
- **`app/casatalentos/page.tsx`**: nueva sección "Entusiasmento — Coordenadas y Pitch" agregada **antes** del bloque "Dispositivo CasaTalentos" (que sigue intacto, sin tocar). Reutiliza `GrabadorVideo.tsx` tal cual para el pitch. Título/eyebrow/subtítulo/chips del hero actualizados a "Entusiasmento" en los 3 estados (cargando / sin sesión / normal). También actualizado: `components/AppNav.tsx` (label del link, sin tocar el href `/casatalentos`) y `app/campus/page.tsx` (card del dashboard y texto del recordatorio). **No se tocaron todavía** las etiquetas menos visibles: combo de comunicaciones, consentimientos, HDR — queda para una pasada de renombrado más completa.
- Probado en vivo de punta a punta con Playwright + `admin@escuela.com`: guardar/leer coordenadas por API y verificado que aparecen ya cargadas en la página real; subida de pitch completa (preparar → subir al storage → confirmar), incluida la auto-creación del bucket; sin errores de consola. Limpieza total de fila y archivo de prueba al final. `typecheck`/`lint` limpios (los 4 warnings que aparecen en `casatalentos/page.tsx` son preexistentes, no relacionados).

## 6. Diseño visual/UX — delegado, en curso
Nicolás pidió explícitamente **nada de solapas**, un menú "dinámico, amable, simple", y que la experiencia se sienta como un coworking real (compartir espacio, libertad de elegir qué mostrar). Se armó un prompt completo y autocontenido (identidad, vocabulario de marca, estructura de espacios, reglas del agente, paleta actual del proyecto — fondo `#f4ecde`, acento `#cf9130`) para que Nicolás se lo lleve a otra conversación de Claude y traiga de vuelta una dirección de arquitectura de navegación + metáforas visuales — publicado como Artifact. Pendiente: Nicolás trae la devolución, se decide si el resto de la construcción (Producciones, CoFruto, agente) espera ese diseño o avanza en paralelo con estilos genéricos y se re-skinea después.

## 7. Pendiente (explícitamente fuera de esta entrega)
- **Producciones** (endpoints + UI, con toggle de visibilidad por ítem) y **CoFruto** (vista agregada de todo lo visible + aportes) — schema ya existe, falta todo el resto.
- **Agente de IA**: `lib/ai.ts` (primera integración LLM del proyecto), endpoint de recordatorio semanal enganchado al cron diario (`app/api/cron/diario/route.ts`, patrón `if (diaSemana === 1)`), endpoint de diagnóstico on-demand para admin, refactor del shell de mail HTML (hoy duplicado en 3 lugares: `crearHtmlRecordatorioPagoEntheos`, `crearHtmlRespuestaEntheos`, y el inline de `lib/mailing.ts` — conviene unificar antes de sumar una cuarta copia).
- Rediseño visual completo (esperando la devolución del prompt de diseño).
- Pasada de renombrado completa CasaTalentos→Entusiasmento en comunicaciones/consentimientos/HDR.
- Retiro del "Dispositivo CasaTalentos" viejo, cuando Nicolás confirme que ya no lo necesita en paralelo.
- Captura de respuestas de mail dentro de la app (bloqueado por Resend, ver sesión anterior).
- Nada de esto se pusheó todavía — se decidió esperar a tener también la dirección de diseño antes de cerrar y subir este paquete a `main`.

---

# Sesión de trabajo 2026-08-11 — Diseño de Entusiasmento (Fase 0: bug de seguridad + Fase A: "Mi espacio")

## 1. Bug de seguridad encontrado antes de construir nada (ya corregido)
Nicolás recibió de otra conversación de Claude una dirección de diseño concreta para Entusiasmento (2 destinos "Mi espacio"/"CoFruto", producciones como filtros no como rutas, visibilidad opt-in por ítem, paleta intacta) y, al revisarla contra el plan de implementación, **encontró y verificó directo contra producción** que el bucket `entusiasmo-producciones` (creado en la sesión anterior) había quedado `public: true` — copiado por error del patrón de `espacios-archivos` en vez de `casatalentos-videos` (que siempre fue `public: false`). Esto rompía la premisa central del diseño: un archivo marcado "solo lo ves vos" igual sería alcanzable por URL directa sin autenticación.

**Verificado independientemente y confirmado**: el bucket estaba vacío y `entusiasmo_proyectos` no tenía filas — el único archivo que existió ahí fue un PNG de prueba de la sesión anterior, subido y borrado en el mismo test automatizado. **Ningún dato real quedó expuesto.**

**Corregido**: `entusiasmo-producciones` pasado a `public: false` en producción (`storage.updateBucket`), y `asegurarBucketEntusiasmo` (`app/api/entusiasmo/pitch/preparar-upload/route.ts`) corregido para crear/mantener el bucket privado a futuro, en vez de forzarlo público. Las lecturas del pitch dejaron de usar `getPublicUrl` (client-side, no sirve contra bucket privado) y pasaron a **signed URLs generadas server-side** (mismo patrón que ya usa `app/api/casatalentos/listar/route.ts` con `createSignedUrls`, 1 hora de validez): `GET /api/entusiasmo/proyecto` devuelve `pitchSignedUrl`, `POST /api/entusiasmo/pitch/confirmar` devuelve `pitchUrl` firmado.

**Hallazgo relacionado, no corregido todavía**: `espacios-archivos` (adjuntos de Mentorías/Terapia en `EspacioAcompanamiento.tsx`) tiene el mismo patrón — bucket público, sin signed URL en ningún lado del código. Es contenido potencialmente más sensible (adjuntos de sesiones de mentoría/terapia). A diferencia de `entusiasmo-producciones`, **este bucket está en uso activo real** — pasarlo a privado rompe la visualización de adjuntos existentes a menos que se le sume lectura por signed URL en `EspacioAcompanamiento.tsx`, que es un cambio de mayor alcance y en un flujo distinto. Queda marcado como pendiente propio, fuera del alcance de esta sesión — evaluar cuándo se retoma.

## 2. Política de retención del pitch (decidida, implementada)
A diferencia de `casatalentos_videos` (se borran a los 28 días vía cron `limpiar-antiguos`), **el pitch no es descartable** — es la carta de presentación vigente de cada participante. Lo que hay que evitar es acumular versiones viejas cuando alguien regraba. Implementado dentro de `POST /api/entusiasmo/pitch/confirmar`: antes de guardar el `storage_path` nuevo, si ya existía uno distinto para esa persona, se borra el archivo viejo del bucket en el mismo request (sin cron nuevo). Producciones (Fase B, todavía sin construir) va a necesitar su propia política de retención cuando se construya — no decidida todavía, no aplica lo mismo automáticamente.

## 3. Gate temporal de la sección nueva — IMPORTANTE, sacar en su momento
La sección "Entusiasmento" (Mi espacio / CoFruto) hoy está **visible solo para admin** (`{esAdmin && (...)}` alrededor de todo el bloque en `app/casatalentos/page.tsx`) — los participantes reales siguen viendo únicamente el "Dispositivo CasaTalentos" de siempre, sin ningún cambio visible para ellos. Es a propósito: evita que participantes reales (Agustina, Verónica, Cristian, Florencia, María Gabriela, entre otros) entren a `/casatalentos` esta semana y encuentren un módulo a medio construir. **Este gate es temporal — sacarlo cuando la Fase C (CoFruto real, con producciones visibles de verdad) esté lista y Nicolás confirme que se puede abrir a todos.** Hay un comentario en el código en el mismo lugar (`app/casatalentos/page.tsx`, justo antes del `{esAdmin &&`) que apunta a esta sección de CLAUDE.md — no debería perderse de vista.

## 4. Diseño aprobado — decisiones estructurales (no se re-discuten en fases siguientes)
- Navegación de **2 destinos únicos**: "Mi espacio" y "CoFruto" — nunca solapas horizontales en ningún nivel del módulo.
- Las 5 categorías de producciones (Producto/Servicio/Institucional/Comunicación/Administración) van a ser **píldoras de filtro sobre una sola lista** (Fase B), no rutas ni tabs separadas — un participante nuevo con 1-2 producciones no debe ver "habitaciones vacías".
- Paleta intacta (`#f4ecde` crema, `#cf9130` dorado); el dorado se reserva para el marco del pitch y el estado "visible en la mesa" — sin quiebre visual, la diferencia es de organización del espacio.
- Copy: "N todavía sin definir" (nunca "incompleto"/"te falta"), "mostrar"/"llevar a la mesa" (nunca "publicar"), sin % ni barra de progreso hacia 100, sin comparación entre participantes.
- "Tu ritmo" (indicador de actividad) se saca de la Fase A por decisión de Nicolás: con solo coordenadas+pitch, alguien nuevo completa todo en un día y ve casi todas las barras vacías — comunica lo contrario de lo que busca el diseño ("no hiciste nada" en vez de "así viene tu ritmo"). Se implementa en Fase B cuando Producciones dé señal real, y no se muestra hasta que haya actividad en al menos 2 semanas distintas (un módulo ausente no dice nada; un módulo vacío dice algo malo).

## 5. Qué se construyó en esta fase (Fase A recortada, sin "Tu ritmo") — pendiente de probar en vivo y confirmar antes de commit
- `app/casatalentos/page.tsx`: la sección "Entusiasmento" se reestructuró en el shell de 2 destinos (`destinoEntusiasmo`, persistido con `usePersistentState`), Pitch rediseñado (tarjeta con marco dorado, "Volver a grabarlo"/"Guardar pitch" según corresponda, lectura por signed URL), Coordenadas rediseñada como fila plegable (`coordenadasAbiertas`, colapsada por defecto, "{N} todavía sin definir" contando los 9 campos vacíos vía `CAMPOS_COORDENADAS`), "Tu ritmo" como placeholder reservado sin lógica, destino "CoFruto" con estado vacío. Gate `esAdmin` alrededor de todo el bloque (ver punto 3).
- `app/api/entusiasmo/proyecto/route.ts` y `app/api/entusiasmo/pitch/confirmar/route.ts`: signed URLs + borrado de versión anterior del pitch (ver puntos 1 y 2).

## 6. Pendiente
- Probar en vivo (bucket privado confirmado, signed URL funcional, URL pública vieja del mismo archivo devuelve 403, retención borra el archivo anterior al regrabar, copy de coordenadas, persistencia de destino) y limpiar mostrando explícitamente que el bucket queda vacío al final — recién ahí se hace commit.
- Fase B: Producciones (filtros por categoría + visibilidad opt-in con ícono ojo/candado + copy "mostrar"/"llevar a la mesa") + "Tu ritmo" real.
- Fase C: CoFruto real (lista vertical de "puestos", uno por participante).
- Fase D: agente de IA. Fase E: relabeling completo + retiro del Dispositivo viejo.
- Evaluar por separado la privacidad de `espacios-archivos` (punto 1).

---

# Sesión de trabajo 2026-08-11 (continuación) — Fase A2: romper solapas, retirar lo viejo, aportes de admin

## 1. Objetivo
Después de probar la Fase A, Nicolás pidió un salto grande: "sigue siendo un espacio académico aburrido". Pidió, todo junto: que Entusiasmento deje de vivir en un acordeón y sea la pantalla principal de `/casatalentos`; retirar de una vez el "Dispositivo CasaTalentos" viejo (antes se mantenía en paralelo a propósito — ahora confirmado explícitamente que se reemplaza); sacar "Hoja de Ruta" de esta página; renombrar "Mensajes" a "Valoraciones y agradecimientos"; achicar "Reunión semanal" a un botón en una esquina; eliminar "Grabaciones y biblioteca"; mudar "Gestión de referentes" al espacio de admin (que pasa a ser el mismo que ve el participante, con funciones extra); un mecanismo nuevo de aportes de admin sobre el trabajo de cualquier participante; y una pasada de personalidad visual rompiendo la homogeneidad de tarjetas iguales.

Dos decisiones confirmadas por Nicolás antes de tocar código (preguntadas directamente porque afectaban a participantes reales):
- **Entusiasmento se abre a todos los participantes ya** (no solo admin) — consecuencia directa de que el Dispositivo viejo desaparece y no queda nada más que mostrarles.
- **"Valoraciones y agradecimientos" mantiene los hilos con respuestas** (no se aplana a muro simple), solo cambia nombre y propósito declarado.

## 2. Hallazgo: ya existía un sistema de "aportes" genérico (HDR), no se reusó
`lib/hdr.ts` tiene un sistema completo de Hoja de Ruta con coordenadas/respuestas/aportes (`crearAporteHDR`, tabla `hdr_aportes`), pero con un modelo de datos distinto (coordenadas configurables por admin, título/descripción, global o individual) al de Entusiasmento (9 campos fijos). Confirmado por grep que **solo `app/casatalentos/page.tsx` lo consumía** — se pudo sacar de esta página sin afectar nada más. El sistema HDR en sí (tablas, componentes, endpoints `/api/hdr/*`) **no se borró del código**, solo dejó de renderizarse acá — sigue disponible si en el futuro se necesita para otra actividad.

Para "aportes de admin sobre el trabajo del participante" se reutilizó la tabla `entusiasmo_aportes` (creada en la Fase 0, sin uso hasta ahora) en vez de HDR — mismo modelo sirve para esto y para los aportes entre participantes que se van a necesitar en CoFruto (Fase C), sin duplicar sistemas.

## 3. Qué se hizo
- **`app/casatalentos/page.tsx`** (el más tocado, con diferencia):
  - Se sacó el acordeón/gate `esAdmin &&` que envolvía Entusiasmento — ahora es contenido directo, visible para todos, arriba de la página (justo después del hero).
  - Se eliminó el bloque completo "Dispositivo CasaTalentos" (ranking/videos/votación/evaluación, ~700 líneas de JSX) y los handlers que solo lo alimentaban (`handleArchivo`, `handleCargarVideo`, `handleElegir`, `handleComentar`, `handleEliminarVideoParticipante`, `handleLimpiarVideos`, ~330 líneas). Las tablas viejas (`casatalentos_videos`, etc.) siguen archivadas en la base, sin tocar.
  - Se eliminó `<HDRActividad>` y su import.
  - "Mensajes" → "Valoraciones y agradecimientos": cambió `tituloMensajes`, el copy del formulario ("Nueva valoración o agradecimiento", placeholder, botón "Compartir"), y el estado vacío. La mecánica de hilos/respuestas no cambió.
  - Las dos apariciones de "Reunión semanal" (`SeccionDesplegable` + `<AgendaActividad>`, una para admin y otra para participante) se reemplazaron por **un solo botón compacto** arriba de la página, junto al hero: fecha/hora del próximo encuentro + `ConsentimientoMeetButton` (componente ya existente, reutilizado tal cual — ya resolvía el gate de términos y condiciones antes de entrar al Meet, no hizo falta escribir nada nuevo para eso). Nuevo estado `proximoEncuentro`, fetch propio a `/api/agenda/por-actividad` (mismo endpoint que ya usaba `AgendaActividad`, sin tocarlo).
  - `<CasaTalentosAdminPanel>` se movió de su posición original (arriba de la página, siempre visible para admin) a **dentro de "Mi espacio", solo cuando `esAdmin`** — ahora el espacio de admin es el mismo que ve el participante, con un bloque extra.
  - Coordenadas pasó a tener identidad visual propia (tono celeste, ícono de brújula 🧭); Pitch se reforzó (marco dorado más grueso, sombra, ícono ✦); "Tu ritmo" quedó como placeholder con forma de píldora punteada; "Valoraciones y agradecimientos" con tono rosa/rojo (♥, 💌); el selector Mi espacio/CoFruto ahora tiene íconos (🪴/🧺) y color distinto por destino (dorado vs. verde esmeralda).
- **`components/casatalentos/CasaTalentosAdminPanel.tsx`**: se sacó por completo la sección "Grabaciones y biblioteca" (formulario, CRUD, `BibliotecaGrabaciones`, ~400 líneas incluyendo tipos/estado/handlers/fetch combinado) — Nicolás va a armar un espacio de suscripción aparte más adelante. Quedó solo "Gestión de referentes" (general + semanal), que es lo que ahora vive dentro de "Mi espacio" del admin.
- **`app/api/entusiasmo/aportes/route.ts`** (nuevo): GET (propios, o de cualquiera si sos admin) y POST (por ahora **solo admin** puede crear aportes — dejado explícito en el endpoint, participantes-a-participantes queda para cuando exista CoFruto). Si la persona destinataria todavía no tiene fila en `entusiasmo_proyectos`, se le crea una vacía automáticamente para poder asociarle el aporte.
- **UI de aportes**: en "Mi espacio", los aportes recibidos se muestran como notas/burbujas de color (rotando entre 4 colores) debajo del Pitch. En el bloque admin, un mini-formulario (email + texto) para dejarle un aporte a cualquier participante.

## 4. Verificado en vivo (Playwright + `admin@escuela.com`, sin errores de consola)
Entusiasmento visible sin necesitar abrir ningún acordeón; "Dispositivo CasaTalentos"/"Hoja de Ruta"/"Grabaciones y biblioteca" ausentes; "Valoraciones y agradecimientos" presente y funcional; "Gestión de referentes" visible dentro de Mi espacio solo para admin; envío de un aporte de prueba a un participante ficticio confirmado en base (fila creada en `entusiasmo_proyectos`, aporte guardado en `entusiasmo_aportes`, recuperable por `GET /api/entusiasmo/aportes?email=...`), limpieza total confirmada al final. `typecheck` limpio.

## 5. Pendiente — código muerto identificado, no removido en esta pasada
Además de los handlers del Dispositivo (ya eliminados), quedan **~45 warnings de lint** por variables/`useMemo` que solo alimentaban la UI vieja de ranking/votación/comentarios-por-video (ej. `resumenSemana`, `eleccionesPorParticipante`, `resultadosVotacionVisibles`, `comentariosPorVideo`, `referenteSemanalActual`, `resumenAdmin`, entre otros — todos en `app/casatalentos/page.tsx`, ninguno afecta funcionalidad, todos son cálculos derivados sin consumidor en el JSX actual). No se tocaron en esta entrega por alcance/tiempo — es una limpieza de bajo riesgo pero mecánica, pendiente para una pasada dedicada.

## 6. Pendiente general (sin cambios respecto a la Fase A)
- Fase B: Producciones reales (hoy solo hay schema) — esto también habilita "Tu ritmo" real.
- Fase C: CoFruto real.
- Fase D: agente de IA (recordatorios semanales, diagnóstico admin).
- Relabeling menor pendiente (consentimientos, HDR ya no aplica, comunicaciones ya decía "CasaTalentos" en el selector de actividad — no se tocó, bajo impacto).
- Evaluar por separado la privacidad de `espacios-archivos` (bucket público, mencionado en la sesión anterior).
- **No se hizo commit todavía** — a la espera de que Nicolás lo pruebe y confirme, mismo criterio que toda la iniciativa de Entusiasmento.

---

# Sesión de trabajo 2026-08-11 (continuación 2) — Fase A3a: Recursos en CoFruto, Valoraciones como cuadrito, Producciones, Tareas semanales

## 1. Objetivo
Después de probar la Fase A2, Nicolás pidió 5 cosas más de una: Recursos dentro de CoFruto; comentarios de admin anclados a un fragmento de texto en Coordenadas (estilo Google Docs, con popup); Valoraciones y agradecimientos como un cuadrito junto al botón de reunión semanal; un espacio de Producciones (imágenes/texto/audio) debajo de Coordenadas con visibilidad; y Tareas semanales para que luego el agente les haga seguimiento.

Dado que los comentarios anclados a texto son sustancialmente más complejos que el resto (hoy no existe forma de que admin vea el espacio de otro participante — el aporte de la Fase A2 era "a ciegas", solo con el email), se propuso y se acordó con Nicolás dividir en dos entregas: **Fase A3a** (esta, las 4 más simples) y **Fase A3b** (próxima, los comentarios anclados — con su propio diagnóstico).

## 2. Qué se hizo (Fase A3a)
- **Recursos dentro de CoFruto**: las dos secciones "Recursos" (admin y participante) se movieron de su lugar original (arriba de la página) a adentro del destino "CoFruto" — ya no son secciones aparte, aparecen debajo del cartel "🧺 CoFruto".
- **Valoraciones y agradecimientos como cuadrito**: se sacó de ser un acordeón en el medio del flujo y pasó a ser un botón compacto (mismo porte que el de "Reunión semanal", junto a él, debajo del hero) con un ícono 💌 que crece levemente según la cantidad de valoraciones (`mensajesGenerales.length`) y muestra el contador de no leídos — clickeable para abrir/cerrar el contenido completo (mismos hilos/respuestas de siempre, sin cambios en la lógica) en un panel con fondo rosado, ahí mismo.
- **Producciones**: tabla ya existía (Fase 0), se agregaron los endpoints (`app/api/entusiasmo/producciones/route.ts` GET/POST/PATCH/DELETE, `.../preparar-upload/route.ts` mismo patrón que el pitch, mismo bucket privado, ahora acepta `image/*` y `audio/*`) y la UI debajo de Coordenadas: elegís tipo (texto/imagen/audio), subís o escribís, y cada ítem tiene el toggle "👁️ En la mesa común" / "🔒 Solo lo ves vos". Sin categorías todavía (Producto/Servicio/etc. quedan para cuando se retome esa parte del diseño original). CoFruto todavía no muestra las producciones visibles de otros — eso es Fase C.
- **Tareas semanales**: tabla nueva `entusiasmo_tareas` (`sql/2026-08-12_entusiasmo_tareas.sql`, **pendiente que Nicolás la corra**), endpoint `app/api/entusiasmo/tareas/route.ts` (GET/POST/PATCH), UI debajo de Producciones — el participante escribe tareas y las tilda. El seguimiento automático del agente queda para la Fase D (no implementado, no hay agente todavía).

## 3. Verificado en vivo (lo que no depende de la tabla nueva)
Cuadrito de Valoraciones abre y cierra correctamente; Recursos visible dentro de CoFruto; producción de texto creada y verificada en base; producción de imagen probada **directo contra los endpoints** (preparar-upload → subida → confirmar, los 3 pasos con 200 y el registro correcto en base) — la prueba end-to-end vía UI en Playwright falló por un problema del script de prueba (el selector de `input[type="file"]` agarró el de Pitch en vez del de Producciones, porque hay más de un input de archivo en la página), no del código; toggle de visibilidad confirmado; limpieza total mostrada al final. Sin errores de consola. `typecheck`/`lint` limpios (mismos 45 warnings preexistentes del código muerto del Dispositivo, documentados en la sesión anterior, sin warnings nuevos).

## 4. Pendiente
- **Nicolás tiene que correr `sql/2026-08-12_entusiasmo_tareas.sql`** antes de poder probar Tareas semanales en vivo — es lo único que quedó sin verificar en esta entrega.
- Fase A3b: comentarios de admin anclados a texto en Coordenadas (selector de a quién ver + coordenadas en modo lectura + selección de texto + popup), reemplaza el formulario suelto de "Dejar un aporte" armado en la Fase A2.
- Sigue pendiente de fases anteriores: Fase C (CoFruto mostrando producciones visibles reales), Fase D (agente de IA, incluido el seguimiento de tareas semanales), limpieza de código muerto del Dispositivo viejo, privacidad de `espacios-archivos`.
- **No se hizo commit todavía.**

---

# Sesión de trabajo 2026-08-11 (continuación 3) — Ronda de feedback sobre la Fase A3a

## 1. Contexto
Nicolás probó la Fase A3a en vivo (con `entusiasmo_tareas` ya corrido) y dio una lista larga de feedback — mezcla de un bug real, ajustes visuales concretos, y pedidos grandes para fases futuras. Pidió explícitamente "ve anotando y considerando todo esto para los próximos cambios", así que se separó en dos grupos: lo que se corrigió ya (ajustes chicos y contenidos, más un bug real) y lo que queda documentado para más adelante (rediseños grandes).

## 2. Hallazgo importante: el cartel de consentimiento NO es un bug
Nicolás reportó que "la reunión semanal no dispara el cartel de consentimiento informado". Investigado: `ConsentimientoMeetButton` (componente ya existente, reutilizado tal cual desde la Fase A2) tiene esta línea explícita: `if (esAdmin || !actividadValida || !session?.user?.email) { abrirDestinoUnaVez(href); return }` — **el rol admin salta el consentimiento a propósito, en todo el proyecto**, no es algo nuevo de Entusiasmento. `"casatalentos"` sí está registrado como actividad de consentimiento en `lib/consentimientos.ts`. Si Nicolás estaba probando con una cuenta admin (como se hizo toda esta sesión), es el comportamiento esperado — no vieron el cartel porque son admin, no porque esté roto. **Pendiente confirmar con Nicolás**: si prueba con un usuario participante real sí debería aparecer; si igual no aparece ahí, eso sí sería un bug a investigar.

## 3. Qué se corrigió en esta ronda
- **Cartel grande (hero) simplificado**: ahora dice solo "Entusiasmento" con el subtítulo "Espacio para Plasmar" — se sacaron el eyebrow, la descripción larga y los chips (Talento/Entusiasmo/Producción/Propósito), y se unificó: ya no hay versión distinta para admin ("Admin Entusiasmento" desapareció).
- **Cuadrito de Valoraciones**: se sacó el corazón (♥ → ✦) y el tono rosa/afecto se reemplazó por dorado con brillo (`box-shadow` con glow dorado en el botón y en el panel expandido) — la metáfora pasa a ser "luz/valor" en vez de "afecto", como pidió.
- **Producciones**: ahora se ve el contenido real de lo subido, no solo el título — imágenes como miniatura, audio con reproductor, texto con el contenido completo. Esto requirió sumar `signedUrl` a la respuesta de `GET /api/entusiasmo/producciones` (mismo patrón de signed URLs de 1 hora que ya usa el pitch, bucket privado).
- **Tareas semanales**: probado en vivo end-to-end (crear, tildar completada) ahora que la tabla existe — funciona.

## 4. Incidente menor durante la prueba: hydration error transitorio (resuelto, no era del código)
Al probar, aparecieron errores de hidratación de React en la consola (`Hydration failed...`) apuntando exactamente al lugar donde se había sacado el `eyebrow` del hero. Se verificó que el código fuente ya estaba correcto (sin `eyebrow`) — era el **servidor de desarrollo sirviendo una versión en caché** de esa ruta, desincronizado después de varias ediciones seguidas al mismo archivo. Confirmado: tras reiniciar `npm run dev`, 0 errores en 3 recargas seguidas. No afecta producción (un build real compila una sola vez, no tiene este tipo de staleness) — se documenta solo por si vuelve a aparecer algo similar en una sesión futura con ediciones muy seguidas al mismo archivo grande.

## 5. Anotado para fases futuras (NO implementado todavía, a pedido explícito de Nicolás)
- **Pitch**: mantiene el formato/posición actual, pero Nicolás quiere un estilo más moderno tipo redes sociales (Instagram) — pendiente de diseño más concreto antes de construir.
- **Tu ritmo**: Nicolás no terminaba de entender cómo funciona (es normal, hoy es solo un placeholder reservado para la Fase B) pero confirmó que le gusta la metáfora musical — se mantiene esa dirección para cuando se construya de verdad.
- **Coordenadas — pregunta importante que Nicolás hizo y quedó respondida**: hoy "Mi espacio" muestra siempre los datos de quien está logueado (si sos admin, ves tus propias coordenadas, no las de un participante). Nicolás notó esto y preguntó si como admin debería poder ver las de cada persona — **la respuesta es sí, y es exactamente lo que la Fase A3b (comentarios anclados a texto) ya iba a necesitar construir** (un selector de a qué participante está viendo el admin). Aporte nuevo de Nicolás para esa fase: sugirió que **para el admin específicamente sí tendría sentido usar solapas** (una por participante, para cambiar entre ellos) — excepción puntual a la regla general de "nada de solapas", solo para este selector, a tener en cuenta cuando se diseñe la Fase A3b.
- **Tareas semanales — pedido grande para más adelante**: agregar fecha y hora por tarea, que los recordatorios del futuro agente se basen en esa configuración particular de cada tarea (no un horario genérico), y un dashboard de tareas para el participante. Esto es sustancialmente más grande que el CRUD simple de esta entrega — probablemente su propia fase, ligada a cuando se construya el agente (Fase D).
- **Aportes de admin**: confirmado por Nicolás que quedan igual por ahora, entendiendo que se reemplazan en la Fase A3b.

## 6. Pendiente
- Confirmar con Nicolás si probó el consentimiento como admin (esperado que no aparezca) o como participante (ahí sí sería bug real).
- Todo lo anotado en el punto 5, para cuando se retomen esas fases.
- **No se hizo commit todavía.**

---

# Sesión de trabajo 2026-08-11 (continuación 4) — Ronda de feedback 2: logo, bug real de micrófono, grabar audio, emoji

## 1. Qué se corrigió
- **Logo del hero**: se sacó `logoSrc="/casatalentos-logo.png"` (el logo viejo de CasaTalentos) del cartel de "Entusiasmento" — Nicolás va a subir uno nuevo. Sin `logoSrc`, `WorkspaceHero` cae en su logo genérico por defecto (Interlegere) mientras tanto.
- **Bug real encontrado y corregido**: la participante Cuchulain Mago reportó un error crudo de Next.js (`NotAllowedError: Permission denied`) al intentar dar permiso de micrófono. Investigado: **el manejo de este error ya existía** en `GrabadorVideo.tsx` (try/catch con mensaje amigable + fallback a subir archivo) — lo que pasaba es que el `console.error(...)` dentro de ese catch hace que **Next.js 16 en modo desarrollo muestre igual el overlay de error a pantalla completa**, aunque la app ya se haya recuperado sola — se ve como un crash sin serlo. Se cambió ese `console.error` a `console.warn` (que no dispara el overlay) y se mejoró el mensaje ("revisá los permisos del navegador... o subí un archivo ya grabado"). Confirmado en vivo con Playwright simulando **ambos casos** (permiso concedido y denegado, usando flags de fake-media-device de Chromium): con permiso funciona y graba; sin permiso muestra el mensaje amigable y **cero errores sin manejar en consola** — antes esto último no se había probado explícitamente.
- **Grabar audio en Producciones**: nuevo componente `components/casatalentos/GrabadorAudio.tsx` (grabación con `MediaRecorder`, mismo patrón de manejo de errores ya corregido) — en el formulario de Producciones, tipo "audio" ahora ofrece "🎙️ Grabar audio" además de subir un archivo. Probado en vivo: graba, detiene, muestra reproductor de preview.
- **Emoji de Valoraciones**: 💌 (carta con corazón) → ✉️ (sobre sin corazón) — la vez anterior solo se había sacado el símbolo "♥" de texto, pero el emoji en sí seguía teniendo corazón dibujado.

## 2. Verificado en vivo
Hero sin logo viejo; emoji sin corazón (✉️ presente, 💌 ausente); grabación de audio con permiso concedido (fake mic de Chromium) graba y muestra preview; grabación de audio con permiso denegado muestra el mensaje amigable sin ningún error de consola sin manejar. `typecheck`/`lint` limpios (mismos 45 warnings preexistentes, sin nuevos).

## 3. Pendiente
- Nicolás va a subir un logo nuevo para Entusiasmento — cuando lo tenga, agregarlo a `logoSrc` en el hero.
- Resto de lo anotado en la ronda de feedback anterior (Pitch estilo Instagram, Tu ritmo con metáfora musical, Fase A3b con selector de participante para admin, Tareas semanales con fecha/hora + recordatorios + dashboard).

---

# Sesión de trabajo 2026-08-11 (continuación 5) — Commit + gate de apertura a participantes antes del push

## 1. Commit hecho
Se commiteó todo lo de Entusiasmento (Fase 0 a la ronda de feedback 2) en un solo commit (`4a6bbcf`) — separado a propósito del fix de Google Calendar (invitados a eventos), que Nicolás pidió dejar afuera porque todavía tiene que terminar de configurar cosas del lado de Google Workspace. `AGENTS.md` (una corrección de reglas de CasaTalentos de una sesión bien anterior, sin relación) y todo lo de la landing page (trabajo propio de Nicolás, no tocado) también quedaron fuera del commit.

## 2. IMPORTANTE — gate agregado antes de pushear: Entusiasmento vuelve a estar oculto para participantes
Antes de preguntar si hacía push, Nicolás aclaró algo clave: aunque en la Fase A2 se había decidido abrir Entusiasmento a todos los participantes (porque el Dispositivo viejo ya no existía y no quedaba nada más que mostrarles), **no quiere que los participantes lo usen todavía** — recién cuando esté terminado. Como pushear a `main` dispara el deploy a producción automáticamente (sin ambiente intermedio), esto había que resolverlo antes de pushear, no después.

**Solución**: nuevo flag `ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES` (constante booleana, `app/casatalentos/page.tsx`, arriba del todo, `false` por defecto) — mismo patrón que ya se usó antes en el proyecto para este tipo de apagador (`RESERVA_NUEVA_SESION_TERAPIA_HABILITADA`, `BIBLIOTECA_GRABACIONES_HABILITADA`). Con el flag en `false`: admin sigue viendo todo el contenido de "Mi espacio"/"CoFruto" para seguir probando y cargando cosas; cualquier no-admin ve en cambio un cartel simple ("🌱 Entusiasmento se está terminando de armar... te avisamos apenas esté listo") en el mismo lugar. **Cuando esté listo para abrir, cambiar ese único `false` a `true`.**

Alcance del gate: cubre específicamente Coordenadas/Pitch/Producciones/Tareas semanales/CoFruto (lo genuinamente nuevo e incompleto). El botón de "Reunión semanal" y el cuadrito de "Valoraciones y agradecimientos" (que ya usaban los participantes antes, solo renombrados/reubicados) siguen visibles para todos — no tenía sentido esconder algo que ya conocían y usaban.

## 3. Verificado en vivo
`admin@escuela.com`: sigue viendo "Mi espacio" completo, sin el cartel de "en construcción". `colaborador@escuela.com` (rol no-admin): no ve "Mi espacio" — aunque en este caso puntual la prueba no llegó a mostrar el cartel nuevo porque esa cuenta de prueba no tiene inscripción activa a CasaTalentos y quedó atajada antes, por el mensaje de "Acceso no habilitado" que ya existía (nada que ver con este cambio). La lógica en sí (`esAdmin || ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES`) es un simple booleano verificado por TypeScript — no se armó un participante de prueba con inscripción/pago reales solo para confirmar el cartel exacto, para no tocar datos de facturación de producción por una verificación de bajo riesgo. Si Nicolás quiere ver el cartel real, puede probarlo con cualquier participante activo real (va a ver el cartel de "en construcción" en vez de Mi espacio, dado que el flag sigue en `false`).

## 4. Pendiente
- Cuando Entusiasmento esté listo para todos: cambiar `ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES` a `true` en `app/casatalentos/page.tsx`.
- Resto de lo pendiente de rondas anteriores, sin cambios.

## 5. Excepción agregada: Cuchulain Mago puede ver Entusiasmento como participante
Nicolás pidió que Cuchulain Mago (el participante que reportó el bug de micrófono) pueda seguir probando Entusiasmento como participante real, aunque el resto siga viendo el cartel de "en construcción". Se agregó `ENTUSIASMENTO_BETA_EMAILS` (array de emails, hoy solo `consultasbpe@gmail.com` — confirmado por email real en `usuarios_plataforma`, no un supuesto) — el gate ahora es `esAdmin || ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES || ENTUSIASMENTO_BETA_EMAILS.includes(storageEmail)`. Confirmado que Cuchulain tiene inscripción activa a `casatalentos` (y a mentorías/terapia/conectando-sentidos), así que va a llegar hasta esta pantalla sin problema. **No se pudo probar el login real como Cuchulain** (no tengo su contraseña) — la verificación quedó a nivel de lógica (booleano simple, chequeado por TypeScript) y de datos (inscripción activa confirmada en la base). Sacar `consultasbpe@gmail.com` de esa lista cuando ya no haga falta la excepción puntual.

---

# Sesión de trabajo 2026-08-11 (continuación 6) — Fase A3b: comentarios de admin anclados a texto en Coordenadas

## 1. Objetivo
Reemplazar el formulario suelto de "Dejar un aporte" (email + texto libre, sin ver el contenido de la persona, de la Fase A2) por un flujo estilo Google Docs: el admin puede entrar al espacio de un participante puntual, seleccionar un fragmento de texto dentro de sus Coordenadas, y dejar ahí una nota anclada — visible como un ícono que se abre al pasar el mouse, no como texto permanentemente remarcado. Plan aprobado antes de escribir código (`golden-sparking-pebble.md`).

## 2. Qué se hizo
- **`sql/2026-08-13_entusiasmo_aportes_ancla.sql`** (corrido por Nicolás en Supabase): agrega `campo`/`fragmento` (ambas nullable) a `entusiasmo_aportes`. Los aportes generales viejos (sin campo/fragmento) siguen funcionando igual, sin romper nada.
- **`app/api/entusiasmo/aportes/route.ts`**: el POST ahora acepta `campo`/`fragmento` opcionales y los persiste.
- **Selector de participante (solo admin, solapas)**: nueva fila arriba de "Mi espacio"/"CoFruto" — "Yo" + una solapa por cada participante activo de Entusiasmento (reutiliza el fetch que ya existía, `cargarParticipantesActivos`, sin endpoint nuevo). Nuevo estado `viendoEmail`; al cambiar de solapa se re-consultan proyecto/aportes/producciones/tareas de esa persona (`?email=` en los GET, que ya lo soportaban desde que se escribieron).
- **Coordenadas en modo lectura** (admin viendo a otro): texto seleccionable con el mouse; al seleccionar aparece "💬 Comentar selección", que abre un cuadro para escribir la nota y guardarla anclada a ese fragmento exacto.
- **Comentarios ya guardados**: no quedan remarcados de forma permanente — aparece un ícono 💬 chiquito junto al fragmento comentado, y la nota (contenido, autor, fecha) se abre pasando el mouse por encima del ícono (o tocándolo, para que funcione en celular). Decisión tomada con Nicolás vía pregunta directa después de ver el primer diseño (remarcado amarillo permanente) — no le gustó, prefirió hover-sobre-ícono.
- **Coordenadas propias** (participante, o admin en "Yo"): cada campo sigue siendo editable como siempre, y ahora muestra debajo los comentarios que le dejaron ahí (con el fragmento citado).
- **Se sacó "Resultado semanal"** de Coordenadas (campo y conteo de "sin definir") — a pedido de Nicolás: sin fecha asociada ahí, lo semanal se termina resolviendo con Tareas semanales, que sí tiene ese propósito.
- **Se sacó el formulario viejo** "Dejar un aporte" (email + textarea suelto).
- **Se ocultaron las acciones de escritura al ver a otro participante** (grabar/guardar pitch, agregar producción, agregar tarea) — esos POST no llevan `participanteEmail` desde el cliente, así que si quedaban visibles se habrían guardado por error a nombre del admin en vez de la persona que se está mirando. Las acciones de moderación que ya eran admin-only en el backend (ocultar/eliminar producciones de otros) se dejaron como estaban.
- **Bug encontrado y corregido durante la prueba de Nicolás**: al cambiar de solapa de participante, el borrador de comentario (selección de texto, cuadro abierto, mensaje de error) no se reseteaba — quedaba pegado del participante anterior. Se armó `cambiarViendoEmail()` que limpia todo ese estado al cambiar de solapa.

## 3. Verificado en vivo
Nicolás probó él mismo contra producción: seleccionó texto en la cuenta de Cuchulain Mago, dejó un comentario, confirmó que el guardado funciona (después de correr el SQL — el primer intento falló porque todavía no había corrido la migración, confirmado por mí contra la base antes de avisarle) y que el hover sobre el ícono abre la nota como se pidió. El comentario de prueba se borró de la base al terminar (`entusiasmo_aportes` quedó vacía) — había quedado en la cuenta real de Cuchulain, no en un usuario descartable, así que se confirmó con Nicolás antes de borrarlo. `typecheck`/`lint` limpios, sin warnings nuevos (mismos ~45 preexistentes documentados en sesiones anteriores).

## 4. Pendiente
- Resto de lo pendiente de rondas anteriores sin cambios: Pitch estilo Instagram, "Tu ritmo" real con metáfora musical, Tareas semanales con fecha/hora + recordatorios + dashboard (Fase D, agente de IA), limpieza de código muerto del Dispositivo viejo (~45 warnings), privacidad de `espacios-archivos`.

Commiteado y pusheado (`302a9fe`).

---

# Sesión de trabajo 2026-08-11 (continuación 7) — Fase C: CoFruto real

## 1. Objetivo
Reemplazar el cartel vacío de CoFruto ("acá vas a poder visitar proyectos... muy pronto") por la mesa común real: mostrar, por cada participante de Entusiasmento, su pitch y las producciones que haya marcado como visibles — sin exponer nada que la persona no haya elegido mostrar.

## 2. Qué se hizo
- **`app/api/entusiasmo/cofruto/route.ts`** (nuevo, GET): junta `entusiasmo_proyectos` (pitch) + `entusiasmo_producciones` con `visible = true`, genera signed URLs en batch (mismo patrón que el resto de Entusiasmento, 1 hora de validez), y arma un "puesto" por participante — solo si tiene pitch o al menos una producción visible. No requiere admin: cualquiera con acceso a `casatalentos` puede pegarle (a diferencia de `/api/espacios/participantes`, que es admin-only y por eso no se reutilizó para esto; en cambio se reutilizó la función de más bajo nivel `listarParticipantesActividad` de `lib/espacios.ts`, que no tiene esa restricción). Excluye al propio usuario de la lista (no te ves a vos mismo en la mesa, ya te ves en "Mi espacio").
- **UI**: dentro del destino "CoFruto", lista vertical de "puestos" — una tarjeta plegable por participante (🌿, borde verde esmeralda) con su nombre y cantidad de producciones; al abrir muestra el pitch (si tiene) y cada producción visible con su contenido real (imagen/audio/texto), mismo criterio visual que ya usa "Mi espacio" para sus propias producciones. Se saca el texto placeholder "muy pronto vas a poder visitar...".
- Los Recursos (que ya vivían dentro de CoFruto desde la Fase A3a) quedan debajo de los puestos, sin cambios.

## 3. Verificado en vivo
Se creó una producción de texto visible de prueba en la cuenta de Cuchulain Mago (el participante beta), se confirmó por API que el endpoint la trae correcta, y por Playwright que aparece como puesto en CoFruto, se abre al tocarlo y muestra título + contenido reales. Se confirmó que participantes sin pitch ni producciones visibles no aparecen como puesto (no generan "habitaciones vacías"). Producción de prueba borrada al final — la cuenta de Cuchulain quedó como estaba. `typecheck`/`lint` limpios, sin warnings nuevos.

Nota al pasar: quedó una producción vieja de Cuchulain (`id=5`, imagen, `visible: false`) de una sesión anterior — no la tocamos, no es de esta fase y al estar no-visible no aparece en CoFruto igual.

## 4. Pendiente
- Resto sin cambios: Pitch estilo Instagram, Tareas semanales con fecha/hora + agente de IA (Fase D), limpieza de código muerto del Dispositivo viejo, privacidad de `espacios-archivos`.

Commiteado y pusheado (`eec3b1d`).

---

# Sesión de trabajo 2026-08-11 (continuación 8) — "Tu ritmo" real

## 1. Objetivo
Reemplazar el placeholder punteado de "Tu ritmo" (reservado desde la Fase A) por una señal real de actividad, ahora que Tareas semanales tiene datos de verdad.

## 2. Primer diseño (barras semanales por cantidad) — descartado antes de commitear
La primera versión agrupaba producciones + tareas en 6 barras semanales por cantidad de ítems creados por semana (con metáfora musical, nota 🎵). Nicolás la probó y aclaró que no era lo que pedía: quería que la barra representara específicamente el **avance de las tareas semanales** (tareas totales = 100%, se llena a medida que se tildan como hechas), no un conteo histórico de actividad. Como esta versión nunca se había commiteado, se reemplazó directamente en vez de dejar el diseño descartado documentado como si hubiera sido real.

## 3. Diseño final (implementado)
Una sola barra de progreso, **dentro de la propia tarjeta de "Tareas semanales"** (no en una sección aparte, por pedido explícito de Nicolás de que quedara "en estrecha relación" con esa sección) — visible solo si hay al menos una tarea cargada:
- **Porcentaje** = tareas completadas / tareas totales de la persona (todas las que tiene cargadas, no filtradas por semana — las tareas nunca se borran automáticamente de una semana a otra, se acumulan, así que el total crece con el tiempo).
- **"Renovable" por diseño, sin lógica especial**: como el porcentaje se recalcula en cada render a partir del estado real (`tareasCompletadas / tareas.length`), automáticamente baja si se agrega una tarea nueva sin completar, y sube cuando se tilda una — exactamente el comportamiento "infinita y finita a la vez" que pidió Nicolás, sin necesidad de ningún mecanismo de reseteo.
- Se sacaron los helpers de agrupación semanal (`inicioSemanaISO`, `construirSemanasRitmo`, `SEMANAS_RITMO`) del primer diseño, sin uso ya.

## 4. Verificado en vivo
Se cargaron 3 tareas de prueba en la cuenta de Cuchulain Mago (2 completadas, 1 pendiente) → la barra mostró "2 de 3 tareas realizadas (67%)" correctamente. Se destildó una tarea real desde la UI (Playwright) y se confirmó que el porcentaje se recalculó solo, en vivo, a "1 de 3 tareas realizadas (33%)", sin recargar la página — confirma el comportamiento "renovable" pedido. Datos de prueba borrados al final. `typecheck`/`lint` limpios, sin warnings nuevos.

## 5. Pendiente
- Resto sin cambios: Pitch estilo Instagram, Tareas semanales con fecha/hora + agente de IA (Fase D), limpieza de código muerto del Dispositivo viejo, privacidad de `espacios-archivos`.

Commiteado y pusheado (`03a1995`).

---

# Sesión de trabajo 2026-08-11 (continuación 9) — Tareas semanales con fecha y hora

## 1. Objetivo
Agregar fecha y hora opcional a cada tarea semanal — precursor necesario para cuando se construya el agente de IA (Fase D), que va a necesitar esa configuración puntual por tarea para armar recordatorios. En esta fase solo se agregó el dato y su visualización, sin tocar el agente todavía.

## 2. Qué se hizo
- **`sql/2026-08-13_entusiasmo_tareas_fecha_hora.sql`** (corrido por Nicolás en Supabase): agrega `fecha` (date) y `hora` (time), ambas nullable, a `entusiasmo_tareas`.
- **`app/api/entusiasmo/tareas/route.ts`**: POST y PATCH aceptan `fecha`/`hora` opcionales; GET ya las devuelve al traer `select("*")`.
- **`app/casatalentos/page.tsx`**: el formulario de "Nueva tarea de la semana" ganó dos inputs opcionales (`type="date"`/`type="time"`) junto al de texto. Cada tarea de la lista muestra, si tiene algo cargado, un texto tipo "Vie 14/08 · 18:30" (o solo fecha, o solo hora) al lado del check — nuevo helper puro `formatearFechaHoraTarea`. Edición de fecha/hora de una tarea ya existente queda fuera de esta entrega (solo se carga al crearla) — no se pidió, se puede sumar después si hace falta.

## 3. Verificado en vivo
Se agregó una tarea real de prueba vía la UI (con la cuenta de test `admin@escuela.com`, que generó su propio proyecto aislado, sin tocar la cuenta real de Nicolás ni la de Cuchulain) con fecha 14/08/2026 y hora 18:30 → se confirmó en la base que quedó guardada (`fecha: "2026-08-14"`, `hora: "18:30:00"`) y que la UI la mostró como "Vie 14/08 · 18:30" (día de la semana calculado correcto). Tarea y proyecto de prueba borrados al final. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- Edición de fecha/hora de una tarea ya cargada (hoy solo se define al crearla).
- Resto sin cambios: Pitch estilo Instagram, agente de IA (Fase D, va a usar esta fecha/hora para los recordatorios), limpieza de código muerto del Dispositivo viejo, privacidad de `espacios-archivos`.

Commiteado y pusheado (`523c12e`).

---

# Sesión de trabajo 2026-08-11 (continuación 10) — Privacidad de espacios-archivos

## 1. Objetivo
Corregir la deuda de seguridad marcada hace varias sesiones (sesión del 2026-08-11, Fase 0 de Entusiasmento): el bucket `espacios-archivos` (adjuntos de mensajes y recursos de Mentorías/Terapia) estaba público, sin signed URLs — mismo patrón de bug que se había corregido en `entusiasmo-producciones`, pero acá con uso real activo. A diferencia de Entusiasmento, esta vez el riesgo era mayor porque el link se guarda de dos formas: como campo estructurado (`url` de un recurso) y **embebido directo dentro del HTML enriquecido de un mensaje** (`contenido_html`, insertado por el editor de texto enriquecido al insertar una imagen o adjuntar un archivo) — no se puede simplemente "regenerar una signed URL al leer" como en Entusiasmento, porque el HTML guardado ya tiene la URL final escrita adentro, y una signed URL vencería a la hora.

## 2. Relevamiento antes de tocar nada (bajó mucho el riesgo real)
Antes de escribir código se chequeó el estado real de producción: de 18 mensajes con `contenido_html`, **ninguno** tenía un adjunto de `espacios-archivos` embebido — la función existe en el editor pero nadie la había usado todavía para mensajes. De 6 recursos con `url` cargada, **solo 1** apuntaba al bucket (una imagen de WhatsApp subida por Nicolás para Alexis Alexandroff en Mentorías) — el resto son links externos (Drive, Google). El bucket en sí solo tenía **1 archivo real**. Esto redujo el alcance de "corregir código + migrar datos reales en producción" a algo mucho más chico y seguro de lo que sugería la nota pendiente.

## 3. Diseño elegido: proxy autenticado, no signed URL directa
En vez de reemplazar la URL guardada por una signed URL (que vence), se armó un endpoint propio que actúa de intermediario y nunca vence:
- **`app/api/espacios/archivo/route.ts`** (nuevo): recibe `path`, `actividadSlug`, `participanteEmail` por query string. Reutiliza `resolverContextoEspacio` (el mismo gate de acceso que ya usan mensajes/recursos) para autenticar y autorizar — si sos admin podés pedir el archivo de cualquier participante del espacio; si sos participante, tu propio email se fuerza igual que en el resto del código (no podés pedir el archivo de otra persona cambiando el parámetro). Verifica además que el `path` pedido efectivamente empiece con `actividadSlug/<email normalizado>/` antes de generar una signed URL de 1 hora y redirigir (302) a ella.
- **`app/api/espacios/preparar-upload/route.ts`**: `asegurarBucketEspacios` ahora crea/mantiene el bucket **privado** (`public: false`) en vez de forzarlo público. La respuesta ya no devuelve `publicUrl` (permanente, sin auth) sino `viewUrl` — la URL estable de este proxy nuevo, que es la que se guarda en `contenido_html`/`url` en vez de la URL directa de Supabase. Como el proxy nunca vence (resuelve una signed URL fresca en cada visita), no hace falta ningún mecanismo especial para el caso "mensaje con imagen embebida" — el `<img src="...">` guardado sigue funcionando para siempre, autenticado.
- **`components/espacios/EspacioAcompanamiento.tsx`**: `subirArchivoEspacio` ahora arma la URL a embeber/guardar a partir de `preparacion.viewUrl` en vez de `preparacion.publicUrl`.
- **`lib/espacios.ts`**: se extrajo `limpiarNombreArchivo` (antes duplicada dentro de `preparar-upload/route.ts`) como función compartida y exportada, para que el proxy nuevo use exactamente la misma normalización de email que el upload — si divergieran, el chequeo de autorización por prefijo de path podría fallar en falso positivo o falso negativo.
- **Nota al pasar**: al escribir `limpiarNombreArchivo` de nuevo se repitió, por segunda vez en el proyecto, el bug ya documentado de tipear los caracteres Unicode combinantes literales en vez del rango escapado `̀-ͯ` — detectado y corregido en el momento, antes de seguir.

## 4. Migración de datos (un solo archivo real)
El bucket se pasó a privado en producción, y se actualizó el único recurso real (`espacios_recursos.id = 6`, Alexis Alexandroff / Mentorías) para que su `url` apunte al proxy nuevo en vez de a la URL pública vieja de Supabase.

## 5. Verificado en vivo
- Proxy autenticado: con sesión admin devuelve 307 hacia una signed URL válida (confirmado que el archivo descarga con `content-type: image/jpeg` real); sin sesión devuelve 401; con una cuenta sin acceso a ese espacio (`colaborador@escuela.com`) devuelve 403. La URL pública vieja de Supabase ahora devuelve 400 (bucket privado).
- UI real (Playwright, admin seleccionando a Alexis Alexandroff en `/mentorias` → Recursos): el recurso migrado se ve con su imagen cargando correctamente (`naturalWidth` real, no rota), sin errores de consola.
- **Subida nueva de punta a punta a través del editor enriquecido real** (el camino de mayor riesgo, el de mensajes): se subió una imagen de prueba vía "Insertar imagen" en un recurso nuevo, quedó embebida en `contenido_html` con la URL del proxy nuevo, y se confirmó que renderiza (`naturalWidth` correcto). Recurso y archivo de prueba borrados al final — el bucket quedó con el único archivo real que ya tenía antes.
- `typecheck`/`lint` limpios, sin warnings nuevos (el único warning de `EspacioAcompanamiento.tsx` es preexistente y no relacionado, documentado en sesiones anteriores).

## 6. Pendiente
- **No se hizo commit todavía** — a la espera de confirmación de Nicolás.
- Resto sin cambios: Pitch estilo Instagram, Tareas semanales con edición de fecha/hora, agente de IA (Fase D), limpieza de código muerto del Dispositivo viejo.

---

# Sesión de trabajo 2026-08-11 (continuación 11) — Formato 24hs en toda la plataforma + hora local por persona

## 1. Objetivo
Pedido de Nicolás, transversal a toda la plataforma (no específico de un módulo): (a) sacar el AM/PM de todos lados, dejar todo en 24hs; (b) que cada persona vea (en la plataforma) y reciba (por mail) los horarios de sus encuentros convertidos a su propia hora local, no solo en hora Argentina.

## 2. Fase 1 — Formato 24hs

**Causa real del AM/PM**: se relevaron los 10 lugares del código que formatean fecha+hora con `Intl`/`toLocaleString`. 9 ya usaban configuración regional argentina (`"es-AR"`, que normalmente cae en 24hs) pero sin fijarlo de forma explícita — riesgoso porque depende del comportamiento por default de la librería ICU del entorno. El décimo (`app/campus/page.tsx`, el recordatorio del dashboard) usaba directamente la configuración regional del **navegador** (`toLocaleString(undefined, ...)`) — ese es el que efectivamente mostraba AM/PM si el navegador/SO de quien mira está en inglés. Se agregó `hourCycle: "h23"` explícito en los 10 lugares (defensivo, no depende más de configuración implícita de nadie).

**El problema real de fondo — inputs nativos**: los 4 campos `<input type="time">` de la plataforma (agenda, comunicaciones programadas, tareas semanales de Entusiasmento) son controles nativos del navegador — su formato visual (AM/PM o 24hs) lo decide el navegador/SO de quien los usa, no el código de la app, así que ningún cambio de `Intl` los afecta. Se armó **`components/ui/Hora24Input.tsx`** (nuevo, reutilizable): dos `<select>` (hora 00–23, minuto 00–59) en vez del input nativo, mismo contrato `value`/`onChange` como string `"HH:MM"` que ya usaba todo el código, sin tocar la lógica de guardado en ningún lado. Reemplazó los 4 usos nativos.

**Verificado en vivo**: con el navegador forzado a `en-US` (para simular el caso que reportaba Nicolás), se confirmó que el recordatorio de campus ya no muestra AM/PM, y que los selects de hora/minuto nuevos funcionan y actualizan el estado correctamente.

## 3. Fase 2 — Hora local por persona

**Decisión de origen del dato** (pregunta directa a Nicolás antes de tocar nada): el huso horario de cada persona se **detecta solo del navegador** al entrar a la plataforma (`Intl.DateTimeFormat().resolvedOptions().timeZone`), sin pedirle nada a nadie ni tener que cargarlo Nicolás a mano.

**Modelo de datos**: `fecha`/`hora` en `disponibilidades` ya se guardaban como hora de pared de Argentina, sin zona adjunta — como Argentina tiene offset fijo (UTC-3 todo el año, sin horario de verano desde 2009), convertir a cualquier otra zona es directo: se arma el instante absoluto asumiendo `-03:00` y se re-formatea en la zona destino.

**Qué se hizo**:
- **`sql/2026-08-13_usuarios_zona_horaria.sql`** (corrido por Nicolás): agrega `zona_horaria` (text, nullable) a `usuarios_plataforma`.
- **`lib/fechas.ts`**: nuevas funciones puras — `esZonaHorariaValida`, `nombreCortoZona`, `convertirFechaHoraArgentinaAZona` (fecha Argentina + hora Argentina + zona destino → fecha/hora en esa zona).
- **`app/api/me/zona-horaria/route.ts`** (nuevo, POST): guarda la zona horaria detectada del usuario autenticado. Endpoint chico y separado del formulario de perfil (`/api/me/perfil`) a propósito, para no arrastrar validaciones de nombre/apellido a un simple sync silencioso en segundo plano.
- **`components/auth/AppSessionProvider.tsx`**: al autenticarse, detecta la zona del navegador y la sincroniza una sola vez por sesión (con un `ref` de guarda) — en segundo plano, sin bloquear nada si falla.
- **`components/ui/HoraEnZonaLocal.tsx`** (nuevo): componente de solo lectura que muestra un horario Argentina convertido a la zona detectada del navegador de quien lo está viendo — si coincide con Argentina no convierte nada (`"19:30 hs (Argentina)"`), si difiere muestra ambas (`"17:30 hs tu hora (Bogota) (19:30 hs Argentina)"`).
- **Dónde se aplicó** (solo vistas de **lectura** de horarios ya agendados — nunca en los formularios donde Nicolás carga/edita un encuentro, que siguen 100% en hora Argentina a propósito, para no arriesgar una carga mal hecha por confundir husos): `app/agenda/page.tsx` ("Tu agenda", vista participante), `components/agenda/AgendaActividad.tsx` (Conectando Sentidos), `app/casatalentos/page.tsx` (botón "Reunión semanal" de Entusiasmento), `components/espacios/EspacioAcompanamiento.tsx` (Mentorías/Terapia, ambas vistas de "reuniones agendadas").
- **Mails de sesión** (`lib/comunicaciones.ts`): `enviarConfirmacionSesionIndividual`, `enviarActualizacionSesionIndividual` y `enviarCancelacionSesionIndividual` ahora buscan la `zona_horaria` guardada del destinatario y, si existe y es distinta de Argentina, agregan la hora local como aclaración junto a la hora Argentina (que sigue siendo la referencia principal del mail). Nueva función compartida `obtenerHoraLocalDestinatario`.

## 4. Verificado en vivo
- Auto-detección: usuario de prueba descartable, navegador con huso `America/Bogota` → confirmado en base que `zona_horaria` quedó guardada como `"America/Bogota"` tras loguearse, sin errores de consola.
- Conversión real end-to-end: mismo usuario de prueba, inscripto temporalmente a Conectando Sentidos con pago al día (datos 100% descartables), vio el próximo encuentro grupal (19:30 hs Argentina real) mostrado como **"17:30 hs tu hora (Bogota) (19:30 hs Argentina)"** — matemática correcta (Bogotá está 2 horas detrás de Argentina). Todo el usuario/inscripción/honorario/pago de prueba se borró al final, sin dejar residuo.
- **Incidente durante la prueba, no relacionado con el código**: la primera ronda de pruebas de esta fase se quedó colgada en "Cargando..." pese a que la API devolvía los datos correctamente — mismo patrón ya documentado antes en esta sesión (server de desarrollo con estado de compilación viejo tras muchas ediciones seguidas). Se reinició `npm run dev` y quedó resuelto — confirmado con la prueba de conversión real inmediatamente después, sin tocar código.
- La app no se rompe si el SQL de esta fase no está corrido todavía (probado antes de que Nicolás lo corriera): el sync de zona horaria falla en silencio sin afectar nada visible.
- `typecheck`/`lint` limpios en ambas fases, sin warnings nuevos.

## 5. Pendiente
- Los mails de sesión con hora local no se probaron con un envío real (no hay una forma segura de disparar `enviarConfirmacionSesionIndividual` sin una reserva real de por medio) — la lógica reutiliza la misma función de conversión ya verificada en vivo para la UI, pero queda pendiente una verificación real la próxima vez que se cree/edite/cancele una sesión real de Mentorías o Terapia para alguien con `zona_horaria` distinta de Argentina.

Commiteado y pusheado (`145095e`), junto con la privacidad de `espacios-archivos`.

---

# Sesión de trabajo 2026-08-12 — Limpieza de código muerto del Dispositivo CasaTalentos viejo

## 1. Objetivo
Sacar los ~45 warnings de lint que quedaron en `app/casatalentos/page.tsx` desde que se retiró el "Dispositivo CasaTalentos" (ranking/votación/comentarios por video) en la Fase A2 del reemplazo por Entusiasmento (sesión 2026-08-11) — el JSX se había sacado en su momento, pero todo el cálculo (`useMemo`/`useState`) que solo alimentaba esa UI había quedado sin usar.

## 2. Qué se hizo
Limpieza en cascada, no mecánica de una sola pasada: se fue sacando cada variable/función marcada como no usada y, después de cada tanda, se volvía a correr `lint` para detectar qué quedaba huérfano recién ahí (por ejemplo, sacar `rankingParticipantes` dejó sin uso a `votosPorVideo`, que a su vez dejó sin uso a `pesoEvaluacion`, y así con varias cadenas más). Se sacaron por completo:
- Todo el cálculo de ranking/ganador/empate semanal (`rankingParticipantes`, `top3`, `ganadorSemana`, `evaluacionCerrada`, `resumenSemana`, `resultadosVotacionVisibles`, `nombreGanadorEntusiasmo`, `mostrarEncuestaEvaluacion`, `mostrarControlesEvaluacion`, `eleccionesHabilitadas`, `eleccionesPorParticipante`, `bloquearNuevaEvaluacion`, `yaParticipoEvaluacionSemana`, `claveActorEvaluacion`).
- Los estados de video/carga/comentario del Dispositivo viejo (`archivo`, `titulo`, `nombreParticipante`, `videoAbierto`, `elegidoSeleccionado`, `eliminandoVideoId`, `subiendoVideo`, `estadoSubidaVideo`, `eligiendo`, `comentariosDraft`, `comentandoVideoId`, `subsolapaDispositivo`) y los datos que ya no se cargan (`videos`, `votos`, `comentarios`, `referentesGenerales`, `referentesSemanales`, junto con sus tipos `VideoItem`, `VotoItem`, `ComentarioItem`, `ReferentesGenerales`, `ReferenteSemanal` y los campos correspondientes en la respuesta de `cargarDatosCasaTalentos`).
- Funciones puras que solo alimentaban lo anterior: `claveParticipante`, `claveVotante`, `normalizarClaveDia`, `ordenDia`, `ordenarVideosPorProceso`, `obtenerVideoRepresentativo`, `normalizarFechaSemana`, `resultadosDisponiblesSegunAhora`, `pesoEvaluacion`, `nombreDiaActual`, `tieneRecurso`, `participantesSinVideoLunes`, `esMartesAportes`, `textoReferentesGenerales`.
- **El hallazgo más importante de esta limpieza**: el "reloj" que recalculaba `ahoraArgentina` cada minuto (con `setTimeout`, listener de `focus` y de `visibilitychange`) solo existía para alimentar exactamente este cálculo ya muerto — no era solo una variable sin usar, era un `useEffect` completo corriendo de fondo sin ningún consumidor real. Se simplificó ese efecto a únicamente `setMounted(true)`, que es lo único que seguía haciendo falta. Esto no es solo prolijidad: es menos trabajo de fondo real en el navegador de cada persona que tiene la página abierta.
- `obtenerAhoraArgentinaCliente` y el import de `obtenerPartesArgentina` (`lib/fechas.ts`) también se sacaron al quedar sin ningún uso.

## 3. Verificado en vivo
`typecheck` limpio. `lint`: los warnings de `no-unused-vars` en `app/casatalentos/page.tsx` bajaron de ~45 a **0** (solo quedan 5 warnings de `react-hooks/exhaustive-deps` en ese archivo, que son el patrón intencional ya usado en todo el proyecto — dependencias de `mounted`/`viendoEmail` a propósito, no deuda). El total de problemas de lint de todo el proyecto bajó de 67 a 23, todos preexistentes y ajenos a este módulo (documentados en sesiones anteriores). Probado en vivo con Playwright: la página de Entusiasmento carga sin errores de consola, "Mi espacio"/"CoFruto"/Coordenadas/Producciones/Tareas semanales/Valoraciones/Reunión semanal siguen funcionando, y el cambio de solapa entre participantes (Fase A3b) sigue andando bien — nada de lo que quedaba en uso se vio afectado.

## 4. Pendiente
- Resto sin cambios: Pitch estilo Instagram, edición de fecha/hora de una tarea ya cargada, agente de IA (Fase D).

Commiteado y pusheado (`227cb0d`).

---

# Sesión de trabajo 2026-08-12 (continuación) — Editar fecha/hora de una tarea ya cargada

## 1. Objetivo
Hasta ahora la fecha/hora de una tarea semanal solo se podía definir al crearla (Fase de "Tareas semanales con fecha y hora", sesión anterior). Se agregó poder editarla después sin borrar y recrear la tarea.

## 2. Qué se hizo
- El backend (`PATCH /api/entusiasmo/tareas`) ya soportaba `fecha`/`hora` opcionales desde la fase anterior — no hizo falta tocarlo.
- **`app/casatalentos/page.tsx`**: cada tarea de la lista ahora tiene un botón junto a la fecha/hora — "+ Fecha" si todavía no tiene, "Editar" si ya tiene algo cargado. Al tocarlo se abre un formulario chico inline (mismo `Hora24Input` reutilizado + un input de fecha) con Guardar/Cancelar, sin afectar el resto de la tarea (el texto y el estado completada/pendiente). Se reestructuró la fila de cada tarea (de `<label>` a un `<div>` con un `<label>` interno solo para el check+texto) para poder agregar el botón de editar sin que el click le dispare el toggle del checkbox por accidente (herencia de click de `<label>`).

## 3. Verificado en vivo
Con la cuenta de test `admin@escuela.com` (que genera su propio proyecto aislado): se creó una tarea sin fecha, se confirmó que muestra "+ Fecha", se editó a 20/08/2026 09:15 y se confirmó tanto en pantalla ("Jue 20/08 · 09:15", con el botón pasando a decir "Editar") como en la base (`fecha: "2026-08-20"`, `hora: "09:15:00"`). Tarea y proyecto de prueba borrados al final. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- Resto sin cambios: Pitch estilo Instagram, agente de IA (Fase D).

Commiteado y pusheado (`7a6fc05`).

---

# Sesión de trabajo 2026-08-12 (continuación) — Pitch estilo Stories/Reels

## 1. Objetivo
Rediseño visual pedido en una ronda de feedback bien anterior: que el bloque de Pitch se sintiera más "estilo Instagram". Dado lo ambiguo del pedido, se le mostraron a Nicolás 2 mockups concretos (formato Stories/Reels vertical vs. formato post de feed clásico) antes de tocar código — eligió **Stories/Reels**.

## 2. Qué se hizo
`app/casatalentos/page.tsx`, bloque de Pitch dentro de "Mi espacio": se reemplazó la tarjeta con marco dorado grueso por un marco vertical (9:16) con anillo degradado dorado (como el borde de una Story activa), esquinas bien redondeadas, fondo negro. Adentro:
- Un overlay superior con degradado (transparente a negro) mostrando un avatar circular (inicial del nombre, con su propio mini-anillo dorado) + el nombre de la persona.
- La imagen/video del pitch llenando todo el marco (`object-cover`), o un estado vacío centrado ("Todavía no grabaste tu pitch." / "Todavía no subió su pitch." según se esté viendo el propio o el de otro) cuando no hay nada cargado todavía.
- Un overlay inferior con degradado mostrando "✦ Así te ven en la mesa" como caption.
Los controles para grabar/subir (que solo se muestran cuando es el propio espacio, no viendo a otro) quedaron debajo del marco, sin cambios de lógica — solo de layout, para no arriesgar tocar `GrabadorVideo` ni el flujo de subida. Nuevo derivado `nombrePitchMostrado` (nombre propio, o el de la persona vista si sos admin mirando a otro, resuelto contra la lista de participantes activos que ya se cargaba).

## 3. Verificado en vivo
Con la cuenta de test `admin@escuela.com`: estado vacío confirmado visualmente (marco con anillo dorado, avatar "A", texto "Todavía no grabaste tu pitch.", caption abajo). Después se subió una imagen de prueba de punta a punta (preparar-upload → subida real al bucket → confirmar) y se confirmó que el marco pasa a mostrar la imagen llenando el espacio (`object-cover`) en vez del estado vacío. Se confirmó además que la vista de puestos en CoFruto (que muestra el pitch de otros participantes con su propio layout, sin marco de Stories) no se tocó y sigue intacta. Imagen y proyecto de prueba borrados al final. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Ronda de feedback: layout desarmónico + duda sobre CoFruto
Nicolás probó con su cuenta real (`nicolasbusico.psi@gmail.com`) y mandó captura: el marco del reel (vacío al principio, columna angosta) quedaba apilado arriba de la tarjeta de grabación (`GrabadorVideo`, con su propio encabezado "Preparación / Elegí cómo preparar tu video") — dos bloques con peso visual propio, uno debajo del otro, sin relación clara. Pidió ponerlos lado a lado o integrar el menú de grabación al reel.

**Se resolvió con layout, no tocando `GrabadorVideo`**: ese componente se reutiliza también en `CasaTalentosAdminPanel` (referentes semanales), así que no convenía meterle mano a su estructura interna solo para este caso. Se cambió el contenedor a `flex flex-col md:flex-row`: en desktop el reel queda a la izquierda (ancho fijo, `shrink-0`) y la tarjeta de grabación ocupa el resto del ancho a la derecha; en mobile se apilan (no entrarían lado a lado en una pantalla angosta). Confirmado visualmente en ambos anchos.

**Duda sobre CoFruto**: Nicolás grabó un pitch real con su cuenta y, viendo CoFruto como admin, no lo vio reflejado — preguntó si se vería para otro participante. Investigado: su cuenta (`nicolasbusico.psi@gmail.com`) no tiene ninguna inscripción activa a ninguna actividad — es la cuenta de dueño/admin, no una cuenta de participante — así que nunca entra a la lista de participantes que arma CoFruto, para nadie que lo mire (no es por el filtro de "no te ves a vos mismo", es que no está en el padrón). Confirmado que si un participante real sube un pitch, sí se vería para los demás: se probó viendo CoFruto con una cuenta distinta y las producciones visibles de Cuchulain Mago aparecieron correctamente. No se tocó el pitch real que Nicolás subió a su cuenta (no es un dato de prueba mío, queda como está).

## 5. Eliminar pitch (pedido en la misma ronda)
"Actualizar" el pitch ya funcionaba (botón "Volver a grabarlo" — al confirmar uno nuevo, el endpoint ya borraba el archivo anterior del bucket, política de retención de la Fase A). Lo que faltaba era poder **sacarlo del todo**, sin reemplazarlo por otro.

- **`app/api/entusiasmo/pitch/confirmar/route.ts`**: nuevo `DELETE` — verifica dueño o admin, borra el archivo del bucket y deja `pitch_storage_path`/`pitch_mime_type`/`pitch_actualizado_at` en `null`.
- **`app/casatalentos/page.tsx`**: nuevo botón "Eliminar pitch" (texto rojo, debajo del botón de guardar), visible solo cuando ya hay un pitch cargado y no se está viendo el espacio de otra persona. Pide confirmación (`window.confirm`, mismo patrón que otras acciones destructivas del proyecto) antes de borrar.

**Verificado en vivo**: con la cuenta de test, se cargó un pitch de prueba, se confirmó que el botón aparece, se lo eliminó, y se confirmó tanto en pantalla (vuelve al estado vacío del marco, mensaje "Pitch eliminado") como en la base y el storage (`pitch_storage_path: null`, carpeta del bucket vacía). Proyecto de prueba borrado al final. `typecheck`/`lint` limpios.

## 6. CoFruto: incluir el propio puesto (pedido en la misma ronda)
Hasta ahora CoFruto excluía siempre al que estaba mirando ("no te ves a vos mismo, ya te ves en Mi espacio" — decisión original de la Fase C). Nicolás pidió el cambio: le pareció mejor que el participante también se vea reflejado en la mesa junto a los demás.

- **`app/api/entusiasmo/cofruto/route.ts`**: se sacó el filtro que excluía `emailPropio` de la lista. Cada puesto ahora trae un campo nuevo `esPropio`, y la lista se ordena con el propio puesto primero.
- **`app/casatalentos/page.tsx`**: el puesto propio se distingue visualmente (borde dorado en vez de verde esmeralda, como el resto de "Mi espacio") y muestra una etiqueta "(vos)" al lado del nombre.

**Verificado en vivo**: usuario y datos 100% descartables (usuario, inscripción activa a `casatalentos`, honorario y pago al día para destrabar el acceso, una producción visible) — se agregó temporalmente a `ENTUSIASMENTO_BETA_EMAILS` para poder probarlo como participante real (no admin), se confirmó en pantalla "Prueba CoFruto (vos)" apareciendo primero en la lista con el borde dorado distintivo, y "Cuchulain Mago" apareciendo después con el estilo normal. Se revirtió el agregado a `ENTUSIASMENTO_BETA_EMAILS` y se borró todo el dato de prueba (usuario, inscripción, honorario, pago, proyecto, producción) al terminar. `typecheck`/`lint` limpios.

## 7. Performance: chequeo de acceso lento al abrir Entusiasmento
Nicolás reportó que abrir Entusiasmento tarda mucho en resolver el acceso. Investigado con mediciones reales (`curl` cronometrado contra el endpoint real, antes/después) en vez de a ojo: el cuello de botella no era ningún cálculo pesado, sino **una cadena larga de consultas a Supabase hechas una atrás de la otra** — cada viaje de ida y vuelta a la base tarda un rato (probablemente por la distancia geográfica al servidor de Supabase), así que encadenar 6-8 consultas secuenciales suma varios segundos.

- **`lib/authz.ts`, `resolveActivityAccess`** (la función que decide si alguien puede entrar a una actividad — la usa toda la plataforma, no solo Entusiasmento): tenía una consulta 100% redundante (volvía a pedir la actividad que `asegurarActividadBase` ya acababa de traer un instante antes) — se sacó. Además, 3 consultas que en el fondo son independientes entre sí (si tiene acceso extra por espacios, si tiene una inscripción activa, y su honorario configurado) se disparan ahora **en simultáneo** (`Promise.all`) en vez de una detrás de la otra — la decisión final es exactamente la misma, solo cambia el orden en que se piden los datos.
- **`cargarRecursosActividad`** (misma función usada en todas las actividades): sus dos consultas (recursos de la actividad + accesos individuales) también eran independientes y ahora corren en paralelo.
- **A propósito, no se tocó** el resto de la cadena (chequeo de pago mensual, carga de recursos cuando hay acceso extra) por prudencia — son ramas con más lógica de negocio sensible (dinero, accesos), y ya se logró una mejora real sin arriesgar esa parte.

**Medido, no estimado**: con la cuenta de test admin, la respuesta del endpoint bajó de ~1.0s a ~0.6s. Con un participante real (inscripción + pago al día, caso más representativo), bajó de ~1.3–1.8s a ~1.0–1.2s. Se verificó además que la lógica de decisión no cambió: se probaron en vivo los 3 casos (participante con pago al día → acceso, participante sin inscripción → `sin_inscripcion`, y el camino de acceso admin) y todos devolvieron exactamente el mismo resultado que antes. Datos de prueba borrados al final. `typecheck`/`lint` limpios.

**Pendiente si hace falta más**: la carga completa de la página de Entusiasmento (no solo el chequeo de acceso) dispara bastantes otros pedidos en paralelo después de eso (proyecto, aportes, producciones, tareas, participantes, etc.) — no se auditó esa parte todavía porque Nicolás pidió específicamente por "cargar el acceso". Si sigue sintiéndose lento en general, esa es la próxima punta a tirar.

## 8. CoFruto: rediseño — grilla siempre visible, con el pitch estilo reel
Nicolás pidió sacar el acordeón (no le gustaba tener que abrir cada puesto) y en cambio mostrar todo de entrada, como puestos de una feria — y que el pitch también se vea con el estilo "Instagram" ya usado en Mi espacio, en miniatura. Con un máximo de 4 cosas visibles por persona para que ningún puesto crezca sin límite.

- **`app/api/entusiasmo/cofruto/route.ts`**: ahora capa cada puesto a un máximo de 4 producciones (las más recientes) — el corte se hace antes de generar las signed URLs, así no se pagan de más por producciones que no se van a mostrar.
- **`app/casatalentos/page.tsx`**: se sacó el acordeón (clic para abrir/cerrar) — ahora es una grilla responsive (1 columna en mobile, 2–3 en pantallas más anchas) de tarjetas ("mesas"), cada una mostrando **todo de entrada, sin clics**: el pitch en miniatura con el mismo anillo dorado y marco oscuro de "Mi espacio" (más chico, `92px` de ancho), y al lado una grilla 2×2 de hasta 4 producciones (imagen real si es imagen, ícono si es audio, texto recortado si es texto). Se sacó el estado `puestoAbiertoEmail`, que ya no hace falta.

**Verificado en vivo**: se le agregaron temporalmente un pitch de prueba y 5 producciones de texto a la cuenta real de Cuchulain Mago (participante beta) para forzar el caso "más de 4" — se confirmó por API que devuelve exactamente 4 (las últimas 4, ordenadas por fecha), y visualmente que la tarjeta muestra el pitch en miniatura + las 4 producciones en grilla, todo visible sin ningún clic. Se revirtió todo al final (se borraron las 5 producciones de prueba y se volvió a dejar el pitch en `null`), quedó solo la producción real que ya tenía antes. `typecheck`/`lint` limpios.

## 9. CoFruto: modal ampliado al seleccionar un puesto
Con la grilla siempre visible (punto 8), las miniaturas quedaron chicas — Nicolás pidió poder agrandar un puesto puntual para ver bien tanto el pitch como las producciones ("así como está ahora no se ve bien la imagen de producción ni el pitch").

- **`app/casatalentos/page.tsx`**: cada tarjeta de la grilla de CoFruto pasó de `<div>` a `<button>` clickeable (con sombra al pasar el mouse como affordance). Al tocarla, se abre un modal (mismo patrón visual que `EditarEncuentroModal` de Agenda — fondo oscuro + panel centrado) con el nombre de la persona, un botón "Cerrar", el pitch en tamaño grande (hasta 260px de ancho, mismo anillo dorado/marco negro que en "Mi espacio") y una grilla 2 columnas de sus producciones visibles, ahora en tamaño legible de verdad: imágenes como cuadrado grande (no recortadas a 60px), audio con reproductor `<audio controls>` nativo en vez de solo un ícono, y texto completo sin el recorte de 4 líneas de la miniatura chica. Nuevo estado `puestoAmpliadoEmail`.
- Ajuste de layout durante la prueba: al principio la imagen de producción se estiraba a la altura completa del pitch (por `align-items: stretch` del contenedor flex) — se corrigió con `content-start`/`self-start` en la grilla de producciones y un alto fijo (`aspect-square`) solo para imágenes, así cada tile queda con su tamaño natural en vez de estirarse.

**Verificado en vivo**: participante 100% descartable (usuario + inscripción activa a `casatalentos`, sin necesidad de honorario/pago porque se lo miró desde la cuenta admin, que no pasa por ese gate) con un pitch de imagen y 2 producciones (imagen + texto largo) subidas de verdad al bucket. Confirmado que la tarjeta chica aparece en la grilla, que el click abre el modal con el nombre correcto, que la imagen de producción se ve grande y nítida (no los ~60px de la miniatura), que el texto largo se lee completo sin recorte, y que el botón "Cerrar" cierra el modal. Cero errores de consola. Datos y archivos de prueba borrados al final (usuario, inscripción, proyecto, producciones, ambos archivos del bucket). `typecheck`/`lint` limpios, sin warnings nuevos.

**Ronda de feedback inmediata**: Nicolás probó con datos reales (su propia cuenta viendo el espacio de Cuchulain Mago) y avisó que la imagen de producción "sigue en tamaño pequeño" dentro del modal — con el pitch ocupando casi la mitad del ancho del panel (`max-w-2xl`, 672px), a la grilla de producciones le queda poco lugar real. Pidió una opción de ampliar.

- **`app/casatalentos/page.tsx`**: cada tile de imagen dentro del modal pasó a ser un `<button>` (con un overlay "🔍 Ampliar" que aparece al pasar el mouse) que abre un segundo overlay por encima de todo (`z-[60]`, fondo negro semitransparente) mostrando esa imagen puntual a tamaño grande (`max-h-[85vh]`, `object-contain`, sin recorte). Nuevo estado `imagenAmpliada`. Clic afuera de la imagen o en "Cerrar" cierra solo este lightbox (el modal del puesto sigue abierto detrás).
- Primer intento de prueba con la imagen de 1×1 px ya usada en otros tests de esta sesión mostró el lightbox casi vacío (el navegador no agranda una imagen de 1px) — no era un bug, era el dato de prueba; se repitió la prueba con una imagen real (`public/interlegere-icono-transparente.png`, 500×500) y ahí sí se vio grande y nítida como corresponde.

**Verificado en vivo**: mismo participante descartable, click en la imagen dentro del modal abre el lightbox a 500×500px (contra ~120×120px del tile), cierra correctamente con el botón dedicado, cero errores de consola. Datos de prueba borrados al final. `typecheck`/`lint` limpios, sin warnings nuevos.

## 10. Pendiente
- Resto sin cambios: agente de IA (Fase D). Si se quiere seguir optimizando velocidad, falta auditar el resto de los pedidos que dispara la página de Entusiasmento al cargar (más allá del chequeo de acceso).

Commiteado y pusheado (`b24f517`).

---

# Sesión de trabajo 2026-08-12 (continuación) — Fase D, parte 1: auditoría de velocidad del resto de la carga de Entusiasmento

## 1. Objetivo
Nicolás pidió arrancar la Fase D (agente de IA) pero primero terminar la auditoría de velocidad que había quedado pendiente — la vez anterior solo se optimizó el chequeo de acceso (`resolveActivityAccess`); faltaba revisar el resto de los pedidos que dispara `/casatalentos` al cargar (proyecto, aportes, producciones, tareas, y el listado de "Valoraciones y agradecimientos").

## 2. Hallazgo grande: `/api/casatalentos/listar` seguía cargando todo el Dispositivo viejo, aunque nadie lo usa
Este endpoint (el que alimenta el cuadrito de "Valoraciones y agradecimientos") seguía haciendo, en cada carga de la página, 8 consultas secuenciales a Supabase: videos + firmar sus URLs, votos, roles de quienes votaron, comentarios, referentes generales, referentes semanales + firmar sus URLs, y recién al final los mensajes. Pero **ni `app/casatalentos/page.tsx` ni `CasaTalentosAdminPanel.tsx`** (los dos únicos consumidores de este endpoint) leen `videos`, `votos` ni `comentarios` de la respuesta — quedaron huérfanos desde que se retiró el Dispositivo viejo en la Fase A2 (2026-08-11). Es la misma clase de deuda que ya se había limpiado del lado del frontend (sesión "Limpieza de código muerto del Dispositivo CasaTalentos viejo") pero nadie había vuelto a mirar el endpoint que sigue alimentando esos datos para nadie.

**Medido, no estimado** (con datos reales de producción: 38 videos, 12 votos, 78 comentarios ya archivados): la versión vieja tardaba **entre 4.2 y 9.5 segundos** por carga (mucho peor de lo esperado — generar 38 signed URLs de golpe para videos que ya nadie muestra explica buena parte). La nueva versión, sin esas 3 consultas muertas y con las 3 que sí se usan (referentes generales, referentes semanales, mensajes) disparadas en simultáneo con `Promise.all` en vez de una atrás de la otra, tarda **entre 340 y 430ms** — una mejora de entre 10 y 20 veces, la más grande de toda la auditoría.

- **`app/api/casatalentos/listar/route.ts`**: se sacaron las consultas a `casatalentos_videos`, `casatalentos_votos` y `casatalentos_comentarios` (con su firmado de URLs y el lookup de roles de votantes) y los tipos que solo servían para eso (`VideoDB`, `VotoDB`, `UsuarioRolRow`). Las 3 consultas que sí se usan (`casatalentos_referentes_generales`, `casatalentos_referentes_semanales`, `casatalentos_mensajes`) pasaron de secuenciales a `Promise.all` (son independientes entre sí). El firmado de URLs de los referentes semanales sigue después, porque depende de esos resultados.
- Las tablas viejas (`casatalentos_videos`, `casatalentos_votos`, `casatalentos_comentarios`) siguen archivadas en la base sin tocar — mismo criterio de siempre, esto solo saca las consultas muertas del código, no borra datos.

## 3. Segundo hallazgo: mismo patrón "resolver proyecto_id y recién después consultar" en 3 endpoints de Entusiasmento
`GET /api/entusiasmo/producciones`, `.../aportes` y `.../tareas` hacían, cada uno, 2 consultas secuenciales: primero resolver el `id` de `entusiasmo_proyectos` a partir del email, y recién con ese id consultar la tabla hija. Se reemplazó por un solo viaje con join (`.select("*, entusiasmo_proyectos!inner(participante_email)").eq("entusiasmo_proyectos.participante_email", email)`) — mismo patrón de embed que ya se usaba en el PATCH/DELETE de producciones, así que no era una sintaxis nueva para el proyecto. `resolverProyectoId` se mantuvo en los archivos porque los POST (crear producción/tarea) todavía la necesitan para crear el proyecto si no existe.

**Verificado en vivo, con foco en seguridad** (no solo velocidad): se crearon dos participantes descartables con datos propios en producciones/aportes/tareas, y se confirmó que cada uno ve exactamente lo suyo — nada del otro se filtra por el join. También se probó el caso de un email sin proyecto todavía (participante nuevo): devuelve lista vacía sin romper, igual que antes. Datos de prueba borrados al final.

## 4. Lo que se dejó afuera, a propósito
- `listarAgendaUnificada` (usada por `/api/agenda/por-actividad`, el próximo encuentro que se ve arriba de la página): ya está identificada como deuda aparte en la sección de "Agenda" de este documento (consulta sin límite de `reservas`) — mayor alcance porque la usan las 4 actividades, no se tocó acá para no mezclar cambios.
- `listarParticipantesActividad` (la que arma el selector de solapas del admin): tiene 2 consultas secuenciales (inscripciones activas, después usuarios habilitados) que en teoría se podrían unir en un solo join, pero no hay certeza de que exista una foreign key declarada entre `inscripciones.participante_email` y `usuarios_plataforma.email` (varias tablas núcleo de este proyecto no tienen su `CREATE TABLE` versionado) — combinarlas a ciegas podía romper el embed sin previo aviso. Solo la usa el admin, y solo una vez por carga, así que el impacto es bajo — se dejó como está.
- `/api/entusiasmo/cofruto` no se tocó — solo se dispara cuando se abre la solapa CoFruto (no en la carga inicial), y ya estaba razonablemente optimizado desde la Fase C (batch de signed URLs).

## 5. Verificado en vivo
`typecheck`/`lint` limpios, sin warnings nuevos. Comparación antes/después hecha con la versión vieja del archivo restaurada momentáneamente (`git stash`) contra el mismo servidor corriendo, para que la comparación sea real y no una estimación. Correctitud de los 3 endpoints de Entusiasmento confirmada con datos de dos participantes distintos en simultáneo (ver punto 3). Todo el dato de prueba se borró al terminar.

## 6. Segunda pasada: el cuello de botella más grande era `listarAgendaUnificada` para participantes reales
Nicolás pidió seguir bajando el tiempo hasta menos de 2 segundos. El primer indicio: medir el waterfall real de red de la página (no endpoint por endpoint aislado) mostró que **para un participante real** (no admin), `/api/agenda/por-actividad` — el "próximo encuentro" que se ve arriba de toda la página — tardaba **~4 segundos** ella sola.

**Causa**: `listarAgendaUnificada` (`lib/agenda-unificada.ts`), que arma la agenda unificada usada por las 4 actividades, calcula el acceso a **las 4 actividades completas** (`casatalentos`, `conectando-sentidos`, `mentorias`, `terapia`) más el estado de pago de mentorías/terapia — 6 llamados en total — aunque quien pregunta solo quiera el próximo encuentro de una sola actividad. Para colmo, esos 6 llamados se hacían **uno atrás del otro** (`for` con `await` adentro), no en simultáneo. Sumado a eso, la consulta de `reservas` no tenía ningún filtro de fecha ni límite — traía **toda la tabla histórica completa** (meses de reservas ya pasadas) en cada pedido.

- Los 6 llamados (4 de acceso por actividad + 2 de estado de pago) pasaron a `Promise.all` — son independientes entre sí, la decisión final no cambia, solo el orden en que se piden.
- La consulta de `reservas` ahora se limita, con un join (`disponibilidades!inner(fecha)` + `.gte("disponibilidades.fecha", hoy)`), a reservas de encuentros futuros — que es lo único que el código termina usando (se verificó leyendo el resto de la función: solo se consulta `reservaPorDisponibilidad` para disponibilidades ya filtradas a `fecha >= hoy`, así que ninguna reserva pasada se estaba usando para nada, pese a traerse siempre).

**Medido, no estimado** (con un participante real de prueba, pagado y con acceso, restaurando momentáneamente la versión vieja con `git stash` contra el mismo servidor): la versión vieja tardaba **~4.0 segundos** consistentes; la nueva, **~1.2-1.3 segundos**. Sigue siendo el endpoint más pesado de la página, pero bajó a un tercio.

## 7. Límite real: la carga completa de la página, medida en producción local
Se armó un waterfall de red real (Playwright, participante de prueba real con pago al día) para ver cuánto tarda la página entera, no un endpoint aislado. Hallazgo importante: **medir contra el servidor de desarrollo (`npm run dev`) da números poco confiables** — measurements en dev mostraron los mismos endpoints tardando 3-4 veces más que en una build de producción real (`npm run build && npm run start`) corrida en la misma máquina, y con mucha variación entre corridas — se confirmó que la máquina de desarrollo tenía poca memoria libre disponible después de una sesión larga (muchas horas, muchos procesos de prueba), lo que mete ruido en cualquier medición local que no se puede achacar al código.

Con la build de producción corriendo localmente, la carga completa de `/casatalentos` para un participante real terminó en **~2.5 segundos** (contra ~3.1s en modo desarrollo, mismos datos) — más cerca del objetivo de 2 segundos pero todavía por encima. Los ~9-10 pedidos que dispara la página se ejecutan todos en paralelo desde el navegador (eso ya estaba bien), pero **local, en esta máquina, corren más lento en conjunto que cada uno por separado** — un patrón consistente con contención de recursos de esta laptop en este momento (memoria/CPU compartida entre el servidor, el navegador de prueba, y el resto de lo que tenía abierto), no necesariamente representativo de cómo se va a comportar en Vercel (cómputo dedicado, sin compartir con nada de esto).

**Conclusión honesta**: se hicieron las dos optimizaciones de fondo más grandes que había para hacer sin arriesgar código (`casatalentos/listar` y `listarAgendaUnificada`, ambas con mejoras de 3x a 20x medidas de verdad) — el resto de lo que queda no son bugs de código sino la suma de ~9-10 pedidos concurrentes, cada uno ya razonablemente liviano. Para saber si ya se llegó a menos de 2 segundos de verdad hace falta medirlo contra el sitio desplegado en Vercel, no contra esta máquina — recomendado como siguiente paso antes de seguir optimizando a ciegas.

## 8. Pendiente
- Confirmar el tiempo real de carga contra producción (Vercel) una vez pusheado esto, para saber si hace falta seguir optimizando o si ya alcanza.
- Fase D: agente de IA (recordatorio semanal por mail, diagnóstico admin on-demand) — arranca después de esto.

Commiteado y pusheado (`5d62d2c`).

---

# Sesión de trabajo 2026-08-12 (continuación) — Fase D1: agente de IA, recordatorio semanal por mail

## 1. Objetivo
Primera integración de un modelo de lenguaje en todo el proyecto. Alcance de esta entrega: el recordatorio semanal automático por mail a cada participante activo de Entusiasmento, con las reglas ya dictadas por Nicolás en la sesión de diseño original (2026-08-09/11): nunca resuelve lo que la persona tiene que resolver, ayuda a ordenar/planificar con preguntas (nunca respuestas), deriva dudas reales a Nicolás, trae la frase del oráculo del campus, y nunca reemplaza el vínculo humano. Canal: mail únicamente (Resend, ya integrado). El diagnóstico on-demand para admin y el mail resumen semanal para Nicolás quedan para una Fase D2 aparte.

## 2. API key de Anthropic
Nicolás nunca había trabajado con esto ("no entiendo nada respecto a agentes, es la primera vez") — se le explicó en criollo qué es una API key y se lo guió paso a paso (cuenta en console.anthropic.com, tarjeta con tope bajo, generar la key). La pegó en el chat y quedó guardada únicamente en `.env.local` (`ANTHROPIC_API_KEY`, confirmado que `.env*` está en `.gitignore` antes de escribirla) — nunca se sube a GitHub. **Pendiente**: cargar esa misma variable en Vercel cuando se confirme el despliegue de esta fase (mismo patrón ya usado con `CRON_SECRET`/`GOOGLE_CALENDAR_OWNER_EMAIL`).

## 3. Qué se construyó
- **`lib/ai.ts`** (nuevo): primer wrapper de LLM del proyecto — `fetch` directo a la API de Mensajes de Anthropic, sin SDK oficial (mismo criterio hand-rolled que Resend/MercadoPago). Modelo `claude-haiku-4-5-20251001` (Haiku, el más económico, acorde al presupuesto de ~US$5/mes que fijó Nicolás). Una sola función, `generarTextoIA({ system, prompt, maxTokens })`.
- **`lib/oraculo.ts`** (nuevo): se extrajo `FRASES_ORACULO` y la función determinística que elige la frase del día (semilla = fecha + email) desde `app/campus/page.tsx`, que antes la tenía duplicada inline — ahora `campus/page.tsx` importa de acá (mismo comportamiento, cero cambios visibles) y el agente usa exactamente la misma frase que ya ve la persona en el campus.
- **`lib/agente-entusiasmo.ts`** (nuevo, el corazón de la Fase D1): por cada participante activo de `casatalentos` (reutiliza `listarParticipantesActividad`, sin endpoint nuevo), arma un mail con: la frase del oráculo, un párrafo breve generado por el modelo (2 a 4 oraciones, con una pregunta abierta puntual sobre sus tareas pendientes o invitándolo a definir qué se propone si no cargó nada), y la lista de tareas pendientes con fecha/hora **renderizada por código, no por el modelo** — decisión deliberada: la IA nunca inventa ni transcribe los datos estructurados (evita que alucine una tarea o una fecha), solo aporta la parte reflexiva/humana. El *system prompt* codifica las reglas de Nicolás de forma literal (no resolver, preguntar, derivar dudas reales a Nicolás, nunca reemplazar el vínculo humano, sin sonar "a IA").
- **`app/api/entusiasmo/agente/recordatorio-semanal/route.ts`** (nuevo, GET): mismo patrón de auth que el resto de endpoints llamados por cron (`CRON_SECRET` en `Authorization`).
- **`app/api/cron/diario/route.ts`**: se agregó una rama más, solo los lunes (`diaSemana === 1`), llamando al endpoint de arriba — mismo cron único ya existente, sin sumar un cron nuevo (límite de 2/Hobby de Vercel, documentado en el incidente de agosto).

## 4. Diseño: qué genera la IA y qué no
Deliberado, para minimizar tanto el costo como el riesgo de que el modelo "invente": el modelo **solo** escribe el párrafo reflexivo con la(s) pregunta(s) abierta(s) — nunca la lista de tareas (esa la arma el código a partir de `entusiasmo_tareas`, igual que ya se muestra en la página), nunca la frase del oráculo (ya es determinística, se le pasa como dato, no se le pide que la genere ni que la repita), y nunca un saludo/despedida (los pone la plantilla del mail). Esto separa lo automatizable-con-seguridad (datos, estructura) de lo que necesita el "toque humano" (la reflexión), en línea con el criterio del documento fundacional de ENTHEOS citado en la sesión de diseño: *"se automatiza todo lo que rodea a la conversación, nunca la conversación"*.

## 5. Probado en vivo, con foco en las 3 reglas más sensibles
Se probaron 3 escenarios reales contra la API de Anthropic (sin pasar por mail todavía, solo el texto crudo del modelo) antes de dar por buena la integración:
1. **Con tareas y contexto personal** ("armar contenido audiovisual", 2 tareas con fecha): el modelo resumió las tareas y preguntó por el orden que tiene sentido para la persona — no le dijo qué hacer primero.
2. **Sin tareas cargadas**: invitó con una pregunta a definir qué se entusiasma/para qué está ahí, sin inventar datos que no se le dieron.
3. **El caso más sensible — una "tarea" que en realidad es una decisión real** ("decidir si registrar la marca antes de lanzar"): el modelo **no la resolvió** — hizo una pregunta abierta y explícitamente sugirió hablarlo con Nicolás. Este es exactamente el comportamiento de derivación que Nicolás pidió como no negociable.

Ajuste menor tras la primera ronda: el modelo repetía el nombre de la persona al arranque del párrafo (redundante con el "Hola {nombre}," que ya pone la plantilla) — se agregó una instrucción explícita al *system prompt* ("no uses el nombre de la persona") y se confirmó corregido en una segunda ronda de los mismos 3 casos.

**Prueba de punta a punta** (proyecto + tareas de prueba descartables, temporalmente vía un endpoint de test que se creó y se borró en la misma sesión): primer intento con un email `@example.com` — Resend lo rechazó como se esperaba (mismo comportamiento ya documentado en sesiones anteriores de Comunicaciones), lo cual **destapó un bug real** en el manejo de errores: `enviarRecordatorioSemanalParticipante` daba por exitoso el envío con solo que `enviarComunicacionIndividual` no tirara una excepción — pero esa función nunca tira excepción ante un fallo de Resend, lo registra "en frío" (mismo criterio ya usado en pagos: un fallo de mail no debe romper el flujo) y devuelve el resultado real en un campo. Se corrigió para chequear `resultado.enviado` de verdad. Repetido el test contra `delivered@resend.dev` (la dirección de prueba oficial de Resend, entrega real sin mandarle nada a una persona real): **envío real confirmado** (`estado: "enviado"`, `proveedor_id` real de Resend), registrado correctamente en `comunicacion_envios` con `tipo: "agente_recordatorio_semanal"`. Datos de prueba borrados al final; el endpoint temporal de test se eliminó del código.

**Costo real medido** (no estimado): ~600 tokens de entrada + ~70-115 de salida por participante — con el volumen actual de Entusiasmento (activos de un solo dígito hasta poco más de diez), el gasto semanal de esta función es una fracción muy chica del presupuesto de ~US$5/mes.

## 6. Pendiente
- Cargar `ANTHROPIC_API_KEY` en las variables de entorno de Vercel antes de que corra el primer lunes en producción.
- Fase D2: panel de diagnóstico on-demand para admin + mail resumen semanal para Nicolás con sugerencias de mejora (necesita guardar una foto semanal de actividad para poder comparar "de una semana a la otra" — no arrancado).
- **No se hizo commit todavía** — a la espera de confirmación de Nicolás.

---

# Sesión de trabajo 2026-08-13 — Fase D completa: calendario alternado, tabla de registro, informe diario y tono final

## 1. Objetivo
Ampliar la Fase D1 (que solo mandaba un mail genérico los lunes) a la versión real pedida por Nicolás: calendario de envío alternado, una tabla que registre **todo** (enviados y omitidos, con motivo), un informe diario para él, la regla de tono #6 (no repetirse), y el *system prompt* final de tono que Nicolás terminó de diseñar en otra conversación de Claude (a partir del brief que se le armó — ver Artifact de la sesión anterior).

Se pidió diagnóstico y plan antes de tocar código — se hizo, con una vuelta de correcciones antes de arrancar (ver punto 2).

## 2. Reconciliación de datos — importante para el futuro
Antes de escribir código, Nicolás verificó el padrón contra producción y encontró una discrepancia real: mi conteo inicial (8 inscriptos activos a `casatalentos`) no coincidía con lo que él veía. Investigado a fondo: **hay dos tablas separadas** que registran actividad de un participante — `inscripciones` (la única que usa `resolveActivityAccess`, el gate real de acceso de toda la plataforma — confirmado por código, `usuario_actividades` no interviene en ningún control de acceso real) y `usuario_actividades` (tabla más nueva, nacida el 7 de mayo, usada solo por pantallas admin puntuales: HDR, agenda, resumen de personas). `admin@escuela.com` y `participante@escuela.com` tienen su fila en `inscripciones` desde el 24 de marzo — antes de que `usuario_actividades` existiera — por eso nunca aparecieron ahí. No es una inconsistencia de datos real, son las 2 cuentas de prueba hardcodeadas del proyecto (`lib/auth.ts`), nunca gente real. **La corrección no fue cambiar de tabla** (`usuario_actividades` no es la fuente real de acceso, migrar ahí arriesgaba excluir a alguien con acceso legítimo que nunca pasó por esa pantalla admin puntual) — fue excluir del padrón del agente esos emails hardcodeados puntualmente.

También se confirmó el caso de Agustina (`gotydevoto@gmail.com`, subió videos hasta el 27/07): su inscripción a `casatalentos` está `inactiva` en ambas tablas por igual — lo que tiene activo es **Terapia** (pasó de una actividad a la otra en algún momento). El agente la excluye correctamente, no hacía falta ningún ajuste.

**Padrón real de participantes** (gente real, sin las cuentas de prueba): Florencia Varela, María Gabriela Rodríguez Luna, Cristian Ruggiero, Verónica Alejandra Saracho — 4 personas. Ninguna pasa el gate de Entusiasmento todavía (`ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES = false`), así que durante la beta el único destinatario real es **Cuchulain Mago** (`consultasbpe@gmail.com`) — a propósito, es el email de prueba de la beta, decisión explícita de Nicolás.

## 3. Qué se construyó

- **`lib/entusiasmo-acceso.ts`** (nuevo): se extrajeron `ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES`/`ENTUSIASMENTO_BETA_EMAILS` (antes vivían solo dentro de `app/casatalentos/page.tsx`) a un módulo compartido con `tieneAccesoEntusiasmento(email, esAdmin)` — usado tanto por la UI como por el agente, para que **nunca puedan desincronizarse** (si algún día alguien cambia el gate de la UI sin tocar el agente, o viceversa, dejaría de tener sentido — ahora es literalmente la misma función). `app/casatalentos/page.tsx` se actualizó para importar de acá en vez de declarar las constantes localmente — mismo comportamiento, cero cambios visibles.
- **`lib/agente-entusiasmo-calendario.ts`** (nuevo): `ANCLA_LUNES = "2026-08-17"` (constante con comentario grande de "no tocar nunca desplegada"), `esSemanaPar`/`esDiaDeEnvioHoy` — cuentan semanas transcurridas por diferencia de días ÷ 7 desde la ancla, **nunca** número de semana ISO (evita el problema de los años de 53 semanas que pidió Nicolás evitar). Semana par → lunes/miércoles/viernes; impar → martes/jueves. Verificado en vivo contra 10 fechas cubriendo un ciclo completo de 4 semanas — el patrón alterna correctamente.
- **`lib/ai.ts`**: nueva función `generarConHerramientaIA` — fuerza al modelo a responder con `tool_use` en vez de texto libre (más confiable que pedir "respondé en JSON" y parsear a mano). Se usa para que el modelo devuelva `{ es_decision_real, texto }` en una sola llamada, sin costo extra.
- **`sql/2026-08-13_entusiasmo_agente_mensajes.sql`** (corrido por Nicolás): tabla nueva `entusiasmo_agente_mensajes` — `participante_email`, `fecha`, `tipo_caso` (`con_fecha`/`sin_fecha`/`sin_tareas`/`decision`), `texto_generado`, `estado` (`enviado`/`omitido`), `motivo_omision`, `valoracion` (nullable, la carga Nicolás a mano — **sin pantalla de revisión en esta fase**, a pedido explícito: "todavía no sé bien qué voy a querer evaluar... construir la pantalla antes de saberlo es trabajo al pedo"), `nota`.
- **`lib/agente-entusiasmo.ts`** (reescrito): 
  - *System prompt* final, diseñado por Nicolás en otra conversación a partir del brief (Artifact) armado en la sesión anterior — usado **tal cual**, incluida la regla 6 (no repetirse: se le pasan las últimas hasta 4 frases ya enviadas a esa persona, consultando la tabla nueva).
  - `tipo_caso` se arma combinando: 3 categorías calculadas por datos (`sin_tareas`/`con_fecha`/`sin_fecha`, según haya tareas pendientes y si tienen fecha) + `es_decision_real` que devuelve el modelo — si es `true`, pisa el tipo a `decision` sin importar la categoría de datos.
  - **Ya no crea un `entusiasmo_proyectos` vacío automáticamente** (corrección de Nicolás a su propio pedido anterior) — pero sí genera y manda el mensaje del caso `sin_tareas` igual, con `queTeEntusiasma`/`paraQue`/tareas vacíos. Si no hay proyecto, tampoco hay dónde guardar el texto para el cartel de "Mi espacio" — se omite ese paso puntual sin romper el resto (el mail se manda igual).
  - **Padrón**: `listarParticipantesActividad("casatalentos")` (misma función que ya usa CoFruto y el selector de admin) menos `EMAILS_EXCLUIDOS_SIEMPRE` (las 3 cuentas de prueba + `interlegerensa@gmail.com`). Por cada uno: si no pasa `tieneAccesoEntusiasmento`, se omite con motivo `sin_acceso_habilitado`; si falla la generación del texto, `error_generando_texto`; si falla el envío real (Resend), `error_enviando_mail`. **Todos** los casos (enviado u omitido) generan una fila en `entusiasmo_agente_mensajes` — nunca se pierde silenciosamente a quién no le llegó nada ni por qué.
  - `ejecutarAgenteEntusiasmoDiario()`: función única que decide si hoy toca (`esDiaDeEnvioHoy`), procesa a todo el padrón si corresponde, y **siempre** — toque o no — le manda un informe a Nicolás (`nicolasbusico@entheosescuela.com`, ya estaba en `MAIL_REPLY_TO`, no se sumó variable nueva): si no tocaba, un mail de una línea; si tocaba, conteos + tabla de enviados (con el texto completo) + tabla de omitidos (con motivo) + cuánto tardó la corrida (telemetría barata para vigilar el límite de Vercel a futuro, ver punto 5).
- **`app/api/entusiasmo/agente/diario/route.ts`** (reemplaza a `.../recordatorio-semanal/`, que se borró — el nombre viejo ya no describía bien lo que hace): mismo patrón de auth con `CRON_SECRET` que el resto de endpoints de cron.
- **`app/api/cron/diario/route.ts`**: se sacó el `if (diaSemana === 1)` — ahora llama al agente **todos los días** (mismo patrón que comunicaciones programadas), y el endpoint decide adentro si corresponde. Motivo del cambio: el cron de Vercel Hobby corre una sola vez al día — que decida el endpoint, no el cron, es lo único compatible con el calendario alternado (lunes/miércoles/viernes una semana, martes/jueves la otra).

## 4. Riesgo de tiempo de ejecución de Vercel — verificado contra la documentación actual, no de memoria
Confirmado contra la doc oficial de Vercel (no supuesto): **plan Hobby = 300 segundos, default Y máximo a la vez** — no hay nada que subir por configuración, es el techo real. Ese presupuesto lo comparte **toda** la corrida de `cron/diario` (comunicaciones programadas + reintento de Google + el agente + lo mensual/semanal que corresponda ese día).

Medido en vivo (no estimado): LLM (Haiku) ≈1.3-2.8s, envío por Resend ≈0.3-0.9s. Con el padrón real actual (7 personas evaluadas, 4 se cortan al toque por el gate, 1 sola genera+manda de verdad) la corrida completa tardó **9.6 segundos**. Conclusión: sin riesgo hoy ni en el corto plazo; si el programa crece mucho (orden de 50-60 personas activas, sumado al resto de tareas del cron) ahí sí conviene revisarlo — la corrida ya reporta su propia duración en el informe diario para tener visibilidad si eso empieza a pasar.

## 5. Verificado en vivo
- Calendario: 10 fechas cubriendo un ciclo completo de 4 semanas, patrón correcto en las 10.
- **Corrida real de punta a punta** contra producción (no datos de prueba descartables — el padrón real, tal como va a correr en producción): 5 candidatos evaluados (Cristian, Cuchulain, Florencia, María Gabriela, Verónica), 4 omitidos por `sin_acceso_habilitado`, 1 enviado (Cuchulain) — texto real generado: *"¿Hay algo que ya sepas que querés producir acá?"* (caso `sin_tareas`, porque hoy no tiene tareas cargadas). Confirmado en `entusiasmo_agente_mensajes` (las 5 filas, con motivo correcto cada una), en `entusiasmo_proyectos` de Cuchulain (texto guardado para el cartel), y en `comunicacion_envios` (2 mails reales enviados: el recordatorio a Cuchulain y el informe a Nicolás, ambos `estado: "enviado"`).
- **Calidad de la salida estructurada** (la duda que tenía Nicolás: "a veces los modelos escriben más plano cuando generan dentro de una herramienta"): se generaron 4 muestras más vía `tool_use` (con fecha, sin fecha, decisión real, y un caso de no-repetición con 2 frases previas de ejemplo) — la calidad no bajó, las 4 leen naturales y cumplen las 5 reglas de tono + la derivación a Nicolás en el caso de decisión.
- `typecheck`/`lint` limpios en todo el build, sin warnings nuevos.

## 6. Pendiente
- Cargar `ANTHROPIC_API_KEY` en las variables de entorno de Vercel antes del próximo despliegue (mismo lugar que `CRON_SECRET`).
- Fase D2: panel de diagnóstico on-demand para admin + mail resumen semanal con sugerencias de mejora — sigue sin arrancar.

Commiteado y pusheado (`6f52e79`).

---

# Sesión de trabajo 2026-08-13/14 (continuación) — Ajustes chicos + prioridad de tareas + versiones de Coordenadas

## 1. Renombre "Empujón" → "Destello"
A pedido de Nicolás, el cartel de "Tareas semanales" y el aviso de arriba de la página pasaron de "🎯 Empujón de la semana"/"Tenés un empujón nuevo" a "✨ Destello de la semana"/"Tenés un destello nuevo" (`app/casatalentos/page.tsx`). Cambio puramente de texto/emoji, sin tocar lógica.

## 2. Tareas semanales: orden por fecha + semáforo de prioridad
- **Orden**: `GET /api/entusiasmo/tareas` ahora ordena por `fecha` (ascendente, sin fecha al final) y dentro del mismo día por `hora` (con hora antes que sin hora) — antes ordenaba por `created_at`.
- **Prioridad**: columna nueva `entusiasmo_tareas.prioridad` (`sql/2026-08-13_entusiasmo_tareas_prioridad.sql`, corrida por Nicolás), valores `verde`/`amarillo`/`rojo` (verde = más prioritario/avanzar, rojo = menos prioritario/frenar — así lo definió Nicolás). En la UI, 3 puntitos de color por tarea, sin ningún texto explicativo (a propósito, "lo voy a explicar yo") — tocar uno lo marca, tocar el mismo de nuevo lo saca. `PATCH /api/entusiasmo/tareas` valida que `prioridad` sea uno de los 3 valores o `null`.
- **Bug de percepción reportado y corregido**: Nicolás avisó que el semáforo se sentía lento. Causa real: `cambiarPrioridadTarea` esperaba la respuesta del `PATCH` y **después** volvía a pedir todas las tareas (`cargarTareas()`) antes de mostrar cualquier cambio — dos viajes de red seguidos antes de que el usuario viera algo. Se cambió a actualización **optimista**: el color cambia en pantalla al toque (`setTareas` local), el `PATCH` viaja en segundo plano, y solo si falla de verdad se revierte el color y se avisa. Mismo patrón podría aplicarse a otras acciones si vuelve a reportarse lentitud en algo similar.
- **Verificado en vivo** con datos descartables: orden correcto (fecha+hora, sin fecha al final), los 3 colores se marcan/desmarcan bien, sin errores de consola. Un primer intento de prueba automatizada dio falsos negativos por recompilaciones de Next (HMR) en simultáneo con los clics — no era un bug real, se confirmó repitiendo la prueba con el archivo ya estable.

## 3. Coordenadas: versiones anteriores sin perderlas
Pedido de Nicolás: que el participante pueda reescribir sus Coordenadas después de un aporte de admin sin perder lo que había escrito antes.

- **`sql/2026-08-14_entusiasmo_coordenadas_versiones.sql`** (corrida por Nicolás): tabla nueva `entusiasmo_coordenadas_versiones` (`proyecto_id`, `campo`, `contenido`, `created_at`).
- **`PUT /api/entusiasmo/proyecto`**: antes de sobrescribir, ahora siempre lee la fila existente completa (antes solo leía `participante_nombre` en el caso de admin editando a otro). Por cada uno de los 8 campos de Coordenadas (no incluye `pitch_contenido` ni `resultado_semanal`, que ya no se editan desde acá), si el valor anterior existía y es distinto del nuevo, se archiva el valor **anterior** como una versión — automático, sin ningún botón ni paso extra para el participante. Si el campo estaba vacío o no cambió, no se archiva nada (evita versiones vacías o duplicadas).
- **`GET /api/entusiasmo/coordenadas-versiones`** (nuevo, mismo patrón `?email=` que el resto de endpoints de Entusiasmento): devuelve todas las versiones archivadas del participante, un solo viaje con join (mismo patrón ya usado en producciones/aportes/tareas).
- **UI**: debajo de cada campo (tanto en el modo edición propio como en el modo lectura de admin viendo a otro), un link "Ver versiones anteriores (N)" que despliega el historial con fecha — se carga solo cuando se abre la sección Coordenadas (perezoso, no en cada carga de página) y se refresca después de guardar.
- **Verificado en vivo** con datos descartables: 3 guardados seguidos (mismo valor → no archiva; valor nuevo → archiva el anterior; valor nuevo otra vez → archiva el segundo), confirmado el orden correcto por API, y confirmado visualmente tanto en el espacio propio como en la vista de admin mirando a otro participante — en ambos casos el link aparece con el conteo correcto y despliega el texto y la fecha de cada versión.

## 4. Verificado en vivo (general)
`typecheck`/`lint` limpios en todo — el único warning nuevo es la misma clase de "dependencia faltante en useEffect" que ya existe para las otras 4 funciones `cargarX` del archivo (patrón intencional del proyecto, no un problema real).

## 5. Pendiente
- Fase D2 del agente (panel de diagnóstico admin + resumen semanal) sigue sin arrancar.

## 6. Dos arreglos más antes de commitear

**"Guardar coordenadas" poco visible — bug real, no de gusto**: `className="workspace-button"` (sin sufijo) **no existe** como clase en `app/globals.css` — solo existen `workspace-button-primary`, `-secondary` y `-ghost`. El botón se renderizaba sin ningún estilo (básicamente un `<button>` de HTML puro). Se cambió a `workspace-button-primary` (el mismo estilo prominente — degradé dorado, texto blanco — que ya usan otras acciones principales). De paso se encontró y corrigió el mismo problema en el botón de guardar el pitch (`app/casatalentos/page.tsx`), que tenía exactamente la misma clase inexistente.

**"Ya lo vi" del Destello no daba ninguna señal al tocarlo**: el botón SÍ funcionaba (marcaba como visto en `localStorage` y hacía desaparecer el aviso de arriba de la página), pero como el aviso de arriba y el botón "Ya lo vi" están en partes distintas de la pantalla, tocar el botón no cambiaba nada visible ahí mismo — el único cambio real quedaba fuera de la vista. Se corrigió para que el propio botón desaparezca y se reemplace por "✓ Visto" en el momento del click, dando una señal inmediata en el mismo lugar donde se tocó.

**Verificado en vivo** ambos: el botón de Guardar coordenadas se ve con el estilo dorado prominente (capturado visualmente); el flujo completo de Destello confirmado con datos descartables — aviso arriba visible + botón "Ya lo vi" visible → click → aviso arriba desaparece + botón se reemplaza por "✓ Visto" → recargar la página, el aviso de arriba se mantiene oculto (persistido). `typecheck`/`lint` limpios, sin warnings nuevos.

---

# Sesión de trabajo 2026-08-14 (continuación) — Limpieza de datos, acceso sin pago para Entusiasmento, y renombrado completo CasaTalentos→Entusiasmento

## 1. Limpieza de datos de prueba
Antes de esto se investigó a fondo qué borrar (ver la pregunta que se le hizo a Nicolás): ninguno de los 10 mensajes de "Valoraciones y agradecimientos" era de Cuchulain — eran mensajes reales de Verónica Alejandra y Agustina. Nicolás confirmó borrar de todas formas **todas** las Valoraciones actuales (no solo las de Cuchulain), para arrancar esa sección en blanco.

- **Respaldo primero**: `respaldos/2026-08-14_valoraciones_y_pruebas_cuchulain.json` (carpeta nueva, agregada a `.gitignore` — nunca se sube al repo). Incluye los 10 mensajes de Valoraciones completos y todo el contenido de prueba de Cuchulain (coordenadas, producciones, tareas, aportes, versiones) tal como estaban antes de borrar.
- **Borrado**: los 10 mensajes de `casatalentos_mensajes`; en la cuenta de Cuchulain — sus producciones (con el archivo del bucket), tareas, aportes y versiones de coordenadas; y se vació el texto de sus 8 campos de Coordenadas (sin borrar la fila del proyecto, que sigue existiendo con su pitch/destello real).
- **A propósito no se tocó**: el `agente_recordatorio_texto`/`agente_recordatorio_generado_at` de Cuchulain ni su fila en `entusiasmo_agente_mensajes` — eso es el envío real del agente (Fase D), no una prueba.

## 2. Acceso a Entusiasmento sin pago
A pedido de Nicolás, `resolveActivityAccess` (`lib/authz.ts`) ahora trata `casatalentos` igual que ya trataba `mentorias`: acceso incondicional (`acceso: true`) aunque no haya pago o esté pendiente/rechazado. Es el mismo bloque de código que ya existía para mentorías, solo se sumó la condición — no se tocó el resto del flujo de pagos (facturación, honorarios, cobros) en absoluto, solo el *gate* de entrada.

**Verificado en vivo**: participante de prueba descartable, inscripción activa a `casatalentos` **sin ningún honorario ni pago cargado** — antes hubiera dado 403 `sin_pago`, ahora entra con 200 y sin el cartel de "Acceso no habilitado".

## 3. Renombrado completo CasaTalentos → Entusiasmento
Barrido de todo el texto visible al usuario, en dos capas:

**Código** (~25 lugares, en `app/`, `lib/` y `components/`): términos y condiciones, consentimientos, `/admin/usuarios` (incluidas las etiquetas de "Configuración de pagos"), `/admin/comunicaciones`, `/agenda` (subtítulo, selector de actividad, títulos), mensajes de error de varios endpoints (`configuracion/pagos`, `casatalentos/listar`, `casatalentos/limpiar`, `casatalentos/recursos`), `lib/core-activities.ts`, `lib/consentimientos.ts`, `lib/hdr.ts`, `lib/admin-person-summary.ts`, `lib/admin-activity-sync.ts`, el panel de admin de Entusiasmento, y las etiquetas de actividad en Mentorías/Terapia (`AgendaActividad`, `AdminAgendaCalendar`, `EspacioAcompanamiento`).

**A propósito NO se tocaron** (son identificadores internos, invisibles para el usuario, y renombrarlos no cambia nada visible — solo suma riesgo): nombres de funciones/variables/componentes como `CasaTalentosAdminPanel`, `cargarDatosCasaTalentos`, `accesoCasaTalentos`, etc. El *slug* `"casatalentos"` (minúscula) tampoco se tocó — es el identificador real en la base y en las URLs, cambiarlo es una migración mucho más grande y riesgosa que no se pidió.

**Datos reales en la base** (esto no lo cubre ningún cambio de código, hacía falta tocarlo aparte):
- `actividades.nombre` (la fila real de la actividad, que varias pantallas leen dinámicamente en vez de un string fijo): `"CasaTalentos"` → `"Entusiasmento"`.
- `disponibilidades.titulo`: 36 filas (reuniones semanales, pasadas y futuras) decían literalmente "Reunión CasaTalentos" — actualizadas a "Reunión Entusiasmento".
- `recursos.nombre`/`recursos.descripcion`: 5 filas con "CasaTalentos" en el texto (Biblioteca de grabaciones, Dispositivo semanal, Reunión semanal, Chat WhatsApp, Incorporación gradual) — actualizadas.

**Sobre "la descripción del link de la web"**: se revisó específicamente — el `metadata` del layout raíz (`app/layout.tsx`) es genérico y nunca mencionó CasaTalentos ("Escuela de trabajo, proceso y creación compartida"), y `/casatalentos` al ser una página 100% cliente no puede tener su propio `metadata` de Next.js (limitación del framework, no hay nada ahí para cambiar). No se encontró ningún lugar real con esa descripción — si Nicolás tenía en mente algo puntual, pedirle que indique dónde lo vio.

**Verificado en vivo**: `/terminos-y-condiciones` y `/admin/usuarios` ya no contienen "CasaTalentos" en ningún lado; `/agenda` se verificó y corrigió tras encontrar los 36 títulos de reunión guardados como datos. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente

Commiteado y pusheado (`104683d`).

---

# Sesión de trabajo 2026-08-14 (continuación 2) — Historial de tareas completadas

## 1. Objetivo
Nicolás pidió que las tareas de la semana, al tildarse como hechas, desaparezcan de la lista de pendientes (para que no se acumulen ahí) y pasen a un historial desplegable aparte.

## 2. Qué se hizo
`app/casatalentos/page.tsx`: se extrajo el renderizado de una fila de tarea a una función compartida (`renderizarFilaTarea`) para no duplicar el JSX entre las dos listas. `tareas` (el estado con todo, sin cambios) ahora se deriva en `tareasPendientesLista` (`!completada`) y `tareasHistorialLista` (`completada`):
- La lista principal solo muestra `tareasPendientesLista`. Si no hay ninguna pendiente, el mensaje distingue dos casos: "Todavía no cargaste tareas para esta semana" (si no hay ninguna tarea en absoluto) vs. "Completaste todo lo que tenías pendiente. ✨" (si hay tareas pero todas están hechas) — antes un solo mensaje cubría mal el segundo caso.
- Debajo, un link "Ver historial (N)" (oculto si no hay ninguna completada) despliega `tareasHistorialLista` — mismas filas, mismos controles (tildar para volver a pendiente, prioridad, fecha), nada nuevo que aprender.
- "Tu ritmo" sigue calculándose sobre el total (`tareas`, sin filtrar) — no cambia, ya contaba completadas vs. total correctamente.

## 3. Verificado en vivo
Con datos descartables: 2 tareas pendientes + 2 completadas — las completadas no aparecen en la lista principal, el link muestra "(2)" y al abrirlo aparecen ambas. Tildar una pendiente como hecha la saca de la lista principal y sube el contador del historial en el momento (confirmado tanto por la respuesta real del `PATCH` como visualmente: "2 de 2 tareas realizadas (100%)", mensaje "Completaste todo lo que tenías pendiente", "Ver historial (2)"). `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- **No se hizo commit todavía** — a la espera de confirmación de Nicolás.

---

# Sesión de trabajo 2026-08-14 (continuación 3) — Video en Producciones + umbral de historial de tareas

## 1. Objetivo
Dos pedidos de Nicolás: (a) poder subir un video liviano en Producciones (sin grabar, solo subir un archivo — a diferencia del Pitch, que sí tiene grabación con `MediaRecorder`); (b) afinar el historial de tareas de la sección anterior: que una tarea completada recién pase al historial desplegable cuando se convierte en la **11ª** tarea marcada como realizada, para que las primeras 10 sigan a la vista y "la barra de avance" (Tu ritmo) siga teniendo sentido visual mientras tanto.

## 2. Qué se hizo

**Video en Producciones**: mismo patrón ya usado para imagen/audio (`preparar-upload` → subida directa al bucket privado → confirmar por POST), sin lógica nueva de flujo — solo se sumó `video` a los tipos aceptados:
- `app/api/entusiasmo/producciones/preparar-upload/route.ts`: `mimePermitido` acepta `video/*` (además de `image/*`/`audio/*`); mensaje de error actualizado.
- `app/api/entusiasmo/producciones/route.ts`: `TIPOS_VALIDOS` suma `"video"`.
- `app/casatalentos/page.tsx`: cuarto botón de tipo ("🎬 Video") junto a texto/imagen/audio; input `<input type="file" accept="video/*">` (sin grabación, como pidió Nicolás); reproductor `<video controls>` agregado en las 3 vistas donde ya se mostraban imágenes/audios de producciones (lista propia en "Mi espacio", miniatura en la grilla de CoFruto — ahí solo ícono 🎬 por espacio, y el modal ampliado de CoFruto con el reproductor completo).
- `MAX_BYTES` se mantuvo en 50MB (mismo límite que ya usa el Pitch para video/imagen).

**Umbral de historial (refina lo de la sesión anterior)**: nueva constante `MAX_TAREAS_COMPLETADAS_VISIBLES = 10`. Las tareas completadas se ordenan por `created_at` descendente (proxy de "más recientemente completada" — no existe una columna `completada_at` dedicada) y se cortan en dos: las primeras 10 quedan en una sección "Completadas" siempre visible (debajo de las pendientes, ya no en la lista de pendientes), el resto (la 11ª en adelante) va al link desplegable "Ver historial (N)" de la sesión anterior, que no cambió de comportamiento. "Tu ritmo" sigue sin tocarse — se calcula igual que siempre sobre el total de tareas (`completadas / total`), nunca estuvo roto por este cambio.

## 3. Verificado en vivo
Con un participante descartable y 11 tareas completadas + 2 pendientes sembradas con `created_at` escalonado: se confirmó que las completadas 1 a 10 aparecen bajo "Completadas" sin necesidad de abrir nada, que la 11ª no está visible hasta abrir el historial, que el contador dice "Ver historial (1)", y que "Tu ritmo" mostró "11 de 13 tareas realizadas (85%)" (correcto, sin cambios en la fórmula).

Para el video, la primera corrida de prueba había arrojado un resultado confuso ("no se encontró la producción en base" pese a que la subida decía éxito) — investigado y confirmado que fue un error del *script* de prueba, no de la app: el filtro de red usado (`url().includes('/api/entusiasmo/producciones')`) matcheaba por accidente tanto el POST de `preparar-upload` como el de confirmación (la URL del primero contiene la del segundo como substring), así que el test se quedó con la respuesta equivocada y consultó la base antes de tiempo. Repetido con un filtro exacto por URL: `preparar-upload` devuelve 200 con la URL firmada, la confirmación devuelve 200 con la fila creada (`tipo: "video"`), la fila aparece en la base, el mensaje "Guardado." se muestra en pantalla, y tras recargar la página el `<video src=...>` se renderiza correctamente. Cero errores de consola en ambas corridas. Datos, usuario y archivo de prueba borrados al final — incluida la entrada temporal que se había agregado a `ENTUSIASMENTO_BETA_EMAILS` en `lib/entusiasmo-acceso.ts` para poder probar como participante (ya revertida, la lista quedó solo con `consultasbpe@gmail.com`). `typecheck`/`lint` limpios, sin warnings nuevos (mismos preexistentes documentados en sesiones anteriores).

## 4. Ajuste final antes de commit: botón sutil "Seleccionar archivo"
Los 3 tipos de Producciones con archivo (imagen/audio/video) usaban el `<input type="file">` nativo directo — con su botón por defecto del navegador, sin relación visual con el resto del formulario. Se reemplazó por el mismo patrón ya usado en `GrabadorVideo.tsx` (input oculto vía `ref` + botón propio que dispara `.click()`): un botón "📎 Seleccionar archivo" con estilo `workspace-button-ghost` (el más discreto de los 3 estilos de botón del proyecto — texto con subrayado al pasar el mouse, sin fondo), mostrando el nombre del archivo elegido debajo a modo de confirmación. Al cambiar de tipo (ej. de Imagen a Video) el archivo elegido se limpia, para no arrastrar por error un archivo del tipo anterior.

**Verificado en vivo** con un participante descartable: confirmado que no queda ningún input nativo visible, que el botón sutil aparece en los 3 tipos (incluido audio, conviviendo con el botón de grabación), que el nombre del archivo se muestra tras elegirlo, y que cambiar de tipo limpia ese nombre correctamente. Cero errores de consola. `typecheck`/`lint` limpios, sin warnings nuevos.

## 5. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`c4c4006`).

---

# Sesión de trabajo 2026-08-14 (continuación 4) — Pestaña de links en Producciones

## 1. Objetivo
Nicolás pidió sumar un quinto tipo a Producciones (junto a texto/imagen/audio/video): links — a la web del proyecto, Instagram, YouTube, u otros que sirvan para mostrarse.

## 2. Qué se hizo
Mismo patrón ya establecido para los otros tipos, sin lógica nueva de flujo — un link no sube archivo, así que reutiliza el circuito simple de "texto" (un solo POST directo, sin `preparar-upload` ni storage):
- `app/api/entusiasmo/producciones/route.ts`: `TIPOS_VALIDOS` suma `"link"`. Validación nueva: si `tipo === "link"`, exige que `contenido` no esté vacío y empiece con `http://` o `https://` (mismo campo `contenido` que ya usa "texto", reutilizado para guardar la URL). Se excluyó `"link"` de la validación que exige `storagePath` (esa sigue aplicando solo a imagen/audio/video).
- `app/casatalentos/page.tsx`: quinto botón de tipo ("🔗 Link"); el formulario para "link" muestra un `<input type="url">` (en vez del `<textarea>` de texto o el selector de archivo de imagen/audio/video) con placeholder `https://...` y una nota aclarando que puede ser la web del proyecto, Instagram, YouTube, u otro. Si el participante pega la URL sin protocolo (ej. `instagram.com/...`), se le antepone `https://` automáticamente antes de guardar — tanto en el cliente como validado de nuevo en el backend. Al cambiar de tipo se limpia tanto `archivoProduccion` como `textoProduccion` (antes solo se limpiaba el archivo), para no arrastrar el link tipeado si se cambia a texto o viceversa.
- Renderizado en las 3 vistas que ya mostraban imagen/audio/video, con ícono 🔗:
  - "Mi espacio" (lista propia): el link se muestra como `<a>` clickeable (`target="_blank"`), con el título como etiqueta arriba (o "Link" si no se puso título).
  - CoFruto, grilla de miniaturas: solo el ícono 🔗 (mismo criterio ya usado para audio/video, que tampoco muestran preview en la miniatura chica).
  - CoFruto, modal ampliado: ícono grande + título (si tiene) + el link completo, clickeable.

## 3. Verificado en vivo
Con dos participantes descartables (uno que crea el link, otro que lo ve en CoFruto): creación con URL sin protocolo (`instagram.com/pruebaentusiasmo`) confirmada guardada en base ya normalizada a `https://instagram.com/pruebaentusiasmo`; validación de campo vacío rechazada con el mensaje esperado ("Pegá un link antes de guardar."); el link se renderiza como `<a href="https://instagram.com/...">` clickeable en "Mi espacio"; al marcarlo visible, aparece en CoFruto tanto en la grilla (ícono 🔗, confirmado con una espera más generosa después de comprobar que el primer intento había medido antes de que la carga de la mesa común terminara — no era un bug, la respuesta de `/api/entusiasmo/cofruto` tardó más que el tiempo de espera inicial del test) como en el modal ampliado (título "Instagram" + link clickeable). Cero errores de consola/página en ninguna corrida. Datos de prueba borrados al final, incluidas las dos entradas temporales agregadas a `ENTUSIASMENTO_BETA_EMAILS` para poder probar como participante (ya revertidas, la lista quedó solo con `consultasbpe@gmail.com`). `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Bug reportado por Nicolás y corregido: warning de input controlado/no controlado al elegir Link
Al tocar "🔗 Link", React tiraba en consola: *"A component is changing an uncontrolled input to be controlled"*. Causa: los 5 tipos de Producciones (texto/imagen/audio/video/link) se arman con una cadena de ternarios que ocupan la misma posición en el árbol — React reconcilia por posición y tipo de etiqueta, no por a qué rama del ternario pertenecen. Como los inputs de archivo (imagen/audio/video) son `<input>` sin `value` (no controlados) y el input de link es `<input>` con `value={textoProduccion}` (controlado), al cambiar de video/audio/imagen a link React reutilizaba el mismo nodo `<input>` del DOM y solo le cambiaba los atributos — pasando de "sin value" a "con value" sobre la marcha, exactamente lo que dispara ese warning.

**Corrección**: se agregó `key` (`"texto"`/`"audio"`/`"video"`/`"link"`/`"imagen"`) al elemento raíz de cada rama del ternario, en `app/casatalentos/page.tsx`. Con `key` distinta, React desmonta y vuelve a montar en cada cambio de tipo en vez de reutilizar el nodo, evitando la mezcla de atributos.

**Verificado en vivo** con un participante descartable: recorrido completo por los 5 tipos, ida y vuelta varias veces (texto → imagen → audio → video → link → texto → video → link → imagen → link) sin ningún error ni warning de consola, y confirmado que el campo de link sigue funcionando normalmente después del recorrido (se puede escribir y el valor se carga bien). `typecheck`/`lint` limpios, sin warnings nuevos.

## 5. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`3d3aac8`).

---

# Sesión de trabajo 2026-08-14 (continuación 5) — Apertura de Entusiasmento a todos los participantes

## 1. Objetivo
Nicolás pidió sacar el gate: los participantes (no solo Cuchulain, la cuenta de beta) veían el cartel "se está terminando de armar" en vez de "Mi espacio"/CoFruto.

## 2. Qué se hizo
`lib/entusiasmo-acceso.ts`: `ENTUSIASMENTO_ABIERTO_A_PARTICIPANTES` pasó de `false` a `true` — el flag que existía justo para este momento (documentado desde la Fase A2). `ENTUSIASMENTO_BETA_EMAILS` se dejó tal cual (con `consultasbpe@gmail.com`) en vez de vaciarse, ya sin efecto real hoy (`esAdmin || true || ...`), pero disponible como mecanismo listo por si en el futuro hay que volver a cerrar el acceso general y reabrirlo solo para casos puntuales.

**Efecto colateral a tener en cuenta**: `tieneAccesoEntusiasmento` también decide el padrón del agente de IA diario (`lib/agente-entusiasmo.ts`, recordatorio automático por mail con calendario alternado lunes/miércoles/viernes una semana, martes/jueves la otra). Con el flag en `true`, deja de ser solo Cuchulain — a partir de ahora **todos los inscriptos activos a Entusiasmento con acceso real** (verificado antes de este cambio: Florencia Varela, María Gabriela Rodríguez Luna, Pablo Tello Novella, Cristian Ruggiero, Verónica Alejandra Saracho, además de Cuchulain — 6 personas reales; se excluyen las cuentas de prueba hardcodeadas y `interlegerensa@gmail.com` como ya hacía el agente) van a empezar a recibir el mail automático del agente en el próximo día que corresponda según el calendario. No hacía falta ningún cambio de código para esto — es una consecuencia directa de compartir la misma función de acceso, tal como se había diseñado a propósito en la Fase D.

## 3. Verificado en vivo
Con un participante descartable **sin** estar en `ENTUSIASMENTO_BETA_EMAILS` ni ser admin: antes del cambio hubiera visto el cartel de "en construcción"; con el flag en `true`, entra directo a "Mi espacio" (ve Coordenadas) y tiene el botón de CoFruto disponible — confirmado con el flag ya aplicado. Cero errores de consola. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`8eafceb`).

---

# Sesión de trabajo 2026-08-14 (continuación 6) — Cuenta admin en CoFruto + campo "Nombre del proyecto" en Coordenadas

## 1. Diagnóstico: "¿por qué no veo mi producción de texto en CoFruto?"
Nicolás había creado una producción de texto desde su cuenta admin real (`nicolasbusico.psi@gmail.com`) y no la veía reflejada en CoFruto. Investigado: la producción estaba guardada correctamente y ya marcada `visible: true` — el problema no era la producción ni el nombre de usuario (como sospechaba Nicolás), sino que **su cuenta admin nunca tuvo una inscripción activa a `casatalentos`** (es la cuenta de dueño/admin, no una cuenta de participante) — mismo hallazgo puntual que ya se había documentado para el Pitch en una sesión anterior, ahora confirmado que aplica igual a Producciones porque las dos features dependen de la misma función `listarParticipantesActividad`. Confirmado con Nicolás antes de tocar datos reales: se le dio de alta una inscripción activa a `casatalentos` (`inscripciones.id = 125`, sin afectar pagos/honorarios — Entusiasmento ya tiene acceso incondicional sin pago). Verificado en vivo con un participante descartable viendo CoFruto: su puesto ("Nicolás") ya aparece.

## 2. Reordenamiento de Coordenadas + campo nuevo "Nombre del proyecto"
Pedido de Nicolás, aclarado con una pregunta de por medio (la primera interpretación — "Nombre" de la persona — era incorrecta; la etiqueta final quedó **"Nombre del proyecto"**, un campo nuevo para que cada participante defina cómo se va a llamar su proyecto, distinto de "Qué" que describe de qué se trata):
- **`sql/2026-08-14_entusiasmo_proyectos_nombre.sql`** (corrida por Nicolás): agrega `entusiasmo_proyectos.nombre` (text, nullable).
- **`app/api/entusiasmo/proyecto/route.ts`**: `ProyectoRow`/`Body` suman `nombre`; se agregó a `CAMPOS_VERSIONABLES` (así que también queda con historial de versiones, igual que el resto de Coordenadas); el `select` del existente y el `upsert` lo incluyen.
- **`app/casatalentos/page.tsx`**: `CoordenadasForm`/`COORDENADAS_VACIAS`/`CAMPOS_COORDENADAS`/`COLUMNA_POR_CAMPO_COORDENADAS` suman `nombre`. `CAMPOS_COORDENADAS_PRINCIPALES` reordenado: **Objetivo (para qué) pasa a ser el primer campo**, **Nombre del proyecto el segundo** (campo nuevo), y "Qué" (que antes era el primero) pasa a tercero — sigue estando, no se perdió. El resto de la grilla (Problema y solución, Habilidad a desarrollar, Algo que te entusiasme) y el panel "Resultados" (Mensual/Trimestral/Anual) no cambiaron de posición ni de lógica.

## 3. Verificado en vivo
Con un participante descartable: orden de etiquetas confirmado exacto (Objetivo → Nombre del proyecto → Qué → Problema y solución → Habilidad → Entusiasma → Mensual → Trimestral → Anual); guardado confirmado por la respuesta real del `PUT` (`nombre`, `que` y `para_que` los tres con su valor correcto, nada se pisó); confirmado en base con una consulta directa; confirmado que el valor persiste después de recargar la página. Cero errores de consola. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`40ca333`).

---

# Sesión de trabajo 2026-08-15 — Indicadores de "nuevo" (actividad para admin, aportes para participante)

## 1. Objetivo
Nicolás pidió una notificación de "nuevo" en ambas direcciones: (a) que a él, como admin, le aparezca una marca en la solapa de un participante si esa persona avanzó algo en "Mi espacio" desde la última vez que la vio — así sabe a quién revisar para dejarle un aporte; (b) que al participante le aparezca "nuevo" si el admin le dejó un aporte. En los dos casos, la marca se apaga recién cuando la persona correspondiente abre y ve el contenido.

## 2. Diseño
- **`sql/2026-08-14_entusiasmo_lecturas.sql`** (nuevo, corrido por Nicolás): tabla `entusiasmo_lecturas` (`lector_email`, `participante_email`, `leido_at`, unique por el par) — un solo mecanismo genérico sirve para las dos direcciones: cuando `lector_email === participante_email` es "la propia persona leyendo sus aportes"; cuando son distintos (siempre con `lector_email` admin) es "el admin viendo la actividad de tal participante".
- **`app/api/entusiasmo/lecturas/route.ts`** (nuevo, POST): marca `leido_at = now()` para `(lector_email: quien pide, participante_email: el objetivo)`. Si el objetivo es otra persona, exige ser admin (403 si no).
- **`app/api/entusiasmo/admin/novedades/route.ts`** (nuevo, GET, admin-only): por cada participante activo de Entusiasmento, calcula la última actividad real (`entusiasmo_proyectos.updated_at` solo si difiere de `created_at` en más de 2 segundos — evita el falso positivo de una fila vacía autogenerada al recibir un aporte o crear una producción antes de tener proyecto propio — más el `created_at` más reciente entre sus producciones y tareas) y la compara contra la lectura registrada de ese admin para esa persona. Devuelve `{ [email]: boolean }`.
- **`app/api/entusiasmo/aportes/route.ts`** (GET, modificado): cuando alguien pide sus propios aportes (`emailObjetivo === auth.actor.email`), suma `hayAportesNuevos` a la respuesta, comparando el aporte más reciente contra su propia lectura registrada.
- **`app/casatalentos/page.tsx`**:
  - Admin: nuevo estado `novedadesPorParticipante`, cargado una vez al montar (si `esAdmin`). Cada solapa de participante muestra un punto rojo (`aria-label="Actividad nueva"`) si tiene actividad sin leer. `cambiarViendoEmail(email)` marca esa persona como leída (POST + apagado optimista del punto) en el mismo click que ya cambiaba de pestaña — no hizo falta ningún paso extra.
  - Participante (o admin en "Yo"): nuevo estado `hayAportesNuevos`, seteado desde la respuesta de `cargarAportesRecibidos`. Un punto rojo en la tarjeta "🪴 Mi espacio" (`aria-label="Nuevo aporte"`) se muestra cuando hay algo sin leer.

## 3. Bug encontrado y corregido antes de dar por terminado: el punto del participante nunca llegaba a pintarse
Primera versión: el efecto que marca como leído se disparaba en el mismo ciclo de render que activaba el punto (mismo commit de React), así que al ser "Mi espacio" la pestaña por defecto, el punto pasaba de invisible a leído sin que llegara a pintarse en pantalla — confirmado con una prueba en vivo real (Playwright, con esperas generosas): el punto nunca apareció, ni una sola vez. Se corrigió agregando un margen de 3 segundos antes de marcar como leído y apagar el punto — verificado de nuevo: ahora sí se ve al entrar, y se apaga solo un momento después.

## 4. Verificado en vivo
Batería completa contra el servidor real (login por API + llamadas directas a los 3 endpoints nuevos/modificados, con datos 100% descartables, sin pasar por la UI para poder aislar cada caso):
- Un aporte a alguien que nunca usó Mi espacio (crea un proyecto vacío automáticamente) **no** generó novedad — confirmado `false`.
- La primera edición real de coordenadas de un participante, hecha dentro de los 2 segundos de la creación del proyecto, **no** contó como novedad (evita el falso positivo de alta); una segunda edición más tarde sí — confirmado `true`.
- El admin marcando como leído apagó la novedad — confirmado `false`; una producción nueva del participante la volvió a prender — confirmado `true`.
- El flag `hayAportesNuevos` del participante: `false` sin aportes, `true` after recibir uno, `false` después de marcar como leído.
- Seguridad: un participante intentando marcar como leído el espacio de otro, o consultar `/admin/novedades`, recibió 403 en ambos casos.
- En la UI real (Playwright): el punto en la solapa del participante se ve para el admin y se apaga al clickearla; el punto de "Nuevo aporte" en "Mi espacio" ahora sí se pinta al entrar y se apaga ~3 segundos después (tras el fix del punto 3); el contenido del aporte sigue visible en pantalla en todo momento, solo se apaga el punto. Cero errores de consola en ninguna corrida. `typecheck`/`lint` limpios, sin warnings nuevos.

## 5. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`dec6cec`).

---

# Sesión de trabajo 2026-08-15 (continuación) — Puntos de "nuevo" por campo/producción/tarea (no solo por participante)

## 1. Objetivo
El indicador de "nuevo" de la sesión anterior era por participante entero (un punto en la solapa, sin decir qué cambió). Nicolás pidió bajar un nivel: que el punto aparezca sobre la Coordenada puntual que cambió, sobre la Producción nueva, sobre la Tarea nueva/avanzada, y también sobre "Nombre del proyecto" — así no tiene que revisar todo el espacio para encontrar qué avanzó.

## 2. Diseño
- **`sql/2026-08-15_entusiasmo_campos_actividad.sql`** (nuevo, corrido por Nicolás): tabla `entusiasmo_campos_actividad` (`proyecto_id`, `campo`, `modificado_at`, unique por el par) — a diferencia de `entusiasmo_coordenadas_versiones` (que solo archiva cuando había un valor anterior no vacío), esta registra **cualquier** cambio de valor, incluida la primera vez que se completa un campo — necesario para poder marcarlo como "nuevo" también en ese caso.
- **`app/api/entusiasmo/proyecto/route.ts`** (PUT): además de la lógica de versiones ya existente, ahora compara valor viejo vs. nuevo de cada campo de `CAMPOS_VERSIONABLES` (incluye `nombre`) y hace upsert en `entusiasmo_campos_actividad` por cada uno que cambió de verdad.
- **`app/api/entusiasmo/admin/novedades-detalle/route.ts`** (nuevo, GET `?email=`, admin-only): para un participante puntual, devuelve `{ campos: string[], produccionesIds: number[], tareasIds: number[] }` — campos de `entusiasmo_campos_actividad` modificados después de la lectura registrada del admin para esa persona, más ids de producciones/tareas cuyo `updated_at` (o `created_at`) es posterior a esa misma lectura.
- **`app/casatalentos/page.tsx`**: `cambiarViendoEmail` ahora, al abrir la solapa de un participante, primero pide el detalle (con la lectura *vieja* todavía vigente) y recién **después** marca como leído — el orden importa: si fuera al revés, la propia marca de lectura borraría lo que se quiere mostrar. El detalle queda en 3 sets de estado (`camposNuevosViendo`, `produccionesNuevasViendo`, `tareasNuevasViendo`) que alimentan puntitos rojos en `renderizarCampoLectura` (al lado de la etiqueta de cada Coordenada, incluida "Nombre del proyecto"), en cada ítem de la lista de Producciones, y en `renderizarFilaTarea`. Los puntos quedan visibles durante toda esa sesión de vista (no desaparecen solos) — la próxima vez que el admin abra esa solapa, si no hay nada nuevo, no van a aparecer.
- El punto por participante de la sesión anterior (en la solapa) se mantiene igual, sin tocar — sigue siendo el indicador rápido de "hay algo" antes de entrar.

## 3. Verificado en vivo
Batería de 8 casos contra el servidor real (login por API + llamadas directas, datos descartables):
- Sin actividad: los 3 arrays vacíos.
- Completar "para qué" y "Nombre del proyecto" por primera vez (nunca tuvieron valor antes): ambos aparecen en `campos`, y ningún otro campo no tocado (ni "qué" ni "problema y solución").
- Una producción y una tarea nuevas aparecen en sus respectivos ids.
- El admin marca como leído → los 3 arrays se vacían.
- El participante edita **solo** "qué" después de eso → aparece únicamente `"que"` en `campos` (ni "para_que" ni "nombre", que ya habían sido vistos, vuelven a aparecer) — confirma que la granularidad es real, no un "hubo algo" genérico.
- Seguridad: un participante pidiendo el detalle de otro recibe 403.

En la UI real (Playwright, con datos sembrados directamente para simular el escenario: dos campos "recientes" y uno "viejo", más una producción y una tarea nuevas): al abrir la solapa del participante y expandir Coordenadas, aparece el punto exactamente sobre "Objetivo (para qué)" y "Nombre del proyecto", **no** aparece sobre "Qué" (que no había cambiado), y aparece sobre la producción y la tarea nuevas. Cero errores de consola. `typecheck`/`lint` limpios, sin warnings nuevos.

## 4. Pendiente
- Resto sin cambios de sesiones anteriores: agente de IA reforzado, auditoría de performance del resto de la carga de Entusiasmento.

Commiteado y pusheado (`421e1a6`).

---

# Sesión de trabajo 2026-08-16 — Puntos de "nuevo" en el nav y en encabezados de sección; diagnóstico del agente diario

## 1. Objetivo
Dos pedidos de Nicolás: (a) agregar el punto rojo en dos lugares más — el link "Entusiasmento" del menú de navegación, y el encabezado de cada sección (Coordenadas, Producciones, Tareas semanales) dentro de "Mi espacio"; (b) confirmar si el agente de IA ya le está mandando el mail diario a los participantes en producción.

## 2. Puntos de "nuevo" — nav y encabezados de sección
- **`lib/entusiasmo-novedades.ts`** (nuevo): se extrajo la lógica de `calcularNovedadesPorParticipante` (antes vivía inline en `/api/entusiasmo/admin/novedades`) y se agregó `calcularHayAportesNuevos`, para que las pueda reutilizar el endpoint nuevo sin duplicar las consultas.
- **`app/api/entusiasmo/nav-resumen/route.ts`** (nuevo, GET): devuelve `{ hayAlgoQueRevisar: boolean }` — para admin, agrega (OR) las novedades de todos los participantes; para cualquier otra persona, si tiene aportes nuevos propios. Pensado para ser liviano y tolerante a fallos (nunca tira error visible, si algo falla devuelve `false` y no rompe la navegación).
- **`components/AppNav.tsx`**: pide ese endpoint al montar (para cualquier usuario logueado) y pinta un punto rojo sobre el link "Entusiasmento" del menú si corresponde.
- **`app/casatalentos/page.tsx`**: los 3 encabezados de sección dentro de "Mi espacio" (Coordenadas, "Lo que vas armando" / Producciones, "Lo que te proponés esta semana" / Tareas semanales) ahora muestran un punto si `camposNuevosViendo`/`produccionesNuevasViendo`/`tareasNuevasViendo` (ya calculados desde la sesión anterior) tienen algo — mismo dato, ahora también visible de un vistazo antes de desplegar cada sección, no solo sobre el ítem puntual.

**Verificado en vivo**: con un participante descartable con un campo de Coordenadas, una producción y una tarea recién modificados, y con un aporte de admin sin leer: el admin ve el punto en el nav y, al entrar a la solapa del participante, los 3 encabezados de sección lo muestran correctamente; el participante ve el punto en el nav por el aporte nuevo. Cero errores de consola en ambas sesiones. `typecheck`/`lint` limpios, sin warnings nuevos.

## 3. Diagnóstico: ¿el agente ya le manda el mail diario a los participantes?
Investigado contra producción real (base de datos + Vercel, sin simular nada):
- **La integración funciona de punta a punta cuando se la invoca** — quedó demostrado en la sesión del 13/8 con una corrida real contra producción (5 personas evaluadas, 1 mail real enviado y registrado).
- **Pero el cron automático no parece estar disparando solo desde entonces.** El diseño del agente manda, **todos los días que corre**, un "informe diario" a `nicolasbusico@entheosescuela.com` — incluso los días que no toca escribirle a nadie (un mail de una línea). Revisando `comunicacion_envios` en la base real, el único registro de `tipo: "agente_informe_diario"` que existe es el del 13/8 a las 15:06 UTC (la corrida manual de esa sesión) — no hay ningún registro para el 14/8 ni el 15/8, pese a que el cron (`vercel.json`, `0 3 * * *`) debería haber corrido automáticamente esas dos noches y, según el diseño, debería haber generado el informe igual aunque no fuera día de escribirle a nadie.
- Se revisaron los deploys en Vercel (todos `READY`/`production`, sin fallos) y los errores de runtime de los últimos 7 días (ninguno registrado) — no hay una causa obvia a la vista desde acá. El plan Hobby de Vercel solo guarda logs de ejecución por 1 hora, así que no se puede ver el detalle de qué pasó (o si pasó) en esas corridas de las 00:00 ARG.
- **Conclusión**: la integración en sí funciona, pero hay indicios reales de que el disparador automático (el cron job) no se está ejecutando en producción, o se está ejecutando pero fallando en un punto temprano que ni siquiera llega a intentar mandar el informe. No se pudo confirmar la causa exacta sin acceso al panel de Vercel (Project → Settings → Cron Jobs, que muestra la última ejecución) — **queda pendiente que Nicolás lo revise ahí**, o que confirme si quiere que se dispare una prueba manual real hoy para seguir diagnosticando (no se hizo sin preguntar porque manda mails reales).

Commiteado y pusheado (`0b97349`).

## 4. Causa raíz encontrada y corregida: `CRON_SECRET` nunca se había cargado en Vercel
Siguiendo el diagnóstico del punto 3, Nicolás entró a Vercel → Project Settings → Cron Jobs y usó el botón "Run" para disparar `/api/cron/diario` manualmente — el log en vivo (Observability → Logs) mostró `GET 401`, con `User-Agent: vercel-cron/1.0` (confirma que el disparo SÍ pasó por el mecanismo real de cron de Vercel, no un simulacro). La causa: `/api/cron/diario/route.ts` rechaza con 401 si `process.env.CRON_SECRET` no está seteado o no coincide con el header `Authorization` que Vercel manda automáticamente — y **`CRON_SECRET` nunca se había cargado como variable de entorno en el proyecto de Vercel**, pese a estar documentado como "ya usado" en sesiones anteriores (esa suposición nunca se había verificado en la práctica). Se le dio a Nicolás un fingerprint del valor local (longitud 64, empieza `ee7`, termina `9eb`) sin exponer el secreto completo, para que lo comparara/cargara en Vercel sin que yo tuviera que verlo ni escribirlo. Nicolás lo agregó a las variables de entorno de producción y redesplegó.

Confirmado con un segundo "Run": ya daba `200` en vez de `401`. Pero esa segunda corrida reveló un **segundo problema real**, distinto y más viejo: los 7 participantes activos fallaron con `motivoOmision: "error_generando_texto: Error: ANTHROPIC_API_KEY no configurada."` — es decir, **tampoco esa variable estaba cargada en Vercel** (contradice lo que decían sesiones anteriores, que daban por hecho que sí se había cargado después de la prueba real del 13/8 — esa prueba probablemente corrió contra una preview con env vars distintas, o la variable se perdió después; no se pudo determinar cuál con certeza, y no vale la pena seguir esa punta). Se le dio a Nicolás el mismo tipo de fingerprint sin exponer el secreto (longitud 108, empieza `sk-ant-`, termina `NgAA`), la cargó en Vercel y redeployó.

**Verificado end-to-end contra producción real** (llamada directa a `https://escuela-talento-platform.vercel.app/api/cron/diario` con el `CRON_SECRET` real, sin pasar por el botón "Run" de Vercel): `enviados: 7, omitidos: 0` — los 7 participantes activos de Entusiasmento recibieron un mensaje real y distinto generado por el agente (ej. *"¿Qué de lo que hacés ahora es lo que querés ofrecer al mundo?"* para Verónica), y el informe diario a `nicolasbusico@entheosescuela.com` quedó registrado como enviado. Confirmado en `comunicacion_envios` (7 filas `agente_recordatorio_semanal` + 1 `agente_informe_diario`, todas `estado: "enviado"`, con fecha de hoy). **El agente diario queda funcionando de punta a punta en producción, sin nada pendiente de este lado.**

Ningún archivo de código cambió en todo este diagnóstico (los dos problemas eran configuración faltante en Vercel, no bugs de código) — no hay nada para commitear de esta parte.

## 5. Pendiente
- Resto sin cambios de sesiones anteriores: auditoría de performance del resto de la carga de Entusiasmento.
