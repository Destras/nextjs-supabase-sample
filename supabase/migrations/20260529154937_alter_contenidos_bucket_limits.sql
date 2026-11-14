-- Constrain the contenidos bucket by MIME type only — no file size cap.
--
-- The create-bucket migration inserted with defaults, leaving both limits null.
-- config.toml encodes the intended values for local (`supabase db reset`
-- rehydrates them) but `supabase migration up` and remote pushes don't read it.
-- Baking the intent into SQL makes local + remote behave the same.
--
-- file_size_limit stays null on purpose: per product decision the catalog may
-- hold large, uncompressed videos, so we do not cap upload size at the bucket
-- level. The project-wide Storage quota is the only ceiling. allowed_mime_types
-- still whitelists audio/video/pdf/text so non-media uploads are rejected.

update storage.buckets
   set file_size_limit = null,
       allowed_mime_types = array[
         'audio/mpeg',
         'video/mp4',
         'application/pdf',
         'text/plain'
       ]
 where id = 'contenidos';
