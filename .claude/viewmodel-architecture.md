# ViewModel Architecture

## The Rule

Every page must have a `controllers/` subfolder containing a `use[PageName]ViewModel.ts` hook and a barrel `index.ts`. Components are **purely presentational** — they receive props and return JSX, nothing else.

This is a hard constraint. Claude must never write logic inside a component body.

---

## What belongs where

### ViewModel hook (`use[PageName]ViewModel.ts`)

Everything that is not JSX:

- `useState`, `useReducer`, `useEffect`, `useRef`
- Event handlers (`handleSubmit`, `handleChange`, `handleClick`, …)
- API calls and Supabase operations
- Form validation
- Derived / computed values
- Navigation (`useRouter`)
- Loading state, error state, success state
- Any conditional logic based on state

### Component (`page.tsx` or any child component)

Only JSX. A component body must contain:

- Destructuring of props
- A `return (…)` with JSX
- Nothing else

---

## File naming and location

The ViewModel hook lives inside the page's `controllers/` subfolder — never at the page root:

```
app/
  auth/
    login/
      controllers/
        useLoginViewModel.ts   ← owns all logic
        index.ts               ← re-exports hook and type
      LoginView.tsx            ← pure presentational
      page.tsx                 ← imports from "./controllers", passes all props
      layout.tsx
```

Naming: `use[PageName]ViewModel.ts` — PascalCase page name, no abbreviations.

---

## Props drilling

The **page** component is the only place that calls the ViewModel. It destructures the return value and passes every piece of data and every handler as explicit props to child components. No context, no Zustand, no prop-less magic imports inside children.

```tsx
// page.tsx
export default function LoginPage() {
  const vm = useLoginViewModel()
  return <LoginForm {...vm} />
}
```

Child components declare a typed props interface and receive everything they need as props.

---

## Concrete example

### ❌ Wrong — logic inside the component

```tsx
'use client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return <form onSubmit={handleSubmit}>…</form>
}
```

### ✅ Correct — ViewModel owns all logic

```ts
// useLoginViewModel.ts
'use client'

export interface LoginViewModel {
  email: string
  password: string
  error: string | null
  isLoading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
}

export function useLoginViewModel(): LoginViewModel {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    email,
    password,
    error,
    isLoading,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onSubmit,
  }
}
```

```ts
// controllers/index.ts
export { useLoginViewModel } from './useLoginViewModel'
export type { LoginViewModel } from './useLoginViewModel'
```

```tsx
// page.tsx
'use client'

import { useLoginViewModel } from './controllers'
import { LoginView } from './LoginView'

export default function LoginPage() {
  const vm = useLoginViewModel()
  return <LoginView {...vm} />
}
```

```tsx
// LoginView.tsx — purely presentational
import type { LoginViewModel } from './controllers'

export function LoginView({
  email,
  password,
  error,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginViewModel) {
  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={(e) => onEmailChange(e.target.value)} />
      <input
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
      />
      {error && <p>{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Sign in'}
      </button>
    </form>
  )
}
```

---

## Enforcement checklist

Before writing any component, verify:

- [ ] A `use[PageName]ViewModel.ts` exists inside `controllers/` (not at the page root)
- [ ] The component file contains zero `useState`, `useEffect`, `useRouter`, or API calls
- [ ] Every handler and state value is passed as an explicit prop
- [ ] The ViewModel exports a typed interface consumed by all child components
- [ ] `page.tsx` and View components import from `"./controllers"` only — never from individual files inside `controllers/`
