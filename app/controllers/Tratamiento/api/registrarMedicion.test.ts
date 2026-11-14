import { callMedicionRpc } from './callMedicionRpc'
import { registrarMedicion } from './registrarMedicion'

jest.mock('./callMedicionRpc')

describe('registrarMedicion', () => {
  it('calls registrar_medicion with the etapaId, valores and medicionPreviaId params', async () => {
    ;(callMedicionRpc as jest.Mock).mockResolvedValue({
      data: 'med-1',
      error: null,
    })

    await registrarMedicion({
      etapaId: 'etapa-1',
      valores: {
        estructura_general: 55,
        centros: [{ centro_id: 'c-1', valor: 70 }],
      },
      medicionPreviaId: null,
    })

    expect(callMedicionRpc).toHaveBeenCalledWith('registrar_medicion', {
      p_etapa_id: 'etapa-1',
      p_valores: {
        estructura_general: 55,
        centros: [{ centro_id: 'c-1', valor: 70 }],
      },
      p_medicion_previa_id: null,
    })
  })

  it('returns the result from callMedicionRpc unchanged', async () => {
    const rpcResult = { data: 'med-1', error: null }
    ;(callMedicionRpc as jest.Mock).mockResolvedValue(rpcResult)

    const result = await registrarMedicion({
      etapaId: 'etapa-1',
      valores: { estructura_general: 55, centros: [] },
      medicionPreviaId: 'med-0',
    })

    expect(result).toEqual(rpcResult)
  })
})
