import { handleRequest } from './dispatcher.ts'

/**
 * paciente-cuenta Edge Function
 *
 * Recurso "cuenta del paciente". Acción única hoy: `delete-account`, la baja
 * voluntaria que el paciente dispara desde el portal.
 *
 * verify_jwt está en false en config.toml a propósito: la autorización la hace
 * checkPatientAuth() en código, porque el handler necesita LEER el claim `sub`
 * del token (es el único origen válido de p_user_id) y rechazar explícitamente a
 * terapeutas y admins. El gate built-in valida el token pero no deja inspeccionarlo.
 *
 * Toda la lógica vive en dispatcher.ts: este archivo es solo el wiring, para que
 * los tests puedan importar handleRequest sin levantar un servidor.
 *
 * OJO con la arrow function: Deno.serve invoca al handler con DOS argumentos,
 * (request, info). Pasarle `handleRequest` pelado hace que su segundo parámetro
 * `deps` reciba el objeto `info` de Deno, y como los defaults de JS solo aplican
 * cuando el argumento es `undefined`, el default NUNCA corre y la función explota
 * con "deps.checkPatientAuth is not a function" en el primer POST. Los tests
 * unitarios no pueden ver esto porque todos pasan `deps` explícitamente; lo
 * encontró servir la función de verdad.
 */
Deno.serve((req) => handleRequest(req))
