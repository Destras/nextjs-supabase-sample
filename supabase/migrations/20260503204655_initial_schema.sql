
  create table "public"."alfabetos" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."alfabetos" enable row level security;


  create table "public"."algoritmo_etapas" (
    "algoritmo_id" uuid not null,
    "numero_etapa" integer not null,
    "frase_esperada" text not null
      );


alter table "public"."algoritmo_etapas" enable row level security;


  create table "public"."algoritmos" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "definicion" text,
    "comportamiento" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."algoritmos" enable row level security;


  create table "public"."asignaciones_paciente" (
    "id" uuid not null default gen_random_uuid(),
    "paciente_id" uuid not null,
    "terapeuta_id" uuid not null,
    "fecha_desde" date not null,
    "fecha_hasta" date,
    "motivo" text,
    "asignado_por" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."asignaciones_paciente" enable row level security;


  create table "public"."audit_log" (
    "id" uuid not null default gen_random_uuid(),
    "tabla" text not null,
    "registro_id" text not null,
    "operacion" text not null,
    "usuario_id" uuid,
    "datos_anteriores" jsonb,
    "datos_nuevos" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."audit_log" enable row level security;


  create table "public"."bloqueos" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."bloqueos" enable row level security;


  create table "public"."causa_etapas" (
    "causa_id" uuid not null,
    "numero_etapa" integer not null,
    "frase_esperada" text not null
      );


alter table "public"."causa_etapas" enable row level security;


  create table "public"."causas" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "definicion" text,
    "emociones_esperadas" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."causas" enable row level security;


  create table "public"."contenidos" (
    "id" uuid not null default gen_random_uuid(),
    "tipo" text not null,
    "titulo" text not null,
    "descripcion" text,
    "recurso_ref" text,
    "duracion_seg" integer,
    "metadata" jsonb,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."contenidos" enable row level security;


  create table "public"."entregas_plan" (
    "id" uuid not null default gen_random_uuid(),
    "etapa_id" uuid not null,
    "dia_offset" integer not null,
    "contenido_id" uuid not null,
    "orden" integer not null,
    "fecha_entregada" timestamp with time zone,
    "fecha_consumida" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."entregas_plan" enable row level security;


  create table "public"."estados_etapa" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."estados_etapa" enable row level security;


  create table "public"."estados_paciente" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."estados_paciente" enable row level security;


  create table "public"."estados_terapeuta" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."estados_terapeuta" enable row level security;


  create table "public"."etapa_alfabetos" (
    "etapa_id" uuid not null,
    "alfabeto_id" uuid not null
      );


alter table "public"."etapa_alfabetos" enable row level security;


  create table "public"."etapa_bloqueos" (
    "etapa_id" uuid not null,
    "bloqueo_id" uuid not null
      );


alter table "public"."etapa_bloqueos" enable row level security;


  create table "public"."etapas_tratamiento" (
    "id" uuid not null default gen_random_uuid(),
    "paciente_id" uuid not null,
    "terapeuta_id" uuid not null,
    "causa_id" uuid not null,
    "algoritmo_id" uuid not null,
    "modalidad_id" uuid not null,
    "fecha_inicio" date not null,
    "fecha_finalizacion" date,
    "estado_id" uuid not null,
    "motivo_cierre" text,
    "notas_diagnostico" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."etapas_tratamiento" enable row level security;


  create table "public"."frases_motivacionales" (
    "id" uuid not null default gen_random_uuid(),
    "causa_id" uuid not null,
    "texto" text not null,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."frases_motivacionales" enable row level security;


  create table "public"."modalidades" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "tipo_disco_id" uuid,
    "cantidad_sesiones" integer,
    "cantidad_niveles" integer not null,
    "cadencia_descripcion" text,
    "duracion_meses_estimada" integer,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."modalidades" enable row level security;


  create table "public"."nivel_evaluacion" (
    "id" uuid not null default gen_random_uuid(),
    "nivel_id" uuid not null,
    "score" integer not null,
    "fecha_respuesta" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."nivel_evaluacion" enable row level security;


  create table "public"."niveles" (
    "id" uuid not null default gen_random_uuid(),
    "etapa_id" uuid not null,
    "numero_nivel" integer not null,
    "fecha_seguimiento_esperada" date,
    "fecha_seguimiento_real" date,
    "observaciones" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."niveles" enable row level security;


  create table "public"."notificaciones_outbox" (
    "id" uuid not null default gen_random_uuid(),
    "destinatario_id" uuid not null,
    "destinatario_tipo" text not null,
    "canal" text not null,
    "tipo" text not null,
    "payload" jsonb,
    "programada_para" timestamp with time zone not null,
    "estado" text not null default 'pendiente'::text,
    "intentos" integer not null default 0,
    "ultimo_intento" timestamp with time zone,
    "ultimo_error" text,
    "fecha_envio" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notificaciones_outbox" enable row level security;


  create table "public"."pacientes" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "nombre" text not null,
    "telefono" text,
    "contacto_alternativo" text,
    "relacion_contacto" text,
    "fecha_alta" date,
    "estado_id" uuid,
    "activo" boolean not null default true,
    "fecha_cambio_estado" timestamp with time zone,
    "motivo_cambio_estado" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."pacientes" enable row level security;


  create table "public"."plantilla_entregas" (
    "id" uuid not null default gen_random_uuid(),
    "plantilla_id" uuid not null,
    "dia_offset" integer not null,
    "contenido_id" uuid not null,
    "orden" integer not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."plantilla_entregas" enable row level security;


  create table "public"."plantillas_tratamiento" (
    "id" uuid not null default gen_random_uuid(),
    "causa_id" uuid not null,
    "modalidad_id" uuid not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."plantillas_tratamiento" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "nombre" text,
    "rol_id" uuid,
    "timezone" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."roles" enable row level security;


  create table "public"."terapeutas" (
    "id" uuid not null,
    "matricula" text,
    "especialidad" text,
    "estado_id" uuid,
    "activo" boolean not null default true,
    "fecha_cambio_estado" timestamp with time zone,
    "motivo_cambio_estado" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."terapeutas" enable row level security;


  create table "public"."tipos_disco" (
    "id" uuid not null default gen_random_uuid(),
    "codigo" text not null,
    "nombre" text not null,
    "descripcion" text,
    "activo" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."tipos_disco" enable row level security;

CREATE UNIQUE INDEX alfabetos_codigo_key ON public.alfabetos USING btree (codigo);

CREATE UNIQUE INDEX alfabetos_pkey ON public.alfabetos USING btree (id);

CREATE UNIQUE INDEX algoritmo_etapas_pkey ON public.algoritmo_etapas USING btree (algoritmo_id, numero_etapa);

CREATE UNIQUE INDEX algoritmos_codigo_key ON public.algoritmos USING btree (codigo);

CREATE UNIQUE INDEX algoritmos_pkey ON public.algoritmos USING btree (id);

CREATE UNIQUE INDEX asignaciones_paciente_activa_idx ON public.asignaciones_paciente USING btree (paciente_id) WHERE (fecha_hasta IS NULL);

CREATE UNIQUE INDEX asignaciones_paciente_pkey ON public.asignaciones_paciente USING btree (id);

CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id);

CREATE UNIQUE INDEX bloqueos_codigo_key ON public.bloqueos USING btree (codigo);

CREATE UNIQUE INDEX bloqueos_pkey ON public.bloqueos USING btree (id);

CREATE UNIQUE INDEX causa_etapas_pkey ON public.causa_etapas USING btree (causa_id, numero_etapa);

CREATE UNIQUE INDEX causas_codigo_key ON public.causas USING btree (codigo);

CREATE UNIQUE INDEX causas_pkey ON public.causas USING btree (id);

CREATE UNIQUE INDEX contenidos_pkey ON public.contenidos USING btree (id);

CREATE UNIQUE INDEX entregas_plan_pkey ON public.entregas_plan USING btree (id);

CREATE UNIQUE INDEX estados_etapa_codigo_key ON public.estados_etapa USING btree (codigo);

CREATE UNIQUE INDEX estados_etapa_pkey ON public.estados_etapa USING btree (id);

CREATE UNIQUE INDEX estados_paciente_codigo_key ON public.estados_paciente USING btree (codigo);

CREATE UNIQUE INDEX estados_paciente_pkey ON public.estados_paciente USING btree (id);

CREATE UNIQUE INDEX estados_terapeuta_codigo_key ON public.estados_terapeuta USING btree (codigo);

CREATE UNIQUE INDEX estados_terapeuta_pkey ON public.estados_terapeuta USING btree (id);

CREATE UNIQUE INDEX etapa_alfabetos_pkey ON public.etapa_alfabetos USING btree (etapa_id, alfabeto_id);

CREATE UNIQUE INDEX etapa_bloqueos_pkey ON public.etapa_bloqueos USING btree (etapa_id, bloqueo_id);

CREATE UNIQUE INDEX etapas_tratamiento_pkey ON public.etapas_tratamiento USING btree (id);

CREATE UNIQUE INDEX frases_motivacionales_pkey ON public.frases_motivacionales USING btree (id);

CREATE UNIQUE INDEX modalidades_codigo_key ON public.modalidades USING btree (codigo);

CREATE UNIQUE INDEX modalidades_pkey ON public.modalidades USING btree (id);

CREATE UNIQUE INDEX nivel_evaluacion_nivel_id_key ON public.nivel_evaluacion USING btree (nivel_id);

CREATE UNIQUE INDEX nivel_evaluacion_pkey ON public.nivel_evaluacion USING btree (id);

CREATE UNIQUE INDEX niveles_etapa_id_numero_nivel_key ON public.niveles USING btree (etapa_id, numero_nivel);

CREATE UNIQUE INDEX niveles_pkey ON public.niveles USING btree (id);

CREATE UNIQUE INDEX notificaciones_outbox_pkey ON public.notificaciones_outbox USING btree (id);

CREATE UNIQUE INDEX pacientes_pkey ON public.pacientes USING btree (id);

CREATE UNIQUE INDEX plantilla_entregas_pkey ON public.plantilla_entregas USING btree (id);

CREATE UNIQUE INDEX plantillas_tratamiento_causa_id_modalidad_id_nombre_key ON public.plantillas_tratamiento USING btree (causa_id, modalidad_id, nombre);

CREATE UNIQUE INDEX plantillas_tratamiento_pkey ON public.plantillas_tratamiento USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX roles_codigo_key ON public.roles USING btree (codigo);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX terapeutas_pkey ON public.terapeutas USING btree (id);

CREATE UNIQUE INDEX tipos_disco_codigo_key ON public.tipos_disco USING btree (codigo);

CREATE UNIQUE INDEX tipos_disco_pkey ON public.tipos_disco USING btree (id);

alter table "public"."alfabetos" add constraint "alfabetos_pkey" PRIMARY KEY using index "alfabetos_pkey";

alter table "public"."algoritmo_etapas" add constraint "algoritmo_etapas_pkey" PRIMARY KEY using index "algoritmo_etapas_pkey";

alter table "public"."algoritmos" add constraint "algoritmos_pkey" PRIMARY KEY using index "algoritmos_pkey";

alter table "public"."asignaciones_paciente" add constraint "asignaciones_paciente_pkey" PRIMARY KEY using index "asignaciones_paciente_pkey";

alter table "public"."audit_log" add constraint "audit_log_pkey" PRIMARY KEY using index "audit_log_pkey";

alter table "public"."bloqueos" add constraint "bloqueos_pkey" PRIMARY KEY using index "bloqueos_pkey";

alter table "public"."causa_etapas" add constraint "causa_etapas_pkey" PRIMARY KEY using index "causa_etapas_pkey";

alter table "public"."causas" add constraint "causas_pkey" PRIMARY KEY using index "causas_pkey";

alter table "public"."contenidos" add constraint "contenidos_pkey" PRIMARY KEY using index "contenidos_pkey";

alter table "public"."entregas_plan" add constraint "entregas_plan_pkey" PRIMARY KEY using index "entregas_plan_pkey";

alter table "public"."estados_etapa" add constraint "estados_etapa_pkey" PRIMARY KEY using index "estados_etapa_pkey";

alter table "public"."estados_paciente" add constraint "estados_paciente_pkey" PRIMARY KEY using index "estados_paciente_pkey";

alter table "public"."estados_terapeuta" add constraint "estados_terapeuta_pkey" PRIMARY KEY using index "estados_terapeuta_pkey";

alter table "public"."etapa_alfabetos" add constraint "etapa_alfabetos_pkey" PRIMARY KEY using index "etapa_alfabetos_pkey";

alter table "public"."etapa_bloqueos" add constraint "etapa_bloqueos_pkey" PRIMARY KEY using index "etapa_bloqueos_pkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_pkey" PRIMARY KEY using index "etapas_tratamiento_pkey";

alter table "public"."frases_motivacionales" add constraint "frases_motivacionales_pkey" PRIMARY KEY using index "frases_motivacionales_pkey";

alter table "public"."modalidades" add constraint "modalidades_pkey" PRIMARY KEY using index "modalidades_pkey";

alter table "public"."nivel_evaluacion" add constraint "nivel_evaluacion_pkey" PRIMARY KEY using index "nivel_evaluacion_pkey";

alter table "public"."niveles" add constraint "niveles_pkey" PRIMARY KEY using index "niveles_pkey";

alter table "public"."notificaciones_outbox" add constraint "notificaciones_outbox_pkey" PRIMARY KEY using index "notificaciones_outbox_pkey";

alter table "public"."pacientes" add constraint "pacientes_pkey" PRIMARY KEY using index "pacientes_pkey";

alter table "public"."plantilla_entregas" add constraint "plantilla_entregas_pkey" PRIMARY KEY using index "plantilla_entregas_pkey";

alter table "public"."plantillas_tratamiento" add constraint "plantillas_tratamiento_pkey" PRIMARY KEY using index "plantillas_tratamiento_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."terapeutas" add constraint "terapeutas_pkey" PRIMARY KEY using index "terapeutas_pkey";

alter table "public"."tipos_disco" add constraint "tipos_disco_pkey" PRIMARY KEY using index "tipos_disco_pkey";

alter table "public"."alfabetos" add constraint "alfabetos_codigo_key" UNIQUE using index "alfabetos_codigo_key";

alter table "public"."algoritmo_etapas" add constraint "algoritmo_etapas_algoritmo_id_fkey" FOREIGN KEY (algoritmo_id) REFERENCES public.algoritmos(id) not valid;

alter table "public"."algoritmo_etapas" validate constraint "algoritmo_etapas_algoritmo_id_fkey";

alter table "public"."algoritmos" add constraint "algoritmos_codigo_key" UNIQUE using index "algoritmos_codigo_key";

alter table "public"."asignaciones_paciente" add constraint "asignaciones_paciente_asignado_por_fkey" FOREIGN KEY (asignado_por) REFERENCES public.profiles(id) not valid;

alter table "public"."asignaciones_paciente" validate constraint "asignaciones_paciente_asignado_por_fkey";

alter table "public"."asignaciones_paciente" add constraint "asignaciones_paciente_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) not valid;

alter table "public"."asignaciones_paciente" validate constraint "asignaciones_paciente_paciente_id_fkey";

alter table "public"."asignaciones_paciente" add constraint "asignaciones_paciente_terapeuta_id_fkey" FOREIGN KEY (terapeuta_id) REFERENCES public.terapeutas(id) not valid;

alter table "public"."asignaciones_paciente" validate constraint "asignaciones_paciente_terapeuta_id_fkey";

alter table "public"."audit_log" add constraint "audit_log_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) not valid;

alter table "public"."audit_log" validate constraint "audit_log_usuario_id_fkey";

alter table "public"."bloqueos" add constraint "bloqueos_codigo_key" UNIQUE using index "bloqueos_codigo_key";

alter table "public"."causa_etapas" add constraint "causa_etapas_causa_id_fkey" FOREIGN KEY (causa_id) REFERENCES public.causas(id) not valid;

alter table "public"."causa_etapas" validate constraint "causa_etapas_causa_id_fkey";

alter table "public"."causas" add constraint "causas_codigo_key" UNIQUE using index "causas_codigo_key";

alter table "public"."entregas_plan" add constraint "entregas_plan_contenido_id_fkey" FOREIGN KEY (contenido_id) REFERENCES public.contenidos(id) not valid;

alter table "public"."entregas_plan" validate constraint "entregas_plan_contenido_id_fkey";

alter table "public"."entregas_plan" add constraint "entregas_plan_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES public.etapas_tratamiento(id) not valid;

alter table "public"."entregas_plan" validate constraint "entregas_plan_etapa_id_fkey";

alter table "public"."estados_etapa" add constraint "estados_etapa_codigo_key" UNIQUE using index "estados_etapa_codigo_key";

alter table "public"."estados_paciente" add constraint "estados_paciente_codigo_key" UNIQUE using index "estados_paciente_codigo_key";

alter table "public"."estados_terapeuta" add constraint "estados_terapeuta_codigo_key" UNIQUE using index "estados_terapeuta_codigo_key";

alter table "public"."etapa_alfabetos" add constraint "etapa_alfabetos_alfabeto_id_fkey" FOREIGN KEY (alfabeto_id) REFERENCES public.alfabetos(id) not valid;

alter table "public"."etapa_alfabetos" validate constraint "etapa_alfabetos_alfabeto_id_fkey";

alter table "public"."etapa_alfabetos" add constraint "etapa_alfabetos_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES public.etapas_tratamiento(id) not valid;

alter table "public"."etapa_alfabetos" validate constraint "etapa_alfabetos_etapa_id_fkey";

alter table "public"."etapa_bloqueos" add constraint "etapa_bloqueos_bloqueo_id_fkey" FOREIGN KEY (bloqueo_id) REFERENCES public.bloqueos(id) not valid;

alter table "public"."etapa_bloqueos" validate constraint "etapa_bloqueos_bloqueo_id_fkey";

alter table "public"."etapa_bloqueos" add constraint "etapa_bloqueos_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES public.etapas_tratamiento(id) not valid;

alter table "public"."etapa_bloqueos" validate constraint "etapa_bloqueos_etapa_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_algoritmo_id_fkey" FOREIGN KEY (algoritmo_id) REFERENCES public.algoritmos(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_algoritmo_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_causa_id_fkey" FOREIGN KEY (causa_id) REFERENCES public.causas(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_causa_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_estado_id_fkey" FOREIGN KEY (estado_id) REFERENCES public.estados_etapa(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_estado_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_modalidad_id_fkey" FOREIGN KEY (modalidad_id) REFERENCES public.modalidades(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_modalidad_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_paciente_id_fkey";

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_terapeuta_id_fkey" FOREIGN KEY (terapeuta_id) REFERENCES public.terapeutas(id) not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_terapeuta_id_fkey";

alter table "public"."frases_motivacionales" add constraint "frases_motivacionales_causa_id_fkey" FOREIGN KEY (causa_id) REFERENCES public.causas(id) not valid;

alter table "public"."frases_motivacionales" validate constraint "frases_motivacionales_causa_id_fkey";

alter table "public"."modalidades" add constraint "modalidades_codigo_key" UNIQUE using index "modalidades_codigo_key";

alter table "public"."modalidades" add constraint "modalidades_tipo_disco_id_fkey" FOREIGN KEY (tipo_disco_id) REFERENCES public.tipos_disco(id) not valid;

alter table "public"."modalidades" validate constraint "modalidades_tipo_disco_id_fkey";

alter table "public"."nivel_evaluacion" add constraint "nivel_evaluacion_nivel_id_fkey" FOREIGN KEY (nivel_id) REFERENCES public.niveles(id) not valid;

alter table "public"."nivel_evaluacion" validate constraint "nivel_evaluacion_nivel_id_fkey";

alter table "public"."nivel_evaluacion" add constraint "nivel_evaluacion_nivel_id_key" UNIQUE using index "nivel_evaluacion_nivel_id_key";

alter table "public"."nivel_evaluacion" add constraint "nivel_evaluacion_score_check" CHECK (((score >= 1) AND (score <= 5))) not valid;

alter table "public"."nivel_evaluacion" validate constraint "nivel_evaluacion_score_check";

alter table "public"."niveles" add constraint "niveles_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES public.etapas_tratamiento(id) not valid;

alter table "public"."niveles" validate constraint "niveles_etapa_id_fkey";

alter table "public"."niveles" add constraint "niveles_etapa_id_numero_nivel_key" UNIQUE using index "niveles_etapa_id_numero_nivel_key";

alter table "public"."notificaciones_outbox" add constraint "notificaciones_outbox_destinatario_id_fkey" FOREIGN KEY (destinatario_id) REFERENCES public.profiles(id) not valid;

alter table "public"."notificaciones_outbox" validate constraint "notificaciones_outbox_destinatario_id_fkey";

alter table "public"."pacientes" add constraint "pacientes_estado_id_fkey" FOREIGN KEY (estado_id) REFERENCES public.estados_paciente(id) not valid;

alter table "public"."pacientes" validate constraint "pacientes_estado_id_fkey";

alter table "public"."pacientes" add constraint "pacientes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."pacientes" validate constraint "pacientes_user_id_fkey";

alter table "public"."plantilla_entregas" add constraint "plantilla_entregas_contenido_id_fkey" FOREIGN KEY (contenido_id) REFERENCES public.contenidos(id) not valid;

alter table "public"."plantilla_entregas" validate constraint "plantilla_entregas_contenido_id_fkey";

alter table "public"."plantilla_entregas" add constraint "plantilla_entregas_plantilla_id_fkey" FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_tratamiento(id) not valid;

alter table "public"."plantilla_entregas" validate constraint "plantilla_entregas_plantilla_id_fkey";

alter table "public"."plantillas_tratamiento" add constraint "plantillas_tratamiento_causa_id_fkey" FOREIGN KEY (causa_id) REFERENCES public.causas(id) not valid;

alter table "public"."plantillas_tratamiento" validate constraint "plantillas_tratamiento_causa_id_fkey";

alter table "public"."plantillas_tratamiento" add constraint "plantillas_tratamiento_causa_id_modalidad_id_nombre_key" UNIQUE using index "plantillas_tratamiento_causa_id_modalidad_id_nombre_key";

alter table "public"."plantillas_tratamiento" add constraint "plantillas_tratamiento_modalidad_id_fkey" FOREIGN KEY (modalidad_id) REFERENCES public.modalidades(id) not valid;

alter table "public"."plantillas_tratamiento" validate constraint "plantillas_tratamiento_modalidad_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_rol_id_fkey" FOREIGN KEY (rol_id) REFERENCES public.roles(id) not valid;

alter table "public"."profiles" validate constraint "profiles_rol_id_fkey";

alter table "public"."roles" add constraint "roles_codigo_key" UNIQUE using index "roles_codigo_key";

alter table "public"."terapeutas" add constraint "terapeutas_estado_id_fkey" FOREIGN KEY (estado_id) REFERENCES public.estados_terapeuta(id) not valid;

alter table "public"."terapeutas" validate constraint "terapeutas_estado_id_fkey";

alter table "public"."terapeutas" add constraint "terapeutas_id_fkey" FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."terapeutas" validate constraint "terapeutas_id_fkey";

alter table "public"."tipos_disco" add constraint "tipos_disco_codigo_key" UNIQUE using index "tipos_disco_codigo_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant delete on table "public"."alfabetos" to "anon";

grant insert on table "public"."alfabetos" to "anon";

grant references on table "public"."alfabetos" to "anon";

grant select on table "public"."alfabetos" to "anon";

grant trigger on table "public"."alfabetos" to "anon";

grant truncate on table "public"."alfabetos" to "anon";

grant update on table "public"."alfabetos" to "anon";

grant delete on table "public"."alfabetos" to "authenticated";

grant insert on table "public"."alfabetos" to "authenticated";

grant references on table "public"."alfabetos" to "authenticated";

grant select on table "public"."alfabetos" to "authenticated";

grant trigger on table "public"."alfabetos" to "authenticated";

grant truncate on table "public"."alfabetos" to "authenticated";

grant update on table "public"."alfabetos" to "authenticated";

grant delete on table "public"."alfabetos" to "service_role";

grant insert on table "public"."alfabetos" to "service_role";

grant references on table "public"."alfabetos" to "service_role";

grant select on table "public"."alfabetos" to "service_role";

grant trigger on table "public"."alfabetos" to "service_role";

grant truncate on table "public"."alfabetos" to "service_role";

grant update on table "public"."alfabetos" to "service_role";

grant delete on table "public"."algoritmo_etapas" to "anon";

grant insert on table "public"."algoritmo_etapas" to "anon";

grant references on table "public"."algoritmo_etapas" to "anon";

grant select on table "public"."algoritmo_etapas" to "anon";

grant trigger on table "public"."algoritmo_etapas" to "anon";

grant truncate on table "public"."algoritmo_etapas" to "anon";

grant update on table "public"."algoritmo_etapas" to "anon";

grant delete on table "public"."algoritmo_etapas" to "authenticated";

grant insert on table "public"."algoritmo_etapas" to "authenticated";

grant references on table "public"."algoritmo_etapas" to "authenticated";

grant select on table "public"."algoritmo_etapas" to "authenticated";

grant trigger on table "public"."algoritmo_etapas" to "authenticated";

grant truncate on table "public"."algoritmo_etapas" to "authenticated";

grant update on table "public"."algoritmo_etapas" to "authenticated";

grant delete on table "public"."algoritmo_etapas" to "service_role";

grant insert on table "public"."algoritmo_etapas" to "service_role";

grant references on table "public"."algoritmo_etapas" to "service_role";

grant select on table "public"."algoritmo_etapas" to "service_role";

grant trigger on table "public"."algoritmo_etapas" to "service_role";

grant truncate on table "public"."algoritmo_etapas" to "service_role";

grant update on table "public"."algoritmo_etapas" to "service_role";

grant delete on table "public"."algoritmos" to "anon";

grant insert on table "public"."algoritmos" to "anon";

grant references on table "public"."algoritmos" to "anon";

grant select on table "public"."algoritmos" to "anon";

grant trigger on table "public"."algoritmos" to "anon";

grant truncate on table "public"."algoritmos" to "anon";

grant update on table "public"."algoritmos" to "anon";

grant delete on table "public"."algoritmos" to "authenticated";

grant insert on table "public"."algoritmos" to "authenticated";

grant references on table "public"."algoritmos" to "authenticated";

grant select on table "public"."algoritmos" to "authenticated";

grant trigger on table "public"."algoritmos" to "authenticated";

grant truncate on table "public"."algoritmos" to "authenticated";

grant update on table "public"."algoritmos" to "authenticated";

grant delete on table "public"."algoritmos" to "service_role";

grant insert on table "public"."algoritmos" to "service_role";

grant references on table "public"."algoritmos" to "service_role";

grant select on table "public"."algoritmos" to "service_role";

grant trigger on table "public"."algoritmos" to "service_role";

grant truncate on table "public"."algoritmos" to "service_role";

grant update on table "public"."algoritmos" to "service_role";

grant delete on table "public"."asignaciones_paciente" to "anon";

grant insert on table "public"."asignaciones_paciente" to "anon";

grant references on table "public"."asignaciones_paciente" to "anon";

grant select on table "public"."asignaciones_paciente" to "anon";

grant trigger on table "public"."asignaciones_paciente" to "anon";

grant truncate on table "public"."asignaciones_paciente" to "anon";

grant update on table "public"."asignaciones_paciente" to "anon";

grant delete on table "public"."asignaciones_paciente" to "authenticated";

grant insert on table "public"."asignaciones_paciente" to "authenticated";

grant references on table "public"."asignaciones_paciente" to "authenticated";

grant select on table "public"."asignaciones_paciente" to "authenticated";

grant trigger on table "public"."asignaciones_paciente" to "authenticated";

grant truncate on table "public"."asignaciones_paciente" to "authenticated";

grant update on table "public"."asignaciones_paciente" to "authenticated";

grant delete on table "public"."asignaciones_paciente" to "service_role";

grant insert on table "public"."asignaciones_paciente" to "service_role";

grant references on table "public"."asignaciones_paciente" to "service_role";

grant select on table "public"."asignaciones_paciente" to "service_role";

grant trigger on table "public"."asignaciones_paciente" to "service_role";

grant truncate on table "public"."asignaciones_paciente" to "service_role";

grant update on table "public"."asignaciones_paciente" to "service_role";

grant delete on table "public"."audit_log" to "anon";

grant insert on table "public"."audit_log" to "anon";

grant references on table "public"."audit_log" to "anon";

grant select on table "public"."audit_log" to "anon";

grant trigger on table "public"."audit_log" to "anon";

grant truncate on table "public"."audit_log" to "anon";

grant update on table "public"."audit_log" to "anon";

grant delete on table "public"."audit_log" to "authenticated";

grant insert on table "public"."audit_log" to "authenticated";

grant references on table "public"."audit_log" to "authenticated";

grant select on table "public"."audit_log" to "authenticated";

grant trigger on table "public"."audit_log" to "authenticated";

grant truncate on table "public"."audit_log" to "authenticated";

grant update on table "public"."audit_log" to "authenticated";

grant delete on table "public"."audit_log" to "service_role";

grant insert on table "public"."audit_log" to "service_role";

grant references on table "public"."audit_log" to "service_role";

grant select on table "public"."audit_log" to "service_role";

grant trigger on table "public"."audit_log" to "service_role";

grant truncate on table "public"."audit_log" to "service_role";

grant update on table "public"."audit_log" to "service_role";

grant delete on table "public"."bloqueos" to "anon";

grant insert on table "public"."bloqueos" to "anon";

grant references on table "public"."bloqueos" to "anon";

grant select on table "public"."bloqueos" to "anon";

grant trigger on table "public"."bloqueos" to "anon";

grant truncate on table "public"."bloqueos" to "anon";

grant update on table "public"."bloqueos" to "anon";

grant delete on table "public"."bloqueos" to "authenticated";

grant insert on table "public"."bloqueos" to "authenticated";

grant references on table "public"."bloqueos" to "authenticated";

grant select on table "public"."bloqueos" to "authenticated";

grant trigger on table "public"."bloqueos" to "authenticated";

grant truncate on table "public"."bloqueos" to "authenticated";

grant update on table "public"."bloqueos" to "authenticated";

grant delete on table "public"."bloqueos" to "service_role";

grant insert on table "public"."bloqueos" to "service_role";

grant references on table "public"."bloqueos" to "service_role";

grant select on table "public"."bloqueos" to "service_role";

grant trigger on table "public"."bloqueos" to "service_role";

grant truncate on table "public"."bloqueos" to "service_role";

grant update on table "public"."bloqueos" to "service_role";

grant delete on table "public"."causa_etapas" to "anon";

grant insert on table "public"."causa_etapas" to "anon";

grant references on table "public"."causa_etapas" to "anon";

grant select on table "public"."causa_etapas" to "anon";

grant trigger on table "public"."causa_etapas" to "anon";

grant truncate on table "public"."causa_etapas" to "anon";

grant update on table "public"."causa_etapas" to "anon";

grant delete on table "public"."causa_etapas" to "authenticated";

grant insert on table "public"."causa_etapas" to "authenticated";

grant references on table "public"."causa_etapas" to "authenticated";

grant select on table "public"."causa_etapas" to "authenticated";

grant trigger on table "public"."causa_etapas" to "authenticated";

grant truncate on table "public"."causa_etapas" to "authenticated";

grant update on table "public"."causa_etapas" to "authenticated";

grant delete on table "public"."causa_etapas" to "service_role";

grant insert on table "public"."causa_etapas" to "service_role";

grant references on table "public"."causa_etapas" to "service_role";

grant select on table "public"."causa_etapas" to "service_role";

grant trigger on table "public"."causa_etapas" to "service_role";

grant truncate on table "public"."causa_etapas" to "service_role";

grant update on table "public"."causa_etapas" to "service_role";

grant delete on table "public"."causas" to "anon";

grant insert on table "public"."causas" to "anon";

grant references on table "public"."causas" to "anon";

grant select on table "public"."causas" to "anon";

grant trigger on table "public"."causas" to "anon";

grant truncate on table "public"."causas" to "anon";

grant update on table "public"."causas" to "anon";

grant delete on table "public"."causas" to "authenticated";

grant insert on table "public"."causas" to "authenticated";

grant references on table "public"."causas" to "authenticated";

grant select on table "public"."causas" to "authenticated";

grant trigger on table "public"."causas" to "authenticated";

grant truncate on table "public"."causas" to "authenticated";

grant update on table "public"."causas" to "authenticated";

grant delete on table "public"."causas" to "service_role";

grant insert on table "public"."causas" to "service_role";

grant references on table "public"."causas" to "service_role";

grant select on table "public"."causas" to "service_role";

grant trigger on table "public"."causas" to "service_role";

grant truncate on table "public"."causas" to "service_role";

grant update on table "public"."causas" to "service_role";

grant delete on table "public"."contenidos" to "anon";

grant insert on table "public"."contenidos" to "anon";

grant references on table "public"."contenidos" to "anon";

grant select on table "public"."contenidos" to "anon";

grant trigger on table "public"."contenidos" to "anon";

grant truncate on table "public"."contenidos" to "anon";

grant update on table "public"."contenidos" to "anon";

grant delete on table "public"."contenidos" to "authenticated";

grant insert on table "public"."contenidos" to "authenticated";

grant references on table "public"."contenidos" to "authenticated";

grant select on table "public"."contenidos" to "authenticated";

grant trigger on table "public"."contenidos" to "authenticated";

grant truncate on table "public"."contenidos" to "authenticated";

grant update on table "public"."contenidos" to "authenticated";

grant delete on table "public"."contenidos" to "service_role";

grant insert on table "public"."contenidos" to "service_role";

grant references on table "public"."contenidos" to "service_role";

grant select on table "public"."contenidos" to "service_role";

grant trigger on table "public"."contenidos" to "service_role";

grant truncate on table "public"."contenidos" to "service_role";

grant update on table "public"."contenidos" to "service_role";

grant delete on table "public"."entregas_plan" to "anon";

grant insert on table "public"."entregas_plan" to "anon";

grant references on table "public"."entregas_plan" to "anon";

grant select on table "public"."entregas_plan" to "anon";

grant trigger on table "public"."entregas_plan" to "anon";

grant truncate on table "public"."entregas_plan" to "anon";

grant update on table "public"."entregas_plan" to "anon";

grant delete on table "public"."entregas_plan" to "authenticated";

grant insert on table "public"."entregas_plan" to "authenticated";

grant references on table "public"."entregas_plan" to "authenticated";

grant select on table "public"."entregas_plan" to "authenticated";

grant trigger on table "public"."entregas_plan" to "authenticated";

grant truncate on table "public"."entregas_plan" to "authenticated";

grant update on table "public"."entregas_plan" to "authenticated";

grant delete on table "public"."entregas_plan" to "service_role";

grant insert on table "public"."entregas_plan" to "service_role";

grant references on table "public"."entregas_plan" to "service_role";

grant select on table "public"."entregas_plan" to "service_role";

grant trigger on table "public"."entregas_plan" to "service_role";

grant truncate on table "public"."entregas_plan" to "service_role";

grant update on table "public"."entregas_plan" to "service_role";

grant delete on table "public"."estados_etapa" to "anon";

grant insert on table "public"."estados_etapa" to "anon";

grant references on table "public"."estados_etapa" to "anon";

grant select on table "public"."estados_etapa" to "anon";

grant trigger on table "public"."estados_etapa" to "anon";

grant truncate on table "public"."estados_etapa" to "anon";

grant update on table "public"."estados_etapa" to "anon";

grant delete on table "public"."estados_etapa" to "authenticated";

grant insert on table "public"."estados_etapa" to "authenticated";

grant references on table "public"."estados_etapa" to "authenticated";

grant select on table "public"."estados_etapa" to "authenticated";

grant trigger on table "public"."estados_etapa" to "authenticated";

grant truncate on table "public"."estados_etapa" to "authenticated";

grant update on table "public"."estados_etapa" to "authenticated";

grant delete on table "public"."estados_etapa" to "service_role";

grant insert on table "public"."estados_etapa" to "service_role";

grant references on table "public"."estados_etapa" to "service_role";

grant select on table "public"."estados_etapa" to "service_role";

grant trigger on table "public"."estados_etapa" to "service_role";

grant truncate on table "public"."estados_etapa" to "service_role";

grant update on table "public"."estados_etapa" to "service_role";

grant delete on table "public"."estados_paciente" to "anon";

grant insert on table "public"."estados_paciente" to "anon";

grant references on table "public"."estados_paciente" to "anon";

grant select on table "public"."estados_paciente" to "anon";

grant trigger on table "public"."estados_paciente" to "anon";

grant truncate on table "public"."estados_paciente" to "anon";

grant update on table "public"."estados_paciente" to "anon";

grant delete on table "public"."estados_paciente" to "authenticated";

grant insert on table "public"."estados_paciente" to "authenticated";

grant references on table "public"."estados_paciente" to "authenticated";

grant select on table "public"."estados_paciente" to "authenticated";

grant trigger on table "public"."estados_paciente" to "authenticated";

grant truncate on table "public"."estados_paciente" to "authenticated";

grant update on table "public"."estados_paciente" to "authenticated";

grant delete on table "public"."estados_paciente" to "service_role";

grant insert on table "public"."estados_paciente" to "service_role";

grant references on table "public"."estados_paciente" to "service_role";

grant select on table "public"."estados_paciente" to "service_role";

grant trigger on table "public"."estados_paciente" to "service_role";

grant truncate on table "public"."estados_paciente" to "service_role";

grant update on table "public"."estados_paciente" to "service_role";

grant delete on table "public"."estados_terapeuta" to "anon";

grant insert on table "public"."estados_terapeuta" to "anon";

grant references on table "public"."estados_terapeuta" to "anon";

grant select on table "public"."estados_terapeuta" to "anon";

grant trigger on table "public"."estados_terapeuta" to "anon";

grant truncate on table "public"."estados_terapeuta" to "anon";

grant update on table "public"."estados_terapeuta" to "anon";

grant delete on table "public"."estados_terapeuta" to "authenticated";

grant insert on table "public"."estados_terapeuta" to "authenticated";

grant references on table "public"."estados_terapeuta" to "authenticated";

grant select on table "public"."estados_terapeuta" to "authenticated";

grant trigger on table "public"."estados_terapeuta" to "authenticated";

grant truncate on table "public"."estados_terapeuta" to "authenticated";

grant update on table "public"."estados_terapeuta" to "authenticated";

grant delete on table "public"."estados_terapeuta" to "service_role";

grant insert on table "public"."estados_terapeuta" to "service_role";

grant references on table "public"."estados_terapeuta" to "service_role";

grant select on table "public"."estados_terapeuta" to "service_role";

grant trigger on table "public"."estados_terapeuta" to "service_role";

grant truncate on table "public"."estados_terapeuta" to "service_role";

grant update on table "public"."estados_terapeuta" to "service_role";

grant delete on table "public"."etapa_alfabetos" to "anon";

grant insert on table "public"."etapa_alfabetos" to "anon";

grant references on table "public"."etapa_alfabetos" to "anon";

grant select on table "public"."etapa_alfabetos" to "anon";

grant trigger on table "public"."etapa_alfabetos" to "anon";

grant truncate on table "public"."etapa_alfabetos" to "anon";

grant update on table "public"."etapa_alfabetos" to "anon";

grant delete on table "public"."etapa_alfabetos" to "authenticated";

grant insert on table "public"."etapa_alfabetos" to "authenticated";

grant references on table "public"."etapa_alfabetos" to "authenticated";

grant select on table "public"."etapa_alfabetos" to "authenticated";

grant trigger on table "public"."etapa_alfabetos" to "authenticated";

grant truncate on table "public"."etapa_alfabetos" to "authenticated";

grant update on table "public"."etapa_alfabetos" to "authenticated";

grant delete on table "public"."etapa_alfabetos" to "service_role";

grant insert on table "public"."etapa_alfabetos" to "service_role";

grant references on table "public"."etapa_alfabetos" to "service_role";

grant select on table "public"."etapa_alfabetos" to "service_role";

grant trigger on table "public"."etapa_alfabetos" to "service_role";

grant truncate on table "public"."etapa_alfabetos" to "service_role";

grant update on table "public"."etapa_alfabetos" to "service_role";

grant delete on table "public"."etapa_bloqueos" to "anon";

grant insert on table "public"."etapa_bloqueos" to "anon";

grant references on table "public"."etapa_bloqueos" to "anon";

grant select on table "public"."etapa_bloqueos" to "anon";

grant trigger on table "public"."etapa_bloqueos" to "anon";

grant truncate on table "public"."etapa_bloqueos" to "anon";

grant update on table "public"."etapa_bloqueos" to "anon";

grant delete on table "public"."etapa_bloqueos" to "authenticated";

grant insert on table "public"."etapa_bloqueos" to "authenticated";

grant references on table "public"."etapa_bloqueos" to "authenticated";

grant select on table "public"."etapa_bloqueos" to "authenticated";

grant trigger on table "public"."etapa_bloqueos" to "authenticated";

grant truncate on table "public"."etapa_bloqueos" to "authenticated";

grant update on table "public"."etapa_bloqueos" to "authenticated";

grant delete on table "public"."etapa_bloqueos" to "service_role";

grant insert on table "public"."etapa_bloqueos" to "service_role";

grant references on table "public"."etapa_bloqueos" to "service_role";

grant select on table "public"."etapa_bloqueos" to "service_role";

grant trigger on table "public"."etapa_bloqueos" to "service_role";

grant truncate on table "public"."etapa_bloqueos" to "service_role";

grant update on table "public"."etapa_bloqueos" to "service_role";

grant delete on table "public"."etapas_tratamiento" to "anon";

grant insert on table "public"."etapas_tratamiento" to "anon";

grant references on table "public"."etapas_tratamiento" to "anon";

grant select on table "public"."etapas_tratamiento" to "anon";

grant trigger on table "public"."etapas_tratamiento" to "anon";

grant truncate on table "public"."etapas_tratamiento" to "anon";

grant update on table "public"."etapas_tratamiento" to "anon";

grant delete on table "public"."etapas_tratamiento" to "authenticated";

grant insert on table "public"."etapas_tratamiento" to "authenticated";

grant references on table "public"."etapas_tratamiento" to "authenticated";

grant select on table "public"."etapas_tratamiento" to "authenticated";

grant trigger on table "public"."etapas_tratamiento" to "authenticated";

grant truncate on table "public"."etapas_tratamiento" to "authenticated";

grant update on table "public"."etapas_tratamiento" to "authenticated";

grant delete on table "public"."etapas_tratamiento" to "service_role";

grant insert on table "public"."etapas_tratamiento" to "service_role";

grant references on table "public"."etapas_tratamiento" to "service_role";

grant select on table "public"."etapas_tratamiento" to "service_role";

grant trigger on table "public"."etapas_tratamiento" to "service_role";

grant truncate on table "public"."etapas_tratamiento" to "service_role";

grant update on table "public"."etapas_tratamiento" to "service_role";

grant delete on table "public"."frases_motivacionales" to "anon";

grant insert on table "public"."frases_motivacionales" to "anon";

grant references on table "public"."frases_motivacionales" to "anon";

grant select on table "public"."frases_motivacionales" to "anon";

grant trigger on table "public"."frases_motivacionales" to "anon";

grant truncate on table "public"."frases_motivacionales" to "anon";

grant update on table "public"."frases_motivacionales" to "anon";

grant delete on table "public"."frases_motivacionales" to "authenticated";

grant insert on table "public"."frases_motivacionales" to "authenticated";

grant references on table "public"."frases_motivacionales" to "authenticated";

grant select on table "public"."frases_motivacionales" to "authenticated";

grant trigger on table "public"."frases_motivacionales" to "authenticated";

grant truncate on table "public"."frases_motivacionales" to "authenticated";

grant update on table "public"."frases_motivacionales" to "authenticated";

grant delete on table "public"."frases_motivacionales" to "service_role";

grant insert on table "public"."frases_motivacionales" to "service_role";

grant references on table "public"."frases_motivacionales" to "service_role";

grant select on table "public"."frases_motivacionales" to "service_role";

grant trigger on table "public"."frases_motivacionales" to "service_role";

grant truncate on table "public"."frases_motivacionales" to "service_role";

grant update on table "public"."frases_motivacionales" to "service_role";

grant delete on table "public"."modalidades" to "anon";

grant insert on table "public"."modalidades" to "anon";

grant references on table "public"."modalidades" to "anon";

grant select on table "public"."modalidades" to "anon";

grant trigger on table "public"."modalidades" to "anon";

grant truncate on table "public"."modalidades" to "anon";

grant update on table "public"."modalidades" to "anon";

grant delete on table "public"."modalidades" to "authenticated";

grant insert on table "public"."modalidades" to "authenticated";

grant references on table "public"."modalidades" to "authenticated";

grant select on table "public"."modalidades" to "authenticated";

grant trigger on table "public"."modalidades" to "authenticated";

grant truncate on table "public"."modalidades" to "authenticated";

grant update on table "public"."modalidades" to "authenticated";

grant delete on table "public"."modalidades" to "service_role";

grant insert on table "public"."modalidades" to "service_role";

grant references on table "public"."modalidades" to "service_role";

grant select on table "public"."modalidades" to "service_role";

grant trigger on table "public"."modalidades" to "service_role";

grant truncate on table "public"."modalidades" to "service_role";

grant update on table "public"."modalidades" to "service_role";

grant delete on table "public"."nivel_evaluacion" to "anon";

grant insert on table "public"."nivel_evaluacion" to "anon";

grant references on table "public"."nivel_evaluacion" to "anon";

grant select on table "public"."nivel_evaluacion" to "anon";

grant trigger on table "public"."nivel_evaluacion" to "anon";

grant truncate on table "public"."nivel_evaluacion" to "anon";

grant update on table "public"."nivel_evaluacion" to "anon";

grant delete on table "public"."nivel_evaluacion" to "authenticated";

grant insert on table "public"."nivel_evaluacion" to "authenticated";

grant references on table "public"."nivel_evaluacion" to "authenticated";

grant select on table "public"."nivel_evaluacion" to "authenticated";

grant trigger on table "public"."nivel_evaluacion" to "authenticated";

grant truncate on table "public"."nivel_evaluacion" to "authenticated";

grant update on table "public"."nivel_evaluacion" to "authenticated";

grant delete on table "public"."nivel_evaluacion" to "service_role";

grant insert on table "public"."nivel_evaluacion" to "service_role";

grant references on table "public"."nivel_evaluacion" to "service_role";

grant select on table "public"."nivel_evaluacion" to "service_role";

grant trigger on table "public"."nivel_evaluacion" to "service_role";

grant truncate on table "public"."nivel_evaluacion" to "service_role";

grant update on table "public"."nivel_evaluacion" to "service_role";

grant delete on table "public"."niveles" to "anon";

grant insert on table "public"."niveles" to "anon";

grant references on table "public"."niveles" to "anon";

grant select on table "public"."niveles" to "anon";

grant trigger on table "public"."niveles" to "anon";

grant truncate on table "public"."niveles" to "anon";

grant update on table "public"."niveles" to "anon";

grant delete on table "public"."niveles" to "authenticated";

grant insert on table "public"."niveles" to "authenticated";

grant references on table "public"."niveles" to "authenticated";

grant select on table "public"."niveles" to "authenticated";

grant trigger on table "public"."niveles" to "authenticated";

grant truncate on table "public"."niveles" to "authenticated";

grant update on table "public"."niveles" to "authenticated";

grant delete on table "public"."niveles" to "service_role";

grant insert on table "public"."niveles" to "service_role";

grant references on table "public"."niveles" to "service_role";

grant select on table "public"."niveles" to "service_role";

grant trigger on table "public"."niveles" to "service_role";

grant truncate on table "public"."niveles" to "service_role";

grant update on table "public"."niveles" to "service_role";

grant delete on table "public"."notificaciones_outbox" to "anon";

grant insert on table "public"."notificaciones_outbox" to "anon";

grant references on table "public"."notificaciones_outbox" to "anon";

grant select on table "public"."notificaciones_outbox" to "anon";

grant trigger on table "public"."notificaciones_outbox" to "anon";

grant truncate on table "public"."notificaciones_outbox" to "anon";

grant update on table "public"."notificaciones_outbox" to "anon";

grant delete on table "public"."notificaciones_outbox" to "authenticated";

grant insert on table "public"."notificaciones_outbox" to "authenticated";

grant references on table "public"."notificaciones_outbox" to "authenticated";

grant select on table "public"."notificaciones_outbox" to "authenticated";

grant trigger on table "public"."notificaciones_outbox" to "authenticated";

grant truncate on table "public"."notificaciones_outbox" to "authenticated";

grant update on table "public"."notificaciones_outbox" to "authenticated";

grant delete on table "public"."notificaciones_outbox" to "service_role";

grant insert on table "public"."notificaciones_outbox" to "service_role";

grant references on table "public"."notificaciones_outbox" to "service_role";

grant select on table "public"."notificaciones_outbox" to "service_role";

grant trigger on table "public"."notificaciones_outbox" to "service_role";

grant truncate on table "public"."notificaciones_outbox" to "service_role";

grant update on table "public"."notificaciones_outbox" to "service_role";

grant delete on table "public"."pacientes" to "anon";

grant insert on table "public"."pacientes" to "anon";

grant references on table "public"."pacientes" to "anon";

grant select on table "public"."pacientes" to "anon";

grant trigger on table "public"."pacientes" to "anon";

grant truncate on table "public"."pacientes" to "anon";

grant update on table "public"."pacientes" to "anon";

grant delete on table "public"."pacientes" to "authenticated";

grant insert on table "public"."pacientes" to "authenticated";

grant references on table "public"."pacientes" to "authenticated";

grant select on table "public"."pacientes" to "authenticated";

grant trigger on table "public"."pacientes" to "authenticated";

grant truncate on table "public"."pacientes" to "authenticated";

grant update on table "public"."pacientes" to "authenticated";

grant delete on table "public"."pacientes" to "service_role";

grant insert on table "public"."pacientes" to "service_role";

grant references on table "public"."pacientes" to "service_role";

grant select on table "public"."pacientes" to "service_role";

grant trigger on table "public"."pacientes" to "service_role";

grant truncate on table "public"."pacientes" to "service_role";

grant update on table "public"."pacientes" to "service_role";

grant delete on table "public"."plantilla_entregas" to "anon";

grant insert on table "public"."plantilla_entregas" to "anon";

grant references on table "public"."plantilla_entregas" to "anon";

grant select on table "public"."plantilla_entregas" to "anon";

grant trigger on table "public"."plantilla_entregas" to "anon";

grant truncate on table "public"."plantilla_entregas" to "anon";

grant update on table "public"."plantilla_entregas" to "anon";

grant delete on table "public"."plantilla_entregas" to "authenticated";

grant insert on table "public"."plantilla_entregas" to "authenticated";

grant references on table "public"."plantilla_entregas" to "authenticated";

grant select on table "public"."plantilla_entregas" to "authenticated";

grant trigger on table "public"."plantilla_entregas" to "authenticated";

grant truncate on table "public"."plantilla_entregas" to "authenticated";

grant update on table "public"."plantilla_entregas" to "authenticated";

grant delete on table "public"."plantilla_entregas" to "service_role";

grant insert on table "public"."plantilla_entregas" to "service_role";

grant references on table "public"."plantilla_entregas" to "service_role";

grant select on table "public"."plantilla_entregas" to "service_role";

grant trigger on table "public"."plantilla_entregas" to "service_role";

grant truncate on table "public"."plantilla_entregas" to "service_role";

grant update on table "public"."plantilla_entregas" to "service_role";

grant delete on table "public"."plantillas_tratamiento" to "anon";

grant insert on table "public"."plantillas_tratamiento" to "anon";

grant references on table "public"."plantillas_tratamiento" to "anon";

grant select on table "public"."plantillas_tratamiento" to "anon";

grant trigger on table "public"."plantillas_tratamiento" to "anon";

grant truncate on table "public"."plantillas_tratamiento" to "anon";

grant update on table "public"."plantillas_tratamiento" to "anon";

grant delete on table "public"."plantillas_tratamiento" to "authenticated";

grant insert on table "public"."plantillas_tratamiento" to "authenticated";

grant references on table "public"."plantillas_tratamiento" to "authenticated";

grant select on table "public"."plantillas_tratamiento" to "authenticated";

grant trigger on table "public"."plantillas_tratamiento" to "authenticated";

grant truncate on table "public"."plantillas_tratamiento" to "authenticated";

grant update on table "public"."plantillas_tratamiento" to "authenticated";

grant delete on table "public"."plantillas_tratamiento" to "service_role";

grant insert on table "public"."plantillas_tratamiento" to "service_role";

grant references on table "public"."plantillas_tratamiento" to "service_role";

grant select on table "public"."plantillas_tratamiento" to "service_role";

grant trigger on table "public"."plantillas_tratamiento" to "service_role";

grant truncate on table "public"."plantillas_tratamiento" to "service_role";

grant update on table "public"."plantillas_tratamiento" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."terapeutas" to "anon";

grant insert on table "public"."terapeutas" to "anon";

grant references on table "public"."terapeutas" to "anon";

grant select on table "public"."terapeutas" to "anon";

grant trigger on table "public"."terapeutas" to "anon";

grant truncate on table "public"."terapeutas" to "anon";

grant update on table "public"."terapeutas" to "anon";

grant delete on table "public"."terapeutas" to "authenticated";

grant insert on table "public"."terapeutas" to "authenticated";

grant references on table "public"."terapeutas" to "authenticated";

grant select on table "public"."terapeutas" to "authenticated";

grant trigger on table "public"."terapeutas" to "authenticated";

grant truncate on table "public"."terapeutas" to "authenticated";

grant update on table "public"."terapeutas" to "authenticated";

grant delete on table "public"."terapeutas" to "service_role";

grant insert on table "public"."terapeutas" to "service_role";

grant references on table "public"."terapeutas" to "service_role";

grant select on table "public"."terapeutas" to "service_role";

grant trigger on table "public"."terapeutas" to "service_role";

grant truncate on table "public"."terapeutas" to "service_role";

grant update on table "public"."terapeutas" to "service_role";

grant delete on table "public"."tipos_disco" to "anon";

grant insert on table "public"."tipos_disco" to "anon";

grant references on table "public"."tipos_disco" to "anon";

grant select on table "public"."tipos_disco" to "anon";

grant trigger on table "public"."tipos_disco" to "anon";

grant truncate on table "public"."tipos_disco" to "anon";

grant update on table "public"."tipos_disco" to "anon";

grant delete on table "public"."tipos_disco" to "authenticated";

grant insert on table "public"."tipos_disco" to "authenticated";

grant references on table "public"."tipos_disco" to "authenticated";

grant select on table "public"."tipos_disco" to "authenticated";

grant trigger on table "public"."tipos_disco" to "authenticated";

grant truncate on table "public"."tipos_disco" to "authenticated";

grant update on table "public"."tipos_disco" to "authenticated";

grant delete on table "public"."tipos_disco" to "service_role";

grant insert on table "public"."tipos_disco" to "service_role";

grant references on table "public"."tipos_disco" to "service_role";

grant select on table "public"."tipos_disco" to "service_role";

grant trigger on table "public"."tipos_disco" to "service_role";

grant truncate on table "public"."tipos_disco" to "service_role";

grant update on table "public"."tipos_disco" to "service_role";

CREATE TRIGGER set_alfabetos_updated_at BEFORE UPDATE ON public.alfabetos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_algoritmos_updated_at BEFORE UPDATE ON public.algoritmos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_asignaciones_paciente_updated_at BEFORE UPDATE ON public.asignaciones_paciente FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_bloqueos_updated_at BEFORE UPDATE ON public.bloqueos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_causas_updated_at BEFORE UPDATE ON public.causas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_contenidos_updated_at BEFORE UPDATE ON public.contenidos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_entregas_plan_updated_at BEFORE UPDATE ON public.entregas_plan FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_estados_etapa_updated_at BEFORE UPDATE ON public.estados_etapa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_estados_paciente_updated_at BEFORE UPDATE ON public.estados_paciente FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_estados_terapeuta_updated_at BEFORE UPDATE ON public.estados_terapeuta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_etapas_tratamiento_updated_at BEFORE UPDATE ON public.etapas_tratamiento FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_frases_motivacionales_updated_at BEFORE UPDATE ON public.frases_motivacionales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_modalidades_updated_at BEFORE UPDATE ON public.modalidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_nivel_evaluacion_updated_at BEFORE UPDATE ON public.nivel_evaluacion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_niveles_updated_at BEFORE UPDATE ON public.niveles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_notificaciones_outbox_updated_at BEFORE UPDATE ON public.notificaciones_outbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_plantilla_entregas_updated_at BEFORE UPDATE ON public.plantilla_entregas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_plantillas_tratamiento_updated_at BEFORE UPDATE ON public.plantillas_tratamiento FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_terapeutas_updated_at BEFORE UPDATE ON public.terapeutas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tipos_disco_updated_at BEFORE UPDATE ON public.tipos_disco FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


