# Modelo de seeding

Este proyecto sembraba TODA la data (referencia + mock) desde `supabase/seed.sql` y
`supabase/seeds/*.sql`, cargados solo por `supabase db reset`. El problema: `db reset`
nunca corre en producción — solo `db push` corre ahí — así que cualquier tabla de
referencia que la app necesitara para funcionar (roles, catálogo clínico, etc.) NUNCA
llegaba a un ambiente real. Este documento describe el modelo que reemplaza eso: dos
categorías de data, cada una en el lugar correcto para que la data de referencia SÍ
llegue a producción y la data mock JAMÁS pueda hacerlo.

## El modelo mental

| Categoría                                                             | ¿Quién la necesita?                | ¿Dónde vive?                | ¿Cuándo corre?                    |
| --------------------------------------------------------------------- | ---------------------------------- | --------------------------- | --------------------------------- |
| **REFERENCE** (roles, catálogo clínico, modalidades, etc.)            | Todo ambiente, incluida producción | `supabase/migrations/*.sql` | `db reset` **y** `db push`        |
| **MOCK** (usuarios demo, pacientes de prueba, árbol clínico completo) | Solo desarrollo local              | `supabase/seed.sql`         | Solo `db reset` (nunca `db push`) |

Regla de una línea: **si producción lo necesita para funcionar, es una migración. Si es
solo para poder navegar la app localmente, es `seed.sql`.**

## Por qué este split es estructuralmente seguro

Supabase corre los `[db.seed].sql_paths` de `config.toml` en `supabase db reset`
(reset local). `supabase db push` — el comando que toca un ambiente real — aplica
`supabase/migrations/*.sql` y, por defecto, no lee `seed.sql`.

> ⚠️ **Hay una excepción: `supabase db push --include-seed`** sí corre `seed.sql` contra el
> ambiente remoto, y crearía en producción los usuarios demo con su contraseña pública.
> **Nunca uses `--include-seed`.** Ningún script de este repo lo usa; si aparece en un PR,
> es un bloqueante.

Al mismo tiempo, poner
la data de referencia en migraciones garantiza que sí llegue, porque las migraciones
son exactamente lo que `db push` aplica.

## Los dos archivos de referencia

| Archivo                                                         | Contenido                                                                                                  | Autoría                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `supabase/migrations/20260719120000_seed_reference_lookups.sql` | `roles`, `estados_paciente`, `estados_etapa` (base), `tipos_disco`, `alfabetos`, `modalidades`             | Escrito a mano                                 |
| `supabase/migrations/20260719120100_seed_clinical_catalog.sql`  | `causas`, `algoritmos`, `bloqueos`, `causa_etapas`, `algoritmo_etapas`, `causa_frases`, `algoritmo_frases` | Generado desde fuentes internas (no incluidas) |

Ambas migraciones son idempotentes (`on conflict (...) do nothing` sobre su clave
natural), así que reaplicarlas no rompe nada.

## Data de referencia ya sembrada por migraciones previas (no duplicar)

Estas tablas de referencia YA se siembran en migraciones anteriores a este cambio — no
están en los dos archivos de arriba y no hay que volver a insertarlas:

| Tabla                              | Migración                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `estados_terapeuta`                | `20260524175444_seed_estados_terapeuta.sql`                                         |
| `tipos_alerta`                     | `20260705120000_tipos_alerta.sql`, `20260707040500_...sql`, `20260712040000_...sql` |
| `estados_etapa` (fila `pendiente`) | `20260712040000_inicio_tratamiento_fundacion.sql`                                   |

## `supabase/seed.sql` — qué queda ahí

Después del split, `seed.sql` es un fixture 100% mock: los 8 usuarios demo de
`auth.users`, los pacientes de prueba, terapeutas, todo el árbol clínico de ejemplo
(etapas, niveles, evaluaciones) y los `contenidos` placeholder. No contiene ningún
`insert` a una tabla de referencia — todas esas filas ya existen por las migraciones
de arriba cuando `seed.sql` corre.

## Actualizar el catálogo clínico

El catálogo (`causas`, `algoritmos`, `bloqueos` + sus frases) se generó desde fuentes
internas que no forman parte de este repositorio.

### La regla de "editar una sola vez"

Regenerar el archivo lo **sobrescribe** por completo. Eso es seguro únicamente
**antes** del primer `db push` real a producción, porque Supabase trackea qué
migraciones ya se aplicaron por su **timestamp/versión** (tabla
`supabase_migrations.schema_migrations`), no por el contenido del archivo — no hay
checksum. Consecuencia:

- **Antes del primer `db push` a un remoto real**: regenerar y sobrescribir este
  archivo es la forma correcta de actualizar el catálogo.
- **Después del primer `db push`**: un cambio al catálogo es una **migración nueva**
  con timestamp posterior. Nunca edites in-place un archivo ya aplicado — Supabase lo
  va a saltear silenciosamente en el próximo `db push`, dejando ese ambiente
  desincronizado sin ningún error visible.
- Si ya pasó (drift detectado entre lo aplicado y el archivo local), el escape hatch es
  `supabase migration repair`.

## Flujo de reset local

`supabase db reset` aplica **todas** las migraciones en orden de timestamp primero
(la data de referencia queda sembrada) y **recién después** corre `seed.sql`. Por eso
la data mock puede referenciar los UUIDs literales de la data de referencia sin que
las FKs rompan — cuando `seed.sql` corre, esas filas ya existen.

## Cómo verificar

`supabase/tests/seeding_invariants.sql` valida el estado local post-`db reset`:
conteos exactos de cada tabla de referencia y de catálogo, presencia del árbol mock, y
ausencia de FKs huérfanas. Correlo con:

```bash
supabase db reset
psql "$DATABASE_URL" -f supabase/tests/seeding_invariants.sql
```

La corrección en producción es **estructural** (seeds nunca corren en `db push`), no
algo que este script pueda o deba probar — el script valida el estado local, que es
donde realmente puede haber un bug.
