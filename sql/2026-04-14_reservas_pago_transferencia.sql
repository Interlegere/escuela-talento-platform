alter table public.reservas
  add column if not exists medio_pago text,
  add column if not exists comprobante_url text,
  add column if not exists comprobante_nombre_archivo text,
  add column if not exists comprobante_subido_at timestamptz,
  add column if not exists observaciones_admin text,
  add column if not exists monto_transferencia text,
  add column if not exists monto_mercado_pago text,
  add column if not exists porcentaje_recargo_mercado_pago numeric;

create index if not exists reservas_estado_idx
  on public.reservas (estado);

create index if not exists reservas_comprobante_subido_at_idx
  on public.reservas (comprobante_subido_at desc);
