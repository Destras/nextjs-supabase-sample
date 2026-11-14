'use client'

import { useAlertasViewModel } from './controllers'
import { AlertasView } from './AlertasView'

export default function AlertasPage() {
  const vm = useAlertasViewModel()
  return <AlertasView {...vm} />
}
