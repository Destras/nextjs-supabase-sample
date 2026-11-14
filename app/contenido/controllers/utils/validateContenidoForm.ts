interface ValidateContenidoFormParams {
  readonly titulo: string
}

interface ContenidoFormErrors {
  readonly titulo?: string
}

const validateContenidoForm = ({
  titulo,
}: ValidateContenidoFormParams): ContenidoFormErrors => {
  const errors: Record<string, string> = {}

  if (titulo.trim() === '') {
    errors.titulo = 'El nombre es obligatorio.'
  }

  return errors
}

export type { ValidateContenidoFormParams, ContenidoFormErrors }
export { validateContenidoForm }
