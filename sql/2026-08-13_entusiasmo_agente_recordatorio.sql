ALTER TABLE entusiasmo_proyectos
  ADD COLUMN IF NOT EXISTS agente_recordatorio_texto text,
  ADD COLUMN IF NOT EXISTS agente_recordatorio_generado_at timestamptz;
