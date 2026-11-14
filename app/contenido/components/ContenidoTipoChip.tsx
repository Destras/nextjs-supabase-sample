import {
  AudioLines,
  Video,
  Sparkles,
  Images,
  BrainCircuit,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { TabKey } from '@/app/contenido/controllers'
import { contenidoTipoMeta } from '@/app/contenido/controllers/utils/contenidoTipoMeta'

interface ContenidoTipoChipProps {
  readonly tab: TabKey
  readonly className?: string
}

interface ChipStyle {
  readonly icon: LucideIcon
  readonly tone: string
}

// Tipo chip tone — replicates `.chip.teal/.violet` from the mock,
// collapsed onto the existing brand scales (token freeze, no hardcoded hex).
// video → teal → brand-primary · mantra → violet → brand-secondary
//
// PR2b (3 new tipos, only 3 brand hues exist): cycle the same three tokens
// and let the icon carry discrimination, not colour — same resolution design
// §9.3 documents for the plan-grid SLOT_PRESENTATION token collapse, reused
// here for consistency. egregor → accent (first use in this chip); cma →
// secondary (reused, distinguished by the Images icon); ic → primary
// (reused, distinguished by the BrainCircuit icon).
const CHIP: Record<TabKey, ChipStyle> = {
  videos: {
    icon: Video,
    tone: 'bg-[color-mix(in_srgb,var(--brand-primary-500)_15%,transparent)] text-[var(--brand-primary-700)] border-[color-mix(in_srgb,var(--brand-primary-500)_30%,transparent)]',
  },
  mantras: {
    icon: AudioLines,
    tone: 'bg-[color-mix(in_srgb,var(--brand-secondary-500)_18%,transparent)] text-[var(--brand-secondary-700)] border-[color-mix(in_srgb,var(--brand-secondary-500)_40%,transparent)]',
  },
  egregores: {
    icon: Sparkles,
    tone: 'bg-[color-mix(in_srgb,var(--brand-accent-500)_18%,transparent)] text-[var(--brand-accent-700)] border-[color-mix(in_srgb,var(--brand-accent-500)_40%,transparent)]',
  },
  cma: {
    icon: Images,
    tone: 'bg-[color-mix(in_srgb,var(--brand-secondary-500)_18%,transparent)] text-[var(--brand-secondary-700)] border-[color-mix(in_srgb,var(--brand-secondary-500)_40%,transparent)]',
  },
  ic: {
    icon: BrainCircuit,
    tone: 'bg-[color-mix(in_srgb,var(--brand-primary-500)_15%,transparent)] text-[var(--brand-primary-700)] border-[color-mix(in_srgb,var(--brand-primary-500)_30%,transparent)]',
  },
}

/**
 * Tipo chip shared between the catalog card and the content detail head.
 * Presentational only — icon + label, tone-mapped to the brand scale by tab.
 */
const ContenidoTipoChip = ({ tab, className }: ContenidoTipoChipProps) => {
  const meta = contenidoTipoMeta(tab)
  const chip = CHIP[tab]
  const ChipIcon = chip.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[6px] rounded-full border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em]',
        chip.tone,
        className,
      )}
    >
      <ChipIcon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

export { ContenidoTipoChip }
export type { ContenidoTipoChipProps }
