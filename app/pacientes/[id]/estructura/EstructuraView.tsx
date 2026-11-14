import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MedicionForm } from '@/components/mediciones'
import type { EstructuraTabViewModel } from './controllers'
import { CentrosList } from './components/CentrosList'
import { ConfirmarMedicionDialog } from './components/ConfirmarMedicionDialog'
import { EstructuraEmptyState } from './components/EstructuraEmptyState'
import { EstructuraErrorState } from './components/EstructuraErrorState'
import { EstructuraLoadingState } from './components/EstructuraLoadingState'
import { EstructuraResumen } from './components/EstructuraResumen'
import { EstructuraSinEtapaState } from './components/EstructuraSinEtapaState'
import { MedicionNotice } from './components/MedicionNotice'

// Copy verbatim DevSpec §7.2 — intro del formulario, según haya o no
// medición previa que precargar.
const introFormulario = (tieneMedicionPrevia: boolean): string =>
  tieneMedicionPrevia
    ? 'Los campos vienen cargados con la medición anterior. Ajustá lo que cambió. Todos los centros son obligatorios. Un valor puede bajar.'
    : 'Es la primera medición de la etapa: los campos arrancan vacíos. Todos los centros son obligatorios. Un valor puede bajar.'

// Pura: compone todo (design §5.2). La jerarquía visual sigue DevSpec §7.1 —
// banners → card única con hero + sparkline → divisor → lista de centros →
// drill-down inline. El `est-demo` (conmutador de estados) y el botón
// "simular error" del mock NO se implementan (§9.8) — son andamiaje de la
// demo.
const EstructuraView = (vm: EstructuraTabViewModel) => {
  const {
    isLoading,
    error,
    puedeMedir,
    hayEtapas,
    etapaIniciada,
    medicionActual,
    medicionPrevia,
    serie,
    centros,
    centroAbiertoId,
    centroDetalle,
    onToggleCentro,
    modoFormulario,
    campos,
    valores,
    errores,
    momentoPrevisto,
    canSubmit,
    isSubmitting,
    onAbrirNueva,
    onAbrirEdicion,
    onChangeCampo,
    onCancelarFormulario,
    confirmacionAbierta,
    onPedirConfirmacion,
    onConfirmar,
    onCancelarConfirmacion,
    notices,
    onReintentar,
  } = vm

  if (isLoading) return <EstructuraLoadingState />
  if (error !== null) return <EstructuraErrorState onRetry={onReintentar} />

  const noticesBlock = notices.length > 0 && (
    <div className="flex flex-col gap-2">
      {notices.map((n, i) => (
        <MedicionNotice key={i} tone={n.tone}>
          {n.texto}
        </MedicionNotice>
      ))}
    </div>
  )

  if (!hayEtapas || !etapaIniciada) {
    return (
      <div className="flex flex-col gap-4">
        {noticesBlock}
        <EstructuraSinEtapaState />
      </div>
    )
  }

  if (modoFormulario !== 'cerrado') {
    return (
      <div className="flex flex-col gap-4">
        {noticesBlock}
        <Card>
          <CardHeader>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {modoFormulario === 'editar'
                ? 'Editar medición'
                : `Nueva medición · ${momentoPrevisto}`}
            </p>
            <h3 className="font-display text-2xl text-foreground">
              {modoFormulario === 'editar' ? (
                <>
                  Corregir la <em className="not-italic">medición</em>
                </>
              ) : (
                <>
                  Registrar la <em className="not-italic">lectura de hoy</em>
                </>
              )}
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <MedicionForm
              campos={campos}
              valores={valores}
              errores={errores}
              momento={momentoPrevisto}
              modo={modoFormulario}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              onChange={onChangeCampo}
              onSubmit={onPedirConfirmacion}
              onCancel={onCancelarFormulario}
              intro={introFormulario(
                modoFormulario === 'editar' || medicionActual !== null,
              )}
              submitLabel={
                modoFormulario === 'editar'
                  ? 'Guardar cambios'
                  : 'Registrar medición'
              }
            />
          </CardContent>
        </Card>
        <ConfirmarMedicionDialog
          open={confirmacionAbierta}
          momento={momentoPrevisto}
          modo={modoFormulario}
          isSubmitting={isSubmitting}
          onConfirm={onConfirmar}
          onCancel={onCancelarConfirmacion}
        />
      </div>
    )
  }

  if (medicionActual === null) {
    return (
      <div className="flex flex-col gap-4">
        {noticesBlock}
        <EstructuraEmptyState
          puedeMedir={puedeMedir}
          onRegistrar={onAbrirNueva}
        />
      </div>
    )
  }

  const puedeEditar = puedeMedir && medicionActual.editable
  const cantidadMediciones = serie.length

  return (
    <div className="flex flex-col gap-4">
      {noticesBlock}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {cantidadMediciones}{' '}
                {cantidadMediciones === 1 ? 'medición' : 'mediciones'} en esta
                etapa
              </p>
              <h3 className="font-display text-2xl text-foreground">
                Estructura <em className="not-italic">bioenergética</em>
              </h3>
            </div>
            {puedeMedir && (
              <Button type="button" size="sm" onClick={onAbrirNueva}>
                Nueva medición
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <EstructuraResumen
            actual={medicionActual}
            previa={medicionPrevia}
            serie={serie}
            puedeEditar={puedeEditar}
            onEditar={onAbrirEdicion}
          />
          <Separator />
          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Centros energéticos · valor actual y variación
            </p>
            <CentrosList
              centros={centros}
              centroAbiertoId={centroAbiertoId}
              centroDetalle={centroDetalle}
              onToggleCentro={onToggleCentro}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { EstructuraView }
