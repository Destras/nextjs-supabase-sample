import { callMedicionRpc } from './callMedicionRpc'
import { editarMedicion } from './editarMedicion'

jest.mock('./callMedicionRpc')

describe('editarMedicion', () => {
  it('calls editar_medicion with the medicionId and valores params', async () => {
    ;(callMedicionRpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    })

    await editarMedicion({
      medicionId: 'med-1',
      valores: {
        estructura_general: 60,
        centros: [{ centro_id: 'c-1', valor: 80 }],
      },
    })

    expect(callMedicionRpc).toHaveBeenCalledWith('editar_medicion', {
      p_medicion_id: 'med-1',
      p_valores: {
        estructura_general: 60,
        centros: [{ centro_id: 'c-1', valor: 80 }],
      },
    })
  })

  it('returns the result from callMedicionRpc unchanged', async () => {
    const rpcResult = { data: null, error: null }
    ;(callMedicionRpc as jest.Mock).mockResolvedValue(rpcResult)

    const result = await editarMedicion({
      medicionId: 'med-1',
      valores: { estructura_general: 60, centros: [] },
    })

    expect(result).toEqual(rpcResult)
  })
})
