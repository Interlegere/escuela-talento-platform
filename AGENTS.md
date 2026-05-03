# Escuela Talento

## Reglas de trabajo
- No romper funcionalidades existentes.
- Devolver siempre código completo, no fragmentos.
- Priorizar estabilidad sobre elegancia.
- Mantener estilo Next.js + TypeScript + Tailwind actual.
- Evitar dependencias innecesarias.
- Hacer cambios mínimos y seguros.
- Antes de refactorizar, revisar si ya hay lógica funcionando que no debe romperse.
- Si una mejora es riesgosa, proponer primero el plan y luego implementar por fases.

## Contexto técnico
- Stack: Next.js App Router, TypeScript, TailwindCSS, Supabase, NextAuth, MercadoPago, Google Calendar.
- Proyecto en desarrollo local.
- Hay módulos: Campus, Agenda, CasaTalentos, Conectando Sentidos, Mentorías, Terapia y Admin.
- Las páginas pueden tener lógica cliente sensible; evitar dejar pantallas en blanco.
- Varias rutas usan componentes client-side y requieren cuidado con loading, redirect y estado de sesión.

## Contexto de negocio
- Roles base:
  - admin
  - colaborador
  - participante

- Actividades:
  - casatalentos
  - conectando-sentidos
  - mentorias
  - terapia
  - membresia

## Regla clave de arquitectura
Distinguir siempre entre:
1. rol global
2. acceso por actividad
3. permiso por acción

No asumir que “participante” implica acceso a todas las actividades.
No asumir que ocultar botones equivale a seguridad real.

## CasaTalentos
CasaTalentos es módulo crítico.

Reglas actuales importantes:
- Videos semanales de 1 min: lunes, martes y miércoles.
- Elección el miércoles entre 18:30 y 21:30.
- Ranking top 3.
- Ganador solo si:
  - subió lunes, martes y miércoles
  - participó eligiendo
- Si no elige, no puede ganar.
- Puede haber empate → no definir ganador automático.
- Cada video puede recibir aportes/comentarios con nombre y fecha.
- Referentes generales y referente semanal ya existen.
- Se está trabajando el flujo para grabar videos desde el dispositivo tipo WhatsApp.

## Forma de responder
- Explicar brevemente la estrategia antes de tocar código.
- Luego devolver cambios completos listos para copiar.
- Si crea archivos nuevos, dar contenido completo.
- Si hace SQL, darlo completo.
- Si detecta deuda técnica o riesgo, marcarlo con claridad.