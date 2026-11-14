alter table "public"."frases_motivacionales" alter column "causa_id" drop not null;

alter table "public"."frases_motivacionales" add column "titulo" text;

alter table "public"."frases_motivacionales" add column "descripcion" text;

alter table "public"."etapas_tratamiento" add column "frase_motivacional_id" uuid;

alter table "public"."etapas_tratamiento" add constraint "etapas_tratamiento_frase_motivacional_id_fkey" FOREIGN KEY (frase_motivacional_id) REFERENCES public.frases_motivacionales(id) ON DELETE RESTRICT not valid;

alter table "public"."etapas_tratamiento" validate constraint "etapas_tratamiento_frase_motivacional_id_fkey";
