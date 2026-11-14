// Qué errores del formulario de medición se le muestran al usuario (pulidoBeta
// / BETA-049). `validarValoresMedicion` devuelve SIEMPRE todos (de eso depende
// habilitar el envío); a la vista solo llegan los de los campos que el usuario
// ya tocó, o todos después de un intento de envío. Así el formulario no abre
// con los 13 campos en rojo.
const erroresVisiblesMedicion = (
  errores: Readonly<Record<string, string>>,
  tocados: Readonly<Record<string, boolean>>,
  mostrarTodos: boolean,
): Record<string, string> =>
  mostrarTodos
    ? { ...errores }
    : Object.fromEntries(
        Object.entries(errores).filter(
          ([key]) => Object.hasOwn(tocados, key) && tocados[key] === true,
        ),
      )

export { erroresVisiblesMedicion }
