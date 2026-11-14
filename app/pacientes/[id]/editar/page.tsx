'use client'

import { useEditarPacienteViewModel } from './controllers'
import { EditarPacienteView } from './EditarPacienteView'

export default function EditarPacientePage() {
  const vm = useEditarPacienteViewModel()
  return <EditarPacienteView {...vm} />
}
