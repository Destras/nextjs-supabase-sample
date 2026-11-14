# Perfiles

**Tabla:** `profiles` (1:1 con `auth.users`, guarda el rol del usuario).

## Para qué sirve

Es la tabla que responde "¿quién es este usuario y qué rol tiene?". La usan los helpers
`is_admin()` / `is_console_user()` y el panel para mostrar el nombre de quien está logueado.

## Quién puede qué

| Rol        | SELECT                    | Escritura                             |
| ---------- | ------------------------- | ------------------------------------- |
| admin      | Todos los perfiles        | Vía RPC / Edge Function de invitación |
| cualquiera | Solo **su propio** perfil | ❌                                    |

## Ejemplo simplificado

```sql
-- Cada usuario ve su propia fila
create policy "users_select_own_profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- El admin ve todas (política aparte: las permissive se combinan con OR)
create policy "admin_select_all_profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());
```

## Decisión de diseño: la dependencia circular

`is_admin()` lee `profiles`, y la política de admin sobre `profiles` llama a `is_admin()`.
Dos problemas:

1. **Recursión en runtime.** Se evita haciendo `is_admin()` `security definer`: corre como
   dueño de la tabla y no vuelve a disparar la RLS de `profiles`.
2. **Orden de carga del schema declarativo.** `supabase db diff` aplica los archivos en
   orden alfabético y valida el cuerpo de las funciones SQL al crearlas. La tabla tiene que
   existir antes que la función, y la función antes que la política. Por eso la política de
   admin vivía en un archivo separado que carga después de `15_identity_functions.sql`.
