import { etapaSortKey } from '@/app/utils/etapaSortKey'

const etapaOrdinal = (
  etapas: ReadonlyArray<{
    id: string
    fechaInicio: string | null
    createdAt: string
  }>,
  etapaActivaId: string | null,
): number | null => {
  if (etapaActivaId === null) return null
  const sorted = [...etapas].sort((a, b) => {
    const dateDiff = etapaSortKey(a.fechaInicio, a.createdAt).localeCompare(
      etapaSortKey(b.fechaInicio, b.createdAt),
    )
    return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id)
  })
  const index = sorted.findIndex((e) => e.id === etapaActivaId)
  return index === -1 ? null : index + 1
}

export { etapaOrdinal }
