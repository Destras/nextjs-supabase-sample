-- Widen the contenidos bucket MIME whitelist to any video/audio format.
--
-- Originally the bucket only accepted video/mp4 and audio/mpeg, so uploading a
-- webm/mov/wav/ogg (any non-mp4 video or non-mp3 audio) was rejected at the
-- Storage layer even when the client allowed it (CON-005). Product decision:
-- admins should be able to upload any video format under "Video" and any audio
-- format under "Mantra", not just one container.
--
-- The bucket is kept as the permissive outer net (video/*, audio/*) so it never
-- blocks on a MIME variant; the precise "is this a browser-playable format"
-- gate lives client-side in validateMediaFile (PLAYABLE_VIDEO/AUDIO_MIME).
-- application/pdf and text/plain are preserved from the previous whitelist.
-- file_size_limit stays null (no bucket-level size cap) per the prior decision.

update storage.buckets
   set allowed_mime_types = array[
         'video/*',
         'audio/*',
         'application/pdf',
         'text/plain'
       ]
 where id = 'contenidos';
