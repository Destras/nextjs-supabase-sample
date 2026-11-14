import type { Config } from 'jest'
import nextJest from 'next/jest.js'

// Zona horaria fija para toda la suite: el panel se usa en Argentina (UTC-3) y los
// tests de fechas "de día" (fechaDia, semanaActual, mesActual…) arman instantes
// locales. Sin esto pasan en vacío en una máquina/CI en UTC. Los workers heredan
// la variable.
process.env.TZ = 'America/Argentina/Buenos_Aires'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Cap workers so the machine is not saturated; event-loop starvation under
  // full parallelism is what makes async hook tests flake on real timers.
  maxWorkers: '50%',
  roots: ['<rootDir>/app', '<rootDir>/components', '<rootDir>/lib'],
  testMatch: [
    '<rootDir>/app/**/*.test.ts',
    '<rootDir>/components/**/*.test.ts',
    '<rootDir>/lib/**/*.test.ts',
  ],
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // @uppy/* packages ship ESM-only and cannot be parsed by Jest's CJS
    // transformer. Redirect to hand-written stubs so tests that import the
    // Contenido barrel (which re-exports useUploadContenidoMedia) don't fail.
    // useUploadContenidoMedia.test.ts overrides the stub with a factory mock.
    '^@uppy/core$': '<rootDir>/__mocks__/@uppy/core.ts',
    '^@uppy/tus$': '<rootDir>/__mocks__/@uppy/tus.ts',
  },
}

export default createJestConfig(config)
