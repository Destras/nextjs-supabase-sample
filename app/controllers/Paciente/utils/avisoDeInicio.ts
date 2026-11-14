import type { AvisoDeInicio, Paciente } from '../PacienteTypes'

// `ya_recibida` gana sobre `con_app`: un paciente con cuenta que ya recibió la
// bienvenida no debe leer "ya tiene la app" como novedad (segundo tratamiento).
const avisoDeInicio = (
  paciente: Pick<Paciente, 'tieneCuenta' | 'bienvenidaRecibida'>,
): AvisoDeInicio => {
  if (paciente.bienvenidaRecibida) return 'ya_recibida'
  if (paciente.tieneCuenta) return 'con_app'
  return 'bienvenida'
}

export { avisoDeInicio }
