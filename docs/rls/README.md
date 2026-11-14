# Row Level Security (RLS)

> **Nota sobre este repositorio.** Este repo es una copia de muestra. El SQL real de las
> políticas RLS **no se publica**: se quitó de `supabase/schemas/` y `supabase/migrations/`.
> En su lugar, estos documentos explican qué protege cada grupo de políticas, cómo se
> razonó y muestran un ejemplo **simplificado** (no es el SQL de producción).
>
> Consecuencia práctica: las tablas siguen teniendo `enable row level security`, pero sin
> políticas. Si levantás el proyecto en local, cualquier usuario autenticado ve **cero filas**
> en las tablas (RLS sin políticas = denegar todo).

## El modelo en una página

Hay tres tipos de usuario, todos autenticados con Supabase Auth:

| Rol           | Dónde opera         | Qué puede ver                                                 |
| ------------- | ------------------- | ------------------------------------------------------------- |
| **admin**     | Panel web (consola) | Toda la red: todos los pacientes, terapeutas y tratamientos   |
| **terapeuta** | Panel web (consola) | Solo los pacientes que tiene **asignados actualmente**        |
| **paciente**  | App móvil           | Nada por tabla directa: todo pasa por RPCs `security definer` |

"Usuario de consola" = admin **o** terapeuta **activo**. Un terapeuta dado de baja
(`inactivo`) deja de ser usuario de consola aunque su sesión siga viva.

### Principios

1. **Denegar por defecto.** Toda tabla de `public` tiene RLS activado. Lo que no tiene
   una política explícita, no se puede leer ni escribir por la API.
2. **Las políticas solo leen.** Casi todas las políticas son `for select`. Las escrituras
   pasan por funciones `security definer` (RPCs) que validan dueño, estado y reglas de
   negocio en un solo lugar. Así RLS no tiene que expresar reglas de negocio.
3. **`anon` no toca nada.** Además de RLS, se revocan los privilegios de tabla y de
   ejecución para el rol `anon`. RLS es la segunda capa, no la única.
4. **Helpers centralizados.** Las condiciones repetidas viven en funciones, no copiadas
   en cada política. Si cambia la regla (por ejemplo, "un terapeuta inactivo no ve nada"),
   se cambia en un lugar.
5. **Cada política tiene test.** Los tests SQL (bloques `DO $$ ... ASSERT ... $$`) entran
   como cada rol y verifican qué filas ve. Tampoco se incluyen en esta copia.

### Helpers que usan las políticas

Estas funciones **sí** están en el repo (`supabase/schemas/15_identity_functions.sql`,
`30_has_active_assignment.sql`, `74_rpcs_mi_paciente.sql`):

| Helper                                    | Devuelve `true` cuando…                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `is_admin()`                              | el usuario actual tiene rol admin                                      |
| `is_console_user()`                       | el usuario es admin o terapeuta **activo**                             |
| `has_active_assignment(paciente_id)`      | el usuario es de consola y tiene una asignación vigente a ese paciente |
| `paciente_puede_ver_objeto(bucket, path)` | el usuario es un paciente y ese archivo ya está liberado en su plan    |

Son `security definer` con `search_path` fijo: corren con permisos del dueño para poder
leer `profiles`/`roles` sin que la propia RLS de esas tablas genere recursión.

### Convenciones

- Nombre de política: `<quién>_<operación>_<tabla>[_via_<criterio>]`,
  por ejemplo `terapeuta_select_niveles_via_asignacion_activa`.
- `(select auth.uid())` y `(select public.is_console_user())` envueltos en `select`:
  Postgres los evalúa **una vez por consulta** en lugar de una vez por fila.
- Una política por rol y operación. Las políticas `permissive` se combinan con `OR`, así
  que "admin ve todo" es una política aparte y no una rama dentro de la del terapeuta.

## Índice

| Archivo                                                          | Tablas / recursos                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| [01-catalogo.md](01-catalogo.md)                                 | Catálogos de referencia (causas, algoritmos, alfabetos, estados…) |
| [02-perfiles-y-roles.md](02-perfiles-y-roles.md)                 | `profiles`                                                        |
| [03-pacientes-y-asignaciones.md](03-pacientes-y-asignaciones.md) | `pacientes`, `asignaciones_paciente`                              |
| [04-tratamiento.md](04-tratamiento.md)                           | Etapas, niveles, evaluaciones, bloqueos, alfabetos, plan          |
| [05-mediciones.md](05-mediciones.md)                             | `mediciones_estructura`, `medicion_valores`                       |
| [06-alertas.md](06-alertas.md)                                   | `alertas_atendidas`                                               |
| [07-storage.md](07-storage.md)                                   | Buckets `contenidos` y `contenidos-imagenes`                      |
| [08-documentos-legales.md](08-documentos-legales.md)             | `documentos_legales`, `aceptaciones_documentos_legales`           |
