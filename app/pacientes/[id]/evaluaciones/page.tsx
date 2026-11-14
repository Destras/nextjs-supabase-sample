'use client'

import { useEvaluacionesTabViewModel } from './controllers'
import { EvaluacionesView } from './EvaluacionesView'

const EvaluacionesPage = () => {
  const vm = useEvaluacionesTabViewModel()
  return <EvaluacionesView {...vm} />
}

export default EvaluacionesPage
