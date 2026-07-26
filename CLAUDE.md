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
- **Posible inconsistencia de precio a revisar con Nicolás**: la tabla de Canva dice CasaTalentos y Conectando Sentidos individuales a **$160.000**, pero la configuración real de la plataforma (pre-existente, no tocada en esta sesión) tiene **$150.000** para ambas. No se actualizó porque no se pidió explícitamente — solo se cargaron los valores nuevos (Terapia base $55.000, combo CT+CS $213.000, combo Terapia $43.000). Confirmar si hay que subir CasaTalentos/Conectando Sentidos a $160.000 también.
- **Pack de 4 sesiones de Terapia ($200.000)**: fuera de alcance a pedido de Nicolás — necesita trackear consumo de sesiones prepagas (no existe hoy el concepto de "crédito"/paquete). Evaluar como fase aparte.
- **Comunicaciones**: diagnosticado (5 puntos: envío masivo secuencial sin límite de tiempo, sin emails automáticos de aprobación/rechazo de pago, tabla de plantillas fantasma sin CRUD, sin tracking de apertura/rebote, deuda de código menor) pero **sin implementar todavía** — Nicolás pidió mejoras sobre esos puntos + UX de uso, pendiente de arrancar.
- **Agenda**: diagnosticada (5 puntos, Nicolás respondió a cada uno) pero **sin implementar todavía**:
  1. Sacar la conciliación de pago de Terapia del calendario de Agenda (duplicada con Admin Usuarios) — acordado.
  2. Corregir el bug de advertencias de cancelación que se pierden silenciosamente — acordado, corregir.
  3. Acotar la consulta sin límite de `reservas` en `listarAgendaUnificada` — Nicolás no entendía el tecnicismo pero pidió que se mejore igual.
  4. Agregar filtro por participante y por "sin Meet generado" — acordado si es viable.
  5. Revisar qué botones ya existentes no funcionan + **bug nuevo reportado**: el calendario mensual no muestra eventos de días del mes siguiente que aparecen en la grilla del mes actual (ej. parado en julio, no se ven eventos de agosto aunque esos días ya se ven en la grilla).
- **Fase 4 del roadmap original** (comentarios de video en CasaTalentos: hoy sin editar/eliminar/rich text) — todavía no arrancada.
- El commit de "Precios combinados" (combo CT+CS + sesiones con descuento) está probado y listo pero el usuario pidió actualizar este archivo **antes** de confirmar el push — confirmar si ya se subió mirando `git log`.

## 6. Próximo paso
Nicolás confirmó seguir "por fases, del 1 al 5" sobre el segundo roadmap (Administración ✅ → Actividades/Agenda-embebida-en-CT-CS ⏳ → Comunicaciones ⏳ → Agenda ⏳ → Perfil ✅ ya resuelto). El siguiente bloque de trabajo pendiente más inmediato es la Fase 2 de ese roadmap: sacar la gestión de agenda embebida (editar/cancelar/generar Meet) de CasaTalentos y Conectando Sentidos, dejándola de solo lectura con link a `/agenda`, igual que ya funciona en Mentorías/Terapia — esto había quedado confirmado ("Sí, acuerdo con la recomendación") pero aún no implementado.
