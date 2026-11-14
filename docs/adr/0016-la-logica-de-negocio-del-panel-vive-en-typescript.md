# La lógica de negocio del panel vive en TypeScript, no en Postgres

_Estado: propuesta (2026-11-13). Se confirma después del spike de `iniciar_tratamiento`._

Toda la lógica de negocio vive en la base: 79 funciones PL/pgSQL (unas 7.000 líneas) que el
panel y la app del paciente llaman como RPC. Nos sirvió para arrancar, porque una RPC nos daba
atomicidad (PostgREST corre una sentencia por request y supabase-js no tiene transacciones) y
autorización con `auth.uid()` y RLS. Con el dominio más grande, el costo se volvió visible:
cambiar una regla de negocio es una migración, testearla requiere levantar la base, y el SQL es
más difícil de leer, revisar y refactorizar que el resto del código. **Decidimos que la lógica
de negocio del panel pase a un módulo TypeScript (`core/`) que corre en el servidor de Next.js
y se conecta directo al mismo Postgres de Supabase, con transacciones propias. La app del
paciente sigue con sus RPC, sin cambios.**

## Qué se muda y qué se queda

Se muda la lógica que usa el panel (unas 38 funciones, unas 3.000 líneas):

| Módulo                  | Funciones principales                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pacientes / tratamiento | `register_paciente`, `update_paciente_identidad`, `update_etapa_diagnostico`, `set_etapa_alfabetos`, `set_entregas_plan`, `iniciar_tratamiento`, `cerrar_etapa`, `iniciar_nueva_etapa`, `telefono_en_otra_ficha`    |
| Mediciones              | `registrar_medicion`, `editar_medicion`, `cerrar_etapa_con_medicion`, `get_estructura_paciente` y sus helpers `_validar_valores_medicion`, `_medicion_editable`, `_insertar_medicion`, `_generar_cierre_automatico` |
| Alertas y Dashboard     | `derive_alertas_activas`, `list_alertas_terapeuta`, `list_alertas_admin`, `count_alertas_terapeuta`, `marcar_alerta_atendida`, `desmarcar_alerta_atendida`, `get_admin_dashboard_stats`                             |
| Terapeutas              | `list_terapeutas`, `get_terapeuta`, `update_terapeuta`, `deactivate_terapeuta`, `reactivate_terapeuta`                                                                                                              |
| Contenidos              | `create_contenido`, `create_contenido_galeria`, `set_contenido_imagenes`, `update_contenido`, `count_contenido_usage`, `delete_contenido`, `replace_and_delete_contenido`                                           |
| Frases                  | `get_frases_del_tratamiento_activo`                                                                                                                                                                                 |

Se queda en la base:

- **La integridad**: constraints, FKs, `set_updated_at`, `rechazar_modificacion`,
  `validar_numero_alfabeto` y la normalización del teléfono (ADR-0008).
- **RLS y sus helpers** (`is_admin`, `is_console_user`, `has_active_assignment`) y los auth
  hooks (`handle_new_user`, `handle_terapeuta_email_confirmed`).
- **Las reglas que comparte con la app del paciente**: `hoy()` (ADR-0012), `semanas_de_etapa()`
  y `frases_de_etapa()`. El panel calcula fechas de tratamiento y la app calcula qué semana está
  liberada; si la regla queda en dos lenguajes, un cambio en un lado y no en el otro hace que el
  terapeuta y el paciente vean semanas distintas. `core/` las llama (`select public.hoy()`) y se
  mudan cuando se mude la app.
- **Todo lo de la app del paciente**: `get_mi_*`, `submit_mi_evaluacion`, el flujo de OTP,
  `baja_voluntaria_paciente`, `resolver_documentos_legales_vigentes`.

## Cómo funciona

- **Conexión directa.** `core/` usa Kysely sobre `pg`, con la connection string del pooler de
  Supabase (Supavisor, modo transacción, sin prepared statements) y tipos generados desde la
  base. Seguimos en Supabase: misma base, mismo Auth, mismo Storage, mismo schema declarativo.
  Lo que deja de usarse para escribir es PostgREST.
- **Identidad de Supabase Auth.** El panel sigue logueando con supabase-js. El servidor verifica
  el JWT con `getClaims()` antes de usarlo; nunca se usan claims sin verificar.
- **`withTx(claims, fn)`.** Cada caso de uso corre en una transacción que primero hace
  `set local role authenticated` y `set local request.jwt.claims`, lo mismo que hace PostgREST.
  Así `auth.uid()` y RLS siguen funcionando.
- **Doble barrera.** El guard "admin o dueño" (SEG-008) que hoy está al principio de cada RPC
  pasa a TypeScript, donde se testea. RLS queda como segunda barrera.
- **Errores del dominio.** Los códigos que hoy salen de `raise exception`
  (`email_bloqueado_por_cuenta`, `no_autorizado`…) se conservan para que la UI no cambie.
- **Agregaciones como SQL en el código.** `derive_alertas_activas` y `get_admin_dashboard_stats`
  no se traducen a loops: pasan a consultas SQL dentro de un `.ts` (`sql` de Kysely). Cambiarlas
  es un deploy, no una migración.
- **Sin API pública.** El panel llama a `core/` desde server actions y server components. No
  hacen falta Route Handlers hasta que se mude la app del paciente.
- **`core/` no importa nada de Next.** Si algún día el panel y la app necesitan un backend con
  deploy propio, `core/` se lleva a un servicio aparte (por ejemplo Hono) cambiando solo los
  adaptadores.

## Consecuencias

- Una regla de negocio del panel se cambia con un deploy y se testea con Jest: tests unitarios
  para las reglas puras y de integración contra `supabase:local-start` para las transacciones.
- La autorización del panel deja de estar en un solo lugar (la RPC): vive en el guard de
  TypeScript y en RLS, y los dos se mantienen.
- Los fetchers de `app/controllers/*/api/` (27 archivos que llaman `.rpc()` desde el navegador)
  pasan a llamar server actions. Cambian el patrón de `.claude/controllers-architecture.md` y la
  sección "Architecture" del `CLAUDE.md` del repo ("no API routes, auth only"); se actualizan en
  el mismo trabajo.
- Los cambios de esquema siguen siendo migraciones desde `supabase/schemas/`. Lo que deja de
  necesitar migración es la lógica.
- Durante la transición conviven dos estilos: por módulo, o todo en RPC o todo en `core/`. Nunca
  mitad y mitad.
- La migración es por módulo, sin big bang. Cada módulo se cierra con una migración que borra
  sus RPC. Como solo las llama el panel, se borran apenas el reemplazo está en producción, sin
  esperar versiones de la app.
- Los tests SQL de `supabase/tests/` que cubren lógica migrada se pasan a tests de integración
  en Jest. Los de RLS se quedan.

## Orden y costo estimado

Unos 34 a 52 días de una persona (entre 7 y 10 semanas), de los que la fundación lleva 5 a 8. El
orden va de mayor a menor retorno: fundación (`core/`, `withTx`, verificación del JWT, mapeo de
errores, harness de integración) con el spike de `iniciar_tratamiento`; después pacientes y
tratamiento (9 a 13 días), mediciones (5 a 7), y por último alertas, terapeutas, contenidos y
frases, que cambian poco y pueden quedarse en SQL un tiempo sin mucho costo. El spike convierte
este rango en un número medido.

## Alternativas descartadas

**Seguir en PL/pgSQL y mejorar el tooling (pgTAP, `plpgsql_check`).** Mejora los tests, pero
cada cambio de regla sigue siendo una migración y la lógica sigue escrita en SQL.

**Mover la lógica a TypeScript usando supabase-js.** Es el camino más corto, pero cada llamada es
una transacción aparte: `register_paciente` podría dejar un paciente sin etapa ni niveles si
falla a mitad de camino.

**Supabase Edge Functions.** Ya tenemos cinco y están cerca de la base, pero son una función por
endpoint, corren en Deno (tooling y tests separados de Jest, sin compartir código con el panel)
y tienen cold starts. No escalan bien a un dominio de este tamaño.

**Servicio TypeScript propio (Hono o Fastify en un contenedor).** Le da a panel y app una API con
deploy independiente, pool persistente y jobs, pero suma infraestructura que el panel solo no
necesita. Queda como destino si se muda la app del paciente; `core/` está pensado para eso.

**Servicio Go, al lado de billing.** Reutiliza los patrones de `billing-service`, pero parte el
TypeScript de punta a punta y reescribir SQL a Go cuesta más. Dentro de billing no: es otro
contexto y tiene su propia base.

**Migrar también la lógica de la app del paciente.** Duplica el trabajo (unas 3.300 líneas más),
exige una API HTTP versionada y coordinar versiones mínimas en las stores. Se decide por
separado.
