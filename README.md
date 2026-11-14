# Aurora — Web console

Panel web de un producto real: una plataforma con la que un terapeuta gestiona a sus pacientes y les entrega contenido de tratamiento semana a semana. Stack: Next.js (App Router), shadcn/ui, Supabase (Postgres, RLS, Edge Functions) y Jest/Playwright.

## Sobre esta versión pública

Este repositorio es una **copia de muestra** del proyecto, publicada como portfolio. Respecto del original:

- **La marca, el cliente y los datos son ficticios.** "Aurora" reemplaza al nombre real; el catálogo clínico, los documentos legales y los usuarios del seed son inventados.
- **Los flujos de autenticación del paciente están omitidos.** Las Edge Functions `patient-activation`, `paciente-auth` y `paciente-invitacion`, y las funciones SQL de OTP, no se incluyen o quedan como stub. Ver [`supabase/functions/README.md`](supabase/functions/README.md).
- **Las specs de producto y de desarrollo no se incluyen.** El código y los skills de `.claude/` mencionan rutas como `.docs/features/...`, el vault de producto o los repos `app-paciente` y `whatsapp-templates`, que no forman parte de esta copia.
- **Las credenciales del seed son solo locales.** Ver [`supabase/seed-credentials.md`](supabase/seed-credentials.md).

Lo que sí está completo: la arquitectura ViewModel/controllers del panel, el schema declarativo con sus migraciones y políticas RLS (documentadas en [`docs/rls/`](docs/rls/)), los ADRs en [`docs/adr/`](docs/adr/) y el tooling de agentes en [`.claude/`](.claude/) (gates de TDD, fidelidad de UI y entidades).

## Steps to run

### Environments variables

Rename `.env.example` to `.env.local` and update the following:

```env
NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
```

> [!NOTE]
> This example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which refers to Supabase's new **publishable** key format.
> Both legacy **anon** keys and new **publishable** keys can be used with this variable name during the transition period. Supabase's dashboard may show `NEXT_PUBLIC_SUPABASE_ANON_KEY`; its value can be used in this example.
> See the [full announcement](https://github.com/orgs/supabase/discussions/29260) for more information.

Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

### Link Supabase project

run

```bash
npx supabase login
# To get tu-project-ref go to go to the project dashboard Settings → General → Reference ID or take it from the URL
npx supabase link --project-ref <tu-project-ref>
```

### Run command!

You can now run the Next.js local development server:

```bash
npm run dev
```

The starter kit should now be running on [localhost:3000](http://localhost:3000/).

### Supabase local developing

Make sure you hace docker running
Run

```bash
npx supabase start
```

This will start a docker image for supabase local and will prompt some info:

- The supabas studio link link (http://127.0.0.1:54323)[http://127.0.0.1:54323]
- APIs > project URL: http://127.0.0.1:54321
- Authentication Keys > Publishable: sb*publishable*...

Then to make your local development point to this image you need to change the .env.local with the info prompter before

NEXT_PUBLIC_SUPABASE_URL=project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=Authentication Keys > Publishable

### WSL docker startup

```bash
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```
