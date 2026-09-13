-- Permite que quien sube una producción (ahora también PDF/PowerPoint)
-- decida si los demás pueden descargarla o solo verla en CoFruto.
-- Default true para no cambiar el comportamiento de las producciones ya
-- existentes (hoy cualquiera con el link ya podía verlas/guardarlas igual).
alter table public.entusiasmo_producciones
  add column if not exists permite_descarga boolean not null default true;
