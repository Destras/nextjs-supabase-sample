# Alertas

**Tablas:** `alertas_atendidas` (y el catálogo `tipos_alerta`, ver [01-catalogo.md](01-catalogo.md)).

## Para qué sirven

Las alertas (paciente sin contenido asignado, evaluación baja, tratamiento por terminar…)
**no se guardan**: se derivan en cada consulta a partir del estado de los tratamientos.
Lo único que se persiste es el hecho de que alguien **marcó una alerta como atendida**.

## Quién puede qué

| Rol              | SELECT                                 | INSERT                                              |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| admin            | Todas                                  | ✅ (firmando como sí mismo)                         |
| terapeuta activo | Las de pacientes con asignación activa | ✅ solo para esos pacientes, firmando como sí mismo |
| paciente         | ❌                                     | ❌                                                  |

## Ejemplo simplificado

Es una de las pocas tablas con política de escritura directa. El `with check` impide
marcar alertas en nombre de otro usuario:

```sql
create policy "terapeuta_o_admin_insert_alertas_atendidas"
  on public.alertas_atendidas
  for insert
  to authenticated
  with check (
    atendida_por = (select auth.uid())
    and (
      public.is_admin()
      or (paciente_id is not null and public.has_active_assignment(paciente_id))
    )
  );
```

## Decisión de diseño: alertas de red sin paciente

Algunas alertas son globales (`paciente_id` nulo). La condición
`paciente_id is not null and has_active_assignment(...)` es **null-safe**: un terapeuta
nunca puede atender (ni ver) una alerta global; solo el admin.
