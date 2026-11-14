# Un mes de tratamiento son 4 semanas, no un mes calendario

El panel contaba el tiempo con dos reglas a la vez: el contenido y los niveles del plan en
bloques de 4 semanas, pero el "mes de tratamiento", la fecha de evaluación de cada nivel
(`fecha_inicio + n * interval '1 month'`) y las alertas que dependen de ella, en meses
calendario. El resultado era "Mes 1 · Semana 5" en la ficha y una evaluación de cierre que caía
~9 días después de terminado el contenido (día ~121 vs día 112). El equipo clínico trabaja con
**1 mes = 4 semanas**, así que **decidimos que un mes de tratamiento son exactamente 28 días
contados desde el arranque, y una etapa de 4 niveles dura 16 semanas (112 días)**.

## Consecuencias

- La evaluación del nivel _n_ vence el día `28 × n` desde `fecha_inicio`; requiere migración
  (`register_paciente`, el recompute al completar el plan en `set_entregas_plan` y los niveles
  ya creados de tratamientos en curso).
- Las alertas calculan su propio `mes_actual` con `age()` (meses calendario,
  `supabase/schemas/65_alertas.sql:138`): `mes_3`, `fin` y `reinicio` pasan a usar bloques de
  28 días. `eval_vencida` cambia por arrastre (depende de `fecha_seguimiento_esperada`).
- Cambian las fechas de evaluación y de alertas de los pacientes en curso. Avisar antes de
  deployar.
- `mesActual` deja de usar `monthsBetween` (calendario) y pasa a derivarse de la semana de
  contenido: `ceil(semana / 4)`, con tope en `cantidad_niveles`.

## Alternativa descartada

**Mes calendario para todo y solo corregir cómo se muestra.** Respetaba "una etapa son 4
meses" literalmente, pero dejaba el contenido (semanal) desalineado de la evaluación, y no es
como piensa el tiempo el equipo clínico.
