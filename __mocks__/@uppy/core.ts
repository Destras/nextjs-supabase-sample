// Stub for @uppy/core — used by Jest for tests that don't explicitly mock
// this module. Prevents ESM parse errors when the Contenido barrel is imported
// transitively.
const Uppy = jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  use: jest.fn().mockReturnThis(),
  cancelAll: jest.fn(),
  destroy: jest.fn(),
}))

export default Uppy
export { Uppy }
