import { PACIENTE_STATE } from '../PacienteTypes'
import type { Paciente } from '../PacienteTypes'

/**
 * Whether the paciente is owed a bienvenida that was never delivered: the
 * treatment started, they have no account yet, they are not in baja and the
 * bienvenida was not already received.
 */
const isBienvenidaPendiente = (
  paciente: Pick<
    Paciente,
    | 'sinIniciar'
    | 'etapaActivaId'
    | 'tieneCuenta'
    | 'state'
    | 'bienvenidaRecibida'
  >,
): boolean =>
  paciente.etapaActivaId !== null &&
  !paciente.sinIniciar &&
  !paciente.tieneCuenta &&
  paciente.state !== PACIENTE_STATE.BAJA &&
  !paciente.bienvenidaRecibida

export { isBienvenidaPendiente }
