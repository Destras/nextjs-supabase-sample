// Caracteres de control (incluye tab y saltos de línea): los navegadores los
// descartan al parsear una URL, así que `/\t/evil` termina siendo `//evil`.
const CARACTER_DE_CONTROL = /[\u0000-\u001f\u007f]/

/**
 * Devuelve `ruta` solo si es una ruta interna del panel; si no, `porDefecto`.
 *
 * Una ruta interna empieza con una sola `/`. Se rechaza todo lo que un
 * navegador pueda resolver contra otro origen: URLs con esquema
 * (`https://…`, `javascript:…`), protocol-relative (`//host`), y cualquier
 * barra invertida, porque los navegadores la leen como `/` (`/\host`).
 */
const rutaInternaSegura = (ruta: string | null, porDefecto: string): string => {
  if (!ruta) return porDefecto
  if (!ruta.startsWith('/')) return porDefecto
  if (ruta.startsWith('//')) return porDefecto
  if (ruta.includes('\\')) return porDefecto
  if (CARACTER_DE_CONTROL.test(ruta)) return porDefecto
  return ruta
}

export { rutaInternaSegura }
