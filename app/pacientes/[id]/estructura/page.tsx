'use client'

import { useEstructuraTabViewModel } from './controllers'
import { EstructuraView } from './EstructuraView'

const EstructuraPage = () => {
  const vm = useEstructuraTabViewModel()
  return <EstructuraView {...vm} />
}

export default EstructuraPage
