# Storage (videos, audios e imágenes)

**Recursos:** `storage.objects` de los buckets privados `contenidos` (video/audio) y
`contenidos-imagenes` (galerías), más la tabla `contenido_imagenes`.

## Para qué sirve

Los contenidos del tratamiento son archivos pesados en Supabase Storage. El panel los sube
(upload resumible con TUS) y la app del paciente los reproduce con **URLs firmadas** que
genera ella misma. Las políticas sobre `storage.objects` deciden quién puede firmar qué.

## Quién puede qué

| Rol              | SELECT (firmar URL)                                   | INSERT / UPDATE / DELETE |
| ---------------- | ----------------------------------------------------- | ------------------------ |
| admin            | ✅ todo                                               | ✅                       |
| terapeuta activo | ✅ todo                                               | ❌                       |
| paciente         | Solo archivos de su plan **ya liberados** esta semana | ❌                       |

## Ejemplo simplificado

```sql
create policy "console_or_plan_select_contenidos_storage"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'contenidos'
    and (
      (select public.is_console_user())
      or public.paciente_puede_ver_objeto(bucket_id, name)
    )
  );
```

## Decisiones de diseño

**Goteo del plan.** Antes, cualquier sesión podía leer cualquier objeto del bucket. Como
los paths son predecibles, un paciente podía bajarse el contenido de semanas futuras.
`paciente_puede_ver_objeto` reutiliza **la misma regla** que usa `get_mi_plan_semanal`
para decidir si una semana está liberada. Así la app y Storage no pueden discrepar.

**Validar la forma del path.** En `contenidos-imagenes`, todas las políticas exigen que
el path tenga exactamente la forma `cma/<uuid>.<ext>` o `ic/<uuid>.<ext>`:

```sql
and (storage.foldername(name))[1] in ('cma', 'ic')
and array_length(storage.foldername(name), 1) = 1
```

El `array_length = 1` no es decorativo: `'/cma/x.jpg'` (con barra inicial) produce
`{'', 'cma'}` y sin ese chequeo fallaría con un 403 genérico muy difícil de diagnosticar.
