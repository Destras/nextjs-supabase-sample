'use client'

import { useNuevoPacienteViewModel } from './controllers'
import { NuevoPacienteView } from './NuevoPacienteView'

export default function NuevoPacientePage() {
  const vm = useNuevoPacienteViewModel()
  return <NuevoPacienteView {...vm} />
}
