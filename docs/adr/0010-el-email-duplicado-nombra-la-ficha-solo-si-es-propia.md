# El aviso de email duplicado nombra la ficha solo si es del mismo terapeuta

`pacientes.email` es único. Hasta ahora, cuando un alta o una edición chocaban con esa restricción, el terapeuta veía el error crudo de Postgres (`duplicate key value violates unique constraint "pacientes_email_key"`). **Decidimos que el choque se traduzca a un aviso legible, y que ese aviso nombre la ficha que ya tiene el email (con link) solo si la ficha pertenece al mismo terapeuta. Si pertenece a otro, el aviso es genérico.**

## Contexto

Un terapeuta intentó cargarse a sí mismo como paciente con su propio email. Ese email ya estaba en otra ficha suya, donde lo había cargado meses antes en lugar del email de la paciente. Vio el error crudo, no entendió qué pasaba y lo esquivó agregándole un "1" al email.

El caso más común resulta ser que el terapeuta choca **consigo mismo**: reusó un email en dos fichas suyas. Para ese caso, lo que destraba es saber _cuál_ ficha lo tiene.

## Decisión

- El panel reconoce el choque por el código de error (`23505`) y el nombre de la restricción (`pacientes_email_key`), no por el texto del mensaje.
- Ante ese error, el panel busca el email en `pacientes` con la sesión del terapeuta. Las RLS solo le devuelven fichas asignadas a él (o todas, si es admin).
  - Si encuentra una ficha, el panel muestra _"Ese email ya está en la ficha de {nombre}"_ con un link a esa ficha.
  - Si no encuentra ninguna, el panel muestra _"Ese email ya está registrado en otro paciente. Usá el email propio del paciente."_
- No se modifican `register_paciente` ni `update_paciente_identidad`. La privacidad entre terapeutas la resuelven las RLS existentes, no una regla nueva.

## Alternativas descartadas

**Aviso genérico siempre.** Es más simple, pero en el caso más común (el choque consigo mismo) deja al terapeuta buscando a mano cuál de sus fichas tiene el email.

**Detectar el choque en el RPC y devolver un código propio (`email_duplicado`) con los datos de la ficha.** Funciona, pero requiere migración y coordinar el deploy de la base con el del panel. Además, el RPC tendría que reimplementar a mano la regla de "¿esta ficha es del terapeuta?", que las RLS ya resuelven.

**Nombrar la ficha siempre.** Le mostraría a un terapeuta el nombre de un paciente que no es suyo, y eso rompe el aislamiento entre terapeutas que imponen las RLS.

## Consecuencias

- El arreglo se publica solo con el panel; no hay migración.
- Hay una consulta extra, pero solo en el camino de error.
- La comparación sigue distinguiendo mayúsculas: `Foo@x.com` y `foo@x.com` todavía no chocan, aunque el glosario los define como el mismo email de la ficha. Cerrar eso requiere una migración aparte (normalizar a minúsculas).
- Un admin siempre ve el nombre de la ficha, porque las RLS le dejan ver todas.
- "La ficha pertenece al terapeuta" quiere decir que tiene una asignación **abierta** con ese paciente. Las RLS de `pacientes` no miran `fecha_hasta` y también le devuelven a sus ex-pacientes: para esas fichas (incluso dadas de baja) el aviso es el genérico. El panel necesita saber si quien pregunta es admin para seguir nombrándole todas.
