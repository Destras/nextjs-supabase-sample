import { CORS_HEADERS } from '../../_shared/cors.ts'

// Las cabeceras CORS van en TODAS las respuestas, no solo en el preflight: si el
// POST real vuelve sin `Access-Control-Allow-Origin`, el navegador lo bloquea
// igual aunque el preflight haya pasado. Ver _shared/cors.ts.
const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

export { jsonResponse }
