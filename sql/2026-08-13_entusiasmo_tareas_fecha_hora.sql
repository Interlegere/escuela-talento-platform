alter table public.entusiasmo_tareas
  add column if not exists fecha date,
  add column if not exists hora time;
