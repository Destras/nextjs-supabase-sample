# Testing Guide

Mandatory rules for writing tests with Jest + React Testing Library in this repo.

---

## Rule 1 — One `expect` per test case

Each `it` / `test` verifies one and only one assertion. If you need to verify several things, write several test cases.

### ✅ Correct

```ts
it('returns the merged id', () => {
  expect(buildUser(input)).toEqual({ id: '1', name: 'Ana', isAdmin: false })
})

it('returns the merged id for admins', () => {
  expect(buildUser(adminInput)).toEqual({
    id: '2',
    name: 'Bea',
    isAdmin: true,
  })
})
```

### ❌ Wrong

```ts
it('builds a user', () => {
  const result = buildUser(input)
  expect(result.id).toBe('1')
  expect(result.name).toBe('Ana')
  expect(result.isAdmin).toBe(false)
})
```

---

## Rule 2 — Test by whole object, not by property

When a function returns an object, compare the whole thing with `toEqual`. Don't verify property by property.

### ✅ Correct

```ts
expect(mapAsignacionToPaciente(row)).toEqual({
  id: 'p-1',
  nombre: 'Juan',
  terapeutaId: 't-1',
  estado: 'activo',
})
```

### ❌ Wrong

```ts
const paciente = mapAsignacionToPaciente(row)
expect(paciente.id).toBe('p-1')
expect(paciente.nombre).toBe('Juan')
expect(paciente.terapeutaId).toBe('t-1')
expect(paciente.estado).toBe('activo')
```

This combines with Rule 1: whole-object comparison ⇒ a single `expect`.

---

## Rule 3 — One `beforeEach` at the start of the `describe`

Variables shared by test cases are declared at the top of the `describe` and initialized in a single `beforeEach`. No multiple nested `beforeEach` blocks and no scattered initialization inside the `it`s.

### ✅ Correct

```ts
describe('buildUser', () => {
  let input: BuildUserInput
  let expected: User

  beforeEach(() => {
    input = { id: '1', name: 'Ana', role: 'user' }
    expected = { id: '1', name: 'Ana', isAdmin: false }
  })

  it('builds a non-admin user', () => {
    expect(buildUser(input)).toEqual(expected)
  })

  it('builds an admin user when role is admin', () => {
    input.role = 'admin'
    expect(buildUser(input)).toEqual({ ...expected, isAdmin: true })
  })
})
```

### ❌ Wrong

```ts
describe('buildUser', () => {
  it('builds a non-admin user', () => {
    const input = { id: '1', name: 'Ana', role: 'user' } // ❌ setup inside the it
    expect(buildUser(input)).toEqual({
      id: '1',
      name: 'Ana',
      isAdmin: false,
    })
  })

  beforeEach(() => {
    /* ... */
  }) // ❌ beforeEach at the end
  beforeEach(() => {
    /* ... */
  }) // ❌ multiple beforeEach
})
```

---

## Rule 4 — Custom hooks are tested with `renderHook`

Custom hooks (any `use*` function that returns state/effects) are tested using `renderHook` from `@testing-library/react`. Never call them directly outside a component or `renderHook`.

### ✅ Correct

```ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFetchPaciente } from './useFetchPaciente'

describe('useFetchPaciente', () => {
  let pacienteId: string

  beforeEach(() => {
    pacienteId = 'p-1'
  })

  it('returns the paciente when the fetch resolves', async () => {
    const { result } = renderHook(() => useFetchPaciente(pacienteId))
    await waitFor(() => {
      expect(result.current).toEqual({
        paciente: { id: 'p-1', nombre: 'Juan' },
        isLoading: false,
        error: null,
      })
    })
  })
})
```

### ❌ Wrong

```ts
it('returns the paciente', async () => {
  const result = useFetchPaciente('p-1') // ❌ calling a hook outside renderHook
  expect(result.paciente.id).toBe('p-1')
})
```

---

## Rule 5 — Only functions (`.ts`) are tested, never components (`.tsx`)

For now, tests cover **only pure logic and hooks** — `.ts` files. No tests are written for React components (`.tsx`).

This includes:

- ✅ Utilities in `lib/`
- ✅ Mappers in `app/controllers/[Entity]/utils/`
- ✅ Fetch / BE call functions in `app/controllers/[Entity]/api/`
- ✅ Custom hooks (`useFetchX`, `useXViewModel`, etc.) — tested with `renderHook`
- ❌ Presentational components (`*View.tsx`, `page.tsx`, etc.)

When a view needs validation, the behavior already lives in its ViewModel hook — test the hook, not the view.

---

## Rule 6 — Cover every branch of the function

Each function must have a test case for every branch of its logic. This includes:

- Every branch of an `if` / `else` / `switch`
- Every early return
- Every value that produces a distinct result in a ternary
- Edge cases (`null`, `undefined`, empty array, error path, etc.)

A function is not considered "tested" if only the happy path is covered.

### Example

```ts
const classifyAge = (age: number): 'kid' | 'teen' | 'adult' => {
  if (age < 13) return 'kid'
  if (age < 18) return 'teen'
  return 'adult'
}
```

Required tests:

```ts
describe('classifyAge', () => {
  it('returns "kid" for ages below 13', () => {
    expect(classifyAge(12)).toBe('kid')
  })

  it('returns "teen" for ages between 13 and 17', () => {
    expect(classifyAge(15)).toBe('teen')
  })

  it('returns "adult" for ages 18 or above', () => {
    expect(classifyAge(18)).toBe('adult')
  })
})
```

Three branches → three test cases. Testing only `'adult'` is not enough.

---

## Rule 7 — Factory module mocks: use the imported symbol directly

When you mock a module by passing an inline factory to `jest.mock` (e.g. `jest.mock('@/app/controllers/Auth', () => ({ useCurrentUserId: jest.fn() }))`), do not store the `jest.Mock` in a `describe`-level variable. Use the imported symbol directly with a cast to `jest.Mock`, set the default value in `beforeEach`, and override it per-test when needed.

### ✅ Correct

```ts
import { useCurrentUserId } from '@/app/controllers/Auth'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserId: jest.fn(),
}))

describe('usePacientesViewModel', () => {
  beforeEach(() => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: 't-1',
      error: null,
      isLoading: false,
    })
  })

  it('reports isLoading true while the auth hook is still resolving', () => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: null,
      error: null,
      isLoading: true,
    })
    // ... renderHook + expect
  })
})
```

### ❌ Wrong

```ts
describe('usePacientesViewModel', () => {
  let mockUseCurrentUserId: jest.Mock // ❌ intermediate variable

  beforeEach(() => {
    mockUseCurrentUserId = useCurrentUserId as unknown as jest.Mock
    mockUseCurrentUserId.mockReset() // ❌ manual reset; clearMocks already does it
  })

  it(/* ... */, () => {
    mockUseCurrentUserId.mockReturnValue({
      /* ... */
    }) // ❌ via the variable
  })
})
```

### Notes

- The inline cast `(useCurrentUserId as jest.Mock)` is the chosen style. Do not use `jest.mocked(...)`.
- Manual `mockReset()` / `mockClear()` is not needed: `jest.config.ts` has `clearMocks: true`, so call history and `mockReturnValue` are cleaned between `it`s automatically. If a test needs a value different from the default, declare it explicitly at the start of the `it`.
- This rule applies **only** to factory mocks (`jest.mock(path, () => ({ ... }))`). For auto-mocks (`jest.mock(path)`) or sub-object mocks (e.g. `verifyOtp = jest.fn()` inside a mocked client), follow the previous pattern.

---

## Review checklist

Before considering any test file done, verify:

- [ ] Each `it` contains exactly one `expect`
- [ ] Object comparisons use `toEqual` on the whole object, not property by property
- [ ] There is a single `beforeEach` per `describe`, declared at the start, where shared variables are initialized
- [ ] Custom hooks are tested with `renderHook` from `@testing-library/react`
- [ ] The file under test is `.ts` (not `.tsx`)
- [ ] Every logical branch of the function under test has its own test case
- [ ] Factory mocks use the imported symbol directly (`(X as jest.Mock).mockReturnValue(...)`), not an intermediate `let mockX` variable
