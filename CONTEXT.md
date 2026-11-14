# Domain Context — Aurora

## Product purpose

Aurora digitalizes a bioenergetic therapy protocol. The therapist loads a treatment plan once and the system automates all weekly content delivery, motivational phrases, monthly evaluations, and low-score alerts for months afterward — without manual intervention.

**Core milestone:** The plan is considered working end-to-end when a single real patient has been onboarded, diagnosed, assigned a plan, and begins receiving weekly content automatically.

---

## Shared entity controllers (`app/controllers/`)

Six first-level domain entities cover the entire data model used across features.
All consumers import exclusively from the entity's `index.ts` barrel — never from internal files.

### 1. Paciente (`app/controllers/Paciente/`)

The central entity. Represents a patient assigned to a therapist.

**Domain types (`PacienteTypes.ts`):**

- `Paciente` — patient profile with id, nombre, nivelActual, ultimaEvaluacion, ultimoScore, tieneScoreBajo, fechaInicioTratamiento
- `NotaClinica` — therapist clinical note with id, pacienteId, terapeutaId, terapeutaNombre, contenido, createdAt

**Public surface (barrel):**

- `useFetchPacientesByTerapeuta` — list patients assigned to the current therapist
- `useFetchPacienteById` — fetch a single patient
- `registerPaciente` — write: create a new patient record
- `reassignPaciente` — write: transfer a patient to another therapist
- `useFetchNotasByPaciente` — list clinical notes for a patient
- `useCreateNotaClinica` — write: create a clinical note
- Types: `Paciente`, `NotaClinica`, `RegisterPacienteParams`, `ReassignPacienteParams`, `UseFetchNotasByPacienteResult`, `UseCreateNotaClinicaResult`

**DB tables touched:** `asignaciones_paciente`, `pacientes`, `notas_clinicas`

---

### 2. Terapeuta (`app/controllers/Terapeuta/`)

Represents a therapist in the system.

**Domain types (`TerapeutaTypes.ts`):**

- `Terapeuta` — id, nombre, matricula, especialidad, activo

**DB tables touched:** `terapeutas`, `profiles`

---

### 3. Tratamiento (`app/controllers/Tratamiento/`)

Encapsulates the complete treatment lifecycle: diagnostic stages, weekly plan levels, objectives, and content deliveries.

**Domain types (`TratamientoTypes.ts`):**

- `EtapaTratamiento` — diagnostic stage (id, pacienteId, causaId, algoritmoId, modalidadId, bloqueoIds, fechaInicio, fechaFinalizacion, notasDiagnostico, estado, modalidad)
- `Nivel` — one week/level inside an active stage (id, etapaId, numeroNivel, fechaInicio, fechaFin, completado)
- `NivelObjetivo` — therapist's objective for a level (nivelId, etapaId, descripcion)
- `EntregaPlan` — a single slot assigned to a week (id, etapaId, numeroSemana, tipoSlot, fraseId, contenidoId). A week has **five** slots, one per content type, all mandatory; the frase is derived, not assigned.
- `SemanaPlan` — aggregate: nivel + objetivo + ReadonlyArray of entregas
- `PlanSemanal` — top-level: ReadonlyArray of SemanaPlan
- `UseTratamientoResult` — composite hook return shape
- `DraftEntrega` — ephemeral draft state in the plan builder UI
- `SlotSelection` — discriminated union for picker selection

**Public surface (barrel):**

- `useTratamiento` — deep hook: chains etapas → niveles → objetivos → entregas into PlanSemanal
- `useFetchEtapasByPaciente`, `useFetchNivelesByEtapa`, `useFetchObjetivosByEtapa`, `useFetchEntregasByEtapa`
- `createEtapaDiagnostico`, `cerrarEtapa`, `guardarPlanSemanal` — writes
- `computeFechaEntregaEsperada`, `selectionToDraftFields`, `validarPlanCompleto`, `buildObjetivosPorNivel` — pure domain utils

**DB tables touched:** `etapas_tratamiento`, `niveles_tratamiento`, `objetivos_nivel`, `entregas_plan`

---

### 4. CatalogoDiagnostico (`app/controllers/CatalogoDiagnostico/`)

Read-only lookup tables used during the diagnostic wizard.

**Domain types (`CatalogoDiagnosticoTypes.ts`):**

- `Causa` — therapeutic cause (id, codigo, nombre, definicion, emocionesEsperadas)
- `Algoritmo` — therapeutic algorithm (id, codigo, nombre, definicion, comportamiento)
- `Bloqueo` — energetic block (id, codigo, nombre, descripcion)
- `Modalidad` — treatment modality/duration (id, codigo, nombre, tipoDiscoId, cantidadSesiones, cantidadNiveles, cadenciaDescripcion, duracionMesesEstimada)

**Public surface (barrel):**

- `useFetchCausasActivas`, `useFetchAlgoritmosActivos`, `useFetchBloqueosActivos`, `useFetchModalidadesActivas`

**DB tables touched:** `causas`, `algoritmos`, `bloqueos`, `modalidades`

---

### 5. BibliotecaContenido (`app/controllers/BibliotecaContenido/`)

The media library: the five content types plus motivational phrases.

**Content types.** A piece of content is exactly one of:

- `VIDEO` — a video meditation.
- `AUDIO` — a mantra.
- `EGREGOR` — a long-form video piece. Same medium as `VIDEO`, distinct clinically; its defining property is that it runs long.
- `CMA` — Control Mental de Acuario. An ordered gallery of images, not a single file.
- `IC` — Ingeniería de la Conciencia. An ordered gallery of images, not a single file.

**Domain types (`BibliotecaContenidoTypes.ts`):**

- `Contenido` — media item (id, tipo, titulo, descripcion, recursoRef, duracionSeg, metadata, activo)
- `Frase` — motivational phrase tied to a Causa (id, causaId, texto, activo)

**Public surface (barrel):**

- `useFetchContenidosByTipo` — filter by tipo array (e.g. `['mantra']`, `['meditacion', 'video']`)
- `useFetchFrasesByCausa` — filter frases for a given causa

**DB tables touched:** `contenidos`, `frases_motivacionales`

---

### 6. Auth (`app/controllers/Auth/`)

Current-user identity. The single seam for resolving who is logged in.

**Public surface (barrel):**

- `useCurrentUserId` — returns `{ userId: string | null, error: string | null, isLoading: boolean }`
- `useCurrentUserRole` — returns the therapist's role in the system

**Rule:** ViewModels MUST call `useCurrentUserId` from this barrel to obtain the logged-in user's id. Direct calls to `supabase.auth.getUser()` in ViewModels are forbidden.

---

## Treatment composition (clinical model)

This is the core clinical model. A **treatment** is one row of `etapas_tratamiento` (the table name says "etapa" but a row is the whole treatment cycle, not a sub-stage). A patient may have several over time, but only **one active** at a time — the one with `fecha_finalizacion IS NULL`. Everything the patient app reads hangs off the active treatment.

A treatment is composed of three layers:

1. **Diagnosis (clinical — never shown to the patient).** Foreign keys on `etapas_tratamiento`:
   - `causa_id` → `causas` — exactly **one** diagnostic cause (the emotional/energetic root).
   - `algoritmo_id` → `algoritmos` — exactly **one** pathological algorithm (the behavioral pattern; 62 algorithms across 18 energy bodies).
   - `etapa_bloqueos` → `bloqueos` (the 12 chakras) and `etapa_alfabetos` → `alfabetos` (the 8 therapeutic alphabets).
2. **Modalidad** (`modalidad_id` → `modalidades`) — defines the **shape and length**: `cantidad_niveles` (how many monthly milestones), `cantidad_sesiones` (discs), and `tipo_disco` (Río / Bosque / Agua). Today every modality has `cantidad_niveles = 4`.
3. **Niveles** (`niveles`, `numero_nivel` 1..N) — the **monthly follow-up milestones**. One nivel = one **mes de tratamiento** = exactly 4 weeks (28 days) of content — never a calendar month (ADR 0011). Each nivel carries `fecha_seguimiento_esperada` (when the control is due) and `fecha_seguimiento_real` (when the therapist actually closed it). A nivel may have one `nivel_evaluacion` row: the patient's monthly self-evaluation (`score` 1–5).

### Expected improvements per nivel — `causa_etapas` + `algoritmo_etapas`

Both `causas` and `algoritmos` carry a **per-nivel expected-improvement table**, and they work in parallel:

- `causa_etapas (causa_id, numero_etapa, frase_esperada)` — the **emotional** improvement expected at each nivel.
- `algoritmo_etapas (algoritmo_id, numero_etapa, frase_esperada)` — the **behavioral** improvement expected at each nivel.

**Key invariant:** `numero_etapa` in these two tables maps **1:1 to `niveles.numero_nivel`** (both run 1..N; today 1..4). There is **no intermediate "etapa/fase" layer** in the patient model. For the patient on nivel `K`, the two expected improvements are `causa_etapas.frase_esperada` and `algoritmo_etapas.frase_esperada` where `numero_etapa = K`.

The monthly self-evaluation asks the patient **two questions** — how represented they feel (1–5) by the causa's expected improvement and by the algoritmo's. Both scores are **averaged** into a single `nivel_evaluacion.score` (stored as `numeric(2,1)`, since the average of two 1–5 integers lands on `.0`/`.5`). The two raw component scores are not persisted today — only the average (see `.docs/features/patientReadWrite/DevSpec.md` §16 for the multi-item evolution that would keep them).

> ⚠️ **Do not confuse with the admin dashboard.** The only place that computes `etapa = ceil(numero_nivel / 2)` is `app/(dashboard)/controllers/utils/deriveDistribuciones.ts` — a purely analytical bucketing of patients into 4 groups for a distribution chart. That `ceil(/2)` has **nothing to do** with the nivel→expected-improvement mapping, which is strictly 1:1. The mobile patient contract (`get_mi_evaluacion_vigente`, `get_mi_tratamiento_activo`) must use `numero_etapa = numero_nivel`, not `ceil(/2)`. See `.docs/features/patientReadWrite/DevSpec.md`.

```
etapas_tratamiento (one active treatment)
  ├── causa      → causa_etapas      (numero_etapa = nivel → frase emocional)
  ├── algoritmo  → algoritmo_etapas  (numero_etapa = nivel → frase conductual)
  ├── modalidad  → cantidad_niveles, cantidad_sesiones, tipo_disco
  └── niveles (numero_nivel 1..N, monthly)
        ├── fecha_seguimiento_esperada / fecha_seguimiento_real
        └── nivel_evaluacion (patient score = avg of 2 questions: causa + algoritmo, numeric(2,1))
```

---

## Architectural invariants

1. **Barrel-only imports.** External modules import from `@/app/controllers/[Entity]` only — never from files inside the entity folder.
2. **Raw DB row types never leave the entity.** `*Raw` types are defined in `utils/` and are not re-exported from `index.ts`.
3. **Supabase calls live inside entity `api/` folders.** ViewModels compose entity hooks; they do not call `supabase` directly.
4. **TDD for every `.ts` file.** Every function, mapper, hook, and ViewModel under `app/` has a corresponding `.test.ts`.
5. **Views are pure JSX.** Logic lives in `use[PageName]ViewModel.ts`. The page calls the ViewModel and spreads props.
6. **Edge Functions called from the browser wrap their handler in `withCors`** (`supabase/functions/_shared/cors.ts`). Without it the browser's preflight gets a 405 and the real POST is never sent — invisible locally, where Kong answers the preflight on its own, and broken in production. Functions called only by the mobile app (`patient-activation`, `paciente-cuenta`) do not need it. See [ADR-0009](./docs/adr/0009-las-edge-functions-que-llama-el-navegador-contestan-el-preflight.md).

---

## Language — activación del paciente

**Mensaje de bienvenida**:
El WhatsApp que recibe el paciente cuando el terapeuta inicia su tratamiento y todavía no tiene la app. Anuncia que ya puede usar la app y lleva el link de descarga. No contiene credenciales.
_Avoid_: invitación, mensaje de activación

**OTP de activación**:
El código de seis dígitos, de un solo uso, que autoriza a crear la cuenta del paciente. Se emite cuando el paciente lo pide desde el dispositivo, no cuando el terapeuta guarda el plan.
_Avoid_: código de invitación, PIN, token

**Pedido del código**:
El paso en que el paciente, todavía sin cuenta, tipea en la app el teléfono de su ficha para que se le emita y entregue un OTP de activación.
_Avoid_: reenvío, solicitud de OTP

**Teléfono de la ficha**:
El número de WhatsApp del paciente tal como quedó en su ficha: siempre `+54` seguido de los 10 dígitos del número nacional argentino (área + abonado), sin `9`, sin `0`, sin `15`. Es a la vez con lo que el paciente pide su código y adonde se le entrega. Dos fichas con el mismo teléfono de la ficha no pueden activarse solas.
_Avoid_: celular, contacto, número de teléfono (cuando se habla del dato canónico)

**Email de la ficha**:
El email propio del paciente, tal como quedó en su ficha. Es único: dos fichas no pueden tener el mismo, y dos emails que solo difieren en mayúsculas o espacios cuentan como el mismo. Nunca es el email del terapeuta ni el de otra persona puesto como relleno.
_Avoid_: email de contacto, mail del paciente (cuando se habla del dato único)

**Emisión**:
El acto de generar un OTP, hashearlo y persistirlo contra un paciente. Distinta de la **entrega**, que es mandarlo por WhatsApp: una puede tener éxito y la otra fallar.
_Avoid_: creación del código, envío

**Activación**:
El proceso completo por el que un paciente convierte su ficha (creada por el terapeuta) en una cuenta con la que puede entrar a la app. Termina cuando `pacientes.user_id` queda vinculado.
_Avoid_: registro, alta, sign-up

**Mes de tratamiento**:
Un bloque de 4 semanas (28 días) contado desde que el tratamiento arrancó: las semanas de contenido 1–4 son el mes 1, las 5–8 el mes 2, y así. Es lo mismo que un nivel. Nunca es un mes calendario: una etapa de 4 meses dura 16 semanas.
_Avoid_: mes calendario, "30 días", mes (a secas, cuando puede leerse como calendario)

**Semana de contenido**:
Cada bloque de 7 días desde que el tratamiento arrancó; la semana 1 empieza el día del arranque. Es la unidad en que se entrega el contenido y la que cuenta el plan.
_Avoid_: semana calendario, semana del año

**Hoy**:
El día calendario en Argentina, el mismo para el panel, la base y la app del paciente. Con él se cuentan la semana de contenido y el mes de tratamiento, y es la fecha que queda guardada al cargar un paciente, arrancar o cerrar un tratamiento.
_Avoid_: día UTC, fecha del servidor, `current_date`

**Iniciar el tratamiento**:
El acto explícito con el que el terapeuta pone en marcha el tratamiento de un paciente: fija la fecha de inicio (desde ahí se cuentan semanas, meses y evaluaciones) y le avisa al paciente. No depende de cuánto contenido haya cargado; es irreversible. Es distinto de guardar el plan, que no arranca nada.
_Avoid_: enviar el plan, completar el plan, plan completo (dejó de existir con el ADR 0014: una semana o un tratamiento sin contenido son válidos), activar al paciente (la activación la hace el paciente desde la app)

## Language — contraseña del paciente

**Cambio de contraseña**:
El único flujo por el que un paciente con cuenta elige una contraseña nueva: pide un código, le llega por WhatsApp al teléfono de la ficha, lo tipea y elige la contraseña. Tiene dos entradas, "Olvidé mi contraseña" (sin sesión: el paciente se identifica con el teléfono de la ficha) y "Cambiar contraseña" (desde el Perfil: la sesión dice quién es), pero es el mismo flujo. Al terminar se cierran todas las sesiones del paciente.
_Avoid_: recuperación, reset, recovery (como si fueran flujos distintos)

**OTP de cambio de contraseña**:
El código de seis dígitos, de un solo uso y 15 minutos de vida, que autoriza un cambio de contraseña. Es el único factor: no se pide la fecha de nacimiento. No sirve para la activación, y un OTP de activación no sirve para cambiar la contraseña. Comparte con el OTP de activación los límites de pedidos del paciente.
_Avoid_: OTP de recuperación, código de reset

## Language — seguimiento del paciente

**Cargar un paciente**:
Crear su ficha en el panel: datos, diagnóstico y un tratamiento todavía sin arrancar. La fecha en que se hizo se muestra como **Registrado**. No es la activación (eso lo hace el paciente desde la app) ni el arranque del tratamiento.
_Avoid_: dar de alta, alta (en salud significa terminar la atención), registrar (como verbo en la UI), crear (un paciente)

**Paciente activo**:
Un paciente cuyo estado es `activo` (los otros son `pausado` y `baja_voluntaria`). Dice si el terapeuta lo sigue atendiendo, no si está recibiendo contenido: un paciente activo puede tener el tratamiento sin arrancar o cerrado. Cerrar un tratamiento no lo deja inactivo.
_Avoid_: "activo" para decir "con tratamiento en curso"; "asignado" como sinónimo

## Language — diagnóstico

**Alfabeto**:
Uno de los ocho sistemas que el laboratorio usa sobre el disco del paciente. El terapeuta lo registra en el diagnóstico junto con uno o varios números, cada uno dentro del rango propio de ese alfabeto. Son, con su rango: Kappa (1–40), Sigma (1–102), Iota (1–40), Beta (1–12), Gamma (1–108), Alfa (1–52), Eta (1–55) y Delta (1–40). Es información del terapeuta y del laboratorio; el paciente no la ve. No altera el tratamiento (ni semanas, ni contenido, ni evaluaciones), así que se puede cargar o corregir en cualquier momento mientras el tratamiento esté abierto, a diferencia del resto del diagnóstico.
_Avoid_: alfabeto Fuego, alfabeto Tierra, alfabeto Viento (no existen), "los 7 alfabetos"
