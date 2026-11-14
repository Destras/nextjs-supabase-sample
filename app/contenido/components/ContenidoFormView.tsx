'use client'

import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ContenidoFormViewModel } from '@/app/contenido/controllers'
import type { TabKey } from '@/app/contenido/controllers'
import { MediaUploader } from './MediaUploader'
import { ImageDropzone } from './ImageDropzone'

const TIPO_OPTIONS: ReadonlyArray<{ value: TabKey; label: string }> = [
  { value: 'videos', label: 'Meditación' },
  { value: 'mantras', label: 'Mantra' },
  { value: 'egregores', label: 'Egregor' },
  { value: 'cma', label: 'CMA' },
  { value: 'ic', label: 'IC' },
]

type ContenidoFormViewProps = Omit<
  ContenidoFormViewModel,
  'isResolvingRole' | 'isAdmin' | 'isLoadingInitial' | 'notFound' | 'mode'
> & {
  readonly showUploader: boolean
  readonly mode: 'create' | 'edit'
}

const ContenidoFormView = ({
  mode,
  tipo,
  onTipoChange,
  tipoLocked,
  showUploader,
  titulo,
  descripcion,
  onTituloChange,
  onDescripcionChange,
  errors,
  submitError,
  isSubmitting,
  saveDisabled,
  uppy,
  uploadState,
  uploadFileName,
  uploadError,
  onUploaderReset,
  isGallery,
  galleryItems,
  onGalleryFilesAdded,
  onGalleryRetry,
  onGalleryRemove,
  onSubmit,
  onCancel,
}: ContenidoFormViewProps): JSX.Element => {
  const heading = mode === 'create' ? 'Nuevo contenido' : 'Editar contenido'

  return (
    <div className="py-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">{heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Tipo de contenido */}
            <div className="space-y-2">
              <Label>Tipo de contenido</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={tipo}
                onValueChange={(value) => {
                  if (value) onTipoChange(value as TabKey)
                }}
                disabled={tipoLocked}
                className="w-full"
              >
                {TIPO_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {tipoLocked && (
                <p className="text-xs text-muted-foreground">
                  El tipo no se puede cambiar al editar.
                </p>
              )}
            </div>

            {/* Nombre (titulo) */}
            <div className="space-y-2">
              <Label htmlFor="titulo">Nombre</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => onTituloChange(e.target.value)}
                placeholder="Ingresá el nombre del contenido"
                aria-invalid={!!errors.titulo}
                aria-describedby={errors.titulo ? 'titulo-error' : undefined}
              />
              {errors.titulo && (
                <p id="titulo-error" className="text-sm text-destructive">
                  {errors.titulo}
                </p>
              )}
            </div>

            {/* Descripción (optional) */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => onDescripcionChange(e.target.value)}
                placeholder="Descripción opcional del contenido"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Opcional.</p>
            </div>

            {/* Media input — only when creating. In edit mode the file can't
                be replaced (CON-004). Galleries (cma/ic) use the direct-upload
                ImageDropzone (Strategy A, design §5/§8.3); video/mantra/
                egregor keep the Uppy/TUS MediaUploader verbatim. */}
            {showUploader &&
              (isGallery ? (
                <ImageDropzone
                  items={galleryItems}
                  onFilesAdded={onGalleryFilesAdded}
                  onRetry={onGalleryRetry}
                  onRemove={onGalleryRemove}
                />
              ) : (
                <MediaUploader
                  uppy={uppy}
                  state={uploadState}
                  fileName={uploadFileName}
                  error={uploadError}
                  onReset={onUploaderReset}
                />
              ))}

            {/* Submit error (global) */}
            {submitError && (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={onSubmit} disabled={saveDisabled}>
                {isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { ContenidoFormView }
export type { ContenidoFormViewProps }
