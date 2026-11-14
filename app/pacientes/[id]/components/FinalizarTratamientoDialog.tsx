'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useCerrarEtapa } from '@/app/controllers/Paciente'
import type { EstadoCierre } from '@/app/controllers/Paciente'
import {
  useFetchEstructuraPaciente,
  useCerrarEtapaConMedicion,
  validarValoresMedicion,
  erroresVisiblesMedicion,
  serializeValoresMedicion,
  mapMedicionError,
  construirCampos,
} from '@/app/controllers/Tratamiento'
import type { CampoMedicion } from '@/app/controllers/Tratamiento'
import { MedicionForm } from '@/components/mediciones'
import { MedicionNotice } from '../estructura/components/MedicionNotice'

interface FinalizarTratamientoDialogProps {
  readonly pacienteId: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCerrada: () => void
}

const FinalizarTratamientoDialog = ({
  pacienteId,
  open,
  onOpenChange,
  onCerrada,
}: FinalizarTratamientoDialogProps) => {
  const [estado, setEstado] = useState<EstadoCierre>('finalizada')
  const [motivo, setMotivo] = useState('')
  const { submit: submitCierre, isSubmitting } = useCerrarEtapa()
  const router = useRouter()

  // PR4 (E3, design §5.4) — estado inline agregado, sin extraer un
  // ViewModel: ningún diálogo del repo usa un hook de ViewModel, la
  // exploración lo confirmó (`rg -l 'use.*ViewModel' --glob '*Dialog*.tsx'`
  // → cero) — es la convención, no deuda técnica.
  const [paso, setPaso] = useState<1 | 2>(1)
  const [campos, setCampos] = useState<ReadonlyArray<CampoMedicion>>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})
  // Los errores de campo se muestran recién cuando el campo se tocó (cambio o
  // blur) o después de un intento de envío (BETA-049): `errores` sigue
  // teniendo TODOS, y de eso depende que se pueda finalizar.
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const [intentoEnviar, setIntentoEnviar] = useState(false)
  // Error del paso 2 persistido inline (MED-007): un toast desaparece antes
  // de que el terapeuta lo lea y el conflicto quedaba invisible.
  const [errorMedicion, setErrorMedicion] = useState<string | null>(null)

  const estructura = useFetchEstructuraPaciente(open ? pacienteId : null)
  const cerrarConMedicion = useCerrarEtapaConMedicion()

  // La etapa "activa" que este diálogo cierra: la que todavía no tiene
  // fecha de finalización. Mismo criterio que `useEstructuraTabViewModel`'s
  // `etapaVigente` (design §4.5) — `fechaFin === null`, no el enum `estado`.
  const etapaAbierta =
    estructura.data?.etapas.find((e) => e.fechaFin === null) ?? null

  // DEC-33 / T3.1: el diálogo se vuelve de dos pasos ÚNICA Y EXCLUSIVAMENTE
  // en esta rama. Cualquier otra combinación (abandonada, admin sin
  // asignación, etapa no iniciada) salta el formulario y llama a
  // `cerrar_etapa` directo, igual que hoy.
  const esRamaDosPage =
    estado === 'finalizada' &&
    estructura.data?.puedeMedir === true &&
    (etapaAbierta?.iniciada ?? false)

  // "Cierre sin medición" (§7.2) — sólo en las ramas de un paso, y sólo si
  // hay al menos una medición previa (si no, no se genera `cierre_automatico`
  // y el aviso mentiría).
  const mostrarAvisoSinMedicion =
    !esRamaDosPage &&
    etapaAbierta !== null &&
    etapaAbierta.medicionActual !== null

  // Reset a los defaults (DEC-14: "Finalizado" por default, motivo vacío)
  // cada vez que el diálogo se vuelve a abrir, para que no arrastre el
  // estado del cierre anterior. PR4 extiende el reset a paso/valores/errores.
  useEffect(() => {
    if (open) {
      setEstado('finalizada')
      setMotivo('')
      setPaso(1)
      setCampos([])
      setValores({})
      setErrores({})
      setTocados({})
      setIntentoEnviar(false)
      setErrorMedicion(null)
    }
  }, [open])

  const mostrarExitoYcerrar = () => {
    // CTA post-cierre (DEC-26): un toque lleva directo al wizard de
    // rediagnóstico; si se ignora, queda el ítem "Nuevo tratamiento" en el
    // menú de TratamientoActions (visible tras el refetch que dispara
    // onCerrada). Sin botones/carteles nuevos en la pantalla.
    toast.success('Tratamiento finalizado', {
      action: {
        label: 'Iniciar nuevo tratamiento',
        onClick: () =>
          router.push(`/pacientes/${pacienteId}/nuevo-tratamiento`),
      },
    })
    onOpenChange(false)
    onCerrada()
  }

  // Rama de un paso (sin medición) — sin cambios de comportamiento vs. antes
  // de PR4: siempre llama a `cerrar_etapa`.
  const handleConfirmCierre = async () => {
    const { error } = await submitCierre({
      pacienteId,
      estado,
      motivo: motivo.trim() === '' ? null : motivo.trim(),
    })

    if (error) {
      toast.error(error)
      return
    }

    mostrarExitoYcerrar()
  }

  // Paso 1 → paso 2: precarga ÚNICA (R7, design §4.5) — nunca vía un efecto
  // atado a `medicionActual`. `campos[].valorAnterior` (hints) y `valores`
  // (lo tipeado) se seedean acá una sola vez.
  const avanzarAPaso2 = () => {
    if (etapaAbierta === null) return
    const camposNuevos = construirCampos(
      estructura.data?.centrosActivos ?? [],
      etapaAbierta.medicionActual,
    )
    const valoresIniciales = Object.fromEntries(
      camposNuevos.map((c) => [c.key, String(c.valorAnterior ?? '')]),
    )
    setCampos(camposNuevos)
    setValores(valoresIniciales)
    setErrores(validarValoresMedicion(valoresIniciales, camposNuevos))
    setTocados({})
    setIntentoEnviar(false)
    setPaso(2)
  }

  const marcarTocado = (key: string) =>
    setTocados((prev) => (prev[key] === true ? prev : { ...prev, [key]: true }))

  const onChangeValorMedicion = (key: string, value: string) => {
    const nuevosValores = { ...valores, [key]: value }
    setValores(nuevosValores)
    setErrores(validarValoresMedicion(nuevosValores, campos))
    marcarTocado(key)
  }

  // Paso 2 → cierre atómico. Exactamente UNA llamada a
  // `cerrar_etapa_con_medicion` (T3.1): si falla, el diálogo queda abierto,
  // el error mapeado queda inline arriba del formulario (no un toast
  // efímero — MED-007) y `valores` se preserva byte a byte.
  const handleConfirmMedicion = async () => {
    if (etapaAbierta === null) return
    const wire = serializeValoresMedicion(valores, campos)
    setErrorMedicion(null)

    const { error } = await cerrarConMedicion.submit({
      pacienteId,
      motivo: motivo.trim() === '' ? null : motivo.trim(),
      valores: wire,
      medicionPreviaId: etapaAbierta.medicionActual?.id ?? null,
    })

    if (error !== null) {
      const mapped = mapMedicionError(error)
      // PT409: refrescamos la estructura para que la próxima confirmación
      // viaje con el `medicionPreviaId` correcto, pero NUNCA tocamos
      // `valores` (design §4.5/§5.4 — lo tipeado no se resetea).
      if (mapped.debeRefetchear) {
        estructura.refresh()
      }
      setErrorMedicion(mapped.mensaje)
      return
    }

    mostrarExitoYcerrar()
  }

  const canSubmitMedicion =
    campos.length > 0 && Object.keys(errores).length === 0

  const handlePrimary = () => {
    if (paso === 2) {
      // Con campos inválidos no se llama a la base: el intento deja a la vista
      // todos los errores, también los de los campos que no se tocaron.
      if (!canSubmitMedicion) {
        setIntentoEnviar(true)
        return
      }
      void handleConfirmMedicion()
      return
    }
    if (esRamaDosPage) {
      avanzarAPaso2()
      return
    }
    void handleConfirmCierre()
  }

  const primaryLabel =
    paso === 2
      ? cerrarConMedicion.isSubmitting
        ? 'Finalizando…'
        : 'Finalizar tratamiento'
      : esRamaDosPage
        ? 'Continuar'
        : isSubmitting
          ? 'Finalizando…'
          : 'Finalizar tratamiento'

  const primaryDisabled =
    paso === 2
      ? cerrarConMedicion.isSubmitting || campos.length === 0
      : isSubmitting || estructura.isLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={paso === 2 ? 'sm:max-w-xl' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-foreground">
            Finalizar tratamiento
          </DialogTitle>
          {paso === 1 && (
            <DialogDescription className="text-muted-foreground">
              Registrá el cierre de la etapa activa. Esta acción no se puede
              deshacer.
            </DialogDescription>
          )}
        </DialogHeader>

        {paso === 1 && (
          <>
            <RadioGroup
              value={estado}
              onValueChange={(value) => setEstado(value as EstadoCierre)}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem
                  value="finalizada"
                  id="cierre-estado-finalizada"
                />
                <Label htmlFor="cierre-estado-finalizada">Finalizado</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem
                  value="abandonada"
                  id="cierre-estado-abandonada"
                />
                <Label htmlFor="cierre-estado-abandonada">Abandonado</Label>
              </div>
            </RadioGroup>

            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo del cierre (opcional)"
              disabled={isSubmitting}
              rows={3}
            />

            {mostrarAvisoSinMedicion && (
              <Alert>
                <AlertDescription>
                  Se va a guardar el último estado registrado como cierre sin
                  medición.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {paso === 2 && errorMedicion !== null && (
          <MedicionNotice tone="error">{errorMedicion}</MedicionNotice>
        )}

        {paso === 2 && (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <MedicionForm
              campos={campos}
              valores={valores}
              errores={erroresVisiblesMedicion(errores, tocados, intentoEnviar)}
              momento="cierre"
              modo="crear"
              isSubmitting={cerrarConMedicion.isSubmitting}
              canSubmit={canSubmitMedicion}
              onChange={onChangeValorMedicion}
              onBlur={marcarTocado}
              onSubmit={handlePrimary}
              onCancel={() => onOpenChange(false)}
              columnas={2}
              acciones="ninguna"
              intro="Se va a guardar como la medición de cierre y la etapa se va a finalizar. Después de confirmar no se puede borrar."
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSubmitting || cerrarConMedicion.isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button disabled={primaryDisabled} onClick={handlePrimary}>
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { FinalizarTratamientoDialog }
export type { FinalizarTratamientoDialogProps }
