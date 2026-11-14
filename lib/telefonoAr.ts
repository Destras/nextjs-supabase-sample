// Espejo TypeScript de public.normalizar_telefono_ar (supabase/schemas/00_functions.sql,
// activacionPorTelefono Task 0.1). Solo UX: la base sigue siendo la autoridad — los
// ViewModels mandan al RPC lo tipeado con `trim`, no el resultado de esta función
// (DEC-17). Debe mantenerse alineado con la tabla de casos de la función SQL.
//
// El prefijo de país es OPCIONAL en la entrada (ACT-001): el panel muestra el `+54`
// como prefijo fijo del campo, así que el terapeuta tipea solo código de área +
// número. Como todos los pacientes son de Argentina (ADR-0008), el `54` no aporta
// información y no tiene sentido exigirlo. La salida sigue siendo siempre canónica.
//
// Se prueban dos lecturas del mismo input y gana la primera que valida:
//   1. con prefijo de país, si los dígitos arrancan en 54;
//   2. sin prefijo de país, tomando todo como área + número.
// El orden importa para `+541155551234`, y la segunda lectura es la que rescata a un
// hipotético número local de 10 dígitos que empiece con 54.
// Código de área + número, ya sin prefijo de país, sin el 9 de celular y sin
// el 0 de larga distancia: 10 dígitos que no arrancan en 9 ni en 0.
const AREA_Y_NUMERO_AR = /^[1-8][0-9]{9}$/

const aCanonico = (digitos: string): string | null => {
  let resto = digitos
  if (resto.startsWith('9')) resto = resto.slice(1)
  if (resto.startsWith('0')) resto = resto.slice(1)

  return AREA_Y_NUMERO_AR.test(resto) ? `+54${resto}` : null
}

const normalizarTelefonoAr = (input: string): string | null => {
  if (input.trim() === '') return null

  const soloDigitos = input.replace(/\D/g, '')

  const lecturas = soloDigitos.startsWith('54')
    ? [soloDigitos.slice(2), soloDigitos]
    : [soloDigitos]

  for (const lectura of lecturas) {
    const canonico = aCanonico(lectura)
    if (canonico !== null) return canonico
  }

  return null
}

// El campo del panel muestra el '+54' como prefijo fijo, así que lo que se tipea
// al lado es solo área + número. Al hidratar una ficha guardada hay que sacarle el
// prefijo canónico para no mostrarlo dos veces. Solo toca el valor exactamente
// canónico: cualquier otra cosa se muestra tal cual está guardada, para que el
// terapeuta vea el dato real y no una versión maquillada.
const CANONICO_AR = /^\+54([1-8][0-9]{9})$/

const sinPrefijoAr = (telefono: string): string =>
  CANONICO_AR.exec(telefono)?.[1] ?? telefono

export { normalizarTelefonoAr, sinPrefijoAr }
