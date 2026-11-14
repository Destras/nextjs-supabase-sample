'use client'

import { useNuevoTratamientoViewModel } from './controllers'
import { NuevoTratamientoView } from './NuevoTratamientoView'

export default function NuevoTratamientoPage() {
  const vm = useNuevoTratamientoViewModel()
  return <NuevoTratamientoView {...vm} />
}
