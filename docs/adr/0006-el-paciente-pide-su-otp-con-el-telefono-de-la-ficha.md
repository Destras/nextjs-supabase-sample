# El paciente pide su OTP con el teléfono de la ficha, no con el email

Refina un ADR anterior (omitido en la versión pública), que movió la emisión del código al momento en que el paciente lo pide desde la app. La emisión a demanda desde el dispositivo sigue igual; lo único que cambia es **con qué se identifica el paciente al pedir el código**.

## Contexto

El ADR anterior eligió el **email**, porque en la base `pacientes.email` es `not null unique` y `telefono` es nullable y no único. En paralelo, sin conocer esa decisión, la app eligió el **teléfono** (`app-paciente`, ADR-0015, ya con ProductSpec, DevSpec, PLAN y épicos). Ninguna de las dos consideró el argumento de la otra, y el contrato del backend no puede tener dos identificadores.

## Decisión

El paciente pide su código con el **teléfono**. Tipea `+54` y los 10 dígitos del número nacional, y el backend compara contra los últimos 10 dígitos del teléfono guardado. El formato de cable y la concesión del `15` quedan como los fijó el ADR-0015 de la app.

Pesa más el argumento de producto que la garantía de la base:

- **El email no lo escribió el paciente: lo cargó el terapeuta.** Un paciente recién derivado no tiene por qué saber cuál quedó.
- **El teléfono es el dato que el equipo ya registra de todos los pacientes.** En los datos existentes todos lo tienen, ninguno lo comparte y ninguno tiene menos de 10 dígitos.
- **Es el mismo dato con el que se entrega el código.** Con teléfono, un solo dato de la ficha tiene que estar bien; con cualquier otro identificador, dos.

## Alternativas descartadas

**Email (ADR anterior).** Más robusto en la base, pero le pide al paciente un dato que tipeó otro.

**DNI.** Lo más natural para un paciente argentino, y el único identificador que no se comparte. Se descartó porque:

- **No existe en ningún lado:** ni en la base, ni en el alta, ni en los datos de pacientes existentes. Ninguno activó su cuenta todavía, así que habría que cargarles el DNI a mano a todos **antes** de que el primero pueda activarse.
- **No reemplaza al teléfono, se suma.** El código se sigue entregando al teléfono de la ficha: pasan a ser dos datos que tienen que estar bien en vez de uno, y un teléfono mal cargado rompe igual.
- **Su única ventaja cubre un caso con cero ocurrencias reales** (un WhatsApp compartido entre pacientes), que no justifica juntar un dato nuevo. Qué hace el pedido cuando un número matchea a más de un paciente se decide aparte, con lo que ya hay.
- Suma un documento de identidad al lado de datos clínicos, que hoy no guardamos.

## Consecuencias

- **La base no garantiza que el teléfono exista ni que sea único.** El alta del panel lo exige, pero la columna es nullable y sin índice único. Si un número no matchea a nadie **o matchea a más de un paciente**, el pedido no envía nada y responde igual que siempre. Un WhatsApp compartido entre pacientes no pasa en la práctica (cero casos en los datos existentes), así que no se diseña para él hasta que aparezca un caso confirmado.
- **Un paciente con el teléfono compartido hoy no puede activarse de ninguna forma.** El ADR-0015 de la app dice que "se activan a través del terapeuta", pero ese camino no existe: el web console no tiene cómo emitirle un código a una ficha puntual, y con la bienvenida `paciente-invitacion` deja de emitir. Distinto es el teléfono **mal cargado**, que sí tiene salida: el terapeuta corrige la ficha y el paciente vuelve a pedir el código. La cura, cuando aparezca el primer caso, queda abierta entre dos: pedir también la fecha de nacimiento en `request-otp` (desambigua a dos hermanos, pero cambia el contrato con la app) o un botón del terapeuta que emita y entregue el código para esa ficha (sin cambio de contrato).
- **Para que ese caso se pueda confirmar, se detecta en los dos extremos.** Al cargar o editar el teléfono en el panel, el terapeuta ve un aviso —no bloqueante, sin revelar de quién es la otra ficha— de que ese número ya está en otra ficha y el paciente no va a poder activarse solo; es el único momento en que el caso se evita gratis, cargando otro número. Y `request-otp` loguea, sin datos personales, cuando un número matchea más de una ficha, para los casos que entren por otra vía. El aviso y `request-otp` usan **la misma** regla de matcheo por los últimos 10 dígitos: si divergen, el aviso diría "sin duplicados" donde el pedido encuentra dos.
- **Las guardas del pedido siguen vigentes sin cambios de fondo.** Donde el pedido iba keyeado por email, va keyeado por teléfono: cooldown, tope diario y respuesta ciega aplican igual.
- **El paciente activa su cuenta sin tipear nunca el email con el que después tiene que entrar.** Con email como identificador esa deuda se cerraba sola. Con teléfono se cierra devolviendo el email en la respuesta exitosa de `create-account` —que ya lo conoce y hoy solo responde `{ status }`— para que la app lo muestre en la pantalla de éxito. A esa altura el paciente ya probó el código y su fecha de nacimiento: le mostramos su propio email, a nadie más. Con ese email y la contraseña que acaba de elegir, la app llama ella misma a `signInWithPassword`, así que el paciente queda adentro al terminar la activación —lo estándar— sin que el backend emita tokens. Funciona aunque el terapeuta haya cargado mal el email: en este sistema el email es el **nombre de usuario**, no una casilla (no se confirma y la recuperación iba a entregar por WhatsApp); lo que rompía era que el paciente no lo conociera. Se descartó el login por teléfono + contraseña: Supabase lo soporta pero lo desaconseja (los números se reciclan), `auth.users.phone` es único y el teléfono no, y cambiaría el contrato de login y de recuperación de una app ya construida. Queda como evolución si el email resulta un problema.
