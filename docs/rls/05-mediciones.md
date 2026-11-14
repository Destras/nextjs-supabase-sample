# Mediciones de estructura

**Tablas:** `mediciones_estructura` (una medición por etapa y momento),
`medicion_valores` (un valor por centro energético dentro de la medición).

## Para qué sirven

Al cerrar una etapa, el terapeuta registra una medición con un valor por cada centro del
catálogo `centros_energeticos`. Sirve para comparar el antes y el después del tratamiento.

## Quién puede qué

| Rol              | SELECT                                        | INSERT / UPDATE / DELETE             |
| ---------------- | --------------------------------------------- | ------------------------------------ |
| admin            | Todo                                          | Solo vía `cerrar_etapa_con_medicion` |
| terapeuta activo | Mediciones de pacientes con asignación activa | Solo vía `cerrar_etapa_con_medicion` |
| paciente         | ❌                                            | ❌                                   |

## Ejemplo simplificado

`medicion_valores` está a dos saltos del paciente (valor → medición → etapa):

```sql
create policy "select_medicion_valores_via_asignacion_o_admin"
  on public.medicion_valores
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.mediciones_estructura m
        join public.etapas_tratamiento e on e.id = m.etapa_id
       where m.id = medicion_valores.medicion_id
         and (public.has_active_assignment(e.paciente_id) or public.is_admin())
    )
  );
```

## Decisión de diseño: revocar además de no tener política

No tener política de escritura ya hace que RLS rechace un `insert` directo. Pero eso es un
efecto colateral frágil: alcanza con que alguien agregue una política `for all` por error
para abrirlo. Por eso, además, se **revocan** `insert/update/delete/truncate` a
`authenticated` sobre estas tablas. `truncate` es especialmente importante: **no pasa por
RLS**, así que sin el `revoke` un usuario autenticado podría vaciar la tabla entera.
