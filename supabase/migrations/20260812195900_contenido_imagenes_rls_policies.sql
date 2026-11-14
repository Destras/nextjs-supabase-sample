-- RLS enable + table comment for public.contenido_imagenes.
--
-- `enable row level security` y los `comment on` sueltos no los captura
-- `supabase db diff`, así que van en una migración escrita a mano.
-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

alter table public.contenido_imagenes enable row level security;

comment on table public.contenido_imagenes is 'Imágenes ordenadas de un contenido tipo galería (cma / ic). Un contenido de video/audio/egregor nunca tiene filas acá.';
