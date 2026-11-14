# Las Edge Functions que llama el navegador contestan el preflight, y sus errores también

El panel llama Edge Functions con `supabase.functions.invoke()`, y el navegador manda un preflight `OPTIONS` antes de cada POST. Ninguna función lo contestaba, así que **todas las llamadas del panel estaban rotas en producción** — y no se veía en desarrollo. **Decidimos centralizar CORS en un único wrapper, `withCors`, que envuelve el handler de `Deno.serve` y hace dos cosas: contesta el preflight, y convierte cualquier excepción en un 500 que también lleva las cabeceras.**

## Contexto

`supabase.functions.invoke()` agrega `Authorization` y `Content-Type: application/json`. Eso vuelve al pedido "no simple" según la política de mismo origen, así que el navegador manda antes un `OPTIONS` de preflight. Las funciones rechazaban todo método distinto de `POST` con 405, incluido ese `OPTIONS`, y el POST real **nunca se enviaba**.

Estaban afectadas las seis invocaciones que el panel hace desde el navegador: la bienvenida al paciente (`paciente-invitacion`) y las cinco acciones de terapeutas —invitar, reenviar, revocar, desactivar, reactivar— (`terapeuta-invitations`). Probablemente desde el primer deploy.

**Lo que hizo que durara tanto es que en local el bug no existe.** El stack local rutea por Kong, que contesta el preflight por su cuenta con `Access-Control-Allow-Origin: *`. En producción no hay Kong: Supabase rutea directo a la función. Todo anda en desarrollo, nada anda en producción, y ningún test lo agarra porque los tests usan `curl` o mocks — ninguno hace preflight.

El síntoma, además, miente. Cuando una función responde sin cabeceras CORS, el navegador **no muestra el status real**: muestra un error de CORS. El diagnóstico arranca mirando la configuración de CORS en vez del error de abajo. Se encontró el 2026-09-28, en producción, persiguiendo por qué no salía un mensaje de bienvenida.

## Decisión

- **Un solo wrapper, `_shared/cors.ts`.** `withCors(handler)` envuelve el handler de `Deno.serve`. Las funciones no repiten el manejo de CORS ni el `try/catch`.
- **El wrapper contesta el preflight** con 204 y las cabeceras, sin invocar al handler.
- **El wrapper atrapa toda excepción** y devuelve un 500 **con** las cabeceras. Sin esto el arreglo cubre solo el camino feliz: una excepción no capturada la contesta Deno con un 500 pelado, y el navegador vuelve a mostrar un error de CORS que manda el diagnóstico al lugar equivocado.
- **El cuerpo de ese 500 es genérico** (`{ error: 'error_inesperado' }`); el detalle de la excepción va al log del servidor. Hay un test que fija que no se filtre.
- **`Access-Control-Allow-Origin: *`.** La autorización viaja en `Authorization` (o `X-Cron-Secret`), nunca en cookies, así que no hay credenciales que un origen ajeno pueda reusar sin tener el token.
- **Las cabeceras van en todas las respuestas, no solo en el preflight.** Si el POST vuelve sin `Access-Control-Allow-Origin`, el navegador lo bloquea igual aunque el preflight haya pasado.
- **Solo en las funciones que llama el navegador.** `patient-activation` y `paciente-cuenta` las llama la app móvil por HTTP nativo, que no aplica la política de mismo origen: agregarles CORS sería superficie sin uso.

## Alternativas descartadas

**`try/catch` y preflight repetidos en cada función.** Es lo que sale naturalmente, y es lo que garantiza que la próxima función se olvide de una de las dos mitades. El wrapper hace que "estar bien" sea el default y "estar mal" requiera salirse del camino.

**Restringir el origen al dominio del panel.** Obliga a configurar el origen por entorno (local, preview de Vercel, producción) y a mantener esa lista, sin ganancia real: lo que autoriza es el token del header, no el origen.

**Devolver el mensaje de la excepción en el 500.** Ayudaría a debuggear desde el navegador, pero expone internals a cualquiera que pueda llamar la función. El log del servidor cubre el caso sin ese costo.

## Consecuencias

- **Toda Edge Function nueva que llame el navegador tiene que usar `withCors`.** No hay nada que lo enforce: es convención, y el olvido se manifiesta recién en producción.
- **El entorno local sigue sin poder reproducir la falla**, porque Kong la tapa. Un test que la hubiera atrapado tendría que pegarle a la función sin pasar por Kong, o correr en un navegador real contra el entorno desplegado. No existe hoy y queda pendiente.
