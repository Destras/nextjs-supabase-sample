import { assertEquals } from 'jsr:@std/assert@1'
import { CORS_HEADERS, preflightResponse, withCors } from './cors.ts'

Deno.test(
  'preflightResponse — responde 204 a un OPTIONS, para que el navegador deje pasar el POST',
  () => {
    const res = preflightResponse(
      new Request('https://x.test/f', { method: 'OPTIONS' }),
    )

    assertEquals(res?.status, 204)
  },
)

Deno.test(
  'preflightResponse — el preflight trae Access-Control-Allow-Origin',
  () => {
    const res = preflightResponse(
      new Request('https://x.test/f', { method: 'OPTIONS' }),
    )

    assertEquals(res?.headers.get('Access-Control-Allow-Origin'), '*')
  },
)

Deno.test(
  'preflightResponse — el preflight habilita los headers que manda supabase-js',
  () => {
    const res = preflightResponse(
      new Request('https://x.test/f', { method: 'OPTIONS' }),
    )

    const permitidos = res?.headers.get('Access-Control-Allow-Headers') ?? ''
    assertEquals(
      ['authorization', 'content-type', 'apikey', 'x-client-info'].every((h) =>
        permitidos.includes(h),
      ),
      true,
    )
  },
)

Deno.test(
  'preflightResponse — devuelve null en POST, para que el handler siga su curso',
  () => {
    const res = preflightResponse(
      new Request('https://x.test/f', { method: 'POST' }),
    )

    assertEquals(res, null)
  },
)

Deno.test(
  'CORS_HEADERS — incluye el header secreto del cron, que no es estándar',
  () => {
    assertEquals(
      CORS_HEADERS['Access-Control-Allow-Headers'].includes('x-cron-secret'),
      true,
    )
  },
)

Deno.test(
  'withCors — deja pasar la respuesta del handler cuando todo va bien',
  async () => {
    const handler = withCors(async () => new Response('ok', { status: 201 }))
    const res = await handler(
      new Request('https://x.test/f', { method: 'POST' }),
    )

    assertEquals(res.status, 201)
  },
)

Deno.test(
  'withCors — contesta el preflight sin invocar al handler',
  async () => {
    let invocado = false
    const handler = withCors(async () => {
      invocado = true
      return new Response('ok')
    })
    await handler(new Request('https://x.test/f', { method: 'OPTIONS' }))

    assertEquals(invocado, false)
  },
)

Deno.test(
  'withCors — una excepción del handler devuelve 500, no una promesa rechazada',
  async () => {
    const handler = withCors(() => {
      throw new Error('boom')
    })
    const res = await handler(
      new Request('https://x.test/f', { method: 'POST' }),
    )

    assertEquals(res.status, 500)
  },
)

Deno.test(
  'withCors — ese 500 lleva CORS, para que el navegador muestre el error real y no uno de CORS',
  async () => {
    const handler = withCors(() => {
      throw new Error('boom')
    })
    const res = await handler(
      new Request('https://x.test/f', { method: 'POST' }),
    )

    assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*')
  },
)

Deno.test(
  'withCors — el cuerpo del 500 no filtra el mensaje de la excepción',
  async () => {
    const handler = withCors(() => {
      throw new Error('detalle-interno-sensible')
    })
    const res = await handler(
      new Request('https://x.test/f', { method: 'POST' }),
    )

    assertEquals((await res.text()).includes('detalle-interno-sensible'), false)
  },
)
