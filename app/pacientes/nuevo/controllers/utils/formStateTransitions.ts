import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import { toggleIdInArray } from './toggleIdInArray'

interface DiagnosticoPlanState {
  readonly diagnostico: {
    readonly causaId: string | null
    readonly bloqueoIds: ReadonlyArray<string>
    readonly algoritmoId: string | null
  }
  readonly plan: {
    readonly modalidadId: string | null
    readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
  }
}

// Object-spread over a generic `T` widens to an anonymous shape that TS
// cannot verify still satisfies `T` (the compiler has no proof `T` doesn't
// narrow `diagnostico`/`plan` further), so each transition below closes with
// an explicit `as T`. Every call site in this codebase passes a `T` whose
// `diagnostico`/`plan` shape is exactly `DiagnosticoPlanState`, so the cast
// is safe in practice.

const withCausa = <T extends DiagnosticoPlanState>(state: T, id: string): T =>
  ({
    ...state,
    diagnostico: { ...state.diagnostico, causaId: id },
  }) as T

const withBloqueoToggled = <T extends DiagnosticoPlanState>(
  state: T,
  id: string,
): T =>
  ({
    ...state,
    diagnostico: {
      ...state.diagnostico,
      bloqueoIds: toggleIdInArray(state.diagnostico.bloqueoIds, id),
    },
  }) as T

const withAlgoritmo = <T extends DiagnosticoPlanState>(
  state: T,
  id: string,
): T =>
  ({
    ...state,
    diagnostico: { ...state.diagnostico, algoritmoId: id },
  }) as T

const withModalidad = <T extends DiagnosticoPlanState>(
  state: T,
  id: string,
): T =>
  ({
    ...state,
    plan: { ...state.plan, modalidadId: id },
  }) as T

const withAlfabetos = <T extends DiagnosticoPlanState>(
  state: T,
  alfabetos: ReadonlyArray<AlfabetoConNumeros>,
): T =>
  ({
    ...state,
    plan: { ...state.plan, alfabetos },
  }) as T

export {
  withCausa,
  withBloqueoToggled,
  withAlgoritmo,
  withModalidad,
  withAlfabetos,
}
export type { DiagnosticoPlanState }
