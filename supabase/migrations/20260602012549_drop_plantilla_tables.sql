drop trigger if exists "set_plantilla_entregas_updated_at" on "public"."plantilla_entregas";

drop trigger if exists "set_plantillas_tratamiento_updated_at" on "public"."plantillas_tratamiento";

revoke delete on table "public"."plantilla_entregas" from "anon";

revoke insert on table "public"."plantilla_entregas" from "anon";

revoke references on table "public"."plantilla_entregas" from "anon";

revoke select on table "public"."plantilla_entregas" from "anon";

revoke trigger on table "public"."plantilla_entregas" from "anon";

revoke truncate on table "public"."plantilla_entregas" from "anon";

revoke update on table "public"."plantilla_entregas" from "anon";

revoke delete on table "public"."plantilla_entregas" from "authenticated";

revoke insert on table "public"."plantilla_entregas" from "authenticated";

revoke references on table "public"."plantilla_entregas" from "authenticated";

revoke select on table "public"."plantilla_entregas" from "authenticated";

revoke trigger on table "public"."plantilla_entregas" from "authenticated";

revoke truncate on table "public"."plantilla_entregas" from "authenticated";

revoke update on table "public"."plantilla_entregas" from "authenticated";

revoke delete on table "public"."plantilla_entregas" from "service_role";

revoke insert on table "public"."plantilla_entregas" from "service_role";

revoke references on table "public"."plantilla_entregas" from "service_role";

revoke select on table "public"."plantilla_entregas" from "service_role";

revoke trigger on table "public"."plantilla_entregas" from "service_role";

revoke truncate on table "public"."plantilla_entregas" from "service_role";

revoke update on table "public"."plantilla_entregas" from "service_role";

revoke delete on table "public"."plantillas_tratamiento" from "anon";

revoke insert on table "public"."plantillas_tratamiento" from "anon";

revoke references on table "public"."plantillas_tratamiento" from "anon";

revoke select on table "public"."plantillas_tratamiento" from "anon";

revoke trigger on table "public"."plantillas_tratamiento" from "anon";

revoke truncate on table "public"."plantillas_tratamiento" from "anon";

revoke update on table "public"."plantillas_tratamiento" from "anon";

revoke delete on table "public"."plantillas_tratamiento" from "authenticated";

revoke insert on table "public"."plantillas_tratamiento" from "authenticated";

revoke references on table "public"."plantillas_tratamiento" from "authenticated";

revoke select on table "public"."plantillas_tratamiento" from "authenticated";

revoke trigger on table "public"."plantillas_tratamiento" from "authenticated";

revoke truncate on table "public"."plantillas_tratamiento" from "authenticated";

revoke update on table "public"."plantillas_tratamiento" from "authenticated";

revoke delete on table "public"."plantillas_tratamiento" from "service_role";

revoke insert on table "public"."plantillas_tratamiento" from "service_role";

revoke references on table "public"."plantillas_tratamiento" from "service_role";

revoke select on table "public"."plantillas_tratamiento" from "service_role";

revoke trigger on table "public"."plantillas_tratamiento" from "service_role";

revoke truncate on table "public"."plantillas_tratamiento" from "service_role";

revoke update on table "public"."plantillas_tratamiento" from "service_role";

alter table "public"."plantilla_entregas" drop constraint "plantilla_entregas_contenido_id_fkey";

alter table "public"."plantilla_entregas" drop constraint "plantilla_entregas_plantilla_id_fkey";

alter table "public"."plantillas_tratamiento" drop constraint "plantillas_tratamiento_causa_id_fkey";

alter table "public"."plantillas_tratamiento" drop constraint "plantillas_tratamiento_causa_id_modalidad_id_nombre_key";

alter table "public"."plantillas_tratamiento" drop constraint "plantillas_tratamiento_modalidad_id_fkey";

alter table "public"."plantilla_entregas" drop constraint "plantilla_entregas_pkey";

alter table "public"."plantillas_tratamiento" drop constraint "plantillas_tratamiento_pkey";

drop index if exists "public"."plantilla_entregas_pkey";

drop index if exists "public"."plantillas_tratamiento_causa_id_modalidad_id_nombre_key";

drop index if exists "public"."plantillas_tratamiento_pkey";

drop table "public"."plantilla_entregas";

drop table "public"."plantillas_tratamiento";

