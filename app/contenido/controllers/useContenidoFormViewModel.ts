'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type Uppy from '@uppy/core'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import {
  useCreateContenido,
  useUpdateContenido,
  useFetchContenidoById,
  useUploadContenidoMedia,
  useCreateContenidoGaleria,
  useUploadContenidoImagenes,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import type { UploadItem } from '@/app/controllers/Contenido'
import type { TabKey } from './catalogItem'
import type { ContenidoFormErrors } from './utils/validateContenidoForm'
import { validateContenidoForm } from './utils/validateContenidoForm'

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error'

interface ContenidoFormViewModelParams {
  readonly mode: 'create' | 'edit'
  readonly initialTipo: TabKey
  readonly id?: string
}

interface ContenidoFormViewModel {
  readonly mode: 'create' | 'edit'
  readonly tipo: TabKey
  readonly onTipoChange: (next: TabKey) => void
  readonly tipoLocked: boolean
  readonly showUploader: boolean
  readonly titulo: string
  readonly descripcion: string
  readonly onTituloChange: (value: string) => void
  readonly onDescripcionChange: (value: string) => void
  readonly errors: ContenidoFormErrors
  readonly submitError: string | null
  readonly isSubmitting: boolean
  readonly saveDisabled: boolean
  readonly isResolvingRole: boolean
  readonly isAdmin: boolean
  readonly isLoadingInitial: boolean
  readonly notFound: boolean
  readonly loadError: boolean
  readonly onSubmit: () => Promise<void>
  readonly onCancel: () => void
  // Uploader state (video/mantra/egregor — Uppy/TUS path, verbatim)
  readonly uppy: Uppy
  readonly uploadState: UploadState
  readonly uploadFileName: string | null
  readonly uploadError: string | null
  readonly onUploaderReset: () => void
  // Gallery state (cma/ic — Strategy A direct-upload path, design §5/§8.2)
  readonly isGallery: boolean
  readonly galleryItems: ReadonlyArray<UploadItem>
  readonly onGalleryFilesAdded: (files: ReadonlyArray<File>) => void
  readonly onGalleryRetry: (objectName: string) => void
  readonly onGalleryRemove: (objectName: string) => void
}

// Map y no un objeto: el código viene crudo del RPC, e indexar un objeto con un
// valor arbitrario devuelve lo que herede de Object.prototype (`constructor`,
// `toString`, …). Eso no es nullish, así que se cuela por el `??` y se muestra
// como si fuera copy. El operador `in` tenía el mismo agujero por el mismo
// motivo, así que un código desconocido se tomaba por conocido: ahora es `.has`.
// Mismo bug que apareció en identidadMessages, useEditarPacienteViewModel y
// mapMedicionError (activacionPorTelefono, code review).
const ERROR_COPY = new Map<string, string>([
  ['titulo_vacio', 'El nombre es obligatorio.'],
  [
    'no_encontrado',
    'No encontramos el contenido. Puede que haya sido eliminado.',
  ],
  [
    'formato_invalido',
    'El archivo no tiene un formato de video/audio reproducible.',
  ],
  ['audio_tamano_excedido', 'El audio supera el tamaño máximo (100 MB).'],
  ['upload_failed', 'No pudimos subir el archivo. Reintentá.'],
  ['recurso_ref_vacio', 'Falta el archivo.'],
  ['no_autorizado', 'No tenés permisos para guardar este contenido.'],
  ['tipo_invalido', 'El tipo de contenido no es válido.'],
  ['galeria_vacia', 'Subí al menos una imagen.'],
  ['create_galeria_failed', 'No pudimos guardar la galería. Reintentá.'],
])

// Content types that reuse the video/audio Uppy+TUS upload pipeline
// (design §8.2 — egregores reuse it verbatim under their own folder).
const UPLOADER_TIPO_BY_TAB: Record<
  Exclude<TabKey, 'cma' | 'ic'>,
  'videos' | 'mantras' | 'egregores'
> = {
  videos: 'videos',
  mantras: 'mantras',
  egregores: 'egregores',
}

const CONTENIDO_TIPO_BY_TAB: Record<
  Exclude<TabKey, 'cma' | 'ic'>,
  TIPO_CONTENIDO.VIDEO | TIPO_CONTENIDO.AUDIO | TIPO_CONTENIDO.EGREGOR
> = {
  videos: TIPO_CONTENIDO.VIDEO,
  mantras: TIPO_CONTENIDO.AUDIO,
  egregores: TIPO_CONTENIDO.EGREGOR,
}

const FALLBACK_ERROR = 'No pudimos guardar el contenido. Intentá de nuevo.'

const UPLOAD_OK_CREATE_FAILED_ERROR =
  'El archivo se subió pero no pudimos guardar el contenido. Reintentá.'

const mapErrorCode = (code: string | undefined | null): string => {
  if (!code) return FALLBACK_ERROR
  return ERROR_COPY.get(code) ?? FALLBACK_ERROR
}

const mapUploadError = (code: string | null): string | null => {
  if (!code) return null
  return ERROR_COPY.get(code) ?? null
}

const useContenidoFormViewModel = ({
  mode,
  initialTipo,
  id,
}: ContenidoFormViewModelParams): ContenidoFormViewModel => {
  const router = useRouter()

  // Selected content type. In create mode this is mutable via the selector;
  // in edit mode it is locked to the initial value (content cannot move tables).
  const [tipo, setTipo] = useState<TabKey>(initialTipo)
  const tipoLocked = mode === 'edit'
  const isGallery = tipo === 'cma' || tipo === 'ic'

  // Upload hook (video/mantra/egregor path) — called unconditionally (Rules
  // of Hooks). When the selected tipo is a gallery, this hook's output is
  // simply unused; the fallback keeps the argument a valid literal.
  const uploaderTipo: 'videos' | 'mantras' | 'egregores' = isGallery
    ? 'videos'
    : UPLOADER_TIPO_BY_TAB[tipo as Exclude<TabKey, 'cma' | 'ic'>]
  const {
    uppy,
    state: uploadState,
    recursoRef,
    duracionSeg,
    fileName: uploadFileName,
    error: rawUploadError,
    reset: resetUpload,
  } = useUploadContenidoMedia(uploaderTipo)

  const uploadError = mapUploadError(rawUploadError)

  const onUploaderReset = (): void => {
    resetUpload()
  }

  // Gallery upload hook (cma/ic path, Strategy A) — also called
  // unconditionally. Defaults to 'cma' when the selected tipo isn't a
  // gallery; unused in that case since addFiles is never invoked.
  const galleryTipo: 'cma' | 'ic' = tipo === 'ic' ? 'ic' : 'cma'
  const {
    items: galleryItems,
    addFiles: onGalleryFilesAdded,
    retry: onGalleryRetry,
    remove: onGalleryRemove,
    reset: resetGalleryUpload,
    successfulPaths: gallerySuccessfulPaths,
    canSubmit: galleryCanSubmit,
  } = useUploadContenidoImagenes(galleryTipo)

  const createContenidoGaleria = useCreateContenidoGaleria()

  const onTipoChange = (next: TabKey): void => {
    if (tipoLocked) return
    resetUpload()
    resetGalleryUpload()
    setTipo(next)
  }

  // Auth
  const { profile, isLoading: isResolvingRole } = useCurrentUserProfile()
  const isAdmin = profile?.role === ROLE.ADMIN

  // All mutation hooks — called unconditionally (Rules of Hooks)
  const createContenido = useCreateContenido()
  const updateContenido = useUpdateContenido()

  // Keyed off initialTipo (the type can never change in edit mode), never the
  // mutable `tipo` state.
  const contenidoId = mode === 'edit' ? (id ?? null) : null

  const {
    contenido: fetchedContenido,
    isLoading: isLoadingContenido,
    error: contenidoError,
  } = useFetchContenidoById(contenidoId)

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errors, setErrors] = useState<ContenidoFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preloaded, setPreloaded] = useState(false)
  // Synchronous in-flight latch for the submit double-click guard (CON-016).
  const submittingRef = useRef(false)

  // beforeunload guard — prevents accidental tab close / refresh during upload.
  // Registered only while uploadState === 'uploading'; de-registered on cleanup.
  useEffect(() => {
    if (uploadState !== 'uploading') return

    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [uploadState])

  // Preload edit form from fetched data. Keyed off initialTipo (the entity that
  // was actually loaded), which never changes in edit mode.
  useEffect(() => {
    if (mode !== 'edit' || preloaded) return

    if (fetchedContenido) {
      setTitulo(fetchedContenido.titulo ?? '')
      setDescripcion(fetchedContenido.descripcion ?? '')
      setPreloaded(true)
    }
  }, [mode, fetchedContenido, preloaded])

  // Loading / notFound state for edit mode (keyed off the loaded entity).
  const isLoadingInitial = mode === 'edit' ? isLoadingContenido : false

  // notFound is a genuine 404 (the row doesn't exist), NOT a fetch/permission
  // error — those surface as loadError so the page can show a retry state
  // instead of a misleading "No encontrado" (CON-013).
  const notFound =
    mode === 'edit' && !isLoadingInitial
      ? fetchedContenido === null && contenidoError === null
      : false

  const loadError =
    mode === 'edit' && !isLoadingInitial ? contenidoError !== null : false

  const onTituloChange = (value: string): void => {
    setTitulo(value)
    // Clear the field error as the user corrects it (CON-012).
    setErrors((prev) => ({ ...prev, titulo: undefined }))
  }

  const onDescripcionChange = (value: string): void => {
    setDescripcion(value)
  }

  // Returns the create form to its initial blank state. The App Router reuses
  // the same component instance across soft navigations, so the form must be
  // cleared on leave/submit to avoid showing stale values on re-entry.
  const resetForm = (): void => {
    setTitulo('')
    setDescripcion('')
    setErrors({})
    setSubmitError(null)
    setTipo(initialTipo)
    // Also clear the uploader: otherwise a finished upload (uploadState
    // 'uploaded' + recursoRef) survives the soft-nav instance reuse and lets the
    // admin re-submit, creating a duplicate row pointing at the same object
    // (CON-009). Same reasoning applies to the gallery upload hook.
    resetUpload()
    resetGalleryUpload()
  }

  // Guardar is disabled when:
  // - Currently submitting, OR
  // - In CREATE mode: the media isn't ready yet (mandatory at creation) —
  //   for galleries that means every added image finished uploading
  //   (canSubmit), for video/mantra/egregor it means the Uppy upload
  //   completed with a recursoRef.
  // In EDIT mode the file is never re-uploaded (edit changes only name/
  // description per spec — CON-004), so the upload gate must not apply.
  const saveDisabled =
    isSubmitting ||
    (mode === 'create' &&
      (isGallery
        ? !galleryCanSubmit
        : uploadState !== 'uploaded' || !recursoRef))

  // The media uploader is only meaningful when creating. In edit mode the
  // file can't be replaced (CON-004), so the View must not mount it there.
  const showUploader = mode === 'create'

  const onSubmit = async (): Promise<void> => {
    // Synchronous in-flight guard: a fast double-click can fire onSubmit twice
    // before `isSubmitting` re-renders the disabled button, creating a duplicate
    // (CON-016). The ref flips synchronously so the second call bails out.
    if (submittingRef.current) return

    const validationErrors = validateContenidoForm({ titulo })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    submittingRef.current = true
    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    const normalizedDescripcion =
      descripcion.trim() === '' ? null : descripcion.trim()
    const normalizedTitulo = titulo.trim()

    try {
      let result: { ok: boolean; error?: string | null }

      if (mode === 'create' && isGallery) {
        // Strategy A gallery path (design §5/§8.2): every added image must
        // have finished uploading before submit is even reachable
        // (saveDisabled), but onSubmit is still the source of truth — a
        // caller invoking it directly must get the same guard.
        if (!galleryCanSubmit) {
          setSubmitError(mapErrorCode('galeria_vacia'))
          return
        }
        const tipoGaleria =
          tipo === 'ic' ? TIPO_CONTENIDO.IC : TIPO_CONTENIDO.CMA
        result = await createContenidoGaleria.mutate({
          tipo: tipoGaleria,
          titulo: normalizedTitulo,
          descripcion: normalizedDescripcion,
          paths: gallerySuccessfulPaths,
        })

        if (!result.ok) {
          const known = !!result.error && ERROR_COPY.has(result.error)
          setSubmitError(
            known ? mapErrorCode(result.error) : UPLOAD_OK_CREATE_FAILED_ERROR,
          )
          return
        }
        resetGalleryUpload()
      } else if (mode === 'create') {
        // Upload-first: recursoRef is already available from the upload hook.
        // Guard against a dangling reference — if the upload did not yield a
        // recursoRef (failed/incomplete upload that still reported complete),
        // never create a contenido pointing at a non-existent object (CON-001).
        if (!recursoRef) {
          setSubmitError(mapErrorCode('recurso_ref_vacio'))
          return
        }
        // If create fails after a successful upload, we show a specific error
        // that does not reset the title/description so the user can retry
        // the create without re-uploading.
        const tipoContenido =
          CONTENIDO_TIPO_BY_TAB[tipo as Exclude<TabKey, 'cma' | 'ic'>]
        result = await createContenido.mutate({
          tipo: tipoContenido,
          titulo: normalizedTitulo,
          descripcion: normalizedDescripcion,
          recursoRef: recursoRef ?? '',
          duracionSeg,
        })

        if (!result.ok) {
          // A known, non-recoverable backend code (authz/validation) gets its
          // specific copy; retrying won't help, so don't tell the user the
          // file "uploaded but couldn't save". Only a generic/unknown failure
          // means the upload succeeded but the row didn't persist — there the
          // recursoRef is still held so the next submit retries only the
          // create (CON-008).
          const known = !!result.error && ERROR_COPY.has(result.error)
          setSubmitError(
            known ? mapErrorCode(result.error) : UPLOAD_OK_CREATE_FAILED_ERROR,
          )
          return
        }
      } else {
        // edit mode
        result = await updateContenido.mutate({
          id: id!,
          titulo: normalizedTitulo,
          descripcion: normalizedDescripcion,
        })
      }

      if (result.ok) {
        toast.success('Contenido guardado correctamente.')
        if (mode === 'create') resetForm()
        router.push(`/contenido/${tipo}`)
      } else {
        setSubmitError(mapErrorCode(result.error))
      }
    } finally {
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  const onCancel = (): void => {
    if (uploadState === 'uploading') {
      const confirmed = window.confirm(
        'Si salís ahora se cancela la subida en curso. ¿Querés salir igual?',
      )
      if (!confirmed) return
      resetUpload()
    }
    // resetForm() also resets the gallery upload hook (CON-009 reasoning
    // applies identically to galleries — see resetForm above).
    if (mode === 'create') resetForm()
    router.push(`/contenido/${tipo}`)
  }

  return {
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
    isResolvingRole,
    isAdmin,
    isLoadingInitial,
    notFound,
    loadError,
    onSubmit,
    onCancel,
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
  }
}

export type { ContenidoFormViewModelParams, ContenidoFormViewModel }
export { useContenidoFormViewModel }
