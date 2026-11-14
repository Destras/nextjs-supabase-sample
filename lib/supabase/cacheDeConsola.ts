// Memoria corta de "esta sesión es de consola" (seguridadPanel / SEG-003).
//
// El proxy consulta `is_console_user` en cada request de página, y en
// producción cada <Link> visible hace además un prefetch que también pasa por
// el proxy: una pantalla con 20 links son 20 consultas iguales. Esta memoria
// las reduce a una por sesión cada `ttlMs`.
//
// Qué NO debilita:
//   - Solo se recuerda un `true`. Un `false` (paciente, usuario sin rol) o un
//     error nunca se guardan: quien no es de consola se consulta siempre.
//   - La clave es la sesión, no el usuario.
// Qué cuesta: si a alguien le quitan el rol, el proxy lo deja navegar hasta
// `ttlMs` más. Los datos los sigue protegiendo RLS en cada consulta.
//
// Vive en la memoria del proceso: es por instancia y se pierde al reiniciar.
// Es una optimización; nada depende de que el dato esté.

interface CacheDeConsola {
  readonly esConsolaVigente: (sesion: string) => boolean
  readonly recordar: (sesion: string) => void
}

interface CacheDeConsolaOpciones {
  readonly ttlMs: number
  readonly max: number
  readonly ahora: () => number
}

const crearCacheDeConsola = ({
  ttlMs,
  max,
  ahora,
}: CacheDeConsolaOpciones): CacheDeConsola => {
  const venceEn = new Map<string, number>()

  const esConsolaVigente = (sesion: string): boolean => {
    const vence = venceEn.get(sesion)
    if (vence === undefined) return false
    if (ahora() < vence) return true
    venceEn.delete(sesion)
    return false
  }

  const recordar = (sesion: string): void => {
    // Tope de memoria: al llenarse se vacía entera. Lo peor que pasa es una
    // consulta de más por sesión.
    if (venceEn.size >= max && !venceEn.has(sesion)) venceEn.clear()
    venceEn.set(sesion, ahora() + ttlMs)
  }

  return { esConsolaVigente, recordar }
}

export type { CacheDeConsola, CacheDeConsolaOpciones }
export { crearCacheDeConsola }
