import type { Contenido, ContenidoImagen } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'

interface ContenidoImagenRowRaw {
  readonly path: string
  readonly orden: number
}

interface ContenidoRowRaw {
  id: string
  tipo: string
  titulo: string
  descripcion: string | null
  recurso_ref: string | null
  duracion_seg: number | null
  // Embedded select from fetchAllContenido/fetchContenidoById. Absent for
  // rows fetched without the join (e.g. legacy call sites) — never present
  // for non-gallery tipos, since they have no contenido_imagenes rows.
  contenido_imagenes?: ReadonlyArray<ContenidoImagenRowRaw>
}

type ResolvedTipo =
  | TIPO_CONTENIDO.VIDEO
  | TIPO_CONTENIDO.AUDIO
  | TIPO_CONTENIDO.EGREGOR
  | TIPO_CONTENIDO.CMA
  | TIPO_CONTENIDO.IC

const resolveTipo = (tipo: string): ResolvedTipo | null => {
  const upper = tipo.toUpperCase()
  if (upper === TIPO_CONTENIDO.VIDEO) return TIPO_CONTENIDO.VIDEO
  if (upper === TIPO_CONTENIDO.AUDIO) return TIPO_CONTENIDO.AUDIO
  if (upper === TIPO_CONTENIDO.EGREGOR) return TIPO_CONTENIDO.EGREGOR
  if (upper === TIPO_CONTENIDO.CMA) return TIPO_CONTENIDO.CMA
  if (upper === TIPO_CONTENIDO.IC) return TIPO_CONTENIDO.IC
  // La tabla `contenidos` solo almacena media/galería (video/audio/egregor/
  // cma/ic). El tipo de frase manual fue retirado — ver
  // .claude/controllers-entities.md.
  return null
}

const mapImagenes = (
  raw: ReadonlyArray<ContenidoImagenRowRaw> | undefined,
): ReadonlyArray<ContenidoImagen> =>
  raw === undefined
    ? []
    : [...raw]
        .sort((a, b) => a.orden - b.orden)
        .map((img) => ({ path: img.path, orden: img.orden }))

const mapContenidoRow = (raw: ContenidoRowRaw): Contenido | null => {
  const tipo = resolveTipo(raw.tipo)
  if (tipo === null) return null

  return {
    id: raw.id,
    tipo,
    titulo: raw.titulo,
    descripcion: raw.descripcion,
    contenido: {
      recursoRef: raw.recurso_ref,
      duracion: raw.duracion_seg,
    },
    imagenes: mapImagenes(raw.contenido_imagenes),
  }
}

export type { ContenidoRowRaw, ContenidoImagenRowRaw }
export { mapContenidoRow }
