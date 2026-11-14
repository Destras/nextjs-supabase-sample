'use client'

// Escape hatch (DEC-09): Uppy's CSS is imported here directly instead of using
// Aurora-tokenized markup. The StatusBar visual component is provided by Uppy
// and is intentionally not Aurora-styled at this stage.
import '@uppy/core/css/style.min.css'
import '@uppy/status-bar/css/style.min.css'

import type { JSX } from 'react'
import type Uppy from '@uppy/core'
import { UppyContextProvider, useDropzone } from '@uppy/react'
import StatusBar from '@uppy/react/status-bar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface MediaUploaderProps {
  readonly uppy: Uppy
  readonly state: 'idle' | 'uploading' | 'uploaded' | 'error'
  readonly fileName: string | null
  readonly error: string | null
  readonly onReset: () => void
}

// Own drop zone built on Uppy's headless `useDropzone` hook. The stock
// `<Dropzone>` hardcodes its English copy ("Drop files here or click to add
// them") outside Uppy's i18n, so the only way to translate it is to render the
// markup ourselves. Must live under <UppyContextProvider>. The hook wires
// drag & drop, click and Enter/Space to the hidden file input and hands the
// files to Uppy — no validation happens here (ADR 0003 / 0004).
const MediaDropzone = (): JSX.Element => {
  const { getRootProps, getInputProps } = useDropzone()

  return (
    <div>
      <input
        {...getInputProps()}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-6 text-center transition-colors duration-200 outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <p className="text-muted-foreground">
          Arrastrá el archivo acá o hacé clic para elegirlo
        </p>
      </div>
    </div>
  )
}

const MediaUploader = ({
  uppy,
  state,
  fileName,
  error,
  onReset,
}: MediaUploaderProps): JSX.Element => {
  return (
    <div className="space-y-2">
      <Label>Archivo</Label>

      {/* UppyContextProvider wires the uppy instance to our MediaDropzone.
          StatusBar is the classic @uppy/react class component that renders
          upload progress, cancel, and retry buttons automatically. */}
      <UppyContextProvider uppy={uppy}>
        <MediaDropzone />
      </UppyContextProvider>
      <StatusBar uppy={uppy} hideUploadButton />

      {/* Uploaded state: show filename + reset action */}
      {state === 'uploaded' && fileName && (
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {fileName}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Cambiar archivo
          </Button>
        </div>
      )}

      {/* Inline error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export { MediaUploader }
export type { MediaUploaderProps }
