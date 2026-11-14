# El teléfono del paciente se guarda en una sola forma canónica, impuesta por la base

Desde [ADR-0006](./0006-el-paciente-pide-su-otp-con-el-telefono-de-la-ficha.md) el teléfono de la ficha es la identidad con la que el paciente pide su código **y** el destino al que se le entrega. **Decidimos que `pacientes.telefono` tenga una sola forma posible —`+54` seguido de los 10 dígitos del número nacional argentino, sin `9` móvil, sin `0` de larga distancia, sin espacios ni guiones— y que la imponga la base: un trigger normaliza toda escritura a esa forma y un check rechaza lo que no se pueda normalizar.**

## Contexto

La columna era `text` pelado. El wizard de alta valida E.164 en el browser (`^\+[1-9]\d{7,14}$`), pero eso ni impone una forma única —`+541151234567` y `+5491151234567` pasan los dos— ni alcanza a las escrituras que no pasan por el wizard: los seeds y la importación de pacientes reales guardaron el 100% de sus teléfonos con espacios y guiones (`+54 9 11 ....-....`). Cada consumidor adivinaba la forma por su cuenta, y adivinaban distinto:

- el matcheo de `request-otp` recortaba a los últimos 10 dígitos, lo que convierte `11 15 51234567` en un número de Buenos Aires;
- `normalizeToForMeta` hacía `replace(/^\+549/, '+54')`, que sobre `+54 9 ...` no matchea por el espacio y le manda a Meta el número con el `9` y con espacios.

En los dos casos el paciente recibe `ok` y no le llega nada, y nadie se entera.

## Decisión

- **Trigger `before insert or update`** sobre `pacientes`: saca todo lo que no sea dígito, acepta el prefijo `54` si está, descarta un `9` y un `0` inmediatamente después (ningún código de área argentino empieza con `9` ni con `0`), y guarda `+54` + los 10 dígitos que quedan.
- **Check** sobre la forma canónica exacta. Lo que no normaliza a 10 dígitos —el `15` intercalado, números cortos, otro país— se **rechaza** en la escritura: el terapeuta ve el error en el alta, que es el único momento en que todavía puede corregirlo.
- **Solo Argentina.** Hoy todos los pacientes son argentinos, y la app ya tiene el `+54` fijo: un paciente con número extranjero cargado no podría activarse igual.
- **La forma canónica es exactamente el formato de cable de `request-otp`** (`+54` + 10 dígitos). El matcheo pasa a ser igualdad, el aviso de duplicados es un `where telefono = …`, y lo que se le entrega a Meta es lo guardado. El contrato con la app no cambia.

## Alternativas descartadas

**Normalizar al leer** (dejar la columna como está y limpiar en cada consumidor). No migra nada, pero la basura queda guardada para siempre, el `15` no se detecta nunca y cada consumidor nuevo tiene que acordarse de usar la función.

**Check E.164 estricto sin normalizar.** Rechaza los seeds y deja conviviendo `+54` y `+549`, así que el matcheo y el `9` siguen haciendo falta; y no detecta el `15`.

## Consecuencias

- **La migración normaliza las filas existentes con la misma función.** Antes de aplicarla en producción hay que contar —solo lectura— las filas que no normalizan, porque harían fallar el check.
- **Los seeds sucios se normalizan solos al insertarse**, así que `db reset` sigue funcionando con los seeds actuales, incluido el local de datos reales.
- **La forma guardada es la que Meta quiere en `to` (sin el `9`)** según lo medido en junio de 2026 con un envío real; lo confirma el envío real con template que cierra la entrega de `request-otp`. Si resultara al revés, el ajuste es en el sender, no en los datos.
- **Un paciente de otro país no se puede cargar** _(matizado el 2026-09-24, ver la actualización al pie: un número extranjero en formato nacional de 10 dígitos ahora se acepta como argentino; lo que sigue rechazándose es el formato E.164 de otro país)_. Abrirlo de verdad exige tocar el trigger y el campo de la app a la vez; es un cambio chico y deliberado, en los dos repos.

## Actualización 2026-09-24 — el prefijo de país es opcional en la entrada

El `/playwright-uat` encontró (ACT-001) que la ayuda del campo describía un formato que la regla
rechazaba: `11 5555 1234` —código de área y número, sin el 0 ni el 15, literalmente lo que el texto
pedía— daba "Teléfono inválido", porque el `54` era obligatorio y no lo decía ningún texto.

Se resolvió por el lado permisivo: **el `+54` deja de tipearse**. El campo del panel lo muestra como
prefijo fijo y `normalizar_telefono_ar` prueba dos lecturas del input —con y sin prefijo de país— y
se queda con la primera que valida. Como todos los pacientes son argentinos, el `54` no aportaba
información; era ceremonial de entrada.

Qué **no** cambia:

- La **salida sigue siendo la misma**: `+54` + 10 dígitos. El check y el trigger no se tocan.
- **Ninguna fila existente cambia de valor**: la lectura con prefijo se prueba primero, así que lo ya
  canónico se mapea a sí mismo. La migración lo verifica con un guard antes de terminar.
- El **`15` se sigue rechazando**: deja 12 dígitos y no hay forma de distinguirlo de parte del número.

Lo que sí se pierde: un número de 10 dígitos de **otro país** que empiece con 1–8 ahora se acepta
como argentino. Es el precio de no pedir el prefijo, y es consistente con la decisión de arriba —este
producto no carga pacientes de otro país, y si alguna vez lo hace, el cambio es en el trigger y en el
campo de la app a la vez.
