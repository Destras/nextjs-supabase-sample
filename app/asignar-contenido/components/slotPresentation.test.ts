import { SLOT_PRESENTATION } from './slotPresentation'

describe('SLOT_PRESENTATION', () => {
  it('heads each column with the short name used in the Contenido tab of the patient record, so no header is cut off in a narrow column (BETA-026)', () => {
    expect(
      SLOT_PRESENTATION.map(({ slot, headerLabel }) => [slot, headerLabel]),
    ).toEqual([
      ['meditacion', 'Meditación'],
      ['mantra', 'Mantra'],
      ['egregor', 'Egregor'],
      ['cma', 'CMA'],
      ['ic', 'IC'],
      ['frases', 'Frases'],
    ])
  })
})
