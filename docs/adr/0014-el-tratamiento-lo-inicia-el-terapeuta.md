# El tratamiento lo inicia el terapeuta, no el plan completo

El tratamiento arrancaba solo: al guardar un plan con las 16 semanas completas (los 5 tipos de
contenido en cada una) se fijaba la fecha de inicio y salía la bienvenida. Guardar un plan a
medias no era posible. El requerimiento de producto cambió: que el terapeuta elija qué
ejercicios van cada semana (a veces uno, a veces varios, a veces todos), que una semana o un
tratamiento entero puedan no tener contenido, y poder activar al paciente sin contenido
cargado. Con la regla vigente su tratamiento no arrancaba nunca. **Decidimos separar las dos
cosas: "Guardar" guarda el plan como esté, y el tratamiento arranca con un acto explícito del
terapeuta ("Iniciar tratamiento"), que fija la fecha de inicio y avisa al paciente, sea cual sea
el contenido cargado.**

## Consecuencias

- "Plan completo" deja de ser un evento y deja de ser condición para nada. Se va la regla de
  los 5 tipos por semana (`etapa_plan_completo`, `isSemanaCompleta`).
- `set_entregas_plan` deja de arrancar el tratamiento y de devolver el paciente para la
  bienvenida; eso pasa a una acción propia.
- Un tratamiento puede quedar guardado y sin iniciar por tiempo indefinido: el panel tiene que
  mostrarlo para que no se olvide.
- La app del paciente tiene que recibir las semanas de un tratamiento iniciado aunque no tengan
  contenido. La app actual ya muestra bien una semana vacía (frase + "No hay contenido para esta
  semana todavía."); lo que falta es que la base le mande esas semanas.
- Las frases automáticas no dependen del contenido asignado: llegan desde el inicio.

## Alternativas descartadas

**Que arranque con el primer guardado.** Sin paso extra para el terapeuta, pero guardar un
borrador arrancaría el reloj sin querer, y el arranque es irreversible.

**Que arranque al cargar el paciente.** Ya lo tuvimos y lo sacamos: la evaluación vencía el
mismo día y el reloj corría sin contenido.

**Mantener el plan completo y relajar qué cuenta como completo.** No hay regla posible: producto
considera válido un tratamiento sin ningún contenido.
