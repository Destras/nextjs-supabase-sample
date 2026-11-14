'use client'

import { useTerapeutasViewModel } from './controllers'
import { TerapeutasView } from './TerapeutasView'
import { NotAuthorizedPage } from '@/app/features/Auth/components/NotAuthorizedPage'

export default function TerapeutasPage() {
  const vm = useTerapeutasViewModel()
  if (!vm.isResolvingRole && !vm.isAdmin) {
    return <NotAuthorizedPage />
  }
  return <TerapeutasView {...vm} />
}
