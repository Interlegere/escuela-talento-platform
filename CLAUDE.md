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
- **No se hizo commit todavía** — a la espera de confirmación de Nicolás.
- Edición de fecha/hora de una tarea ya cargada (hoy solo se define al crearla).
- Resto sin cambios: Pitch estilo Instagram, agente de IA (Fase D, va a usar esta fecha/hora para los recordatorios), limpieza de código muerto del Dispositivo viejo, privacidad de `espacios-archivos`.
