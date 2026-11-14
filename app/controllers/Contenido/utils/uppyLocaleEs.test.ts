import { uppyLocaleEs } from './uppyLocaleEs'

describe('uppyLocaleEs', () => {
  it('traduce al castellano todos los textos que la barra de estado de Uppy puede mostrar', () => {
    expect(uppyLocaleEs.strings).toEqual({
      uploading: 'Subiendo',
      complete: 'Listo',
      uploadFailed: 'No se pudo subir',
      paused: 'En pausa',
      retry: 'Reintentar',
      retryUpload: 'Reintentar la subida',
      cancel: 'Cancelar',
      pause: 'Pausar',
      resume: 'Reanudar',
      done: 'Listo',
      showErrorDetails: 'Ver el detalle del error',
      upload: 'Subir',
      uploadXFiles: {
        0: 'Subir %{smart_count} archivo',
        1: 'Subir %{smart_count} archivos',
      },
      uploadXNewFiles: {
        0: 'Subir +%{smart_count} archivo',
        1: 'Subir +%{smart_count} archivos',
      },
      xMoreFilesAdded: {
        0: 'Agregaste %{smart_count} archivo más',
        1: 'Agregaste %{smart_count} archivos más',
      },
      filesUploadedOfTotal: {
        0: '%{complete} de %{smart_count} archivo subido',
        1: '%{complete} de %{smart_count} archivos subidos',
      },
      dataUploadedOfTotal: '%{complete} de %{total}',
      dataUploadedOfUnknown: '%{complete} de un total desconocido',
      xTimeLeft: 'Faltan %{time}',
      failedToAddFiles: 'No se pudieron agregar los archivos',
    })
  })

  it('usa la forma singular para un solo archivo', () => {
    expect(uppyLocaleEs.pluralize(1)).toBe(0)
  })

  it('usa la forma plural para varios archivos', () => {
    expect(uppyLocaleEs.pluralize(3)).toBe(1)
  })

  it('usa la forma plural para cero archivos', () => {
    expect(uppyLocaleEs.pluralize(0)).toBe(1)
  })
})
