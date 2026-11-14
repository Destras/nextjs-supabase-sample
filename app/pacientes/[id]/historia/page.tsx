'use client'

import { useHistoriaTabViewModel } from './controllers'
import { HistoriaView } from './HistoriaView'

export default function HistoriaPage() {
  const vm = useHistoriaTabViewModel()
  return <HistoriaView {...vm} />
}
