'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateImageFile } from '../utils/validateImageFile'
import type { ErrorImagen } from '../ContenidoTypes'

// Bounded worker pool width. 20 images at up to 5 MiB each is too slow
// sequential and saturates the uplink / draws 429s unbounded (design §5).
const CONCURRENCY = 3

type UploadItemStatus = 'pending' | 'uploading' | 'done' | 'error'

interface UploadItem {
  readonly file: File
  readonly objectName: string
  readonly status: UploadItemStatus
  readonly error: ErrorImagen | null
}

interface UseUploadContenidoImagenesResult {
  readonly items: ReadonlyArray<UploadItem>
  readonly addFiles: (files: ReadonlyArray<File>) => void
  readonly retry: (objectName: string) => void
  readonly remove: (objectName: string) => void
  readonly reset: () => void
  readonly successfulPaths: ReadonlyArray<string>
  readonly canSubmit: boolean
}

// Flat paths, one folder segment deep — a leading slash would produce an
// empty first storage.foldername() segment and silently fail every RLS
// policy on this bucket (design §4.2).
const buildObjectName = (tipo: 'cma' | 'ic', originalName: string): string => {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : ''
  const uuid = crypto.randomUUID()
  return `${tipo}/${uuid}.${ext}`
}

const useUploadContenidoImagenes = (
  tipo: 'cma' | 'ic',
): UseUploadContenidoImagenesResult => {
  const [items, setItems] = useState<ReadonlyArray<UploadItem>>([])

  // The File objects live here, keyed by objectName, so the pool can grab
  // them synchronously without racing React's setState/render cycle.
  const filesRef = useRef<Map<string, File>>(new Map())
  const queueRef = useRef<string[]>([])
  const activeCountRef = useRef(0)

  const updateItem = useCallback(
    (objectName: string, patch: Partial<UploadItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.objectName === objectName ? { ...item, ...patch } : item,
        ),
      )
    },
    [],
  )

  const pump = useCallback(() => {
    while (
      activeCountRef.current < CONCURRENCY &&
      queueRef.current.length > 0
    ) {
      const objectName = queueRef.current.shift() as string
      const file = filesRef.current.get(objectName)
      if (!file) continue

      activeCountRef.current += 1
      updateItem(objectName, { status: 'uploading', error: null })

      const supabase = createClient()
      supabase.storage
        .from('contenidos-imagenes')
        .upload(objectName, file, { contentType: file.type, upsert: false })
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            updateItem(objectName, { status: 'error', error: 'upload_failed' })
            return
          }
          updateItem(objectName, { status: 'done', error: null })
        })
        .finally(() => {
          activeCountRef.current -= 1
          pump()
        })
    }
  }, [updateItem])

  const addFiles = useCallback(
    (files: ReadonlyArray<File>) => {
      const newItems: UploadItem[] = []
      for (const file of files) {
        const objectName = buildObjectName(tipo, file.name)
        filesRef.current.set(objectName, file)

        const validation = validateImageFile(file)
        if (!validation.ok) {
          newItems.push({
            file,
            objectName,
            status: 'error',
            error: validation.error,
          })
          continue
        }

        newItems.push({ file, objectName, status: 'pending', error: null })
        queueRef.current.push(objectName)
      }
      setItems((prev) => [...prev, ...newItems])
      pump()
    },
    [tipo, pump],
  )

  const retry = useCallback(
    (objectName: string) => {
      if (!filesRef.current.has(objectName)) return
      // A file rejected by validateImageFile is the same file on a second
      // attempt: re-queueing it would only earn a Storage 413/415 and erase
      // the reason the admin needs to read.
      const item = items.find((i) => i.objectName === objectName)
      if (item?.error !== 'upload_failed') return
      updateItem(objectName, { status: 'pending', error: null })
      queueRef.current.push(objectName)
      pump()
    },
    [items, pump, updateItem],
  )

  const remove = useCallback((objectName: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.objectName === objectName)
      // Best-effort purge: an already-uploaded object left behind by a
      // pre-submit removal would otherwise orphan in Storage (design §5).
      if (item?.status === 'done') {
        const supabase = createClient()
        supabase.storage
          .from('contenidos-imagenes')
          .remove([objectName])
          .catch(() => {})
      }
      return prev.filter((i) => i.objectName !== objectName)
    })
    filesRef.current.delete(objectName)
    queueRef.current = queueRef.current.filter((name) => name !== objectName)
  }, [])

  const reset = useCallback(() => {
    setItems([])
    filesRef.current.clear()
    queueRef.current = []
    activeCountRef.current = 0
  }, [])

  const successfulPaths = items
    .filter((item) => item.status === 'done')
    .map((item) => item.objectName)

  const canSubmit =
    items.length > 0 && items.every((item) => item.status === 'done')

  return {
    items,
    addFiles,
    retry,
    remove,
    reset,
    successfulPaths,
    canSubmit,
  }
}

export type { UseUploadContenidoImagenesResult, UploadItem, UploadItemStatus }
export { useUploadContenidoImagenes }
