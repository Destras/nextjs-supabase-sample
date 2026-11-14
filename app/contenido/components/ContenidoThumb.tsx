import { Clock, Play, Sparkles, Images } from 'lucide-react'

import { cn } from '@/lib/utils'

import { WaveBars } from './WaveBars'

interface ContenidoThumbProps {
  readonly thumbKind: 'video' | 'mantra' | 'frase' | 'egregor' | 'galeria'
  readonly duracion: string | null // already formatted "MM:SS" or null
  readonly excerpt?: string | null // frase text excerpt
  readonly size?: 'card' | 'stage' // default 'card'
}

// Token-mapped gradients — full mock fidelity via --brand-secondary-* (violet scale).
// video:  135deg brand-primary-700 → brand-secondary-700
// mantra: 135deg brand-secondary-700 → brand-primary-900
const VIDEO_GRADIENT =
  'bg-[linear-gradient(135deg,var(--brand-primary-700),var(--brand-secondary-700))]'
const MANTRA_GRADIENT =
  'bg-[linear-gradient(135deg,var(--brand-secondary-700),var(--brand-primary-900))]'
// frase: mock rgba(gold,0.16) → rgba(violet,0.12).
const FRASE_GRADIENT =
  'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-accent-500)_16%,transparent),color-mix(in_srgb,var(--brand-secondary-500)_12%,transparent))]'
// glow: radial gold ~22% → transparent.
const GLOW =
  'bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--brand-accent-500)_22%,transparent),transparent_70%)]'

function DurationBadge({ duracion }: { readonly duracion: string }) {
  // On-image overlay: dark scrim + light text matching the mock's fixed badge.
  return (
    <span className="absolute bottom-[10px] right-[10px] z-[2] inline-flex items-center gap-1 rounded-full bg-[rgba(11,20,24,0.62)] px-2 py-[3px] font-mono text-[10px] text-[#f4efe6] backdrop-blur-[4px]">
      <Clock className="h-[11px] w-[11px]" />
      {duracion}
    </span>
  )
}

/**
 * Decorative content thumbnail faithfully replicating the Aurora mock
 * (`.ct-thumb*` / `.player-stage`). Presentational only — consumed by the
 * content card (card size) and the detail page stage (stage size).
 */
export function ContenidoThumb({
  thumbKind,
  duracion,
  excerpt,
  size = 'card',
}: ContenidoThumbProps) {
  const isStage = size === 'stage'
  const showBadge = !isStage && duracion != null

  if (thumbKind === 'frase') {
    return (
      <div
        className={cn(
          'relative flex flex-col items-start justify-center overflow-hidden border-b border-border px-5 py-[18px]',
          isStage ? 'aspect-[21/9]' : 'aspect-[16/9]',
          FRASE_GRADIENT,
        )}
      >
        <span className="mb-1 font-[family-name:var(--font-display)] text-[44px] leading-[0.6] text-brand-accent-500">
          &ldquo;
        </span>
        <p className="m-0 line-clamp-3 text-base italic leading-[1.4] text-foreground">
          {excerpt}
        </p>
      </div>
    )
  }

  // mantra stage uses 21/9 to match `.player-mantra .player-stage`.
  const aspect =
    isStage && thumbKind === 'mantra' ? 'aspect-[21/9]' : 'aspect-[16/9]'

  // PR2b (egregor/galeria, no distinct gradient token budget): reuse the
  // existing two gradients — egregor rides the video pipeline verbatim
  // (design §8.2) so it shares VIDEO_GRADIENT; galeria (cma/ic) shares
  // MANTRA_GRADIENT. The icon carries the identity, colour is grouping only
  // — same resolution as the CHIP tone collapse above and design §9.3's
  // plan-grid SLOT_PRESENTATION collapse.
  const isVideoLike = thumbKind === 'video' || thumbKind === 'egregor'

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        aspect,
        isVideoLike ? VIDEO_GRADIENT : MANTRA_GRADIENT,
      )}
    >
      <div className={cn('absolute inset-0', GLOW)} />

      {thumbKind === 'video' && (
        <div className="relative z-[1] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[rgba(244,239,230,0.92)]">
          <Play className="ml-[2px] h-5 w-5 text-[var(--brand-primary-900)]" />
        </div>
      )}
      {thumbKind === 'mantra' && (
        <WaveBars
          count={32}
          seed={3}
          className="relative z-[1] h-[46%] w-[78%]"
        />
      )}
      {thumbKind === 'egregor' && (
        <div className="relative z-[1] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[rgba(244,239,230,0.92)]">
          <Sparkles className="h-5 w-5 text-[var(--brand-primary-900)]" />
        </div>
      )}
      {thumbKind === 'galeria' && (
        <div className="relative z-[1] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[rgba(244,239,230,0.92)]">
          <Images className="h-5 w-5 text-[var(--brand-primary-900)]" />
        </div>
      )}

      {showBadge && <DurationBadge duracion={duracion!} />}
    </div>
  )
}
