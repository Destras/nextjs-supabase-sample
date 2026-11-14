# Template — PLAN.md

Plantilla de salida de `/devspec-to-plan`. El **cuerpo del template** (todo lo
que está después del `---`, desde `# PLAN — <NombreDelFeature>` hasta el final)
se copia a `.docs/features/[featureName]/PLAN.md`: reemplazá los `<placeholders>`,
completá las tablas, repetí los bloques de epic y task según haga falta, y borrá
los comentarios `<!-- ... -->`. El PLAN se escribe en español.

Reglas de formato que el downstream (`/to-epics`) parsea y de las que depende:

- Headings exactos: `### Epic <N> — <Nombre>` y `#### Task <N.M> — <Nombre>`.
- Labels de campo exactos, en negrita, con dos puntos (ej: `**Objetivo:**`).
- `**Criterios de aceptación:**` siempre seguido de una lista `- [ ]`.

## Notas de uso

- **Epic 0 vs Epic 1..N.** Epic 0 usa `**Bloquea:**`. Los Epics 1..N usan
  `**Depende de:** Epic 0` + `**Paralelizable con:**`. Los Epics 1..N no
  deberían depender uno de otro; si un slice reusa output de otro y no se puede
  mover a Epic 0, declaralo en `**Depende de:**` (ver SKILL.md Fase 2.3).
- **Numeración de tasks.** `Task <Epic>.<Correlativo>` — `0.1`, `0.2`, `1.1`,
  `2.1`... Es el ID que usan los `**Bloqueadores:**` y la Matriz de cobertura.
- **Referencia DevSpec.** El campo lista la(s) sección(es) del DevSpec que la
  task implementa (`§X.Y`), seguidas del/los deliverable(s) `D-N` al final.
- **Campos opcionales.** `**Flujo de usuario:**` → `N/A — task de
infraestructura` (o `N/A — task de decisión`) si no hay UI. `**Flujos
secundarios:**` → `Ninguno` si no hay edge cases. El resto es obligatorio.
- **Sin routing de skills.** No pongas `/tdd`, `/aurora-ui`, `/playwright-uat`
  en las tasks: son gates globales de `CLAUDE.md` que el pipeline aplica solo.

---

<!-- ▼▼▼ CUERPO DEL TEMPLATE — copiar desde acá hasta el final del archivo ▼▼▼ -->

# PLAN — <NombreDelFeature>

> Generado desde DevSpec.md · <YYYY-MM-DD>

## 1. Resumen

<1-2 párrafos derivados del DevSpec §1 (Resumen técnico): qué entrega este
feature y para quién. Cerrá con una línea de alcance: cuántos deliverables,
cuántos epics, cuántas tasks.>

## 2. Matriz de cobertura de deliverables

<!-- Una fila por deliverable D-N del DevSpec §3.1. Garantiza que todo
     deliverable tiene al menos una task. Un deliverable cuyo trabajo se
     reparte entre Epic 0 (fundación) y un epic de feature (su UI) lista varias
     tasks y varios epics — la columna `Epic` admite varios valores. -->

| Deliverable                | Task(s)       | Epic |
| -------------------------- | ------------- | ---- |
| D-1 — <nombre deliverable> | 0.2           | 0    |
| D-2 — <nombre deliverable> | 0.1, 0.3      | 0    |
| D-3 — <nombre deliverable> | 0.4, 1.1, 1.2 | 0, 1 |
| D-4 — <nombre deliverable> | 2.1, 2.2, 2.3 | 2    |

## 3. Epics y tasks

### Epic 0 — Fundación Transversal

**Objetivo:** <qué deja listo este epic — el andamiaje sin el cual ningún otro epic puede empezar.>

**Bloquea:** todos los epics (1..N)

**Cubre deliverables:** D-1, D-2

<!-- Tasks de Epic 0: solo trabajo que pasa el test de transversalidad —
     schema DB compartido, esqueleto de entidades, integraciones reusables,
     UI compartida por ≥2 epics, RLS, role-gating, y decisiones que bloquean
     varios slices. Repetí el bloque #### Task para cada task. -->

#### Task 0.1 — <nombre corto y accionable>

**Descripción:** <1-2 oraciones: qué hay que hacer, a alto nivel.>

**Flujo de usuario:** N/A — task de infraestructura

**Flujos secundarios:** Ninguno

**Criterios de aceptación:**

- [ ] <criterio verificable, derivado del Given/When/Then del deliverable>
- [ ] <criterio verificable>

**Bloqueadores:** Ninguno

**Referencia DevSpec:** §8.1, D-2

**Prioridad:** Alta

### Epic 1 — <Nombre del slice — feature / página / subsistema>

**Objetivo:** <qué queda logrado cuando este epic cierra, en términos de negocio / usuario.>

**Depende de:** Epic 0

**Paralelizable con:** Epic 2, Epic 3

**Cubre deliverables:** D-3

<!-- Repetí el bloque #### Task para cada task del epic, y el bloque
     ### Epic completo para cada epic de feature. -->

#### Task 1.1 — <nombre>

**Descripción:** <1-2 oraciones.>

**Flujo de usuario:** <el camino feliz que la task tiene que satisfacer: "El <rol> entra a <X> → hace <Y> → ve <Z>". Derivado de §4.2 / §9.2.>

**Flujos secundarios:**

- <edge case relevante → comportamiento esperado>
- <error → comportamiento esperado>

**Criterios de aceptación:**

- [ ] <criterio verificable>
- [ ] <criterio verificable>

**Bloqueadores:** Task 0.1, Task 0.3

**Referencia DevSpec:** §4.2 `<ruta>`, §5.2, D-3

**Prioridad:** Alta

## 4. Orden de ejecución

<!-- Diagrama de texto. Epic 0 primero; los Epics 1..N cuelgan de Epic 0 y son
     paralelos entre sí. Dentro de cada epic, anotá las dependencias
     task-a-task tomadas de los campos **Bloqueadores:**. -->

```
Epic 0 — Fundación Transversal                 [BLOQUEANTE]
  ├── Task 0.1 — <nombre>
  └── Task 0.2 — <nombre>

Epic 1 — <nombre>                              [depende de Epic 0]
  ├── Task 1.1 — <nombre>                      (requiere: 0.1, 0.3)
  └── Task 1.2 — <nombre>                      (requiere: 1.1)

Epic 2 — <nombre>                              [depende de Epic 0]
  └── Task 2.1 — <nombre>                      (requiere: 0.2)
```

> **Paralelismo:** una vez cerrado Epic 0, los Epics 1..N se pueden tomar en
> paralelo. <Aclarar acá cualquier excepción real — toda dependencia declarada
> entre Epics 1..N.>

## 5. Riesgos y supuestos

<!-- Derivado del DevSpec §13 (Riesgos y mitigaciones) y de los supuestos que
     el desglose asume. -->

- **<Riesgo>** — <mitigación o task que lo cubre>.
- **Supuesto:** <algo que el plan da por cierto y, si no se cumple, lo cambia>.
