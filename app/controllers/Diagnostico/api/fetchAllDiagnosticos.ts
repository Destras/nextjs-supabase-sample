'use client'

import { createClient } from '@/lib/supabase/client'
import type { AllDiagnosticos } from '../DiagnosticoTypes'
import type { CausaRowRaw } from '../utils/mapCausaRow'
import { mapCausaRow } from '../utils/mapCausaRow'
import type { AlgoritmoRowRaw } from '../utils/mapAlgoritmoRow'
import { mapAlgoritmoRow } from '../utils/mapAlgoritmoRow'
import type { BloqueoRowRaw } from '../utils/mapBloqueoRow'
import { mapBloqueoRow } from '../utils/mapBloqueoRow'
import type { ModalidadRowRaw } from '../utils/mapModalidadRow'
import { mapModalidadRow } from '../utils/mapModalidadRow'
import type { AlfabetoRowRaw } from '../utils/mapAlfabetoRow'
import { mapAlfabetoRow } from '../utils/mapAlfabetoRow'

const fetchAllDiagnosticos = async (): Promise<{
  data: AllDiagnosticos | null
  error: Error | null
}> => {
  const supabase = createClient()

  const [causasRes, algoritmosRes, bloqueosRes, modalidadesRes, alfabetosRes] =
    await Promise.all([
      supabase
        .from('causas')
        .select(
          `id, codigo, nombre, definicion, emociones_esperadas, activo, causa_etapas ( numero_etapa, frase_esperada )`,
        )
        .eq('activo', true),
      supabase
        .from('algoritmos')
        .select(
          `id, codigo, nombre, definicion, comportamiento, activo, algoritmo_etapas ( numero_etapa, frase_esperada )`,
        )
        .eq('activo', true),
      supabase
        .from('bloqueos')
        .select(`id, codigo, nombre, descripcion, activo`)
        .eq('activo', true),
      supabase
        .from('modalidades')
        .select(`*, tipos_disco ( nombre )`)
        .eq('activo', true),
      supabase
        .from('alfabetos')
        .select('id, codigo, nombre, descripcion, rango_max, orden, activo')
        .eq('activo', true)
        .order('orden'),
    ])

  const firstError =
    causasRes.error ??
    algoritmosRes.error ??
    bloqueosRes.error ??
    modalidadesRes.error ??
    alfabetosRes.error
  if (firstError) {
    return { data: null, error: new Error(firstError.message) }
  }

  return {
    data: {
      causa: (causasRes.data as unknown as CausaRowRaw[]).map(mapCausaRow),
      algoritmo: (algoritmosRes.data as unknown as AlgoritmoRowRaw[]).map(
        mapAlgoritmoRow,
      ),
      bloqueos: (bloqueosRes.data as unknown as BloqueoRowRaw[]).map(
        mapBloqueoRow,
      ),
      modalidades: (modalidadesRes.data as unknown as ModalidadRowRaw[]).map(
        mapModalidadRow,
      ),
      alfabetos: (alfabetosRes.data as unknown as AlfabetoRowRaw[]).map(
        mapAlfabetoRow,
      ),
    },
    error: null,
  }
}

export { fetchAllDiagnosticos }
