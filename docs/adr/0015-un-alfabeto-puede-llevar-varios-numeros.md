# Un alfabeto puede llevar varios números en un mismo diagnóstico

El panel guardaba un solo número por alfabeto en cada diagnóstico (`etapa_alfabetos` con clave
`etapa_id + alfabeto_id`). Al cargar los ocho alfabetos del catálogo, cada uno con su rango,
hubo que decidir si esa forma alcanzaba. La definición de producto
daba ejemplos con varios números del mismo alfabeto, pero también una indicación ambigua
que sugería un único número. No estaba confirmado. **Decidimos que un alfabeto puede llevar uno o varios
números en el mismo diagnóstico, cada uno dentro del rango de ese alfabeto.**

## Consecuencias

- `etapa_alfabetos` pasa a tener una fila por número: la clave incluye el número, que deja de
  ser opcional.
- El catálogo `alfabetos` guarda el tope del rango de cada uno, y la base rechaza un número
  fuera de rango; el panel lo valida antes de guardar.
- Cambian las tres pantallas que cargan alfabetos (cargar paciente, editar, nuevo tratamiento)
  y el resumen de confirmación.
- Si producto confirma que es uno solo, no hay que deshacer nada: cargar un único número sigue
  siendo válido.

## Alternativa descartada

**Seguir con un número por alfabeto hasta que producto confirme.** Era el cambio más chico (solo
el catálogo), pero si resulta que son varios hay que migrar la tabla y rehacer las pantallas
por segunda vez, y mientras tanto el terapeuta no tiene dónde cargar lo que le dicta el
laboratorio.
