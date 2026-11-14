'use client'

import { useEffect, useRef, useState } from 'react'
import Uppy from '@uppy/core'
import Tus from '@uppy/tus'
import { createClient } from '@/lib/supabase/client'
import { validateMediaFile } from '../utils/validateMediaFile'
import { readMediaDuration } from '../utils/readMediaDuration'
import { UPLOAD_CHUNK_SIZE } from '../utils/uploadChunkSize'
import { uppyLocaleEs } from '../utils/uppyLocaleEs'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error'

interface UseUploadContenidoMediaResult {
  readonly uppy: Uppy
  readonly state: UploadState
  readonly recursoRef: string | null
  readonly duracionSeg: number | null
  readonly fileName: string | null
  readonly error: string | null
  readonly reset: () => void
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const sanitizeFilename = (name: string): string => {
  const withoutExt = name.replace(/\.[^.]+$/, '')
  return withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

// Egregores reuse the video pipeline verbatim (design §8.2) — same bucket,
// same TUS hook, own folder.
const FOLDER_BY_TIPO: Record<'videos' | 'mantras' | 'egregores', string> = {
  videos: 'videos',
  mantras: 'audios',
  egregores: 'egregores',
}

const buildObjectName = (
  tipo: 'videos' | 'mantras' | 'egregores',
  originalName: string,
): string => {
  const folder = FOLDER_BY_TIPO[tipo]
  const ext = originalName.includes('.') ? originalName.split('.').pop() : ''
  const uuid = crypto.randomUUID()
  const slug = sanitizeFilename(originalName)
  return `${folder}/${uuid}-${slug}.${ext}`
}

// Uppy's file-picker filter per tab. Kept wide (any video / any audio); the
// precise "is this a playable format" gate is validateMediaFile in
// onBeforeFileAdded. Used both at construction and when the tab changes.
const allowedFileTypesFor = (
  tipo: 'videos' | 'mantras' | 'egregores',
): string[] => (tipo === 'mantras' ? ['audio/*'] : ['video/*'])

// A urlStorage that never persists or finds previous uploads. tus-js-client
// otherwise stores the upload URL in localStorage keyed by a STABLE file
// fingerprint (name+size+type+lastModified) and resumes it on the next upload
// of that file — replaying the OLD objectName while the hook generates a fresh
// one for reconciliation, so a good object is reported as failed (CON-003).
// Worse, a stale entry written before this fix keeps biting until it's evicted.
// A no-op storage makes every upload fresh and ignores any pre-existing entry;
// same-session resume after a transient drop still works via retryDelays.
const noopUrlStorage = {
  findAllUploads: () => Promise.resolve([]),
  findUploadsByFingerprint: () => Promise.resolve([]),
  removeUpload: () => Promise.resolve(),
  addUpload: () => Promise.resolve(''),
}

// Reconcile a finished upload against the server's truth (CON-002).
//
// TUS finalizes the object server-side on the last PATCH, but the 204 of that
// final chunk can be lost between Kong and the browser (the Windows↔WSL2 edge),
// leaving the client blind: Uppy may report failure even though the object is
// fully written. We therefore never trust the client events alone — we list the
// bucket and confirm the object exists with the expected byte size before
// calling the upload a success.
const reconcileStorageObject = async (
  objectName: string,
  expectedSize: number | null,
): Promise<boolean> => {
  const supabase = createClient()
  const slash = objectName.lastIndexOf('/')
  const folder = slash >= 0 ? objectName.slice(0, slash) : ''
  const fileName = slash >= 0 ? objectName.slice(slash + 1) : objectName

  const { data, error } = await supabase.storage
    .from('contenidos')
    .list(folder, { search: fileName, limit: 100 })

  if (error || !data) return false
  const match = data.find((entry) => entry.name === fileName)
  if (!match) return false
  // When we know the expected size, require an exact match so a half-written
  // object never passes. Existence-only is the fallback when size is unknown.
  if (expectedSize === null) return true
  return match.metadata?.size === expectedSize
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

const useUploadContenidoMedia = (
  tipo: 'videos' | 'mantras' | 'egregores',
): UseUploadContenidoMediaResult => {
  const [state, setState] = useState<UploadState>('idle')
  const [recursoRef, setRecursoRef] = useState<string | null>(null)
  const [duracionSeg, setDuracionSeg] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The memoized Uppy instance is created once, so its onBeforeFileAdded/
  // buildObjectName must read the *current* tab from a ref — otherwise the
  // first tab's `tipo` stays frozen and a tab switch validates/uploads against
  // the wrong type (CON-005).
  const tipoRef = useRef(tipo)
  tipoRef.current = tipo

  // Capture the setState helpers in a ref so the memoized Uppy instance
  // always has access to fresh setters without being recreated.
  const settersRef = useRef({
    setState,
    setRecursoRef,
    setDuracionSeg,
    setFileName,
    setError,
  })
  settersRef.current = {
    setState,
    setRecursoRef,
    setDuracionSeg,
    setFileName,
    setError,
  }

  // Memoize the Uppy instance – created once, destroyed in cleanup.
  const uppyRef = useRef<Uppy | null>(null)

  // The object the in-flight upload targets, captured on 'file-added' so the
  // reconciliation in 'complete'/'upload-error' works even when Uppy reports
  // the file as failed (CON-002).
  const pendingRef = useRef<{ objectName: string | null; size: number | null }>(
    { objectName: null, size: null },
  )
  // Idempotency latch: 'complete' and 'upload-error' both route through
  // finalize(); only the first one to fire decides the terminal state.
  const finalizedRef = useRef(false)

  // True while the current attempt was rejected by our own validator. Uppy
  // turns an onBeforeFileAdded rejection into a RestrictionError and emits
  // 'restriction-failed' for it in the same tick (Uppy.js addFile ->
  // #informAndEmit), so without this flag the generic 'upload_failed' would
  // overwrite the specific reason we just set and the user would be told to
  // retry an upload that can never succeed.
  const rejectedByValidatorRef = useRef(false)

  // Generation token (CON-020). finalize() awaits a Storage round-trip; during
  // that await a reset() (tab switch / cancel — CON-019) or a brand-new
  // 'file-added' can start a different attempt over the same stable refs/setters.
  // We bump this on every attempt boundary and capture it on finalize() entry;
  // if it changed after the await, the in-flight finalize belongs to a dead
  // attempt and must not write 'uploaded'/recursoRef over the new state.
  const generationRef = useRef(0)

  // Cache of objectName per file signature. Uppy may invoke onBeforeFileAdded
  // more than once for the same file, so generating a fresh UUID each call
  // would make TUS upload one object while reconciliation searches for another
  // (CON-003). Caching keeps onBeforeFileAdded pure: the same file always maps
  // to the same objectName.
  const objectNameCacheRef = useRef<Map<string, string>>(new Map())

  const buildUppy = (): Uppy => {
    const instance = new Uppy({
      autoProceed: true,
      // Without it the StatusBar falls back to Uppy's English defaults.
      locale: uppyLocaleEs,
      // Allow adding a new file after a completed batch — otherwise Uppy leaves
      // allowNewUpload=false and the next drop is rejected with no network call
      // (CON-019).
      allowMultipleUploadBatches: true,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: allowedFileTypesFor(tipoRef.current),
      },
      onBeforeFileAdded: (currentFile) => {
        const file = currentFile.data as File
        const validation = validateMediaFile(file, tipoRef.current)
        rejectedByValidatorRef.current = !validation.ok
        if (!validation.ok) {
          settersRef.current.setError(validation.error)
          return false
        }
        settersRef.current.setError(null)

        // Attach objectName metadata so TUS and the complete handler can
        // use it without recomputing. Cached by file signature so repeated
        // onBeforeFileAdded calls for the same file yield the same name
        // (onBeforeFileAdded must stay pure — CON-003).
        const cacheKey = `${currentFile.name}:${file.size}`
        const objectName =
          objectNameCacheRef.current.get(cacheKey) ??
          buildObjectName(tipoRef.current, currentFile.name)
        objectNameCacheRef.current.set(cacheKey, objectName)
        // We mutate the file's meta by returning a modified file object.
        // Uppy treats the return value as the accepted file when it's truthy.
        return {
          ...currentFile,
          meta: {
            ...currentFile.meta,
            objectName,
            bucketName: 'contenidos',
            contentType: file.type,
          },
        }
      },
    })

    instance.use(Tus, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      chunkSize: UPLOAD_CHUNK_SIZE,
      allowedMetaFields: [
        'bucketName',
        'objectName',
        'contentType',
        'cacheControl',
      ],
      headers: { 'x-upsert': 'true' },
      // Never resume a stored upload across page loads — see noopUrlStorage
      // above (CON-003). Each upload is fresh, so its objectName matches what
      // reconciliation searches for.
      urlStorage: noopUrlStorage,
      // Retry the chunk whose response never made it back to the client. The
      // final PATCH of a TUS upload finalizes the object server-side, but its
      // 204 can be dropped on the Windows↔WSL2 network edge (status 0); without
      // retries tus gives up and the upload looks failed (CON-002).
      retryDelays: [0, 1000, 3000, 5000],
      onShouldRetry: (err) => {
        const status = (
          err as { originalResponse?: { getStatus?: () => number } }
        )?.originalResponse?.getStatus?.()
        // No status reached the client (lost response / network drop) → retry.
        if (status === undefined || status === 0) return true
        // Otherwise only retry transient server-side failures.
        return status === 429 || status >= 500
      },
      // Resolve the access_token at request time to avoid using a stale token.
      onBeforeRequest: async (req) => {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        req.setHeader('Authorization', `Bearer ${session?.access_token ?? ''}`)
      },
    })

    // Single terminal-state decision for the upload. Both 'complete' and
    // 'upload-error' route here; the idempotency latch guarantees the first to
    // fire wins, so a lost final-chunk response can't be overridden by a later
    // event. The verdict is the server's truth, not Uppy's client events
    // (CON-002): reconcile against Storage and only succeed when the object is
    // really there with the expected size; otherwise fail cleanly so the form
    // never persists a dangling recurso_ref (CON-001).
    const finalize = async (objectName: string | null): Promise<void> => {
      if (finalizedRef.current) return
      finalizedRef.current = true

      // Capture the attempt this finalize belongs to, so a reset/new file that
      // lands during the await below can invalidate this verdict (CON-020).
      const attemptGeneration = generationRef.current

      const {
        setState: setS,
        setRecursoRef: setRR,
        setError: setErr,
      } = settersRef.current

      if (!objectName) {
        setErr('upload_failed')
        setS('error')
        return
      }

      const exists = await reconcileStorageObject(
        objectName,
        pendingRef.current.size,
      )
      // The attempt was reset (tab switch / cancel) or superseded by a new file
      // while we awaited Storage — discard this stale verdict (CON-020).
      if (generationRef.current !== attemptGeneration) return
      if (exists) {
        setRR(objectName)
        setS('uploaded')
        return
      }
      setErr('upload_failed')
      setS('error')
    }

    // ── Event subscriptions ────────────────────────────────
    instance.on('file-added', (file) => {
      const {
        setState: setS,
        setFileName: setFN,
        setDuracionSeg: setDS,
      } = settersRef.current
      // A new file starts a fresh attempt — re-arm the finalize latch, bump the
      // generation so any in-flight finalize from a prior attempt is discarded
      // (CON-020), and capture the target object + expected size for later
      // reconciliation.
      finalizedRef.current = false
      generationRef.current += 1
      pendingRef.current = {
        objectName:
          ((file.meta as Record<string, string>).objectName ?? null) || null,
        size:
          typeof file.size === 'number'
            ? file.size
            : ((file.data as File)?.size ?? null),
      }
      setFN(file.name)
      setS('uploading')
      // Read duration async; failure is non-blocking (R-7).
      readMediaDuration(file.data as File).then((dur) => {
        setDS(dur)
      })
    })

    instance.on('upload', () => {
      settersRef.current.setState('uploading')
    })

    instance.on('complete', async (result) => {
      const first = result.successful?.[0]
      const objectName =
        (first
          ? ((first.meta as Record<string, string>).objectName ?? null)
          : null) ?? pendingRef.current.objectName
      await finalize(objectName)
    })

    instance.on('upload-error', async () => {
      // Defer to finalize() instead of failing outright: the object may have
      // finalized server-side even though the client saw an error (CON-002).
      await finalize(pendingRef.current.objectName)
    })

    instance.on('restriction-failed', () => {
      // Our validator already explained why (bad format, oversized audio) —
      // keep that reason. Only a restriction Uppy itself raised (too many
      // files, wrong type for the tab) falls back to the generic message.
      //
      // The flag is CONSUMED here, not merely read: Uppy can emit this event
      // *before* onBeforeFileAdded runs (#assertNewUploadAllowed does), so a
      // flag left standing from a previous rejection would swallow the next
      // genuine restriction and keep showing a stale reason. Consuming it makes
      // the guarantee structural rather than a side effect of
      // allowMultipleUploadBatches keeping that path unreachable.
      const rejectionWasOurs = rejectedByValidatorRef.current
      rejectedByValidatorRef.current = false
      if (!rejectionWasOurs) {
        settersRef.current.setError('upload_failed')
      }
      settersRef.current.setState('error')
    })

    return instance
  }

  // The tab the current restrictions were set for. An instance is always built
  // with the tab of the render that built it (tipoRef), so this starts in sync.
  const configuredTipoRef = useRef(tipo)

  if (uppyRef.current === null) {
    uppyRef.current = buildUppy()
  }

  // Reconfigure the (memoized) Uppy instance when the tab changes. Without this
  // the allowed file types stay frozen at the first tab, so the Mantra tab keeps
  // accepting video and rejecting audio (CON-005). Also drop the per-file
  // objectName cache so a file re-added under the new tab gets the right folder.
  //
  // Done DURING render, not in an effect (BETA-044): the file input's `accept`
  // is read from `uppy.opts.restrictions` while rendering (useDropzone →
  // getInputProps), and nothing re-renders after an effect, so the picker kept
  // filtering by the previous tab. The ref makes it run once per tab change.
  if (configuredTipoRef.current !== tipo) {
    configuredTipoRef.current = tipo
    uppyRef.current.setOptions({
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: allowedFileTypesFor(tipo),
      },
    })
    objectNameCacheRef.current.clear()
  }

  // Destroy instance on unmount to avoid listener leaks (DevSpec §8.4).
  useEffect(() => {
    return () => {
      uppyRef.current?.destroy()
      // Null the ref so a reused fiber rebuilds a fresh instance instead of
      // returning a destroyed one (CON-019).
      uppyRef.current = null
    }
  }, [])

  const reset = (): void => {
    // Recreate the instance instead of just cancelAll(): the form is reused
    // across App Router soft-navs, and a memoized instance left dirty/terminal
    // after a completed upload rejects the next file with no network call
    // (CON-019). A fresh instance guarantees a pristine uploader per attempt.
    uppyRef.current?.destroy()
    uppyRef.current = buildUppy()
    pendingRef.current = { objectName: null, size: null }
    finalizedRef.current = false
    rejectedByValidatorRef.current = false
    // Invalidate any finalize() still parked on its Storage await so it can't
    // write 'uploaded'/recursoRef over this freshly reset state (CON-020).
    generationRef.current += 1
    objectNameCacheRef.current.clear()
    setFileName(null)
    setRecursoRef(null)
    setDuracionSeg(null)
    setError(null)
    setState('idle')
  }

  return {
    uppy: uppyRef.current,
    state,
    recursoRef,
    duracionSeg,
    fileName,
    error,
    reset,
  }
}

export type { UseUploadContenidoMediaResult }
export { useUploadContenidoMedia }
