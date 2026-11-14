# Catálogos de referencia

**Tablas:** `roles`, `estados_terapeuta`, `estados_paciente`, `estados_etapa`, `causas`,
`algoritmos`, `bloqueos`, `causa_etapas`, `algoritmo_etapas`, `causa_frases`,
`algoritmo_frases`, `tipos_disco`, `alfabetos`, `modalidades`, `contenidos`,
`contenido_imagenes`, `centros_energeticos`, `tipos_alerta`.

## Para qué sirven

Son las tablas de "vocabulario" del sistema: el catálogo terapéutico con el que el
terapeuta arma un tratamiento, los contenidos que se entregan cada semana y los estados
posibles de cada entidad. No tienen datos de pacientes.

## Quién puede qué

| Rol              | SELECT | INSERT / UPDATE / DELETE                |
| ---------------- | ------ | --------------------------------------- |
| admin            | ✅     | Solo vía RPC (`create_contenido`, etc.) |
| terapeuta activo | ✅     | ❌                                      |
| paciente         | ❌     | ❌                                      |
| anon             | ❌     | ❌                                      |

Los estados (`estados_*`) son la excepción: cualquier usuario autenticado puede leerlos,
porque no revelan nada y la app los necesita para pintar etiquetas.

## Ejemplo simplificado

```sql
alter table public.causas enable row level security;

-- Solo la consola (admin o terapeuta activo) lee el catálogo
create policy "console_select_causas"
  on public.causas
  for select
  to authenticated
  using ((select public.is_console_user()));
```

## Decisión de diseño: el catálogo es "solo consola"

En la primera versión el catálogo se leía con `using (true)`: cualquier sesión, incluida
la de un paciente, podía listar todo el catálogo y todos los contenidos por PostgREST.
Eso permitía que un paciente viera **contenidos de semanas futuras** de su plan, saltándose
el goteo semanal.

Se cerró a `is_console_user()`. El paciente recibe solo lo que le corresponde a través de
`get_mi_plan_semanal`, una RPC `security definer` que ya filtra por semana liberada.
