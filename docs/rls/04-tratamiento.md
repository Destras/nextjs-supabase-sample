# Tratamiento

**Tablas:** `etapas_tratamiento`, `etapa_bloqueos`, `etapa_alfabetos`, `niveles`,
`nivel_evaluacion`, `entregas_plan`.

## Para qué sirven

Es el árbol clínico de un paciente: una **etapa** (un tratamiento de N meses, con su causa
y algoritmo), sus **niveles**, las **evaluaciones** de cada nivel, los bloqueos y alfabetos
asignados, y el **plan de entregas** (qué contenido recibe cada semana).

## Quién puede qué

| Rol              | SELECT                                               | Escritura |
| ---------------- | ---------------------------------------------------- | --------- |
| admin            | Todo                                                 | Vía RPC   |
| terapeuta activo | Lo que cuelga de pacientes con **asignación activa** | Vía RPC   |
| paciente         | ❌ (su plan lo recibe por `get_mi_plan_semanal`)     | ❌        |

## Ejemplo simplificado

Las tablas hijas no tienen `paciente_id`: llegan al paciente subiendo por la etapa.

```sql
create policy "terapeuta_select_niveles_via_asignacion_activa"
  on public.niveles
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.etapas_tratamiento e
       where e.id = niveles.etapa_id
         and public.has_active_assignment(e.paciente_id)
    )
  );
```

## Decisión de diseño: "asignación activa" en vez de "dueño de la etapa"

La primera versión filtraba por `etapas_tratamiento.terapeuta_id = auth.uid()`: el
terapeuta veía las etapas **que él creó**. Cuando un paciente cambia de terapeuta, el
nuevo no veía la historia clínica previa, y el anterior la seguía viendo.

Se reescribió para que el criterio sea `has_active_assignment(paciente_id)`: quien atiende
hoy al paciente ve **toda** su historia, y quien dejó de atenderlo deja de verla. La regla
vive en un único helper que reutilizan 8 políticas y varias RPCs.
