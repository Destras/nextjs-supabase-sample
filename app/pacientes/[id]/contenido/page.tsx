'use client'
import { useContenidoTabViewModel } from './controllers'
import { ContenidoView } from './ContenidoView'

const ContenidoPage = () => {
  const vm = useContenidoTabViewModel()
  return <ContenidoView {...vm} />
}
export default ContenidoPage
