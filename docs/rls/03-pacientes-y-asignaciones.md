# Pacientes y asignaciones

**Tablas:** `pacientes`, `asignaciones_paciente`.

## Para qué sirven

`pacientes` es la ficha (nombre, teléfono, email, contacto alternativo). Es la tabla más
sensible del sistema. `asignaciones_paciente` registra qué terapeuta atiende a qué
paciente y desde/hasta cuándo: un paciente puede cambiar de terapeuta y la historia queda.

## Quién puede qué

| Rol                | `pacientes`                  | `asignaciones_paciente` |
| ------------------ | ---------------------------- | ----------------------- |
| admin              | Todos                        | Todas                   |
| terapeuta activo   | Solo los que tiene asignados | Solo las suyas          |
| terapeuta inactivo | ❌                           | ❌                      |
| paciente           | ❌ (lee su ficha por RPC)    | ❌                      |

Altas y ediciones: siempre por RPC (`register_paciente`, `update_paciente_identidad`…), que validan
teléfono, unicidad de email y que quien escribe sea el terapeuta asignado o un admin.

## Ejemplo simplificado

```sql
-- El terapeuta ve la ficha solo si existe una asignación suya a ese paciente
create policy "terapeuta_select_assigned_pacientes"
  on public.pacientes
  for select
  to authenticated
  using (
    (select public.is_console_user())
    and exists (
      select 1
        from public.asignaciones_paciente a
       where a.paciente_id = pacientes.id
         and a.terapeuta_id = (select auth.uid())
    )
  );
```

## Decisión de diseño: el terapeuta desactivado

Desactivar un terapeuta en el panel no invalida su JWT: la sesión puede seguir viva hasta
que expire. Si las políticas solo comparaban `terapeuta_id = auth.uid()`, ese terapeuta
podía seguir leyendo fichas por la API directamente.

La solución fue anteponer `is_console_user()` (que mira el **estado** del terapeuta) a
todas las políticas "de dueño". Así la baja tiene efecto inmediato sin depender de
revocar tokens.
