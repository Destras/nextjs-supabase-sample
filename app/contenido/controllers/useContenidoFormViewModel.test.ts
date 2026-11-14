import { renderHook, act, waitFor } from '@testing-library/react'
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
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useContenidoFormViewModel } from './useContenidoFormViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

jest.mock('@/app/controllers/Contenido', () => ({
  useCreateContenido: jest.fn(),
  useUpdateContenido: jest.fn(),
  useFetchContenidoById: jest.fn(),
  useUploadContenidoMedia: jest.fn(),
  useCreateContenidoGaleria: jest.fn(),
  useUploadContenidoImagenes: jest.fn(),
  TIPO_CONTENIDO: {
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    EGREGOR: 'EGREGOR',
    CMA: 'CMA',
    IC: 'IC',
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const mockPush = jest.fn()
const mockCreateContenidoMutate = jest.fn()
const mockUpdateContenidoMutate = jest.fn()
const mockUploadReset = jest.fn()
const mockUppy = { on: jest.fn(), use: jest.fn(), cancelAll: jest.fn() }
const mockCreateContenidoGaleriaMutate = jest.fn()
const mockGalleryAddFiles = jest.fn()
const mockGalleryRetry = jest.fn()
const mockGalleryRemove = jest.fn()
const mockGalleryReset = jest.fn()

describe('useContenidoFormViewModel', () => {
  beforeEach(() => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-1',
        name: 'Admin',
        role: ROLE.ADMIN,
        timezone: 'UTC',
        email: 'a@test.com',
      },
      isLoading: false,
      error: null,
    })
    ;(useCreateContenido as jest.Mock).mockReturnValue({
      mutate: mockCreateContenidoMutate,
      isLoading: false,
      error: null,
    })
    ;(useUpdateContenido as jest.Mock).mockReturnValue({
      mutate: mockUpdateContenidoMutate,
      isLoading: false,
      error: null,
    })
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: null,
    })
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: 'videos/uuid-mi-video.mp4',
      duracionSeg: 42,
      fileName: 'mi-video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    ;(useCreateContenidoGaleria as jest.Mock).mockReturnValue({
      mutate: mockCreateContenidoGaleriaMutate,
      isLoading: false,
      error: null,
    })
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: [],
      canSubmit: false,
    })
    mockCreateContenidoMutate.mockResolvedValue({ ok: true })
    mockUpdateContenidoMutate.mockResolvedValue({ ok: true })
    mockCreateContenidoGaleriaMutate.mockResolvedValue({ ok: true })
  })

  // --- validation gating ---

  it('sets errors.titulo when onSubmit is called with empty titulo', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.errors).toEqual({
      titulo: 'El nombre es obligatorio.',
    })
  })

  it('does not call mutate when titulo is empty on submit', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).not.toHaveBeenCalled()
  })

  // --- CON-012: inline field errors cleared on change ---

  it('clears errors.titulo when onTituloChange is called after a failed submit', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => result.current.onTituloChange('Mi video'))
    expect(result.current.errors).toEqual({})
  })

  // --- CON-016: no double submit ---

  it('does not call createContenido twice when onSubmit fires twice before the first resolves (CON-016)', async () => {
    mockCreateContenidoMutate.mockImplementation(
      () => new Promise(() => {}), // never resolves → keeps the first submit in flight
    )
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      result.current.onSubmit()
      result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).toHaveBeenCalledTimes(1)
  })

  // --- create routing by tipo ---

  it('calls useCreateContenido mutate with VIDEO tipo when tipo is videos in create mode', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).toHaveBeenCalledWith({
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Mi video',
      descripcion: null,
      recursoRef: 'videos/uuid-mi-video.mp4',
      duracionSeg: 42,
    })
  })

  it('calls useCreateContenido mutate with AUDIO tipo when tipo is mantras in create mode', async () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: 'audios/uuid-mi-mantra.mp3',
      duracionSeg: 30,
      fileName: 'mi-mantra.mp3',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'mantras' }),
    )
    act(() => result.current.onTituloChange('Mi mantra'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).toHaveBeenCalledWith({
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Mi mantra',
      descripcion: null,
      recursoRef: 'audios/uuid-mi-mantra.mp3',
      duracionSeg: 30,
    })
  })

  // --- edit routing by tipo ---

  it('calls useUpdateContenido mutate when tipo is videos in edit mode', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    act(() => result.current.onTituloChange('Video editado'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockUpdateContenidoMutate).toHaveBeenCalledWith({
      id: 'c-1',
      titulo: 'Video editado',
      descripcion: null,
    })
  })

  // --- success: redirect + toast ---

  it('calls router.push with /contenido/videos after successful create for videos', async () => {
    mockCreateContenidoMutate.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockPush).toHaveBeenCalledWith('/contenido/videos')
  })

  it('calls toast.success after successful create', async () => {
    mockCreateContenidoMutate.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(toast.success).toHaveBeenCalledWith(
      'Contenido guardado correctamente.',
    )
  })

  // --- failure: preserves fields, no navigate ---

  it('does not call router.push when create mutate returns ok:false', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sets submitError to upload-ok-but-create-fails message when video create mutate returns ok:false', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'El archivo se subió pero no pudimos guardar el contenido. Reintentá.',
    )
  })

  it('treats an error code named like an Object.prototype member as unknown, not as known copy', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'constructor',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'El archivo se subió pero no pudimos guardar el contenido. Reintentá.',
    )
  })

  it('preserves titulo field value after a failed submit', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.titulo).toBe('Mi video')
  })

  // --- error code → copy mapping ---

  it('maps no_encontrado error code to the not-found copy', async () => {
    mockUpdateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'no_encontrado',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    act(() => result.current.onTituloChange('Video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'No encontramos el contenido. Puede que haya sido eliminado.',
    )
  })

  // --- CON-008: backend error codes mapped to actionable copy ---

  it('maps no_autorizado to the no-permission copy for a video create (not the upload-ok message)', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'no_autorizado',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'No tenés permisos para guardar este contenido.',
    )
  })

  it('still shows the upload-ok-but-create-fails copy for a generic create_failed on video', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'El archivo se subió pero no pudimos guardar el contenido. Reintentá.',
    )
  })

  // --- edit mode preload ---

  it('populates titulo and descripcion from useFetchContenidoById when editing a video', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'Video cargado',
        descripcion: 'Desc cargada',
        contenido: { recursoRef: null, duracion: null },
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    await waitFor(() => {
      expect(result.current.titulo).toBe('Video cargado')
    })
    expect(result.current.descripcion).toBe('Desc cargada')
  })

  // --- notFound ---

  it('sets notFound true when edit mode and fetch returns null and isLoading is false', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-99',
      }),
    )
    await waitFor(() => {
      expect(result.current.notFound).toBe(true)
    })
  })

  it('sets notFound false when the fetch errored (CON-013)', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: 'boom',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    await waitFor(() => {
      expect(result.current.notFound).toBe(false)
    })
  })

  it('exposes loadError true when the fetch errored (CON-013)', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: 'boom',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    await waitFor(() => {
      expect(result.current.loadError).toBe(true)
    })
  })

  it('sets notFound false when edit mode and isLoading is true', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-99',
      }),
    )
    expect(result.current.notFound).toBe(false)
  })

  // --- isLoadingInitial ---

  it('sets isLoadingInitial true when the read hook is loading in edit mode', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    expect(result.current.isLoadingInitial).toBe(true)
  })

  it('sets isLoadingInitial false when the read hook is not loading in edit mode', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    expect(result.current.isLoadingInitial).toBe(false)
  })

  // --- onCancel ---

  it('calls router.push with /contenido/videos when onCancel is called for tipo=videos', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(mockPush).toHaveBeenCalledWith('/contenido/videos')
  })

  // --- form reset on leave (create only, soft-nav guard) ---

  it('resets all form fields when onCancel is called in create mode', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('algo'))
    act(() => result.current.onDescripcionChange('desc'))
    act(() => result.current.onTipoChange('mantras'))
    act(() => result.current.onCancel())
    expect(result.current.titulo).toBe('')
    expect(result.current.descripcion).toBe('')
    expect(result.current.tipo).toBe('videos')
  })

  it('resets the upload hook after a successful create so the next create starts clean (CON-009)', async () => {
    mockCreateContenidoMutate.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockUploadReset).toHaveBeenCalled()
  })

  it('resets the upload hook when onCancel is called in create mode (CON-009)', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(mockUploadReset).toHaveBeenCalled()
  })

  it('resets all form fields after a successful create submit', async () => {
    mockCreateContenidoMutate.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    act(() => result.current.onDescripcionChange('Una desc'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.titulo).toBe('')
    expect(result.current.descripcion).toBe('')
  })

  it('does not reset titulo when onCancel is called in edit mode', async () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'Video cargado',
        descripcion: 'Desc cargada',
        contenido: { recursoRef: null, duracion: null },
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    await waitFor(() => {
      expect(result.current.titulo).toBe('Video cargado')
    })
    act(() => result.current.onCancel())
    expect(result.current.titulo).toBe('Video cargado')
  })

  // --- state fields ---

  it('updates titulo field when onTituloChange is called', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Nuevo titulo'))
    expect(result.current.titulo).toBe('Nuevo titulo')
  })

  it('updates descripcion field when onDescripcionChange is called', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onDescripcionChange('Nueva descripcion'))
    expect(result.current.descripcion).toBe('Nueva descripcion')
  })

  // --- tipo selector (create) ---

  it('routes submit to useCreateContenido with the newly selected tipo after onTipoChange', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTipoChange('mantras'))
    act(() => result.current.onTituloChange('Mi mantra'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: TIPO_CONTENIDO.AUDIO }),
    )
  })

  it('navigates using the selected tipo after a create switch', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTipoChange('mantras'))
    act(() => result.current.onTituloChange('Mi mantra'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockPush).toHaveBeenCalledWith('/contenido/mantras')
  })

  // --- tipo lock (edit) ---

  it('exposes tipoLocked true in edit mode', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    expect(result.current.tipoLocked).toBe(true)
  })

  it('exposes tipoLocked false in create mode', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.tipoLocked).toBe(false)
  })

  it('does not change tipo when onTipoChange is called in edit mode (locked)', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    act(() => result.current.onTipoChange('mantras'))
    expect(result.current.tipo).toBe('videos')
  })

  it('exposes the current tipo state', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'mantras' }),
    )
    expect(result.current.tipo).toBe('mantras')
    act(() => result.current.onTipoChange('videos'))
    expect(result.current.tipo).toBe('videos')
  })

  // --- saveDisabled ---

  it('exposes saveDisabled true for videos when uploadState is not uploaded', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'idle',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.saveDisabled).toBe(true)
  })

  it('exposes saveDisabled true for mantras when uploadState is uploading', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'mi-mantra.mp3',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'mantras' }),
    )
    expect(result.current.saveDisabled).toBe(true)
  })

  it('exposes saveDisabled false for videos when uploadState is uploaded and not submitting', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.saveDisabled).toBe(false)
  })

  it('exposes saveDisabled true for videos when uploadState is uploaded but recursoRef is null', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'mi-video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.saveDisabled).toBe(true)
  })

  it('exposes saveDisabled false in edit mode for videos even when uploadState is idle (CON-004)', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'idle',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    expect(result.current.saveDisabled).toBe(false)
  })

  it('exposes saveDisabled false in edit mode for mantras even when uploadState is idle (CON-004)', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'idle',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'mantras',
        id: 'c-1',
      }),
    )
    expect(result.current.saveDisabled).toBe(false)
  })

  // --- showUploader (CON-004) ---

  it('exposes showUploader true in create mode for videos', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.showUploader).toBe(true)
  })

  it('exposes showUploader false in edit mode for videos', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    expect(result.current.showUploader).toBe(false)
  })

  // --- onTipoChange resets upload hook ---

  it('calls upload reset when onTipoChange is called in create mode', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTipoChange('mantras'))
    expect(mockUploadReset).toHaveBeenCalled()
  })

  it('does not call upload reset when onTipoChange is called in edit mode (locked)', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'videos',
        id: 'c-1',
      }),
    )
    act(() => result.current.onTipoChange('mantras'))
    expect(mockUploadReset).not.toHaveBeenCalled()
  })

  // --- uploader state exposed to View ---

  it('exposes uploadState from the upload hook', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadState).toBe('uploading')
  })

  it('exposes uploadFileName from the upload hook', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadFileName).toBe('mi-video.mp4')
  })

  it('exposes onUploaderReset that calls upload hook reset', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onUploaderReset())
    expect(mockUploadReset).toHaveBeenCalled()
  })

  // --- uploadError copy mapping ---

  it('maps formato_invalido upload error to Spanish copy', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'error',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: 'formato_invalido',
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadError).toBe(
      'El archivo no tiene un formato de video/audio reproducible.',
    )
  })

  it('maps audio_tamano_excedido upload error to Spanish copy', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'error',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: 'audio_tamano_excedido',
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      // Only audio still carries a size cap — video/egregores have none.
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'mantras' }),
    )
    expect(result.current.uploadError).toBe(
      'El audio supera el tamaño máximo (100 MB).',
    )
  })

  it('maps upload_failed upload error to Spanish copy', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'error',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: 'upload_failed',
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadError).toBe(
      'No pudimos subir el archivo. Reintentá.',
    )
  })

  it('maps recurso_ref_vacio upload error to Spanish copy', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'error',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: 'recurso_ref_vacio',
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadError).toBe('Falta el archivo.')
  })

  it('exposes uploadError null when upload hook error is null', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.uploadError).toBeNull()
  })

  // --- upload-ok but create-fails ---

  it('shows upload-ok-but-create-fails error message when create mutate fails after upload', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'El archivo se subió pero no pudimos guardar el contenido. Reintentá.',
    )
  })

  it('preserves titulo after upload-ok but create-fails', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video subido'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.titulo).toBe('Mi video subido')
  })

  it('does not navigate after upload-ok but create-fails', async () => {
    mockCreateContenidoMutate.mockResolvedValue({
      ok: false,
      error: 'create_failed',
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  // --- guard: no create with dangling recursoRef (CON-001) ---

  it('does not call createContenido when recursoRef is null for a video submit', async () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'mi-video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).not.toHaveBeenCalled()
  })

  it('sets submitError to "Falta el archivo." when recursoRef is null for a video submit', async () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'mi-video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTituloChange('Mi video'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe('Falta el archivo.')
  })

  // --- navigation guard (beforeunload + onCancel confirm) ---

  it('registers a beforeunload listener on window when uploadState is uploading', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const addSpy = jest.spyOn(window, 'addEventListener')
    renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    addSpy.mockRestore()
  })

  it('does not register a beforeunload listener when uploadState is not uploading', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: 'videos/uuid.mp4',
      duracionSeg: 42,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const addSpy = jest.spyOn(window, 'addEventListener')
    renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(addSpy).not.toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    )
    addSpy.mockRestore()
  })

  it('removes the beforeunload listener when uploadState transitions away from uploading', () => {
    const mockUploadMediaModule = useUploadContenidoMedia as jest.Mock
    mockUploadMediaModule.mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const removeSpy = jest.spyOn(window, 'removeEventListener')
    const { rerender } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    mockUploadMediaModule.mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: 'videos/uuid.mp4',
      duracionSeg: 42,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    act(() => rerender())
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('calls window.confirm when onCancel is called while uploadState is uploading', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(confirmSpy).toHaveBeenCalledWith(
      'Si salís ahora se cancela la subida en curso. ¿Querés salir igual?',
    )
    confirmSpy.mockRestore()
  })

  it('calls reset and then router.push when user confirms onCancel during upload', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(mockUploadReset).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('navigates via router.push when user confirms onCancel during upload', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(mockPush).toHaveBeenCalledWith('/contenido/videos')
    confirmSpy.mockRestore()
  })

  it('does not call router.push when user dismisses the onCancel confirm during upload', () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploading',
      recursoRef: null,
      duracionSeg: null,
      fileName: 'video.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(mockPush).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('navigates directly without window.confirm when onCancel is called and uploadState is not uploading', () => {
    const confirmSpy = jest.spyOn(window, 'confirm')
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onCancel())
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  // --- egregores: reuse the Uppy path verbatim, own folder ---

  it('calls useCreateContenido mutate with EGREGOR tipo when tipo is egregores in create mode', async () => {
    ;(useUploadContenidoMedia as jest.Mock).mockReturnValue({
      uppy: mockUppy,
      state: 'uploaded',
      recursoRef: 'egregores/uuid-mi-egregor.mp4',
      duracionSeg: 20,
      fileName: 'mi-egregor.mp4',
      error: null,
      reset: mockUploadReset,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'egregores' }),
    )
    act(() => result.current.onTituloChange('Mi egregor'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).toHaveBeenCalledWith({
      tipo: TIPO_CONTENIDO.EGREGOR,
      titulo: 'Mi egregor',
      descripcion: null,
      recursoRef: 'egregores/uuid-mi-egregor.mp4',
      duracionSeg: 20,
    })
  })

  it('passes egregores to useUploadContenidoMedia for the egregores tab', () => {
    renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'egregores' }),
    )
    expect(useUploadContenidoMedia).toHaveBeenCalledWith('egregores')
  })

  // --- isGallery flag ---

  it('exposes isGallery false for videos', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    expect(result.current.isGallery).toBe(false)
  })

  it('exposes isGallery false for egregores', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'egregores' }),
    )
    expect(result.current.isGallery).toBe(false)
  })

  it('exposes isGallery true for cma', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    expect(result.current.isGallery).toBe(true)
  })

  it('exposes isGallery true for ic', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'ic' }),
    )
    expect(result.current.isGallery).toBe(true)
  })

  // --- gallery create routing (cma/ic) ---

  it('passes ic to useUploadContenidoImagenes when tipo is ic', () => {
    renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'ic' }),
    )
    expect(useUploadContenidoImagenes).toHaveBeenCalledWith('ic')
  })

  it('passes cma to useUploadContenidoImagenes when tipo is cma', () => {
    renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    expect(useUploadContenidoImagenes).toHaveBeenCalledWith('cma')
  })

  it('calls useCreateContenidoGaleria mutate with CMA tipo and successfulPaths when tipo is cma in create mode', async () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg', 'cma/b.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoGaleriaMutate).toHaveBeenCalledWith({
      tipo: TIPO_CONTENIDO.CMA,
      titulo: 'Mi galeria',
      descripcion: null,
      paths: ['cma/a.jpg', 'cma/b.jpg'],
    })
  })

  it('calls useCreateContenidoGaleria mutate with IC tipo when tipo is ic in create mode', async () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['ic/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'ic' }),
    )
    act(() => result.current.onTituloChange('Mi galeria IC'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoGaleriaMutate).toHaveBeenCalledWith({
      tipo: TIPO_CONTENIDO.IC,
      titulo: 'Mi galeria IC',
      descripcion: null,
      paths: ['ic/a.jpg'],
    })
  })

  it('does not call useCreateContenido mutate (video path) when submitting a gallery', async () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoMutate).not.toHaveBeenCalled()
  })

  it('navigates to /contenido/cma after a successful gallery create', async () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockPush).toHaveBeenCalledWith('/contenido/cma')
  })

  it('does not call createContenidoGaleria mutate when canSubmit is false (empty/incomplete gallery)', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockCreateContenidoGaleriaMutate).not.toHaveBeenCalled()
  })

  it('sets submitError to "Subí al menos una imagen." when submitting a gallery with canSubmit false', async () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe('Subí al menos una imagen.')
  })

  it('resets the gallery upload hook after a successful gallery create', async () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onTituloChange('Mi galeria'))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockGalleryReset).toHaveBeenCalled()
  })

  // --- saveDisabled for galleries ---

  it('exposes saveDisabled true for cma when canSubmit is false', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    expect(result.current.saveDisabled).toBe(true)
  })

  it('exposes saveDisabled false for cma when canSubmit is true and not submitting', () => {
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items: [],
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    expect(result.current.saveDisabled).toBe(false)
  })

  it('exposes saveDisabled false in edit mode for cma even when canSubmit is false (CON-004, no re-upload on edit)', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({
        mode: 'edit',
        initialTipo: 'cma',
        id: 'c-1',
      }),
    )
    expect(result.current.saveDisabled).toBe(false)
  })

  // --- gallery state exposed to the View ---

  it('exposes galleryItems from useUploadContenidoImagenes', () => {
    const items = [
      {
        file: new File([], 'a.jpg'),
        objectName: 'cma/a.jpg',
        status: 'done',
        error: null,
      },
    ]
    ;(useUploadContenidoImagenes as jest.Mock).mockReturnValue({
      items,
      addFiles: mockGalleryAddFiles,
      retry: mockGalleryRetry,
      remove: mockGalleryRemove,
      reset: mockGalleryReset,
      successfulPaths: ['cma/a.jpg'],
      canSubmit: true,
    })
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    expect(result.current.galleryItems).toBe(items)
  })

  it('exposes onGalleryFilesAdded that delegates to the upload hook addFiles', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    const files = [new File([], 'a.jpg')]
    act(() => result.current.onGalleryFilesAdded(files))
    expect(mockGalleryAddFiles).toHaveBeenCalledWith(files)
  })

  it('exposes onGalleryRetry that delegates to the upload hook retry', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onGalleryRetry('cma/a.jpg'))
    expect(mockGalleryRetry).toHaveBeenCalledWith('cma/a.jpg')
  })

  it('exposes onGalleryRemove that delegates to the upload hook remove', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onGalleryRemove('cma/a.jpg'))
    expect(mockGalleryRemove).toHaveBeenCalledWith('cma/a.jpg')
  })

  // --- onTipoChange resets the gallery hook too ---

  it('calls gallery reset when onTipoChange is called in create mode', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'videos' }),
    )
    act(() => result.current.onTipoChange('cma'))
    expect(mockGalleryReset).toHaveBeenCalled()
  })

  it('resets the gallery hook when onCancel is called in create mode', () => {
    const { result } = renderHook(() =>
      useContenidoFormViewModel({ mode: 'create', initialTipo: 'cma' }),
    )
    act(() => result.current.onCancel())
    expect(mockGalleryReset).toHaveBeenCalled()
  })
})
