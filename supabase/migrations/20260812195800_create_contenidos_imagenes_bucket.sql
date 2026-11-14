-- Bucket privado "contenidos-imagenes" para las galerías de imágenes de CMA
-- (Control Mental de Acuario) e IC (Ingeniería de la Conciencia).
--
-- A diferencia de "contenidos" (20260529154116_create_contenidos_storage_bucket.sql
-- + 20260529154937_alter_contenidos_bucket_limits.sql), este bucket SÍ tiene
-- tope de tamaño y allowlist estricto de MIME desde el día uno — decisión de
-- producto (DEC-5), no una omisión pendiente de arreglar después.
--
-- `insert ... on conflict (id) do nothing` seguido de un `update` explícito
-- (mismo patrón que 20260529154937): el insert con columnas explícitas ya
-- fija file_size_limit/allowed_mime_types en la creación, pero el update de
-- convergencia asegura que un re-run (`supabase migration up` repetido, o un
-- ambiente donde el bucket ya existe por otra vía) deje los límites en el
-- valor deseado en vez de conservar lo que había.
--
-- config.toml declara el mismo bucket para que `supabase db reset` lo
-- reproduzca localmente; config.toml solo lo lee el reset, no
-- `supabase migration up` ni un push a remoto (20260529154937:2-6) — de ahí
-- que este valor tenga que estar hardcodeado también acá.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contenidos-imagenes',
  'contenidos-imagenes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'contenidos-imagenes';
