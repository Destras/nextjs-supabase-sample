'use client'

import { useCaminoTabViewModel } from './controllers'
import { CaminoView } from './CaminoView'

const CaminoPage = () => {
  const vm = useCaminoTabViewModel()
  return <CaminoView {...vm} />
}

export default CaminoPage
