-- Historia RLS: rewrite SELECT policies to use active assignment instead of ownership
-- Enables handoff: the currently-assigned therapist reads full history of a patient,
-- regardless of who opened the rows. Ex-therapists (fecha_hasta IS NOT NULL) lose access.
-- Admin always reads all via is_admin(). See epic-0-fundacion-transversal.md task 0.1.

-- ────────────────────────────────────────────────────────────────────────────
-- Helper function: has_active_assignment
-- Returns true if auth.uid() has an active assignment (fecha_hasta IS NULL)
-- for the given patient. security definer prevents RLS recursion on
-- asignaciones_paciente if this function were ever used there.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.has_active_assignment(p_paciente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.asignaciones_paciente a
     where a.paciente_id  = p_paciente_id
       and a.terapeuta_id = auth.uid()
       and a.fecha_hasta is null
  );
$$;

comment on function public.has_active_assignment is
  'Devuelve true si auth.uid() tiene una asignación activa (fecha_hasta IS NULL) sobre el paciente dado. Usada en políticas RLS de tablas clínicas para habilitar handoff.';

