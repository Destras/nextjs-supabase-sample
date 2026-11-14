import {
  readStoredCatalogViewMode,
  writeStoredCatalogViewMode,
} from './catalogViewModeStorage'

describe('catalogViewModeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('readStoredCatalogViewMode', () => {
    it('returns tabla when tabla is stored', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      expect(readStoredCatalogViewMode()).toBe('tabla')
    })

    it('returns cards when cards is stored', () => {
      window.localStorage.setItem('contenido.vista', 'cards')
      expect(readStoredCatalogViewMode()).toBe('cards')
    })

    it('returns null when nothing is stored', () => {
      expect(readStoredCatalogViewMode()).toBeNull()
    })

    it('returns null when the stored value is not a view mode', () => {
      window.localStorage.setItem('contenido.vista', 'foo')
      expect(readStoredCatalogViewMode()).toBeNull()
    })

    it('returns null when reading the storage throws', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      expect(readStoredCatalogViewMode()).toBeNull()
    })
  })

  describe('writeStoredCatalogViewMode', () => {
    it('stores tabla', () => {
      writeStoredCatalogViewMode('tabla')
      expect(window.localStorage.getItem('contenido.vista')).toBe('tabla')
    })

    it('stores cards', () => {
      writeStoredCatalogViewMode('cards')
      expect(window.localStorage.getItem('contenido.vista')).toBe('cards')
    })

    it('does not throw when writing the storage throws', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })
      expect(() => writeStoredCatalogViewMode('tabla')).not.toThrow()
    })
  })
})
