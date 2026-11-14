'use client'

import { useParams } from 'next/navigation'
import { useTerapeutaDetailViewModel } from './controllers'
import { TerapeutaDetailView } from './TerapeutaDetailView'
import { NotAuthorizedPage } from '@/app/features/Auth/components/NotAuthorizedPage'

export default function TerapeutaDetailPage() {
  const params = useParams<{ id: string }>()
  const vm = useTerapeutaDetailViewModel(params.id)
  if (!vm.isResolvingRole && !vm.isAdmin) return <NotAuthorizedPage />
  return <TerapeutaDetailView {...vm} />
}
