'use client'

import type {
  UpdatePacienteIdentidadPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { callUpdateRpc } from './callUpdateRpc'

const updatePacienteIdentidad = (
  payload: UpdatePacienteIdentidadPayload,
): Promise<UpdatePacienteResult> =>
  callUpdateRpc('update_paciente_identidad', {
    p_paciente_id: payload.pacienteId,
    p_nombre: payload.nombre,
    p_fecha_nacimiento: payload.fechaNacimiento,
    p_email: payload.email,
    p_telefono: payload.telefono,
  })

export { updatePacienteIdentidad }
