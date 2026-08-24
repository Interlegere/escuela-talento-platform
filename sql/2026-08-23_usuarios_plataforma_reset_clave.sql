-- Recuperación de clave self-service: guarda el HASH del token (nunca el
-- token en claro, mismo criterio que password_hash), su expiración, y
-- cuándo se pidió el último token (para un cooldown simple anti-abuso,
-- ver lib/usuarios-plataforma.ts).
alter table public.usuarios_plataforma
  add column if not exists reset_token_hash text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists reset_requested_at timestamptz;
