import type { Contenido } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { contenidoLabel } from './contenidoLabel'

describe('contenidoLabel', () => {
  let video: Contenido
  let audio: Contenido

  beforeEach(() => {
    video = {
      id: 'v-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Meditación matutina',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }

    audio = {
      id: 'a-1',
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Mantra del sol',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
  })

  it('returns titulo when it is non-null for a VIDEO item', () => {
    expect(contenidoLabel(video)).toBe('Meditación matutina')
  })

  it('returns titulo when it is non-null for an AUDIO item', () => {
    expect(contenidoLabel(audio)).toBe('Mantra del sol')
  })

  it('returns empty string when titulo is null and tipo is VIDEO', () => {
    video = { ...video, titulo: null }
    expect(contenidoLabel(video)).toBe('')
  })

  it('returns empty string when titulo is null and tipo is AUDIO', () => {
    audio = { ...audio, titulo: null }
    expect(contenidoLabel(audio)).toBe('')
  })
})
