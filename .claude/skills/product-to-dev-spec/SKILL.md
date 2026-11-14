---
name: product-to-dev-spec
description: Genera una Engineering/Dev Spec a partir de la Product Spec de un feature. Lee .docs/features/[featureName]/ProductSpec.md, lo aterriza en el stack real del repo (Next.js + Supabase + shadcn + arquitectura ViewModel/controllers), y escribe .docs/features/[featureName]/DevSpec.md siguiendo la estructura de 19 secciones de la guía bundleada en references/dev-spec-guide.md. Use when the user wants to create a dev spec, engineering spec, technical design document or TDD from a product spec, mentions "bajar una product spec a spec de desarrollo", "spec de desarrollo", "spec técnica", or invokes /product-to-dev-spec.
---

# product-to-dev-spec

Transforma la **Product Spec** (qué/por qué) de un feature en una **Engineering / Dev Spec** (cómo): un documento accionable que cualquier dev del equipo pueda levantar y empezar a implementar sin tener que preguntar.

La skill **no inventa** la arquitectura: aterriza la spec en el stack y los patrones reales de este repo. Produce un documento en estado `Draft` listo para tech review — no commitea.

## Invocación

```
/product-to-dev-spec [featureName]
```

`[featureName]` es el nombre de una carpeta dentro de `.docs/features/` (ej: `pacientesModule`).

## Fase 0 — Resolver y validar (abort gates, en orden)

Evaluá los gates en orden. **El primero que falle aborta la skill** con el mensaje indicado — no hay selección interactiva ni fallback silencioso.

1. **Sin `[featureName]` en los argumentos** → abortar:
   > "Falta el feature. Invocá `/product-to-dev-spec [featureName]` indicando una carpeta de `.docs/features/`."
2. **`.docs/features/[featureName]/` no existe** → abortar, listando las carpetas que sí existen bajo `.docs/features/`.
3. **`.docs/features/[featureName]/ProductSpec.md` no existe** → abortar:
   > "No encuentro `.docs/features/[featureName]/ProductSpec.md`. Cargá la Product Spec en esa ruta y volvé a correr la skill."
4. **`.claude/skills/product-to-dev-spec/references/dev-spec-guide.md` (guía) no existe** → abortar:
   > "Falta la guía `.claude/skills/product-to-dev-spec/references/dev-spec-guide.md`. La skill no puede generar la DevSpec sin ella."

Antes de generar, chequeá si `.docs/features/[featureName]/DevSpec.md` ya existe — eso decide el modo (creación vs actualización in-place, ver Fase 4).

## Fase 1 — Leer insumos

- `.docs/features/[featureName]/ProductSpec.md` — la fuente de verdad de producto.
- `.claude/skills/product-to-dev-spec/references/dev-spec-guide.md` (bundleada en esta skill) — filosofía, los 7 pasos, la tabla de mapeo Product → Engineering, las 7 secciones clave, anti-patrones y el checklist de "Approved". Es la **única** referencia estructural — define el formato obligatorio de la salida (19 secciones). **Leela entera**: gobierna cómo se construye la spec.
- (Opcional, si existe) un DevSpec previo en `.docs/features/*/DevSpec.md` (ej: `terapeutasModule/DevSpec.md`) — sirve como ejemplo concreto del shape de las 19 secciones aterrizadas a este repo.

## Fase 2 — Aterrizar en el codebase (grounding)

La DevSpec debe reflejar **cómo se construye realmente en este repo**, no el stack genérico de ejemplo del template. Antes de escribir, inspeccioná:

- `CLAUDE.md` (raíz del repo) — stack real, comandos, gates de finishing-work.
- `.claude/controllers-architecture.md`, `.claude/viewmodel-architecture.md`, `.claude/typescript.md`, `.claude/ui-components.md`, `.claude/testing.md` — los patrones obligatorios del proyecto.
- `components/ui/` — inventario de atoms shadcn ya instalados (un componente nuevo del template debe mapear a estos, o marcar que hay que instalarlo vía `/shadcn`).
- `app/controllers/` — entidades de dominio ya existentes (reusar antes de redefinir; Rule 6 de controllers-architecture).
- `supabase/schemas/` — modelo de datos declarativo actual.

Esto alimenta directamente:

| Sección del template    | Cómo se aterriza                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5. Components           | Atoms reales de `components/ui/`; organismos siguen la arquitectura ViewModel (View pura + `controllers/`).                                                            |
| 8. Data model & APIs    | Schema **declarativo** en `supabase/schemas/` + migraciones generadas; acceso vía entity controllers, no API routes. Sin "endpoints REST" salvo route handlers reales. |
| 9. Arquitectura y stack | Next.js App Router + Supabase + shadcn + arquitectura ViewModel/controllers. Sin React Query / Zustand / Fastify / BullMQ salvo que existan en el repo.                |
| 11. Testing             | Jest + RTL (`renderHook`) para `.ts`, `/playwright-uat` como gate de UI. Sin Vitest/Chromatic/Playwright-propio salvo que existan.                                     |

## Fase 3 — Detectar ambigüedades

Leé la Product Spec "con ojos de ingeniero" (Paso 1 de la guía) y marcá: ambigüedades, decisiones implícitas, dependencias técnicas no mencionadas y NFRs faltantes.

Clasificá cada hallazgo:

- **Crítico** — cambia la arquitectura, los contratos de datos, los permisos o el alcance. No se puede escribir la spec sin resolverlo.
- **No-crítico** — afecta detalles que el dev o un review posterior pueden cerrar.

Resolución:

- **Críticos** → un único `AskUserQuestion` batcheado, **máximo 4 preguntas**, cada una con una recomendación. Si hay más de 4 críticos, preguntá los 4 de mayor impacto y tratá el resto como no-críticos.
- **No-críticos** → recolectalos para la **sección 16 "Decisiones abiertas"** del template, cada uno marcado con `🟡 TBD` y, si se conoce, responsable y fecha límite.

Si la Product Spec ya trae una sección de decisiones abiertas, esas preguntas deben quedar **resueltas** en la DevSpec, no copiadas como pendientes.

## Fase 4 — Generar la DevSpec

Escribí `.docs/features/[featureName]/DevSpec.md` llenando **las 19 secciones canónicas** (header + secciones 1–19) definidas en la guía y ejemplificadas en `.docs/features/terapeutasModule/DevSpec.md`:

Header (frontmatter en blockquote): Estado, Versión, Última actualización, Tech Lead / Autor, Reviewers, Product Spec relacionada, Tickets / Epic.

Secciones: 1. Resumen técnico · 2. Contexto y links · 3. Deliverables · 4. Pages · 5. Components · 6. Features cross-cutting · 7. Design · 8. Data model & APIs · 9. Arquitectura y decisiones técnicas · 10. Non-functional requirements · 11. Testing strategy · 12. Dependencias · 13. Riesgos y mitigaciones · 14. Rollout plan · 15. Plan de implementación / Breakdown de tickets · 16. Decisiones abiertas · 17. Out of scope · 18. FAQ · 19. Historial de cambios.

- No saltees secciones. Si una no aplica, poné `N/A` con la razón (ej: "N/A — feature sin diseño dedicado").
- Aplicá la tabla de mapeo Product → Engineering de la guía.
- Acceptance criteria siempre en formato **Given/When/Then**.
- No copies la Product Spec: linkeala. En el header, `Product Spec relacionada:` → `./ProductSpec.md`.
- Header del documento: `Estado: Draft`, `Versión: 1.0`, `Última actualización:` con la fecha de hoy.
- Usá Mermaid para flujos complejos (la sección 9.2 del template lo espera).
- Respetá los anti-patrones de la guía: ni demasiado abstracta (si no se puede escribir el test, falta detalle) ni demasiado prescriptiva (contratos e interfaces, no pseudocódigo línea por línea).

**Modo actualización in-place** — si `DevSpec.md` ya existía:

- Regenerá el contenido, pero **conservá** el `Tech Lead / Autor` y **todas las filas previas** de la sección 19 "Historial de cambios".
- Bumpeá el campo `Versión` del header (ej: `1.0` → `1.1`).
- Agregá una fila nueva al final de la sección 19 con la fecha de hoy y un resumen del cambio.

## Fase 5 — Verificar (gate) y reportar

Antes de devolver el control, auto-chequeá la DevSpec contra el checklist de la guía (ítems estructurales verificables):

- [ ] Linkeada a la Product Spec (`./ProductSpec.md`).
- [ ] Resumen técnico de 1-2 párrafos legible por un no-técnico.
- [ ] Todos los deliverables con acceptance criteria.
- [ ] Cada página con path, datos, estados y permisos.
- [ ] Cada componente nuevo con interface de props y estados.
- [ ] Modelo de datos + contratos de acceso a datos (request/response/errores).
- [ ] Sección de NFRs (performance, seguridad, a11y, SEO).
- [ ] Plan de testing, rollout, observabilidad y rollback.
- [ ] Breakdown de tickets.
- [ ] Sin `TBD` críticos sin responsable.

Reportá al usuario, en lenguaje natural:

- La ruta del archivo generado/actualizado y si fue creación o update (con la versión nueva).
- Las decisiones críticas que se resolvieron vía `AskUserQuestion`.
- Los `🟡 TBD` que quedaron abiertos en la sección 16.
- Cualquier ítem del checklist que no se pudo cerrar.
- Recordá que el documento queda en `Draft` para tech review + PM review (Paso 6 de la guía) y que **la skill no commitea** — el usuario revisa y commitea.

## Reglas

- **No commitear.** La skill solo escribe `DevSpec.md`; no toca git.
- **Feature = argumento obligatorio.** Sin `[featureName]` se aborta; no se auto-resuelve ni se ofrece selección.
- **Generación inline**, sin subagentes.
- **Aterrizar en el repo real**, nunca en el stack genérico del template.
- Toda condición de abort y todo `TBD` abierto se **declara explícitamente** en el reporte final.
