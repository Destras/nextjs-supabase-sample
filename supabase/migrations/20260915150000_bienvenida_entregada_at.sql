-- activacionPorTelefono, Epic 3 Task 3.2: agrega pacientes.bienvenida_entregada_at
-- (null = nunca se entregó la bienvenida post-activación) y corrige el
-- comentario de set_entregas_plan (DEC-22: el paciente_id devuelto dispara la
-- invitación, que según WHATSAPP_BIENVENIDA es el OTP de activación o la
-- bienvenida — no siempre el OTP).
--
-- Hand-written (db diff no funciona en este repo — shadow DB rota, ver
-- supabase/migrations/20260830170100_baja_voluntaria_foundational.sql).
-- Mirrors el estado final de supabase/schemas/21_pacientes.sql y
-- supabase/schemas/71_rpcs_pacientes.sql. Requiere Task 0.1 (teléfono
-- canónico, epic-0-fundacion-transversal.md) y Task 3.1 (bienvenida_paciente
-- en MetaSender/FakeSender), timestamp posterior a
-- supabase/migrations/20260915140000_telefono_en_otra_ficha.sql.
--
-- Orden:
--   1. alter table: agrega la columna al final + su comment on column.
--   2. comment on function set_entregas_plan (solo el comentario; la función
--      en sí no cambia — la sigue devolviendo set_entregas_plan.sql actual).

-- ---------------------------------------------------------------------------
-- 1. pacientes.bienvenida_entregada_at
-- ---------------------------------------------------------------------------

alter table public.pacientes
  add column bienvenida_entregada_at timestamptz;

comment on column public.pacientes.bienvenida_entregada_at is
  'bienvenida_entregada_at IS NULL ⟺ el paciente nunca recibió el mensaje único de bienvenida post-activación (activacionPorTelefono, Epic 3, DEC-19/22); paciente-invitacion la setea una sola vez cuando la entrega con WHATSAPP_BIENVENIDA=1 — nunca vuelve a NULL.';

-- ---------------------------------------------------------------------------
-- 2. set_entregas_plan — comentario corregido (DEC-22).
-- ---------------------------------------------------------------------------

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 5 slots persistibles — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = current_date, estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la invitación (EF paciente-invitacion) — que según WHATSAPP_BIENVENIDA entrega el OTP de activación o la bienvenida post-activación (DEC-22, activacionPorTelefono Epic 3) — el reintento depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';
