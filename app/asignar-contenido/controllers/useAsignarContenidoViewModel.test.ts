import { act, renderHook, waitFor } from '@testing-library/react'
import { useCurrentUserId } from '@/app/controllers/Auth'
import {
  useFetchPacientesByTerapeuta,
  useIniciarTratamiento,
} from '@/app/controllers/Paciente'
import {
  useFetchPlanContenidoDelTratamientoActivo,
  useSetEntregasPlan,
} from '@/app/controllers/Tratamiento'
import {
  useFetchAllContenido,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUnsavedChangesGuard } from '@/components/navigation'
import { useAsignarContenidoViewModel } from './useAsignarContenidoViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserId: jest.fn(),
}))

jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacientesByTerapeuta: jest.fn(),
  useIniciarTratamiento: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchPlanContenidoDelTratamientoActivo: jest.fn(),
  useSetEntregasPlan: jest.fn(),
}))

jest.mock('@/app/controllers/Contenido', () => ({
  useFetchAllContenido: jest.fn(),
  TIPO_CONTENIDO: {
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    EGREGOR: 'EGREGOR',
    CMA: 'CMA',
    IC: 'IC',
  },
}))

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/components/navigation', () => ({
  useUnsavedChangesGuard: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

const VIDEO_1 = {
  id: 'v-1',
  tipo: TIPO_CONTENIDO.VIDEO,
  titulo: 'Video 1',
  descripcion: null,
  contenido: { recursoRef: null, duracion: null },
}
const VIDEO_2 = {
  id: 'v-2',
  tipo: TIPO_CONTENIDO.VIDEO,
  titulo: 'Video 2',
  descripcion: null,
  contenido: { recursoRef: null, duracion: null },
}
const AUDIO_1 = {
  id: 'a-1',
  tipo: TIPO_CONTENIDO.AUDIO,
  titulo: 'Audio 1',
  descripcion: null,
  contenido: { recursoRef: null, duracion: null },
}
const EGREGOR_1 = {
  id: 'eg-1',
  tipo: TIPO_CONTENIDO.EGREGOR,
  titulo: 'Egregor 1',
  descripcion: null,
  contenido: { recursoRef: null, duracion: null },
}
const CMA_1 = {
  id: 'cma-1',
  tipo: TIPO_CONTENIDO.CMA,
  titulo: 'CMA 1',
  descripcion: null,
  imagenes: [],
}
const IC_1 = {
  id: 'ic-1',
  tipo: TIPO_CONTENIDO.IC,
  titulo: 'IC 1',
  descripcion: null,
  imagenes: [],
}

const FRASES_SEMANA_1 = [
  { orden: 1, origen: 'causa' as const, texto: 'Causa frase 1' },
  { orden: 2, origen: 'algoritmo' as const, texto: 'Algoritmo 1' },
  { orden: 3, origen: 'causa' as const, texto: 'Causa frase 2' },
]

const PACIENTE_1 = {
  id: 'p-1',
  nombre: 'Ana García',
  nivelFinalizado: false,
  mesActual: 3,
  etapaOrdinal: null,
  evaluaciones: [],
  semanaGlobal: 2,
  semanasTotales: 4,
  fechaInicioEtapaActiva: null,
  sinIniciar: true,
  modalidadResumen: '4 sem',
  causaActual: null,
  bloqueosIdentificados: [],
  algoritmoActual: null,
  alfabetosActuales: [],
  ultimoScore: null,
  tendencia: 'flat' as const,
  tieneAlerta: false,
  ultimaEvaluacion: null,
  proximaEvaluacion: null,
  inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
  tieneCuenta: false,
  bienvenidaRecibida: false,
  generalInfo: {
    telefono: null,
    email: null,
    fechaNacimiento: null,
    edad: null,
    fechaAlta: null,
    contactoAlternativo: null,
    relacionContacto: null,
  },
  state: 'active' as const,
}

const PACIENTE_2 = {
  ...PACIENTE_1,
  id: 'p-2',
  nombre: 'Carlos López',
  semanasTotales: 4,
}

const TRATAMIENTO_WITH_PLAN = {
  id: 'etapa-1',
  fechaInicio: '2024-01-01',
  fechaFin: null,
  diagnostico: { id: 'd-1', nombre: 'Ansiedad', descripcion: null },
  estado: 'activo',
  niveles: [],
  entregasSemanales: [
    {
      id: 'e-1',
      numeroSemana: 1,
      fechaEntregada: null,
      fechaEntregaEsperada: null,
      contenido: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
    },
    {
      id: 'e-2',
      numeroSemana: 2,
      fechaEntregada: null,
      fechaEntregaEsperada: null,
      contenido: [VIDEO_2, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
    },
    {
      id: 'e-3',
      numeroSemana: 3,
      fechaEntregada: null,
      fechaEntregaEsperada: null,
      contenido: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
    },
    {
      id: 'e-4',
      numeroSemana: 4,
      fechaEntregada: null,
      fechaEntregaEsperada: null,
      contenido: [VIDEO_2, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
    },
  ],
}

const INICIO_OK = {
  ok: true,
  error: null,
  iniciado: true,
  bienvenida: 'enviada',
}

describe('useAsignarContenidoViewModel', () => {
  let mockSubmit: jest.Mock
  let mockIniciar: jest.Mock
  let mockRefresh: jest.Mock
  let mockRefreshPacientes: jest.Mock
  let mockRouterPush: jest.Mock
  let mockSearchParamsGet: jest.Mock

  beforeEach(() => {
    mockSubmit = jest
      .fn()
      .mockResolvedValue({ ok: true, error: null, semanaPasada: null })
    mockRefresh = jest.fn()
    mockRefreshPacientes = jest.fn()
    mockRouterPush = jest.fn()
    mockSearchParamsGet = jest.fn().mockReturnValue(null)
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: 't-1',
      isLoading: false,
      error: null,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [PACIENTE_1, PACIENTE_2],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 4,
      cantidadNiveles: 4,
      frasesPorSemana: {},
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    ;(useSetEntregasPlan as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
      error: null,
    })
    mockIniciar = jest.fn().mockResolvedValue(INICIO_OK)
    ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
      submit: mockIniciar,
      isSubmitting: false,
    })
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, VIDEO_2, AUDIO_1],
      isLoading: false,
      error: null,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: mockSearchParamsGet,
    })
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
    })
  })

  // --- 0. contenidosBySlot (new-media-types/PR4) ---

  it('contenidosBySlot.meditacion contains only VIDEO-tipo contenidos', async () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, VIDEO_2, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.contenidosBySlot.meditacion).toEqual([
        VIDEO_1,
        VIDEO_2,
      ]),
    )
  })

  it('contenidosBySlot.mantra contains only AUDIO-tipo contenidos', async () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.contenidosBySlot.mantra).toEqual([AUDIO_1]),
    )
  })

  it('contenidosBySlot.egregor contains only EGREGOR-tipo contenidos', async () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.contenidosBySlot.egregor).toEqual([EGREGOR_1]),
    )
  })

  it('contenidosBySlot.cma contains only CMA-tipo contenidos', async () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.contenidosBySlot.cma).toEqual([CMA_1]),
    )
  })

  it('contenidosBySlot.ic contains only IC-tipo contenidos', async () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, AUDIO_1, EGREGOR_1, CMA_1, IC_1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.contenidosBySlot.ic).toEqual([IC_1]),
    )
  })

  // --- 1. Initial state ---

  it('isDirty starts as false', () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.isDirty).toBe(false)
  })

  it('selectedPacienteId defaults to the first paciente when no searchParam is present', () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.selectedPacienteId).toBe('p-1')
  })

  // --- 2. Preselección por ?paciente ---

  it('selectedPacienteId initializes to the ?paciente searchParam when present', () => {
    mockSearchParamsGet.mockReturnValue('p-2')
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: mockSearchParamsGet,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.selectedPacienteId).toBe('p-2')
  })

  // --- 2b. Bug PAC: el ?paciente que cambia (deep-link "Editar plan" desde
  // otro paciente) debe re-seleccionar al paciente del query param, no quedar
  // pegado al inicial. El useState solo siembra al montar; hace falta sincronizar. ---

  it('selectedPacienteId follows the ?paciente param when it changes (deep-link to another patient)', async () => {
    mockSearchParamsGet.mockReturnValue('p-1')
    const { result, rerender } = renderHook(() =>
      useAsignarContenidoViewModel(),
    )
    await waitFor(() => expect(result.current.selectedPacienteId).toBe('p-1'))
    // A "Editar plan" deep-link changes the query param to a different patient
    mockSearchParamsGet.mockReturnValue('p-2')
    rerender()
    await waitFor(() => expect(result.current.selectedPacienteId).toBe('p-2'))
  })

  it('a ?paciente param change while dirty goes through the dirty-guard (pending, not immediate)', async () => {
    mockSearchParamsGet.mockReturnValue('p-1')
    const { result, rerender } = renderHook(() =>
      useAsignarContenidoViewModel(),
    )
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    expect(result.current.isDirty).toBe(true)
    // Deep-link to another patient while there are unsaved changes
    mockSearchParamsGet.mockReturnValue('p-2')
    rerender()
    await waitFor(() => expect(result.current.pendingPacienteId).toBe('p-2'))
    // selectedPacienteId must NOT change until the user confirms
    expect(result.current.selectedPacienteId).toBe('p-1')
  })

  // --- 2c. pacienteCtx.mesActual ---

  it('pacienteCtx exposes mesActual sourced from selectedPaciente.mesActual', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.selectedPacienteId).toBe('p-1'))
    expect(result.current.pacienteCtx?.mesActual).toBe(PACIENTE_1.mesActual)
  })

  // --- 3. Tabla vacía sin plan (DEC-01) ---

  it('currentPlan has N semanas all with null slots when no plan exists', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.currentPlan).toHaveLength(4)
    })
    expect(result.current.currentPlan[0]).toEqual({
      semana: 1,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
  })

  it('currentPlan meditacion is null for all semanas when no plan exists', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.currentPlan).toHaveLength(4)
    })
    expect(result.current.currentPlan.every((s) => s.meditacion === null)).toBe(
      true,
    )
  })

  it('currentPlan mantra is null for all semanas when no plan exists', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.currentPlan).toHaveLength(4)
    })
    expect(result.current.currentPlan.every((s) => s.mantra === null)).toBe(
      true,
    )
  })

  // --- 4. Carga de plan existente ---

  it('maps entregasSemanales to currentPlan when tratamiento has an existing plan', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      frasesPorSemana: {},
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.currentPlan[0]).toEqual({
        semana: 1,
        meditacion: 'v-1',
        mantra: 'a-1',
        egregor: 'eg-1',
        cma: 'cma-1',
        ic: 'ic-1',
      })
    })
  })

  it('uses the id from the video-type contenido for meditacion when mapping existing plan', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      frasesPorSemana: {},
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.currentPlan[1]?.meditacion).toBe('v-2')
    })
  })

  // --- frasesPorSemana pass-through (frasesAutomaticas/epic-1, Task 1.2) ---

  it('exposes frasesPorSemana passed through from the plan hook', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: FRASES_SEMANA_1 },
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() =>
      expect(result.current.frasesPorSemana).toEqual({ 1: FRASES_SEMANA_1 }),
    )
  })

  it('defaults frasesPorSemana to {} when the plan hook has not resolved any yet', () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.frasesPorSemana).toEqual({})
  })

  // --- 5. setSemana ---

  it('setSemana updates the targeted cell in currentPlan', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-new')
    })
    expect(result.current.currentPlan[0]?.meditacion).toBe('v-new')
  })

  it('registers the unsaved-changes guard as clean before any edit', () => {
    renderHook(() => useAsignarContenidoViewModel())
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('registers the unsaved-changes guard as dirty after setSemana', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'mantra', 'a-new')
    })
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('setSemana marks isDirty as true', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'mantra', 'a-new')
    })
    expect(result.current.isDirty).toBe(true)
  })

  // --- 6. canSave (planBorrador: un plan parcial se guarda) ---

  const conPlanGuardado = () =>
    (useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })

  it('canSave is false when nothing changed', async () => {
    conPlanGuardado()
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    expect(result.current.canSave).toBe(false)
  })

  it('canSave is true with a partial plan once something changed', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-1')
    })
    expect(result.current.canSave).toBe(true)
  })

  it('canSave is false while saving', async () => {
    conPlanGuardado()
    ;(useSetEntregasPlan as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: true,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    expect(result.current.canSave).toBe(false)
  })

  it('semanasConContenido counts weeks with at least one slot filled', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(1, 'mantra', 'a-1')
    })
    expect(result.current.semanasConContenido).toBe(1)
    expect(result.current.totalSemanas).toBe(4)
  })

  // --- 7. Semana en curso y semanas pasadas (DEC-10) ---

  it('semanaEnCurso is null while the treatment has not started', () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.semanaEnCurso).toBeNull()
    expect(result.current.esSemanaPasada(1)).toBe(false)
  })

  it('semanaEnCurso counts from fechaInicioEtapaActiva without the plan cap', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 0, 30, 12))
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [
        {
          ...PACIENTE_1,
          sinIniciar: false,
          fechaInicioEtapaActiva: '2024-01-01',
          semanaGlobal: 4,
        },
      ],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    jest.useRealTimers()
    // 29 days after the start = semana 5, past the 4-week plan
    expect(result.current.semanaEnCurso).toBe(5)
    expect(result.current.esSemanaPasada(4)).toBe(true)
    expect(result.current.esSemanaPasada(5)).toBe(false)
  })

  // --- 7b. Iniciar tratamiento ---

  it('puedeIniciar is true for a paciente sin iniciar', () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.puedeIniciar).toBe(true)
  })

  it('puedeIniciar is false when already started', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [{ ...PACIENTE_1, sinIniciar: false }],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.puedeIniciar).toBe(false)
  })

  it('puedeIniciar is false for a paciente dado de baja', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [{ ...PACIENTE_1, state: 'baja' }],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.puedeIniciar).toBe(false)
  })

  it('puedeIniciar is false while iniciando', () => {
    ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
      submit: mockIniciar,
      isSubmitting: true,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.puedeIniciar).toBe(false)
    expect(result.current.isIniciando).toBe(true)
  })

  it('avisoDeInicio comes from the selected paciente', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [{ ...PACIENTE_1, tieneCuenta: true }],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.avisoDeInicio).toBe('con_app')
  })

  it('onIniciar sends the draft when there are unsaved changes', async () => {
    conPlanGuardado()
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onIniciar()
    })
    expect(mockIniciar).toHaveBeenCalledWith({
      etapaId: 'etapa-1',
      semanas: expect.arrayContaining([
        expect.objectContaining({ meditacion: 'v-2' }),
      ]),
    })
  })

  it('onIniciar sends null when there are no changes', async () => {
    conPlanGuardado()
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    await act(async () => {
      await result.current.onIniciar()
    })
    expect(mockIniciar).toHaveBeenCalledWith({
      etapaId: 'etapa-1',
      semanas: null,
    })
  })

  it('onIniciar on success clears dirty, closes the dialog, toasts and refreshes', async () => {
    conPlanGuardado()
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
      result.current.setIniciarOpen(true)
    })
    await act(async () => {
      await result.current.onIniciar()
    })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.isIniciarOpen).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('Tratamiento iniciado.')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockRefreshPacientes).toHaveBeenCalledTimes(1)
  })

  it('onIniciar on failure keeps the draft dirty and refreshes', async () => {
    conPlanGuardado()
    mockIniciar.mockResolvedValue({
      ok: false,
      error: 'etapa_cerrada',
      iniciado: false,
      bienvenida: 'desconocida',
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onIniciar()
    })
    expect(result.current.isDirty).toBe(true)
    expect(toast.error).toHaveBeenCalled()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockRefreshPacientes).toHaveBeenCalledTimes(1)
  })

  it('onIniciar ignores a concurrent second call', async () => {
    conPlanGuardado()
    let resolve!: (v: typeof INICIO_OK) => void
    mockIniciar.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    await act(async () => {
      void result.current.onIniciar()
      void result.current.onIniciar()
      resolve(INICIO_OK)
    })
    expect(mockIniciar).toHaveBeenCalledTimes(1)
  })

  // --- 7c. semana_pasada (DEC-09) ---

  it('semana_pasada restores only the rejected week from the server and keeps other edits', async () => {
    conPlanGuardado()
    mockSubmit.mockResolvedValue({
      ok: false,
      error: 'semana_pasada',
      semanaPasada: 2,
    })
    const { result, rerender } = renderHook(() =>
      useAsignarContenidoViewModel(),
    )
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(1, 'meditacion', 'v-1') // semana 2 (server: v-2)
      result.current.setSemana(2, 'meditacion', 'v-2') // semana 3 (server: v-1)
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(toast.error).toHaveBeenCalledWith(
      'La semana 2 ya pasó; no se puede modificar.',
    )
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    // refresh delivers a new tratamiento object
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: { ...TRATAMIENTO_WITH_PLAN },
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    rerender()
    await waitFor(() =>
      expect(result.current.currentPlan[1]?.meditacion).toBe('v-2'),
    )
    expect(result.current.currentPlan[2]?.meditacion).toBe('v-2')
    expect(result.current.isDirty).toBe(true)
  })

  // --- 8. onSave gate ---

  it('save calls submit with etapaId and the current plan when plan is complete', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(mockSubmit).toHaveBeenCalledWith('etapa-1', expect.any(Array))
  })

  it('onSave ignores a concurrent second call while the first is in flight (no double RPC)', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    let resolveSubmit!: (v: {
      ok: boolean
      error: null
      semanaPasada: null
    }) => void
    mockSubmit.mockReturnValue(
      new Promise((r) => {
        resolveSubmit = r
      }),
    )
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      void result.current.onSave()
      void result.current.onSave()
      resolveSubmit({ ok: true, error: null, semanaPasada: null })
    })
    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })

  it('save on success calls refresh', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({ ok: true, error: null, semanaPasada: null })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('al guardar vuelve a pedir los pacientes para refrescar la cabecera (BETA-046)', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(mockRefreshPacientes).toHaveBeenCalledTimes(1)
  })

  it('ante un rechazo del guardado recarga el plan y los pacientes', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({
      ok: false,
      error: 'boom',
      semanaPasada: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockRefreshPacientes).toHaveBeenCalledTimes(1)
  })

  it('la cabecera toma el mes y la semana de la lista refrescada sin ensuciar el formulario', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result, rerender } = renderHook(() =>
      useAsignarContenidoViewModel(),
    )
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [{ ...PACIENTE_1, mesActual: 1, semanaGlobal: 1 }, PACIENTE_2],
      isLoading: false,
      error: null,
      refresh: mockRefreshPacientes,
    })
    rerender()
    expect({
      seleccionado: result.current.selectedPacienteId,
      ctx: result.current.pacienteCtx,
      isDirty: result.current.isDirty,
    }).toEqual({
      seleccionado: PACIENTE_1.id,
      ctx: {
        modalidadResumen: PACIENTE_1.modalidadResumen,
        mesActual: 1,
        currentWeek: 1,
      },
      isDirty: false,
    })
  })

  it('save on success sets isDirty to false', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({ ok: true, error: null, semanaPasada: null })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'mantra', 'a-new')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(result.current.isDirty).toBe(false)
  })

  it('justSaved is false initially, true after a successful save, and false again after an edit', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({ ok: true, error: null, semanaPasada: null })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    expect(result.current.justSaved).toBe(false)
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(result.current.justSaved).toBe(true)
    act(() => {
      result.current.setSemana(1, 'meditacion', 'v-1')
    })
    expect(result.current.justSaved).toBe(false)
  })

  // --- 9. save error ---

  it('save on error retains the draft (currentPlan unchanged)', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({
      ok: false,
      error: 'rpc_error',
      semanaPasada: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(result.current.currentPlan[0]?.meditacion).toBe('v-edited')
  })

  it('save on error keeps isDirty as true', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    mockSubmit.mockResolvedValue({
      ok: false,
      error: 'rpc_error',
      semanaPasada: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    await act(async () => {
      await result.current.onSave()
    })
    expect(result.current.isDirty).toBe(true)
  })

  // --- 10. Borrador single-paciente: se reemplaza al cambiar paciente (DEC-07) ---

  it('draft is replaced with empty semanas when switching to a patient with no plan', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // Edit p-1's draft (makes isDirty = true)
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    // Switch to p-2 while dirty → goes through dirty-guard; confirm to complete switch
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    act(() => {
      result.current.confirmSwitchPaciente()
    })
    await waitFor(() => expect(result.current.selectedPacienteId).toBe('p-2'))
    expect(result.current.currentPlan[0]?.meditacion).toBeNull()
  })

  it('isDirty resets to false when switching to a different patient', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    // Switch while dirty → dirty-guard; confirm to complete
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    act(() => {
      result.current.confirmSwitchPaciente()
    })
    await waitFor(() => expect(result.current.selectedPacienteId).toBe('p-2'))
    expect(result.current.isDirty).toBe(false)
  })

  // --- 12. Dirty-guard al cambiar de paciente (DEC-10) ---

  it('onSelectPaciente when dirty sets pendingPacienteId and does NOT change selectedPacienteId immediately', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // Make dirty
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    expect(result.current.isDirty).toBe(true)
    // Attempt to switch to p-2 while dirty
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    // selectedPacienteId must NOT have changed yet
    expect(result.current.selectedPacienteId).toBe('p-1')
    // pendingPacienteId must be set to the requested id
    expect(result.current.pendingPacienteId).toBe('p-2')
  })

  it('onSelectPaciente when NOT dirty switches selectedPacienteId immediately with no pending', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // isDirty is false (no edits)
    expect(result.current.isDirty).toBe(false)
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    expect(result.current.selectedPacienteId).toBe('p-2')
    expect(result.current.pendingPacienteId).toBeNull()
  })

  it('confirmSwitchPaciente applies the pending switch, clears pendingPacienteId, and resets isDirty', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // Make dirty and trigger pending switch
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    expect(result.current.pendingPacienteId).toBe('p-2')
    // Confirm the switch
    act(() => {
      result.current.confirmSwitchPaciente()
    })
    expect(result.current.selectedPacienteId).toBe('p-2')
    expect(result.current.pendingPacienteId).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })

  it('cancelSwitchPaciente clears pendingPacienteId and keeps the current selectedPacienteId', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // Make dirty and trigger pending switch
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    expect(result.current.pendingPacienteId).toBe('p-2')
    // Cancel the switch
    act(() => {
      result.current.cancelSwitchPaciente()
    })
    expect(result.current.selectedPacienteId).toBe('p-1')
    expect(result.current.pendingPacienteId).toBeNull()
  })

  // --- 13. canSave gate: blocked when catalogs not ready (#4) ---

  it('canSave is false when catalogs are still loading, even if dirty', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [VIDEO_1, VIDEO_2, AUDIO_1],
      isLoading: true, // still loading
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-2')
    })
    expect(result.current.canSave).toBe(false)
  })

  // --- 14. Draft cleared when weeks === 0 (#6) ---

  it('currentPlan is empty when the selected patient has no active etapa (weeks === 0)', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 0,
      cantidadNiveles: 0,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => {
      expect(result.current.weeks).toBe(0)
    })
    expect(result.current.currentPlan).toHaveLength(0)
  })

  it('draft is cleared (empty) after switching to a patient with weeks === 0', async () => {
    // Start: p-1 has a plan with 4 weeks
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 4,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result, rerender } = renderHook(() =>
      useAsignarContenidoViewModel(),
    )
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))

    // Switch to p-2 which has no etapa (weeks=0); simulate by updating the mock
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 0,
      cantidadNiveles: 0,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    act(() => {
      result.current.onSelectPaciente('p-2')
    })
    rerender()
    await waitFor(() => {
      expect(result.current.selectedPacienteId).toBe('p-2')
    })
    expect(result.current.currentPlan).toHaveLength(0)
  })

  // --- 15. onSelectPaciente no-op on same id (#7) ---

  it('onSelectPaciente is a no-op when the selected id equals the current selectedPacienteId', async () => {
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.currentPlan).toHaveLength(4))
    // Make dirty
    act(() => {
      result.current.setSemana(0, 'meditacion', 'v-edited')
    })
    expect(result.current.isDirty).toBe(true)
    // Re-select same patient — should NOT open dirty-guard
    act(() => {
      result.current.onSelectPaciente('p-1')
    })
    expect(result.current.pendingPacienteId).toBeNull()
    expect(result.current.selectedPacienteId).toBe('p-1')
    expect(result.current.isDirty).toBe(true) // draft untouched
  })

  // --- 16. isInitialLoading vs isPlanLoading (#3) ---

  it('isInitialLoading is true when pacientesLoading is true', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.isInitialLoading).toBe(true)
  })

  it('isInitialLoading is false when pacientes have loaded', () => {
    // beforeEach: pacientesLoading = false
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.isInitialLoading).toBe(false)
  })

  it('isPlanLoading is true when planLoading is true and isInitialLoading is false', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: 0,
      isLoading: true,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    expect(result.current.isPlanLoading).toBe(true)
    expect(result.current.isInitialLoading).toBe(false)
  })

  // --- 17. semanasPorNivel (#10) ---

  it('semanasPorNivel equals weeks / cantidadNiveles when cantidadNiveles > 0', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: TRATAMIENTO_WITH_PLAN,
      semanasTotales: 16,
      cantidadNiveles: 4,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.weeks).toBe(16))
    expect(result.current.semanasPorNivel).toBe(4)
  })

  it('semanasPorNivel equals weeks when cantidadNiveles is 0 (guard against division by zero)', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 8,
      cantidadNiveles: 0,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.weeks).toBe(8))
    expect(result.current.semanasPorNivel).toBe(8)
  })

  it('semanasPorNivel uses Math.ceil so non-integer results round up', async () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: 5,
      cantidadNiveles: 2,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
    const { result } = renderHook(() => useAsignarContenidoViewModel())
    await waitFor(() => expect(result.current.weeks).toBe(5))
    expect(result.current.semanasPorNivel).toBe(3) // ceil(5/2) = 3
  })
})
