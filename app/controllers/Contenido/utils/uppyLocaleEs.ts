// Textos en castellano (voseo) para Uppy. Cubre todas las claves que la barra
// de estado (@uppy/status-bar) puede renderizar; se pasa como `locale` al
// constructor de Uppy y los plugins la heredan.
const uppyLocaleEs = {
  // Índice de la forma a usar en las claves pluralizadas: 0 singular, 1 plural.
  pluralize: (n: number): 0 | 1 => (n === 1 ? 0 : 1),
  strings: {
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
  },
}

export { uppyLocaleEs }
