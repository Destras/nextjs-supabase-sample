-- Bucket privado "contenidos" para los recursos del catálogo (audio/video/texto).
-- Los archivos se suben via scripts/seed-media-bucket.ts desde un /media local
-- (gitignored) — los binarios no viven en el repo.
--
-- Lectura abierta a usuarios authenticated: el catálogo es global por ahora;
-- cuando se construya el admin panel se ajustará la policy para read/write.

insert into storage.buckets (id, name, public)
values ('contenidos', 'contenidos', false)
on conflict (id) do nothing;

