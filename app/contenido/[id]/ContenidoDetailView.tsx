'use client'

import Link from 'next/link'
import { ArrowLeft, Clock, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import type { TabKey } from '@/app/contenido/controllers'
import { contenidoTipoMeta } from '@/app/contenido/controllers/utils/contenidoTipoMeta'
import { formatDuracion } from '@/app/contenido/controllers/utils/formatDuracion'
import { ContenidoThumb } from '@/app/contenido/components/ContenidoThumb'
import { MediaPlayer } from '@/app/contenido/components/MediaPlayer'
import { ContenidoGaleriaCarousel } from '@/app/contenido/components/ContenidoGaleriaCarousel'
import { ContenidoTipoChip } from '@/app/contenido/components/ContenidoTipoChip'
import { DeleteContenidoDialog } from '@/app/contenido/components/DeleteContenidoDialog'
import { ReplaceContenidoDialog } from '@/app/contenido/components/ReplaceContenidoDialog'
import type { ContenidoDetailViewModel } from '@/app/contenido/[id]/controllers'

// Real mapping (PR2b) — each tipo has its own catalog route. Keep in sync
// with the identical Record in app/contenido/controllers/catalogItem.ts's
// TAB_BY_TIPO — the two derivations must agree for the same row (G1.3 gate
// finding from PR2a).
const TAB_BY_TIPO: Record<TIPO_CONTENIDO, TabKey> = {
  [TIPO_CONTENIDO.VIDEO]: 'videos',
  [TIPO_CONTENIDO.AUDIO]: 'mantras',
  [TIPO_CONTENIDO.EGREGOR]: 'egregores',
  [TIPO_CONTENIDO.CMA]: 'cma',
  [TIPO_CONTENIDO.IC]: 'ic',
}

// Kicker above a Card title — mock `.kicker` (mono, uppercase, muted).
const CardKicker = ({ children }: { readonly children: string }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
    {children}
  </span>
)

const DetailRow = ({
  label,
  value,
  emphasis = false,
}: {
  readonly label: string
  readonly value: string
  readonly emphasis?: boolean
}) => (
  <div className="flex items-center justify-between gap-4 text-[13px]">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn(emphasis && 'text-brand-accent-700')}>{value}</span>
  </div>
)

const ContenidoDetailView = ({
  item,
  currentItem,
  isAdmin,
  backHref,
  editHref,
  hasArchivo,
  playerSrc,
  isPlayerLoading,
  playerError,
  onPlaybackError,
  onPlayerRetry,
  deleteTarget,
  replaceTarget,
  affectedCount,
  candidates,
  selectedReplacementId,
  isCounting,
  isDeleting,
  isReplacing,
  deleteError,
  replaceError,
  onAskDelete,
  onConfirmDelete,
  onSelectReplacement,
  onConfirmReplace,
  onCloseDelete,
  onCloseReplace,
}: ContenidoDetailViewModel) => {
  if (item === null) return null

  const tab = TAB_BY_TIPO[item.tipo]
  const meta = contenidoTipoMeta(tab)
  const duracion = formatDuracion(item.contenido.duracion)

  return (
    <div className="flex flex-col gap-6">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft />
            Volver a la biblioteca
          </Link>
        </Button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={editHref}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => currentItem && onAskDelete(currentItem)}
              disabled={isCounting}
            >
              <Trash2 />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Head — single tipo chip */}
      <div className="flex flex-col gap-[10px]">
        <div className="flex flex-wrap gap-2">
          <ContenidoTipoChip tab={tab} />
        </div>

        <h1 className="m-0 font-[family-name:var(--font-display)] text-4xl font-normal leading-[1.05] tracking-[-0.02em]">
          {item.titulo}
        </h1>

        {/* Meta row — media only, duración when present */}
        {duracion !== null && (
          <div className="mt-1 flex flex-wrap items-center gap-[14px] border-b border-border pb-5 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-[5px]">
              <Clock className="h-[13px] w-[13px]" />
              {duracion}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {item.tipo === TIPO_CONTENIDO.CMA ||
          item.tipo === TIPO_CONTENIDO.IC ? (
            <ContenidoGaleriaCarousel imagenes={item.imagenes} />
          ) : hasArchivo ? (
            <MediaPlayer
              kind={
                item.tipo === TIPO_CONTENIDO.VIDEO ||
                item.tipo === TIPO_CONTENIDO.EGREGOR
                  ? 'video'
                  : 'audio'
              }
              src={playerSrc}
              isLoading={isPlayerLoading}
              error={playerError}
              onRetry={onPlayerRetry}
              onPlaybackError={onPlaybackError}
            />
          ) : (
            <ContenidoThumb
              thumbKind={meta.thumbKind}
              duracion={null}
              size="stage"
            />
          )}

          <Card>
            <CardHeader>
              <CardKicker>Descripción</CardKicker>
              <CardTitle className="font-[family-name:var(--font-display)]">
                Sobre esta pieza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="m-0 text-[15px] leading-[1.7] text-foreground">
                {item.descripcion}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardKicker>Ficha</CardKicker>
            <CardTitle className="font-[family-name:var(--font-display)]">
              Detalles
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DetailRow label="Tipo" value={meta.label} emphasis />
            {duracion !== null && (
              <>
                <Separator />
                <DetailRow label="Duración" value={duracion} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <DeleteContenidoDialog
        item={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) onCloseDelete()
        }}
        onConfirm={onConfirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
      <ReplaceContenidoDialog
        item={replaceTarget}
        affectedCount={affectedCount}
        candidates={candidates}
        selectedId={selectedReplacementId}
        onSelect={onSelectReplacement}
        open={replaceTarget !== null}
        onOpenChange={(open) => {
          if (!open) onCloseReplace()
        }}
        onConfirm={onConfirmReplace}
        isReplacing={isReplacing}
        error={replaceError}
      />
    </div>
  )
}

export { ContenidoDetailView }
