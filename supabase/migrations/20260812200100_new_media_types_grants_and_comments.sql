-- EXECUTE grants + defensive `comment on function` restatement for every
-- new/changed function in this change.
--
-- Per supabase-migration/SKILL.md: "changes to a function's proconfig ...
-- and to its EXECUTE grants are NOT detected by db diff" — write a manual
-- versioned migration alongside the schema file. is_admin()-style helpers in
-- this project rely on a platform-level `alter default privileges ... grant
-- execute on functions to authenticated` (see 44_semanas_de_etapa.sql:22-25,
-- 20260705120200_derive_alertas_activas.sql:6) that fires automatically on
-- CREATE FUNCTION, so is_console_user and the two new RPCs are technically
-- already callable by authenticated without this file. It is included
-- anyway, explicitly, for two reasons: (1) create_contenido_galeria and
-- set_contenido_imagenes are the two RPCs the console's gallery UI calls
-- directly — their callability by `authenticated` should be a stated fact in
-- a migration, not an implicit platform default a future reader has to go
-- looking for; (2) is_console_user gates read access to gallery bucket paths
-- transitively via console_select_contenido_imagenes, so its grant is
-- security-relevant enough to document explicitly. Verify after applying:
--   select proname, proconfig
--     from pg_proc
--    where proname in ('is_console_user', 'create_contenido_galeria', 'set_contenido_imagenes');

grant execute on function public.is_console_user(uuid) to authenticated;
grant execute on function public.create_contenido_galeria(text, text, text, text[]) to authenticated;
grant execute on function public.set_contenido_imagenes(uuid, text[]) to authenticated;

comment on function public.is_console_user is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin" o "terapeuta" — es decir, es un usuario de consola, no un paciente. rol_id null (pacientes) falla el join y devuelve false. Usada en la policy de lectura de contenido_imagenes.';

comment on function public.create_contenido(text, text, text, text, integer) is
  'Inserta un nuevo contenido (video/audio/egregor/cma/ic) persistiendo recurso_ref y duracion_seg. Valida is_admin(), tipo válido (5 valores), título no vacío y recurso_ref no vacío para TODOS los tipos, sin excepción. cma/ic NO se crean vía este RPC: create_contenido_galeria es el único flujo para galerías (atómico sobre contenidos + contenido_imagenes); este guard sin excepción es lo que hace estructuralmente imposible una galería con cero imágenes. p_duracion_seg es nullable (se acepta null cuando el navegador no expone la duración). Set-returning: devuelve la fila creada para que el hook la mapee.';

comment on function public.create_contenido_galeria(text, text, text, text[]) is
  'Crea una galería (cma/ic) en una sola transacción: inserta la fila contenidos (recurso_ref/duracion_seg null) y sus contenido_imagenes en orden de subida (with ordinality — el cliente nunca envía orden). Valida is_admin(), tipo in (cma, ic), título no vacío y p_paths no vacío. Atómico a propósito (design §3 ADR-3): evita una galería con cero imágenes ante un fallo entre dos round-trips.';

comment on function public.set_contenido_imagenes(uuid, text[]) is
  'Full-replace de las contenido_imagenes de una galería (cma/ic): borra las filas cuyo path ya no está en p_paths, re-inserta el resto con upsert sobre (contenido_id, orden) y devuelve los paths borrados (removed_path) para que el cliente purgue Storage best-effort. Valida is_admin(), p_paths no vacío y que el contenido exista y sea tipo cma/ic (no_encontrado si no).';

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (semanas_de_etapa) tienen los 5 slots persistibles (órdenes 1=video, 2=mantra/audio, 3=egregor, 4=cma, 5=ic). La frase es derivada/automática y no participa de la completitud. Espeja la regla de completitud del front (isSemanaCompleta en semanaCompleteness.ts) y el mapa de slots (SLOT_DEFINITIONS en slotDefinitions.ts). Privada: la invoca set_entregas_plan.';

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 5 slots persistibles — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = current_date, estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion) — el reintento del OTP depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, imagenes: [{path, orden}], duracion }], frases: [{ orden, origen, texto }] }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'La lista de semanas sigue viniendo de entregas_plan (una semana existe si tiene media cargada); '
  'frases se deriva invocando public.frases_de_etapa(v_etapa_id) (Task 0.3) y se joinea por semana, '
  'nunca agrega semanas nuevas. frases trae hasta 3 objetos ordenados por orden; [] si la semana no tiene '
  'frases derivadas (run-out del catálogo) o si es futura (DEC-2-2, misma nulling que recursoRef). '
  'imagenes trae el array ordenado {path, orden} de contenido_imagenes para piezas tipo galería (cma/ic); '
  '[] para toda pieza no-galería (no hay filas). '
  'El campo escalar frase (deprecado) NO existe en este contrato: no se lee entregas_plan.frase_id ni frases_motivacionales. '
  'Nulling de futuras: recursoRef por pieza = null e imagenes = [] (subquery nunca evaluado) y frases = [] cuando estadoSemana = futura — NO NEGOCIABLE, evita filtrar paths de bucket de semanas no desbloqueadas. '
  'recursoRef e imagenes[].path son paths del bucket, NO URLs firmadas — el mobile firma client-side. '
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe '
  'pero no arrancó (fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';
