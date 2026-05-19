do $$
declare
  constraint_names text[];
  constraint_to_drop text;
  constraint_to_create text := 'disponibilidades_estado_check';
begin
  select array_agg(c.conname order by c.conname)
    into constraint_names
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'disponibilidades'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%estado%';

  if constraint_names is null then
    return;
  end if;

  constraint_to_create := constraint_names[1];

  foreach constraint_to_drop in array constraint_names loop
    execute format(
      'alter table public.disponibilidades drop constraint %I',
      constraint_to_drop
    );
  end loop;

  execute format(
    'alter table public.disponibilidades add constraint %I check (estado is null or estado in (%L, %L, %L, %L, %L, %L))',
    constraint_to_create,
    'disponible',
    'pendiente_pago',
    'confirmada',
    'realizada',
    'bloqueado',
    'cancelada'
  );
end $$;
