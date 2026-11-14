import type { Paciente } from '@/app/controllers/Paciente'
import {
  encabezadoTratamiento,
  tituloSinEtapaAbierta,
} from './encabezadoTratamiento'

type DatosDelEncabezado = Parameters<typeof encabezadoTratamiento>[0]

describe('encabezadoTratamiento', () => {
  let enCurso: DatosDelEncabezado

  beforeEach(() => {
    enCurso = {
      modalidadResumen: '16 discos de Río',
      mesActual: 2,
      mesesTotales: 4,
      semanaGlobal: 5,
      nivelFinalizado: false,
      inicioTratamiento: { estado: 'en_curso', fecha: '2026-09-01' },
    } satisfies Pick<
      Paciente,
      | 'modalidadResumen'
      | 'mesActual'
      | 'mesesTotales'
      | 'semanaGlobal'
      | 'nivelFinalizado'
      | 'inicioTratamiento'
    >
  })

  it('en curso: modalidad, mes y semana', () => {
    expect(encabezadoTratamiento(enCurso)).toEqual({
      modalidad: '16 discos de Río',
      estado: 'Mes de tratamiento 2/4 · Semana 5',
    })
  })

  it('en curso con todos los niveles cerrados: mes y "Finalizado"', () => {
    expect(
      encabezadoTratamiento({
        ...enCurso,
        mesActual: 4,
        nivelFinalizado: true,
      }),
    ).toEqual({
      modalidad: '16 discos de Río',
      estado: 'Mes de tratamiento 4/4 — Finalizado',
    })
  })

  it('en curso sin mes ni semana calculables: solo el rótulo', () => {
    expect(
      encabezadoTratamiento({
        ...enCurso,
        mesActual: null,
        mesesTotales: null,
        semanaGlobal: null,
      }),
    ).toEqual({ modalidad: '16 discos de Río', estado: 'Tratamiento en curso' })
  })

  it('en curso con mes pero sin semana: solo el mes', () => {
    expect(encabezadoTratamiento({ ...enCurso, semanaGlobal: null })).toEqual({
      modalidad: '16 discos de Río',
      estado: 'Mes de tratamiento 2/4',
    })
  })

  it('sin iniciar: la modalidad y "Tratamiento sin iniciar"', () => {
    expect(
      encabezadoTratamiento({
        ...enCurso,
        mesActual: null,
        semanaGlobal: null,
        inicioTratamiento: { estado: 'sin_iniciar', fecha: null },
      }),
    ).toEqual({
      modalidad: '16 discos de Río',
      estado: 'Tratamiento sin iniciar',
    })
  })

  it('finalizado: "Tratamiento finalizado", sin modalidad, mes ni semana', () => {
    expect(
      encabezadoTratamiento({
        modalidadResumen: null,
        mesActual: null,
        mesesTotales: null,
        semanaGlobal: null,
        nivelFinalizado: true,
        inicioTratamiento: { estado: 'finalizado', fecha: null },
      }),
    ).toEqual({ modalidad: null, estado: 'Tratamiento finalizado' })
  })

  it('sin tratamiento: "Sin tratamiento"', () => {
    expect(
      encabezadoTratamiento({
        modalidadResumen: null,
        mesActual: null,
        mesesTotales: null,
        semanaGlobal: null,
        nivelFinalizado: false,
        inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
      }),
    ).toEqual({ modalidad: null, estado: 'Sin tratamiento' })
  })
})

describe('tituloSinEtapaAbierta', () => {
  it('finalizado', () => {
    expect(tituloSinEtapaAbierta('finalizado')).toBe('Tratamiento finalizado')
  })

  it('sin tratamiento', () => {
    expect(tituloSinEtapaAbierta('sin_tratamiento')).toBe('Sin tratamiento')
  })

  it('sin iniciar', () => {
    expect(tituloSinEtapaAbierta('sin_iniciar')).toBe('Tratamiento sin iniciar')
  })

  it('en curso', () => {
    expect(tituloSinEtapaAbierta('en_curso')).toBe('Tratamiento en curso')
  })
})
