# Credenciales del seed de prueba

> ⚠️ **Solo local.** Estos usuarios existen únicamente en la base que levanta `supabase db reset` sobre tu máquina. `seed.sql` nunca corre en un ambiente remoto: no uses `supabase db push --include-seed`. La contraseña es pública porque está en este repo; no la reutilices en ningún otro lado.

Todos los usuarios tienen la misma contraseña: **`local-seed-cgGqBIrprZGocA9r5Jxm`**

## Usuarios

| Email                             | Contraseña                        | Rol       | Nombre               | Notas                                                                                  |
| --------------------------------- | --------------------------------- | --------- | -------------------- | -------------------------------------------------------------------------------------- |
| `admin@clienteapp.test`           | `local-seed-cgGqBIrprZGocA9r5Jxm` | admin     | Carlos Administrador | Admin con perfil de terapeuta (MT-0000), 0 pacientes asignados; aparece en /terapeutas |
| `admin.terapeuta@clienteapp.test` | `local-seed-cgGqBIrprZGocA9r5Jxm` | admin     | Ana García           | Admin con perfil de terapeuta (MT-0001). Asignó a todos los pacientes                  |
| `terapeuta1@clienteapp.test`      | `local-seed-cgGqBIrprZGocA9r5Jxm` | terapeuta | Laura Martínez       | Matrícula MT-0002. Tiene asignados a Sofía Rodríguez y Martín López                    |
| `terapeuta2@clienteapp.test`      | `local-seed-cgGqBIrprZGocA9r5Jxm` | terapeuta | Diego Fernández      | Matrícula MT-0003. Tiene asignados a Valentina Torres y Sebastián Díaz                 |
| `paciente1@clienteapp.test`       | `local-seed-cgGqBIrprZGocA9r5Jxm` | paciente  | Sofía Rodríguez      | Asignada a Laura Martínez. Etapa activa: Duelo no resuelto / Modalidad Río 24          |
| `paciente2@clienteapp.test`       | `local-seed-cgGqBIrprZGocA9r5Jxm` | paciente  | Martín López         | Asignado a Laura Martínez. Etapa activa: Conflicto interno / Modalidad Bosque 16       |
| `paciente3@clienteapp.test`       | `local-seed-cgGqBIrprZGocA9r5Jxm` | paciente  | Valentina Torres     | Asignada a Diego Fernández. Etapa activa: Duelo no resuelto / Modalidad Río 32         |
| `paciente4@clienteapp.test`       | `local-seed-cgGqBIrprZGocA9r5Jxm` | paciente  | Sebastián Díaz       | Asignado a Diego Fernández. Etapa activa: Desconexión emocional / Modalidad Bosque 16  |

## Datos clínicos por paciente

Causas/algoritmos/bloqueos del catálogo de ejemplo (ver supabase/migrations/20260719120100_seed_clinical_catalog.sql). Son ficticios.

| Paciente         | Terapeuta       | Causa                 | Algoritmo                         | Modalidad             | Nivel actual                   |
| ---------------- | --------------- | --------------------- | --------------------------------- | --------------------- | ------------------------------ |
| Sofía Rodríguez  | Laura Martínez  | Duelo no resuelto     | 3 — Algoritmo del enfoque         | Río 24 (4 niveles)    | Nivel 1 completado (score 4/5) |
| Martín López     | Laura Martínez  | Conflicto interno     | 30 — Algoritmo de la flexibilidad | Bosque 16 (4 niveles) | Nivel 1 completado (score 3/5) |
| Valentina Torres | Diego Fernández | Duelo no resuelto     | 25 — Algoritmo de la apertura     | Río 32 (4 niveles)    | Nivel 1 completado (score 4/5) |
| Sebastián Díaz   | Diego Fernández | Desconexión emocional | 16 — Algoritmo de la iniciativa   | Bosque 16 (4 niveles) | Nivel 1 completado (score 5/5) |

## Para resetear la base de datos con el seed

```bash
supabase db reset
```
