import { ROLE } from '@/app/controllers/Auth'
import type { Profile } from '@/app/controllers/Auth'

enum TERAPEUTA_STATE {
  PENDIENTE = 'pendiente',
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

interface Terapeuta {
  readonly id: string
  readonly profile: Profile
  readonly role: ROLE.TERAPEUTA
  readonly state: TERAPEUTA_STATE
  readonly email: string
  readonly telefono: string | null
  readonly pacientesActivos: number
  // Task 2.3: sourced by list_terapeutas (task 2.1's alertas_activas
  // rewire). Optional porque get_terapeuta/update_terapeuta todavía no
  // exponen esta columna — undefined en esos flows, siempre presente
  // (int no-nulo) cuando viene de useFetchAllTerapeutas.
  readonly alertasActivas?: number
  // DEC-12 (feat/inicio-tratamiento, post-implementación): compensación de
  // la baja de la alerta contenido_pendiente — count de pacientes activos
  // del terapeuta cuya etapa activa tiene fecha_inicio is null. Sourced by
  // list_terapeutas (mismo patrón que alertasActivas): opcional porque
  // get_terapeuta/update_terapeuta todavía no exponen esta columna —
  // undefined en esos flows, siempre presente (int no-nulo) cuando viene de
  // useFetchAllTerapeutas.
  readonly sinIniciar?: number
}

// Fila del rollup para el dashboard admin: el terapeuta + las métricas
// agregadas de su caseload (score promedio y alertas, Tier B → null sin evals).
interface TerapeutaRollup {
  readonly id: string
  readonly nombre: string
  readonly estado: TERAPEUTA_STATE
  readonly pacientesActivos: number
  readonly scorePromedio: number | null
  readonly alertasActivas: number | null
}

export type { Terapeuta, TerapeutaRollup }
export { TERAPEUTA_STATE }
