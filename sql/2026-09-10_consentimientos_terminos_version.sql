-- Hoy la fila guarda version: "v1.0" (o "v2.0"), que es el número del texto
-- del cartel de consentimiento, no el de los Términos y Condiciones. Sin
-- terminos_version no se puede saber, mirando el registro, qué contrato
-- aceptó cada persona — que era todo el valor de guardarlo (sección 17).
alter table public.consentimientos
  add column if not exists terminos_version text;

-- Las filas viejas quedan en null a propósito: se aceptaron cuando el
-- registro todavía no anotaba esto, y rellenarlas sería inventar un dato
-- que no se puede reconstruir con certeza.
