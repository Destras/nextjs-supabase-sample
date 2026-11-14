import type { PacienteEditData } from '../PacienteTypes'
import { agruparAlfabetos } from './agruparAlfabetos'
import { etapaSortKey } from '@/app/utils/etapaSortKey'

interface NivelEditRaw {
  readonly fecha_seguimiento_real: string | null
  readonly nivel_evaluacion: { readonly id: string } | null
}

interface EtapaEditRaw {
  readonly id: string
  readonly causa_id: string | null
  readonly algoritmo_id: string | null
  readonly modalidad_id: string | null
  readonly fecha_inicio: string | null
  readonly created_at: string | null
  readonly fecha_finalizacion: string | null
  readonly etapa_bloqueos: ReadonlyArray<{ readonly bloqueo_id: string }>
  readonly etapa_alfabetos: ReadonlyArray<{
    readonly alfabeto_id: string
    readonly numero: number
    readonly alfabetos: { readonly orden: number } | null
  }>
  readonly niveles: ReadonlyArray<NivelEditRaw>
  readonly entregas_plan: ReadonlyArray<{
    readonly fecha_entregada: string | null
  }>
}

interface PacienteEditRaw {
  readonly pacientes: {
    readonly nombre: string
    readonly telefono: string | null
    readonly email: string | null
    readonly fecha_nacimiento: string | null
    readonly user_id: string | null
    readonly etapas_tratamiento: ReadonlyArray<EtapaEditRaw>
  } | null
}

const mapAsignacionToPacienteEditData = (
  raw: PacienteEditRaw,
): PacienteEditData => {
  const paciente = raw.pacientes
  const etapas = paciente?.etapas_tratamiento ?? []
  // Si por anomalía de datos hubiera más de una etapa sin finalizar, elegimos
  // la misma que edita el RPC update_etapa_diagnostico: orden por
  // coalesce(fecha_inicio, created_at) desc y, a igualdad, created_at desc.
  // Coalesce (no un simple fecha_inicio desc) porque una etapa sin arrancar
  // (fecha_inicio null, DEC-11) no puede sortear ni siempre-primera ni
  // siempre-última — su antigüedad real es su created_at. Mismo criterio que
  // `etapaSortKey` (app/utils/etapaSortKey.ts, compartido con Tratamiento).
  // Así la UI hidrata la etapa que el guardado va a tocar (evita mostrar una
  // etapa y escribir otra).
  const desc = (a: string, b: string): number => b.localeCompare(a)
  const etapaActiva =
    [...etapas]
      .filter((e) => e.fecha_finalizacion === null)
      .sort(
        (a, b) =>
          desc(
            etapaSortKey(a.fecha_inicio, a.created_at),
            etapaSortKey(b.fecha_inicio, b.created_at),
          ) || desc(a.created_at ?? '', b.created_at ?? ''),
      )[0] ?? null

  const etapaFresca =
    etapaActiva !== null &&
    etapaActiva.niveles.every(
      (n) => n.fecha_seguimiento_real === null && n.nivel_evaluacion === null,
    ) &&
    (etapaActiva.entregas_plan ?? []).every((e) => e.fecha_entregada === null)

  return {
    identidad: {
      nombre: paciente?.nombre ?? '',
      fechaNacimiento: paciente?.fecha_nacimiento ?? null,
      email: paciente?.email ?? null,
      telefono: paciente?.telefono ?? null,
    },
    diagnostico: {
      causaId: etapaActiva?.causa_id ?? null,
      algoritmoId: etapaActiva?.algoritmo_id ?? null,
      modalidadId: etapaActiva?.modalidad_id ?? null,
      bloqueoIds: (etapaActiva?.etapa_bloqueos ?? []).map((b) => b.bloqueo_id),
      // Orden del catálogo (DEC-01): agruparAlfabetos respeta el orden de
      // primera aparición, así que ordenamos las filas por `orden` antes de
      // agrupar. Sin esto el form arranca en el orden de la base.
      alfabetos: agruparAlfabetos(
        [...(etapaActiva?.etapa_alfabetos ?? [])].sort(
          (a, b) =>
            (a.alfabetos?.orden ?? Infinity) - (b.alfabetos?.orden ?? Infinity),
        ),
      ),
    },
    etapaId: etapaActiva?.id ?? null,
    etapaFresca,
    // "Activación" (CONTEXT.md): termina cuando pacientes.user_id queda vinculado.
    tieneCuenta: (paciente?.user_id ?? null) !== null,
  }
}

export type { PacienteEditRaw }
export { mapAsignacionToPacienteEditData }
