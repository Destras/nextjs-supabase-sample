import { callMedicionRpc } from './callMedicionRpc'
import { cerrarEtapaConMedicion } from './cerrarEtapaConMedicion'

jest.mock('./callMedicionRpc')

describe('cerrarEtapaConMedicion', () => {
  it('calls cerrar_etapa_con_medicion with all params by name', async () => {
    ;(callMedicionRpc as jest.Mock).mockResolvedValue({
      data: 'med-cierre',
      error: null,
    })

    await cerrarEtapaConMedicion({
      pacienteId: 'p-1',
      motivo: 'Alta',
      valores: {
        estructura_general: 90,
        centros: [{ centro_id: 'c-1', valor: 95 }],
      },
      medicionPreviaId: 'med-1',
    })

    expect(callMedicionRpc).toHaveBeenCalledWith('cerrar_etapa_con_medicion', {
      p_paciente_id: 'p-1',
      p_motivo: 'Alta',
      p_valores: {
        estructura_general: 90,
        centros: [{ centro_id: 'c-1', valor: 95 }],
      },
      p_medicion_previa_id: 'med-1',
    })
  })

  it('passes motivo as null explicitly when not provided', async () => {
    ;(callMedicionRpc as jest.Mock).mockResolvedValue({
      data: 'med-cierre',
      error: null,
    })

    await cerrarEtapaConMedicion({
      pacienteId: 'p-1',
      motivo: null,
      valores: { estructura_general: 90, centros: [] },
      medicionPreviaId: null,
    })

    expect(callMedicionRpc).toHaveBeenCalledWith(
      'cerrar_etapa_con_medicion',
      expect.objectContaining({ p_motivo: null }),
    )
  })

  it('returns the result from callMedicionRpc unchanged', async () => {
    const rpcResult = { data: 'med-cierre', error: null }
    ;(callMedicionRpc as jest.Mock).mockResolvedValue(rpcResult)

    const result = await cerrarEtapaConMedicion({
      pacienteId: 'p-1',
      motivo: null,
      valores: { estructura_general: 90, centros: [] },
      medicionPreviaId: null,
    })

    expect(result).toEqual(rpcResult)
  })
})
