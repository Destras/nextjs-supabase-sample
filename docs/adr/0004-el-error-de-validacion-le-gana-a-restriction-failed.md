# El error de validación le gana a `restriction-failed` de Uppy

Cuando nuestro `onBeforeFileAdded` rechaza un archivo, Uppy lo convierte en un `RestrictionError` y lo emite como `restriction-failed` en el mismo tick (`Uppy.js` → `addFile` → `#informAndEmit`, que emite para todo lo que tenga `isRestriction`). El handler de ese evento seteaba `'upload_failed'`, pisando el motivo específico que el validador acababa de setear. **Resultado: `formato_invalido` y `tamano_excedido` eran copy muerto** — el terapeuta siempre leía _"No pudimos subir el archivo. Reintentá."_, un mensaje que además lo invita a reintentar algo que nunca va a funcionar. Por eso este bug se reportó como _"creo que está limitado"_: la app nunca dijo cuál era el límite.

**Decidimos que el motivo específico gana.** `rejectedByValidatorRef` marca, por intento, si el rechazo fue nuestro; `restriction-failed` solo cae al mensaje genérico cuando la restricción la levantó Uppy (demasiados archivos, tipo equivocado para la pestaña).

## Consecuencias

- La bandera **parece redundante y no lo es.** Borrarla vuelve a dejar todos los rechazos bajo el mismo mensaje genérico. Está cubierta por dos tests en `useUploadContenidoMedia.test.ts`: uno verifica que el motivo específico sobrevive, el otro que un rechazo propio de Uppy sigue cayendo en `upload_failed`.
