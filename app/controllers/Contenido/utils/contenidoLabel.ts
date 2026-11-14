import type { Contenido } from '../ContenidoTypes'

/**
 * Resolves the display label for a Contenido item.
 *
 * - Returns `titulo` if non-null (covers VIDEO and AUDIO).
 * - Returns `''` when `titulo` is null.
 */
const contenidoLabel = (c: Contenido): string => {
  if (c.titulo !== null) return c.titulo
  return ''
}

export { contenidoLabel }
