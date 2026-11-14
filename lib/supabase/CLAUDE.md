## Supabase Auth — CRITICAL

ALWAYS use `@supabase/ssr`. NEVER use `@supabase/auth-helpers-nextjs`.

Cookie handling MUST use ONLY `getAll` and `setAll`.
NEVER use individual `get`, `set`, or `remove` cookie methods — they BREAK auth.

Browser client: use `createBrowserClient` from `@supabase/ssr`
Server client: use `createServerClient` from `@supabase/ssr`
Middleware: ALWAYS call `supabase.auth.getUser()` and return the supabaseResponse object as-is.
