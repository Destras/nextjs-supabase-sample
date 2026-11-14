import { hasEtapaActiva } from './hasEtapaActiva'
import { PACIENTE_STATE } from '../PacienteTypes'
import type { Paciente } from '../PacienteTypes'

const basePaciente: Paciente = {
  id: 'p-1',
  nombre: 'Juan',
  nivelFinalizado: false,
  mesActual: null,
  etapaOrdinal: null,
  evaluaciones: [],
  semanaGlobal: null,
  semanasTotales: null,
  mesesTotales: null,
  fechaInicioEtapaActiva: null,
  etapaActivaId: null,
  sinIniciar: false,
  modalidadResumen: null,
  causaActual: null,
  bloqueosIdentificados: [],
  algoritmoActual: null,
  alfabetosActuales: [],
  ultimoScore: null,
  tendencia: 'flat',
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
  },
  state: PACIENTE_STATE.ACTIVE,
}

describe('hasEtapaActiva', () => {
  it('returns true when the paciente has etapaActivaId set', () => {
    const paciente: Paciente = {
      ...basePaciente,
      etapaActivaId: 'e-1',
    }
    expect(hasEtapaActiva(paciente)).toEqual(true)
  })

  it('returns false when the paciente has no active etapa (etapaActivaId is null)', () => {
    const paciente: Paciente = {
      ...basePaciente,
      etapaActivaId: null,
    }
    expect(hasEtapaActiva(paciente)).toEqual(false)
  })

  it('returns true for an active etapa that has not started yet (fechaInicioEtapaActiva null, etapaActivaId set) — DEC-10 escape hatch', () => {
    const paciente: Paciente = {
      ...basePaciente,
      fechaInicioEtapaActiva: null,
      etapaActivaId: 'e-2',
    }
    expect(hasEtapaActiva(paciente)).toEqual(true)
  })
})
