'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { FileX, ImagePlus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { describirErrorImagen } from '@/app/controllers/Contenido'
import type { UploadItem } from '@/app/controllers/Contenido'

interface ImageDropzoneProps {
  readonly items: ReadonlyArray<UploadItem>
  readonly onFilesAdded: (files: ReadonlyArray<File>) => void
  readonly onRetry: (objectName: string) => void
  readonly onRemove: (objectName: string) => void
}

// Coarse status → progress mapping. The upload hook (design §5) tracks a
// four-state machine (pending/uploading/done/error), not byte-level
// progress — supabase-js's storage.upload() promise resolves atomically
// with no progress events, so a real percentage bar would need a lower-level
// XHR call the hook deliberately doesn't use. Documented simplification, not
// a missing feature.
const PROGRESS_BY_STATUS: Record<UploadItem['status'], number> = {
  pending: 0,
  uploading: 50,
  done: 100,
  error: 0,
}

const STATUS_LABEL: ReadonlyMap<UploadItem['status'], string> = new Map<
  UploadItem['status'],
  string
>([
  ['pending', 'En cola…'],
  ['uploading', 'Subiendo…'],
  ['done', 'Lista'],
])

// Mirrors validateImageFile (and the bucket's own limits): the admin reads
// the rules before picking files instead of discovering them by rejection.
const LIMITES_LEYENDA = 'JPG, PNG, WebP o AVIF · hasta 5 MB cada una'

/**
 * Multi-file drag-and-drop uploader for gallery tipos (cma/ic). Purely
 * presentational — all state (items, progress, errors) comes from
 * useUploadContenidoImagenes via the form ViewModel (design §8.3). Display
 * order = upload order; no drag-to-reorder in this slice (closed decision).
 */
const ImageDropzone = ({
  items,
  onFilesAdded,
  onRetry,
  onRemove,
}: ImageDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // One object URL per item for its lifetime — revoked on removal and on
  // unmount so a 20-image gallery never leaks blob handles.
  const objectUrlsRef = useRef<Map<string, string>>(new Map())
  const [urlVersion, setUrlVersion] = useState(0)

  useEffect(() => {
    const current = objectUrlsRef.current
    const liveNames = new Set(items.map((item) => item.objectName))
    let changed = false

    for (const item of items) {
      if (!current.has(item.objectName)) {
        current.set(item.objectName, URL.createObjectURL(item.file))
        changed = true
      }
    }
    for (const [name, url] of current) {
      if (!liveNames.has(name)) {
        URL.revokeObjectURL(url)
        current.delete(name)
        changed = true
      }
    }
    if (changed) setUrlVersion((v) => v + 1)
  }, [items])

  useEffect(() => {
    const current = objectUrlsRef.current
    return () => {
      for (const url of current.values()) {
        URL.revokeObjectURL(url)
      }
      current.clear()
    }
  }, [])

  const handleFiles = (fileList: FileList | null): void => {
    if (!fileList || fileList.length === 0) return
    onFilesAdded(Array.from(fileList))
  }

  return (
    <div className="space-y-2">
      <Label>Imágenes</Label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-[color:var(--brand-primary-500)]',
          isDragOver && 'border-[color:var(--brand-primary-500)] bg-accent/30',
        )}
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastrá imágenes acá o hacé clic para elegir archivos
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{LIMITES_LEYENDA}</p>

      {items.length > 0 && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          data-url-version={urlVersion}
        >
          {items.map((item) => {
            // An item in 'error' always carries its reason; a rejected file
            // gets the reason it was rejected for, never a generic label.
            const fallo =
              item.status === 'error'
                ? describirErrorImagen(item.error ?? 'upload_failed')
                : null

            return (
              <div
                key={item.objectName}
                className="flex items-center gap-3 overflow-hidden rounded-[var(--radius)] border border-border bg-card p-3"
              >
                {item.error === 'formato_invalido' ? (
                  // Not an image the browser can decode: an icon instead of a
                  // broken thumbnail.
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-muted"
                  >
                    <FileX className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  <Image
                    src={objectUrlsRef.current.get(item.objectName) ?? ''}
                    alt={item.file.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded-[calc(var(--radius)-4px)] object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.file.name}
                  </p>
                  <Progress value={PROGRESS_BY_STATUS[item.status]} />
                  <p
                    className={cn(
                      'text-xs',
                      fallo ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {fallo ? fallo.mensaje : STATUS_LABEL.get(item.status)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {fallo?.reintentable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRetry(item.objectName)}
                      aria-label="Reintentar"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.objectName)}
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { ImageDropzone }
export type { ImageDropzoneProps }
