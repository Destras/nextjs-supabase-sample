import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContenidoThumb } from '@/app/contenido/components/ContenidoThumb'

interface MediaPlayerProps {
  readonly kind: 'video' | 'audio'
  readonly src: string | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly onRetry: () => void
  readonly onPlaybackError: () => void
}

/**
 * Presentational media player.
 *
 * State precedence (per DEC-15):
 *   1. error  → error block with "Reintentar"
 *   2. loading / src null → ContenidoThumb stage (loading look)
 *   3. ready  → native <video> or <audio> HTML5 player
 *
 * Native <video>/<audio> controls are the accepted non-tokenizable exception
 * (DevSpec §7.4). No state of its own — all props come from the ViewModel.
 */
export function MediaPlayer({
  kind,
  src,
  isLoading,
  error,
  onRetry,
  onPlaybackError,
}: MediaPlayerProps) {
  // 1 — error state
  if (error !== null) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-[var(--radius)] border border-border bg-destructive-bg px-6 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No pudimos cargar el archivo.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    )
  }

  // 2 — loading / idle state (src not yet available)
  if (isLoading || src === null) {
    return (
      <ContenidoThumb
        thumbKind={kind === 'video' ? 'video' : 'mantra'}
        size="stage"
        duracion={null}
      />
    )
  }

  // 3 — ready state: native HTML5 player
  if (kind === 'video') {
    return (
      <div className="overflow-hidden rounded-[var(--radius)] border border-border">
        <video
          controls
          preload="metadata"
          src={src}
          onError={onPlaybackError}
          className="aspect-video w-full"
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border">
      <audio
        controls
        preload="metadata"
        src={src}
        onError={onPlaybackError}
        className="w-full"
      />
    </div>
  )
}
