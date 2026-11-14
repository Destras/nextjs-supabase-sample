# Documentos legales

**Tablas:** `documentos_legales` (consentimiento informado, términos y condiciones,
versionados) y `aceptaciones_documentos_legales` (qué usuario aceptó qué versión y cuándo).

## Para qué sirven

Antes de crear su cuenta en la app, el paciente tiene que aceptar la versión vigente de
cada documento. La aceptación es **evidencia**: no se edita ni se borra.

## Quién puede qué

| Rol      | `documentos_legales`                   | `aceptaciones_documentos_legales` |
| -------- | -------------------------------------- | --------------------------------- |
| admin    | SELECT de todas las versiones          | SELECT (auditoría)                |
| paciente | Lee la versión vigente por RPC pública | Inserta la suya **por RPC**       |
| resto    | ❌                                     | ❌                                |

## Ejemplo simplificado

```sql
create policy "admin_select_all_aceptaciones_documentos_legales"
  on public.aceptaciones_documentos_legales
  for select
  to authenticated
  using ((select public.is_admin()));

-- Sin políticas de escritura + revoke explícito: la única forma de insertar es la
-- RPC de alta de cuenta (security definer); nadie puede editar ni borrar
revoke insert, update, delete on public.aceptaciones_documentos_legales from authenticated, anon;
```

## Decisión de diseño: el grant que hace alcanzable la política

Una política `for select` **no alcanza por sí sola**: Postgres primero verifica el
privilegio de tabla y recién después evalúa RLS. El proyecto revoca privilegios por
defecto, así que cada tabla nueva necesita su `grant select ... to authenticated` explícito.
Sin él, la política de admin existe pero nunca se evalúa.

Además, el texto de cada versión tiene un hash SHA-256 fijado en un test: si alguien edita
el documento publicado en lugar de crear una versión nueva, el test falla.
