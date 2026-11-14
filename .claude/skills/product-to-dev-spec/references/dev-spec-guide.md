# 🛠️ Guía: Cómo escribir una Spec de Desarrollo a partir de una Spec de Producto

> **Audiencia:** Tech leads, ingenieros senior, PMs técnicos.
> **Objetivo:** Bajar una Product Spec (qué y por qué) a una Engineering Spec (cómo) lista para que cualquier dev del equipo pueda implementar una feature web end-to-end sin ambigüedades.

---

## ✦ Filosofía

La **Product Spec** responde a _qué_ construir y _por qué_. La **Engineering Spec** (también llamada Technical Design Document o TDD) responde a _cómo_ construirlo: arquitectura, contratos, componentes, páginas, datos, riesgos.

Si la Product Spec es el "mapa del territorio", la Engineering Spec es el "plan de ruta": rutas, vehículos, paradas, tiempos estimados y plan B si llueve.

**Principio rector:** una buena Engineering Spec debe permitir que un dev del equipo (no necesariamente el autor) levante el ticket, lea el documento, y empiece a codear sin tener que preguntar.

---

## ✦ Cuándo escribir una Spec de Desarrollo

Escribilo **siempre que**:

- La feature toque más de un componente del sistema (frontend + backend, varias páginas, integración con terceros).
- Haya decisiones técnicas no triviales (elección de librería, modelo de datos, estrategia de caching, etc.).
- Más de un dev vaya a trabajar en paralelo sobre la feature.
- La feature tenga impacto en performance, seguridad, accesibilidad o SEO.
- Existan dependencias externas o cross-team.

**No hace falta** para bugfixes simples, cambios cosméticos, o features de menos de medio día de trabajo de una sola persona.

---

## ✦ El proceso end-to-end

### Paso 1 — Leer la Product Spec con ojos de ingeniero

Antes de escribir nada, leé la Product Spec entera y marcá:

- **Ambigüedades** → todo lo que se pueda interpretar de más de una forma.
- **Decisiones implícitas** → cosas que el PM asume pero no escribió (ej: "el usuario exporta a PDF" → ¿cuántos formatos? ¿con qué límite de tamaño? ¿async o sync?).
- **Dependencias técnicas no mencionadas** → ¿necesita auth? ¿toca el modelo de datos? ¿requiere migración?
- **Requerimientos no funcionales faltantes** → performance, seguridad, accesibilidad.

Hacé una lista de preguntas y resolvelas con el PM **antes** de escribir la spec de dev. Si la Product Spec tiene la sección "Decisiones abiertas", esas preguntas van resueltas en tu spec.

### Paso 2 — Definir el alcance técnico

A partir del alcance de producto, identificá:

1. **Qué se entrega** (Deliverables) → pensá en "tickets cerrables".
2. **Qué páginas se ven afectadas** (Pages) → cada ruta nueva o modificada.
3. **Qué componentes se necesitan** (Components) → reutilizables vs específicos.
4. **Qué features cross-page existen** (Features no atadas a una página) → ej: notificaciones, feature flags, modales globales.
5. **Qué datos se manejan** (Data model) → entidades, relaciones, persistencia.
6. **Qué contratos se exponen/consumen** (APIs) → endpoints, schemas.

### Paso 3 — Investigar el diseño

Si no tenés Figma o assets listos:

- Pedile al PM/Diseñador los mockups con los **estados clave** de cada pantalla (vacío, carga, error, éxito, hover, focus, disabled).
- Si la feature no tiene diseño dedicado, investigá patrones de la industria (ver sección "Diseño" en el template).
- Documentá tokens de diseño relevantes (colores, tipografía, spacing) si no están en un design system existente.

### Paso 4 — Decidir la arquitectura

Antes de escribir endpoints o componentes, definí:

- **Stack** y librerías a usar (justificá si te salís del estándar del equipo).
- **Patrón de estado** (local vs global, server state vs client state).
- **Estrategia de data fetching** (REST, GraphQL, SSR, CSR, ISR).
- **Routing** (qué rutas se agregan, nested layouts, params).
- **Auth y permisos** (qué roles pueden hacer qué).

### Paso 5 — Escribir la spec usando el template

Llená el template (archivo aparte) sección por sección. **No saltees secciones**: si una no aplica, escribí "N/A" con la razón.

### Paso 6 — Revisar con el equipo

La spec se valida en al menos dos rondas:

1. **Tech review** → otros ingenieros senior del equipo revisan decisiones arquitectónicas, riesgos, contratos.
2. **PM/Diseño review** → el PM confirma que el alcance técnico cubre lo de producto, y diseño valida que se respetan los flujos visuales.

Iterá hasta que no haya "TBD" ni preguntas abiertas críticas. Una spec con dudas se convierte en código con bugs.

### Paso 7 — Cortar en tickets

La spec termina con un plan de implementación que se traduce a tickets de Jira/Linear/etc. Idealmente cada deliverable es uno o varios tickets cerrables en menos de 3 días.

---

## ✦ Mapeo: secciones de Product Spec → secciones de Engineering Spec

| Product Spec (origen)          | Engineering Spec (destino)                                    |
| ------------------------------ | ------------------------------------------------------------- |
| Resumen ejecutivo              | Resumen técnico (qué se construye, alto nivel)                |
| Problema y motivación          | Contexto (link a Product Spec, no duplicar)                   |
| Objetivos y métricas           | Métricas técnicas (instrumentación, eventos a trackear)       |
| Usuarios objetivo              | Roles y permisos (RBAC)                                       |
| Alcance (In/Out)               | Deliverables + Out of Scope técnico                           |
| Descripción funcional (flujos) | Páginas, Features, Componentes (mapeo de flujos a UI)         |
| Requerimientos funcionales     | Acceptance criteria por deliverable (formato Given/When/Then) |
| Requerimientos no funcionales  | Sección de Performance, Seguridad, Accesibilidad, SEO         |
| Diseño y UX                    | Sección de Diseño + Componentes                               |
| Dependencias                   | Dependencias técnicas + APIs externas                         |
| FAQ                            | Decisiones técnicas y trade-offs (ADRs cortos)                |

---

## ✦ Las 7 secciones clave que toda Engineering Spec debe tener

### 1. **Deliverables**

Lista accionable de "qué se entrega". Cada deliverable es una unidad de valor cerrable, con su propio criterio de aceptación. Pensalo como: "si entrego esto y nada más, ¿el usuario puede hacer algo útil?".

Mal deliverable: "Mejorar el dashboard".
Buen deliverable: "El usuario puede exportar su reporte en PDF desde el dashboard con un click, recibiendo el archivo en menos de 5s".

### 2. **Pages**

Cada ruta del producto que se crea, modifica o elimina. Por cada página documentá:

- Path (`/reports/:id/export`)
- Layout que usa
- Componentes que la componen
- Datos que requiere (qué APIs llama)
- Estados (loading, error, vacío, éxito)
- Roles que pueden acceder
- SEO/meta (si es página pública)

### 3. **Components**

Componentes reutilizables que hay que construir o modificar. Distinguir entre:

- **Atoms/Molecules** del design system (Button, Input, Modal) → idealmente ya existen.
- **Organismos** específicos del producto (ReportCard, ExportDialog).
- **Templates** de layout (DashboardLayout, AuthLayout).

Por cada componente: props (interface), estados internos, eventos que emite, accesibilidad (ARIA, keyboard nav), y si tiene Storybook.

### 4. **Features**

Funcionalidades que no viven dentro de una sola página: notificaciones, feature flags, analytics, autenticación, error boundaries globales, modales globales, side-effects (ej: invalidar caché tras un POST).

Por cada feature cross-cutting: dónde se inicializa, cómo se consume, cómo se testea.

### 5. **Design**

Si la feature tiene diseño, link a Figma + screenshots de los estados clave. Si no tiene diseño dedicado, investigá patrones (ver sub-sección "Design Research" del template) y documentá la decisión.

Incluí siempre: design tokens usados, responsive breakpoints, dark mode, accesibilidad visual (contraste).

### 6. **Data Model & APIs**

- **Modelo de datos**: entidades nuevas o modificadas, schema, índices, migraciones.
- **APIs**: endpoints (método, path, request, response, errores), idealmente con ejemplo de OpenAPI/JSON Schema.
- **Estado del cliente**: qué se cachea, qué se invalida cuando, cómo se maneja optimistic UI si aplica.

### 7. **Non-functional requirements (NFRs)**

Performance (Core Web Vitals, bundle size), Seguridad (auth, RBAC, validación de inputs, OWASP top 10), Accesibilidad (WCAG 2.1 AA mínimo), SEO (meta tags, sitemap, structured data), Observabilidad (logs, métricas, alertas), i18n si aplica.

---

## ✦ Best practices al escribir la spec

- **Escribí pensando en el lector que llega frío.** Asumí que el dev que va a implementar no estuvo en las reuniones.
- **Justificá decisiones, no solo las anunciés.** "Usamos React Query" no alcanza; "Usamos React Query porque ya está en el stack y necesitamos cache + revalidación por foco" sí.
- **Documentá lo que descartaste y por qué.** Esto evita que en el futuro alguien repita la discusión.
- **Usá diagramas para flujos complejos.** Un diagrama de secuencia o un diagrama de estado vale mil palabras (Mermaid funciona bien en markdown).
- **No copies la Product Spec.** Linkea y referenciá. La duplicación se desincroniza siempre.
- **Sé explícito con lo que NO se hace.** Es tan importante como lo que sí.
- **Acceptance criteria en Given/When/Then.** Es un formato que el equipo de QA puede convertir en tests directamente.
- **Versioná la spec.** Si la feature crece o cambia, dejá rastro de los cambios.
- **Marcá decisiones abiertas con `🟡 TBD` o `❓`.** Y poneles responsable y fecha límite, igual que en la Product Spec.

---

## ✦ Anti-patrones comunes

- **Spec demasiado abstracta:** "El usuario podrá exportar reportes" sin detallar formato, tamaño, async, errores. Si no podés escribir el test, no escribiste la spec.
- **Spec demasiado prescriptiva:** Pseudocódigo línea por línea. Eso es código, no diseño. Apuntá a contratos e interfaces, dejá la implementación al dev.
- **Saltarse el "out of scope":** Garantía de scope creep durante el sprint.
- **No incluir estados de error:** El happy path es el 20% del trabajo. Los estados de error, vacío y carga son el 80%.
- **No documentar accesibilidad:** Después es retrabajo carísimo. Pensalo desde el día uno.
- **Empezar por el código antes de la spec.** A veces es tentador "tirar un POC" antes de escribir, pero salvo que sea una incógnita técnica fuerte, escribir primero ahorra reescrituras.

---

## ✦ Checklist antes de marcar la spec como "Approved"

Antes de pasar la spec a `Approved` y empezar a implementar, verificá:

- [ ] Está linkeada a la Product Spec correspondiente.
- [ ] Tiene resumen técnico de 1-2 párrafos legibles por un no-técnico.
- [ ] Lista todos los deliverables con acceptance criteria.
- [ ] Cada página tiene path, datos, estados y permisos definidos.
- [ ] Cada componente nuevo tiene interface (props) y estados.
- [ ] Tiene modelo de datos y contratos de API (request/response/errores).
- [ ] Tiene sección de NFRs (perf, seguridad, a11y, SEO).
- [ ] Tiene plan de testing (unit, integration, e2e).
- [ ] Tiene plan de rollout (feature flag, canary, full release).
- [ ] Tiene plan de observabilidad (qué loguear, qué alertar).
- [ ] Tiene plan de rollback.
- [ ] Tiene estimación o breakdown de tickets.
- [ ] No tiene `TBD` críticos sin responsable.
- [ ] Fue revisada por al menos un tech lead y el PM.

---

## ✦ Tip final

> Si tu spec no le permite a un dev empezar a trabajar el lunes a la mañana sin chatearte, todavía no está terminada.
>
> Si tu spec tiene tanto detalle que el dev no toma decisiones, te excediste y estás escribiendo código en prosa.
>
> El punto justo: contratos claros, decisiones justificadas, libertad sobre cómo implementar.
