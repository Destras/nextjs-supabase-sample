import type { TipoAlerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'
import { mapAlertaRow } from './mapAlertaRow'

describe('mapAlertaRow', () => {
  let baseRow: Parameters<typeof mapAlertaRow>[0]
  let catalogo: ReadonlyArray<TipoAlerta>

  beforeEach(() => {
    baseRow = {
      paciente_id: 'p-1',
      paciente_nombre: 'Juana Pérez',
      terapeuta_id: 't-1',
      terapeuta_nombre: 'Dra. Gómez',
      tipo: 'score_bajo',
      evento_ref: 'ev-1',
      valor: 2,
      fecha: '2026-06-01T00:00:00Z',
    }
    catalogo = [
      {
        codigo: 'score_bajo',
        nombre: 'Score bajo',
        prioridad: 'alta',
        orden: 1,
        icono: '↘',
        descripcion: null,
        activo: true,
        descartable: true,
      },
      {
        codigo: 'eval_vencida',
        nombre: 'Evaluación vencida',
        prioridad: 'media',
        orden: 2,
        icono: '?',
        descripcion: null,
        activo: true,
        descartable: true,
      },
      {
        codigo: 'mes_3',
        nombre: 'Mes 3',
        prioridad: 'media',
        orden: 3,
        icono: '✦',
        descripcion: null,
        activo: true,
        descartable: true,
      },
      {
        codigo: 'fin',
        nombre: 'Cerca del cierre',
        prioridad: 'media',
        orden: 4,
        icono: '✦',
        descripcion: null,
        activo: true,
        descartable: true,
      },
      {
        codigo: 'reinicio',
        nombre: 'Reinicio de tratamiento',
        prioridad: 'baja',
        orden: 5,
        icono: '↻',
        descripcion: null,
        activo: true,
        descartable: true,
      },
      {
        codigo: 'medicion_cierre_pendiente',
        nombre: 'Cierre pendiente de medición',
        prioridad: 'alta',
        orden: 6,
        icono: '◎',
        descripcion: null,
        activo: true,
        descartable: false,
      },
    ]
  })

  it('maps score_bajo using the catalog and a message with the score', () => {
    expect(mapAlertaRow(baseRow, catalogo)).toEqual({
      tipo: ALERTA_TIPO.SCORE_BAJO,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Score bajo',
      icono: '↘',
      mensaje: 'score 2 · última evaluación',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('maps eval_vencida using the catalog and a fixed message', () => {
    expect(
      mapAlertaRow({ ...baseRow, tipo: 'eval_vencida', valor: null }, catalogo),
    ).toEqual({
      tipo: ALERTA_TIPO.EVAL_VENCIDA,
      prioridad: 'media',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Evaluación vencida',
      icono: '?',
      mensaje: 'evaluación vencida',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('maps mes_3 using the catalog and a fixed message', () => {
    expect(
      mapAlertaRow({ ...baseRow, tipo: 'mes_3', valor: 3 }, catalogo),
    ).toEqual({
      tipo: ALERTA_TIPO.MES_3,
      prioridad: 'media',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Mes 3',
      icono: '✦',
      mensaje: 'entra en mes 3',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('maps fin using the catalog and a fixed message', () => {
    expect(
      mapAlertaRow({ ...baseRow, tipo: 'fin', valor: 8 }, catalogo),
    ).toEqual({
      tipo: ALERTA_TIPO.FIN,
      prioridad: 'media',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Cerca del cierre',
      icono: '✦',
      mensaje: 'cerca del cierre',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('maps reinicio using the catalog and a fixed message', () => {
    expect(
      mapAlertaRow({ ...baseRow, tipo: 'reinicio', valor: 2 }, catalogo),
    ).toEqual({
      tipo: ALERTA_TIPO.REINICIO,
      prioridad: 'baja',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Reinicio de tratamiento',
      icono: '↻',
      mensaje: 'reinició tratamiento',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('falls back to safe defaults and a generic message for an unknown tipo, failing closed on descartable', () => {
    expect(
      mapAlertaRow({ ...baseRow, tipo: 'algo_nuevo', valor: null }, catalogo),
    ).toEqual({
      tipo: 'algo_nuevo',
      prioridad: 'media',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'algo_nuevo',
      icono: '?',
      mensaje: 'alerta pendiente de revisión',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: false,
    })
  })

  it('maps terapeutaNombre as null when the row carries no terapeuta name', () => {
    expect(
      mapAlertaRow({ ...baseRow, terapeuta_nombre: null }, catalogo),
    ).toEqual({
      tipo: ALERTA_TIPO.SCORE_BAJO,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: null,
      nombre: 'Score bajo',
      icono: '↘',
      mensaje: 'score 2 · última evaluación',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: true,
    })
  })

  it('maps medicion_cierre_pendiente as not descartable, even though it is in the catalog', () => {
    expect(
      mapAlertaRow(
        { ...baseRow, tipo: 'medicion_cierre_pendiente', valor: null },
        catalogo,
      ),
    ).toEqual({
      tipo: ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juana Pérez',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dra. Gómez',
      nombre: 'Cierre pendiente de medición',
      icono: '◎',
      mensaje: 'Última semana de la etapa: cerrala con su medición',
      eventoRef: 'ev-1',
      fecha: '2026-06-01T00:00:00Z',
      descartable: false,
    })
  })
})
