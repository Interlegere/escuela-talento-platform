alter table public.entusiasmo_aportes
  add column if not exists campo text,
  add column if not exists fragmento text;
