export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      aceptaciones_documentos_legales: {
        Row: {
          aceptado_at: string
          documento_id: string
          id: string
          paciente_id: string
          tipo: Database['public']['Enums']['tipo_documento_legal']
          user_id: string | null
        }
        Insert: {
          aceptado_at?: string
          documento_id: string
          id?: string
          paciente_id: string
          tipo: Database['public']['Enums']['tipo_documento_legal']
          user_id?: string | null
        }
        Update: {
          aceptado_at?: string
          documento_id?: string
          id?: string
          paciente_id?: string
          tipo?: Database['public']['Enums']['tipo_documento_legal']
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'aceptaciones_documentos_legales_documento_id_tipo_fkey'
            columns: ['documento_id', 'tipo']
            isOneToOne: false
            referencedRelation: 'documentos_legales'
            referencedColumns: ['id', 'tipo']
          },
          {
            foreignKeyName: 'aceptaciones_documentos_legales_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
        ]
      }
      alertas_atendidas: {
        Row: {
          atendida_en: string
          atendida_por: string
          created_at: string
          evento_ref: string
          id: string
          paciente_id: string
          terapeuta_id: string
          tipo: string
        }
        Insert: {
          atendida_en?: string
          atendida_por: string
          created_at?: string
          evento_ref: string
          id?: string
          paciente_id: string
          terapeuta_id: string
          tipo: string
        }
        Update: {
          atendida_en?: string
          atendida_por?: string
          created_at?: string
          evento_ref?: string
          id?: string
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alertas_atendidas_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alertas_atendidas_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'terapeutas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alertas_atendidas_tipo_fkey'
            columns: ['tipo']
            isOneToOne: false
            referencedRelation: 'tipos_alerta'
            referencedColumns: ['codigo']
          },
        ]
      }
      alfabetos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      algoritmo_etapas: {
        Row: {
          algoritmo_id: string
          frase_esperada: string
          numero_etapa: number
        }
        Insert: {
          algoritmo_id: string
          frase_esperada: string
          numero_etapa: number
        }
        Update: {
          algoritmo_id?: string
          frase_esperada?: string
          numero_etapa?: number
        }
        Relationships: [
          {
            foreignKeyName: 'algoritmo_etapas_algoritmo_id_fkey'
            columns: ['algoritmo_id']
            isOneToOne: false
            referencedRelation: 'algoritmos'
            referencedColumns: ['id']
          },
        ]
      }
      algoritmo_frases: {
        Row: {
          algoritmo_id: string
          orden: number
          texto: string
        }
        Insert: {
          algoritmo_id: string
          orden: number
          texto: string
        }
        Update: {
          algoritmo_id?: string
          orden?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: 'algoritmo_frases_algoritmo_id_fkey'
            columns: ['algoritmo_id']
            isOneToOne: false
            referencedRelation: 'algoritmos'
            referencedColumns: ['id']
          },
        ]
      }
      algoritmos: {
        Row: {
          activo: boolean
          codigo: string
          comportamiento: string | null
          created_at: string
          definicion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          comportamiento?: string | null
          created_at?: string
          definicion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          comportamiento?: string | null
          created_at?: string
          definicion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      asignaciones_paciente: {
        Row: {
          asignado_por: string | null
          created_at: string
          fecha_desde: string
          fecha_hasta: string | null
          id: string
          motivo: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          asignado_por?: string | null
          created_at?: string
          fecha_desde: string
          fecha_hasta?: string | null
          id?: string
          motivo?: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          asignado_por?: string | null
          created_at?: string
          fecha_desde?: string
          fecha_hasta?: string | null
          id?: string
          motivo?: string | null
          paciente_id?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'asignaciones_paciente_asignado_por_fkey'
            columns: ['asignado_por']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaciones_paciente_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaciones_paciente_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'terapeutas'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          created_at: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          operacion: string
          registro_id: string
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          operacion: string
          registro_id: string
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          operacion?: string
          registro_id?: string
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bloqueos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      causa_etapas: {
        Row: {
          causa_id: string
          frase_esperada: string
          numero_etapa: number
        }
        Insert: {
          causa_id: string
          frase_esperada: string
          numero_etapa: number
        }
        Update: {
          causa_id?: string
          frase_esperada?: string
          numero_etapa?: number
        }
        Relationships: [
          {
            foreignKeyName: 'causa_etapas_causa_id_fkey'
            columns: ['causa_id']
            isOneToOne: false
            referencedRelation: 'causas'
            referencedColumns: ['id']
          },
        ]
      }
      causa_frases: {
        Row: {
          causa_id: string
          orden: number
          texto: string
        }
        Insert: {
          causa_id: string
          orden: number
          texto: string
        }
        Update: {
          causa_id?: string
          orden?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: 'causa_frases_causa_id_fkey'
            columns: ['causa_id']
            isOneToOne: false
            referencedRelation: 'causas'
            referencedColumns: ['id']
          },
        ]
      }
      causas: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          definicion: string | null
          emociones_esperadas: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          definicion?: string | null
          emociones_esperadas?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          definicion?: string | null
          emociones_esperadas?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      centros_energeticos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          etiqueta_paciente: string
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          etiqueta_paciente: string
          id?: string
          nombre: string
          orden: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          etiqueta_paciente?: string
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      contenido_imagenes: {
        Row: {
          contenido_id: string
          created_at: string
          id: string
          orden: number
          path: string
        }
        Insert: {
          contenido_id: string
          created_at?: string
          id?: string
          orden: number
          path: string
        }
        Update: {
          contenido_id?: string
          created_at?: string
          id?: string
          orden?: number
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contenido_imagenes_contenido_id_fkey'
            columns: ['contenido_id']
            isOneToOne: false
            referencedRelation: 'contenidos'
            referencedColumns: ['id']
          },
        ]
      }
      contenidos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          duracion_seg: number | null
          id: string
          metadata: Json | null
          recurso_ref: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_seg?: number | null
          id?: string
          metadata?: Json | null
          recurso_ref?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          duracion_seg?: number | null
          id?: string
          metadata?: Json | null
          recurso_ref?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos_legales: {
        Row: {
          contenido_md: string
          created_at: string
          id: string
          publicado_at: string
          tipo: Database['public']['Enums']['tipo_documento_legal']
          titulo: string
          version: string
        }
        Insert: {
          contenido_md: string
          created_at?: string
          id?: string
          publicado_at: string
          tipo: Database['public']['Enums']['tipo_documento_legal']
          titulo: string
          version: string
        }
        Update: {
          contenido_md?: string
          created_at?: string
          id?: string
          publicado_at?: string
          tipo?: Database['public']['Enums']['tipo_documento_legal']
          titulo?: string
          version?: string
        }
        Relationships: []
      }
      entregas_plan: {
        Row: {
          contenido_id: string
          created_at: string
          dia_offset: number
          etapa_id: string
          fecha_consumida: string | null
          fecha_entregada: string | null
          id: string
          orden: number
          updated_at: string
        }
        Insert: {
          contenido_id: string
          created_at?: string
          dia_offset: number
          etapa_id: string
          fecha_consumida?: string | null
          fecha_entregada?: string | null
          id?: string
          orden: number
          updated_at?: string
        }
        Update: {
          contenido_id?: string
          created_at?: string
          dia_offset?: number
          etapa_id?: string
          fecha_consumida?: string | null
          fecha_entregada?: string | null
          id?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'entregas_plan_contenido_id_fkey'
            columns: ['contenido_id']
            isOneToOne: false
            referencedRelation: 'contenidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entregas_plan_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'etapas_tratamiento'
            referencedColumns: ['id']
          },
        ]
      }
      estados_etapa: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      estados_paciente: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      estados_terapeuta: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      etapa_alfabetos: {
        Row: {
          alfabeto_id: string
          etapa_id: string
          numero: number | null
        }
        Insert: {
          alfabeto_id: string
          etapa_id: string
          numero?: number | null
        }
        Update: {
          alfabeto_id?: string
          etapa_id?: string
          numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'etapa_alfabetos_alfabeto_id_fkey'
            columns: ['alfabeto_id']
            isOneToOne: false
            referencedRelation: 'alfabetos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapa_alfabetos_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'etapas_tratamiento'
            referencedColumns: ['id']
          },
        ]
      }
      etapa_bloqueos: {
        Row: {
          bloqueo_id: string
          etapa_id: string
        }
        Insert: {
          bloqueo_id: string
          etapa_id: string
        }
        Update: {
          bloqueo_id?: string
          etapa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'etapa_bloqueos_bloqueo_id_fkey'
            columns: ['bloqueo_id']
            isOneToOne: false
            referencedRelation: 'bloqueos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapa_bloqueos_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'etapas_tratamiento'
            referencedColumns: ['id']
          },
        ]
      }
      etapas_tratamiento: {
        Row: {
          algoritmo_id: string
          causa_id: string
          created_at: string
          estado_id: string
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          id: string
          modalidad_id: string
          motivo_cierre: string | null
          notas_diagnostico: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          algoritmo_id: string
          causa_id: string
          created_at?: string
          estado_id: string
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          id?: string
          modalidad_id: string
          motivo_cierre?: string | null
          notas_diagnostico?: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          algoritmo_id?: string
          causa_id?: string
          created_at?: string
          estado_id?: string
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          id?: string
          modalidad_id?: string
          motivo_cierre?: string | null
          notas_diagnostico?: string | null
          paciente_id?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'etapas_tratamiento_algoritmo_id_fkey'
            columns: ['algoritmo_id']
            isOneToOne: false
            referencedRelation: 'algoritmos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapas_tratamiento_causa_id_fkey'
            columns: ['causa_id']
            isOneToOne: false
            referencedRelation: 'causas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapas_tratamiento_estado_id_fkey'
            columns: ['estado_id']
            isOneToOne: false
            referencedRelation: 'estados_etapa'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapas_tratamiento_modalidad_id_fkey'
            columns: ['modalidad_id']
            isOneToOne: false
            referencedRelation: 'modalidades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapas_tratamiento_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'etapas_tratamiento_terapeuta_id_fkey'
            columns: ['terapeuta_id']
            isOneToOne: false
            referencedRelation: 'terapeutas'
            referencedColumns: ['id']
          },
        ]
      }
      medicion_valores: {
        Row: {
          centro_id: string
          created_at: string
          id: string
          medicion_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          centro_id: string
          created_at?: string
          id?: string
          medicion_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          centro_id?: string
          created_at?: string
          id?: string
          medicion_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'medicion_valores_centro_id_fkey'
            columns: ['centro_id']
            isOneToOne: false
            referencedRelation: 'centros_energeticos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'medicion_valores_medicion_id_fkey'
            columns: ['medicion_id']
            isOneToOne: false
            referencedRelation: 'mediciones_estructura'
            referencedColumns: ['id']
          },
        ]
      }
      mediciones_estructura: {
        Row: {
          copiada_de: string | null
          created_at: string
          estructura_general: number
          etapa_id: string
          id: string
          momento: string
          registrada_en: string
          registrada_por: string | null
          updated_at: string
        }
        Insert: {
          copiada_de?: string | null
          created_at?: string
          estructura_general: number
          etapa_id: string
          id?: string
          momento: string
          registrada_en?: string
          registrada_por?: string | null
          updated_at?: string
        }
        Update: {
          copiada_de?: string | null
          created_at?: string
          estructura_general?: number
          etapa_id?: string
          id?: string
          momento?: string
          registrada_en?: string
          registrada_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mediciones_estructura_copiada_de_fkey'
            columns: ['copiada_de']
            isOneToOne: false
            referencedRelation: 'mediciones_estructura'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mediciones_estructura_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'etapas_tratamiento'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mediciones_estructura_registrada_por_fkey'
            columns: ['registrada_por']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      modalidades: {
        Row: {
          activo: boolean
          cadencia_descripcion: string | null
          cantidad_niveles: number
          cantidad_sesiones: number | null
          codigo: string
          created_at: string
          duracion_meses_estimada: number | null
          id: string
          nombre: string
          tipo_disco_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cadencia_descripcion?: string | null
          cantidad_niveles: number
          cantidad_sesiones?: number | null
          codigo: string
          created_at?: string
          duracion_meses_estimada?: number | null
          id?: string
          nombre: string
          tipo_disco_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cadencia_descripcion?: string | null
          cantidad_niveles?: number
          cantidad_sesiones?: number | null
          codigo?: string
          created_at?: string
          duracion_meses_estimada?: number | null
          id?: string
          nombre?: string
          tipo_disco_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'modalidades_tipo_disco_id_fkey'
            columns: ['tipo_disco_id']
            isOneToOne: false
            referencedRelation: 'tipos_disco'
            referencedColumns: ['id']
          },
        ]
      }
      nivel_evaluacion: {
        Row: {
          created_at: string
          fecha_respuesta: string
          id: string
          nivel_id: string
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha_respuesta: string
          id?: string
          nivel_id: string
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha_respuesta?: string
          id?: string
          nivel_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'nivel_evaluacion_nivel_id_fkey'
            columns: ['nivel_id']
            isOneToOne: true
            referencedRelation: 'niveles'
            referencedColumns: ['id']
          },
        ]
      }
      niveles: {
        Row: {
          created_at: string
          etapa_id: string
          fecha_seguimiento_esperada: string | null
          fecha_seguimiento_real: string | null
          id: string
          numero_nivel: number
          observaciones: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa_id: string
          fecha_seguimiento_esperada?: string | null
          fecha_seguimiento_real?: string | null
          id?: string
          numero_nivel: number
          observaciones?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa_id?: string
          fecha_seguimiento_esperada?: string | null
          fecha_seguimiento_real?: string | null
          id?: string
          numero_nivel?: number
          observaciones?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'niveles_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'etapas_tratamiento'
            referencedColumns: ['id']
          },
        ]
      }
      notificaciones_outbox: {
        Row: {
          canal: string
          created_at: string
          destinatario_id: string
          destinatario_tipo: string
          estado: string
          fecha_envio: string | null
          id: string
          intentos: number
          payload: Json | null
          programada_para: string
          tipo: string
          ultimo_error: string | null
          ultimo_intento: string | null
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          destinatario_id: string
          destinatario_tipo: string
          estado?: string
          fecha_envio?: string | null
          id?: string
          intentos?: number
          payload?: Json | null
          programada_para: string
          tipo: string
          ultimo_error?: string | null
          ultimo_intento?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          destinatario_id?: string
          destinatario_tipo?: string
          estado?: string
          fecha_envio?: string | null
          id?: string
          intentos?: number
          payload?: Json | null
          programada_para?: string
          tipo?: string
          ultimo_error?: string | null
          ultimo_intento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notificaciones_outbox_destinatario_id_fkey'
            columns: ['destinatario_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      otps_activacion: {
        Row: {
          created_at: string
          delivered_at: string | null
          estado: string
          expires_at: string
          failed_attempts: number
          id: string
          otp_hash: string
          paciente_id: string
          purpose: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          estado?: string
          expires_at: string
          failed_attempts?: number
          id?: string
          otp_hash: string
          paciente_id: string
          purpose?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          estado?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          otp_hash?: string
          paciente_id?: string
          purpose?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'otps_activacion_paciente_id_fkey'
            columns: ['paciente_id']
            isOneToOne: false
            referencedRelation: 'pacientes'
            referencedColumns: ['id']
          },
        ]
      }
      pacientes: {
        Row: {
          activo: boolean
          bienvenida_entregada_at: string | null
          contacto_alternativo: string | null
          created_at: string
          email: string
          estado_id: string | null
          fecha_alta: string | null
          fecha_cambio_estado: string | null
          fecha_nacimiento: string
          id: string
          motivo_cambio_estado: string | null
          nombre: string
          relacion_contacto: string | null
          telefono: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          bienvenida_entregada_at?: string | null
          contacto_alternativo?: string | null
          created_at?: string
          email: string
          estado_id?: string | null
          fecha_alta?: string | null
          fecha_cambio_estado?: string | null
          fecha_nacimiento: string
          id?: string
          motivo_cambio_estado?: string | null
          nombre: string
          relacion_contacto?: string | null
          telefono: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          bienvenida_entregada_at?: string | null
          contacto_alternativo?: string | null
          created_at?: string
          email?: string
          estado_id?: string | null
          fecha_alta?: string | null
          fecha_cambio_estado?: string | null
          fecha_nacimiento?: string
          id?: string
          motivo_cambio_estado?: string | null
          nombre?: string
          relacion_contacto?: string | null
          telefono?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pacientes_estado_id_fkey'
            columns: ['estado_id']
            isOneToOne: false
            referencedRelation: 'estados_paciente'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nombre: string | null
          rol_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nombre?: string | null
          rol_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string | null
          rol_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_rol_id_fkey'
            columns: ['rol_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      roles: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      terapeutas: {
        Row: {
          activo: boolean
          created_at: string
          especialidad: string | null
          estado_id: string | null
          fecha_cambio_estado: string | null
          id: string
          matricula: string | null
          motivo_cambio_estado: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          especialidad?: string | null
          estado_id?: string | null
          fecha_cambio_estado?: string | null
          id: string
          matricula?: string | null
          motivo_cambio_estado?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          especialidad?: string | null
          estado_id?: string | null
          fecha_cambio_estado?: string | null
          id?: string
          matricula?: string | null
          motivo_cambio_estado?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'terapeutas_estado_id_fkey'
            columns: ['estado_id']
            isOneToOne: false
            referencedRelation: 'estados_terapeuta'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'terapeutas_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tipos_alerta: {
        Row: {
          activo: boolean
          codigo: string
          descartable: boolean
          descripcion: string | null
          icono: string
          nombre: string
          orden: number
          prioridad: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          descartable?: boolean
          descripcion?: string | null
          icono: string
          nombre: string
          orden: number
          prioridad: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          descartable?: boolean
          descripcion?: string | null
          icono?: string
          nombre?: string
          orden?: number
          prioridad?: string
        }
        Relationships: []
      }
      tipos_disco: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _generar_cierre_automatico: {
        Args: { p_etapa_id: string }
        Returns: string
      }
      _insertar_medicion: {
        Args: { p_etapa_id: string; p_momento: string; p_valores: Json }
        Returns: string
      }
      _medicion_editable: { Args: { p_medicion_id: string }; Returns: string }
      _validar_valores_medicion: {
        Args: { p_centros_esperados: string[]; p_valores: Json }
        Returns: undefined
      }
      baja_voluntaria_paciente: { Args: { p_user_id: string }; Returns: Json }
      cerrar_etapa: {
        Args: { p_estado: string; p_motivo?: string; p_paciente_id: string }
        Returns: undefined
      }
      cerrar_etapa_con_medicion: {
        Args: {
          p_medicion_previa_id: string
          p_motivo: string
          p_paciente_id: string
          p_valores: Json
        }
        Returns: string
      }
      count_alertas_terapeuta: { Args: never; Returns: number }
      count_contenido_usage: { Args: { p_id: string }; Returns: number }
      create_contenido: {
        Args: {
          p_descripcion: string
          p_duracion_seg: number
          p_recurso_ref: string
          p_tipo: string
          p_titulo: string
        }
        Returns: {
          descripcion: string
          duracion_seg: number
          id: string
          recurso_ref: string
          tipo: string
          titulo: string
        }[]
      }
      create_contenido_galeria: {
        Args: {
          p_descripcion: string
          p_paths: string[]
          p_tipo: string
          p_titulo: string
        }
        Returns: {
          descripcion: string
          id: string
          tipo: string
          titulo: string
        }[]
      }
      deactivate_terapeuta: {
        Args: { p_caller_id: string; p_motivo: string; p_terapeuta_id: string }
        Returns: {
          email: string
          estado: string
          id: string
          nombre: string
          pacientes_activos: number
          telefono: string
        }[]
      }
      delete_contenido: { Args: { p_id: string }; Returns: undefined }
      derive_alertas_activas: {
        Args: never
        Returns: {
          evento_ref: string
          fecha: string
          paciente_id: string
          paciente_nombre: string
          terapeuta_id: string
          terapeuta_nombre: string
          tipo: string
          valor: number
        }[]
      }
      desmarcar_alerta_atendida: {
        Args: { p_evento_ref: string; p_paciente_id: string; p_tipo: string }
        Returns: undefined
      }
      editar_medicion: {
        Args: { p_medicion_id: string; p_valores: Json }
        Returns: undefined
      }
      emitir_otp_activacion: {
        Args: { p_paciente_id: string; p_vigencia: string }
        Returns: string
      }
      entrega_liberada: {
        Args: { p_dia_offset: number; p_fecha_inicio: string }
        Returns: boolean
      }
      evaluar_otp: {
        Args: { p_fecha_nacimiento: string; p_otp: string }
        Returns: Record<string, unknown>
      }
      frases_de_etapa: {
        Args: { p_etapa_id: string }
        Returns: {
          orden: number
          origen: string
          semana: number
          texto: string
        }[]
      }
      generar_codigo_otp: { Args: never; Returns: string }
      generar_otp_activacion: {
        Args: { p_paciente_id: string }
        Returns: string
      }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_estructura_paciente: {
        Args: { p_paciente_id: string }
        Returns: Json
      }
      get_frases_del_tratamiento_activo: {
        Args: { p_paciente_id: string }
        Returns: Json
      }
      get_mi_estructura_actual: { Args: never; Returns: Json }
      get_mi_evaluacion_vigente: { Args: never; Returns: Json }
      get_mi_paciente_id: { Args: never; Returns: string }
      get_mi_perfil: { Args: never; Returns: Json }
      get_mi_plan_semanal: { Args: never; Returns: Json }
      get_mi_tratamiento_activo: { Args: never; Returns: Json }
      get_terapeuta: {
        Args: { p_terapeuta_id: string }
        Returns: {
          email: string
          estado: string
          id: string
          nombre: string
          pacientes_activos: number
          telefono: string
        }[]
      }
      has_active_assignment: {
        Args: { p_paciente_id: string }
        Returns: boolean
      }
      hashear_otp: { Args: { p_otp: string }; Returns: string }
      hoy: { Args: never; Returns: string }
      iniciar_nueva_etapa: {
        Args: {
          p_alfabetos?: Json
          p_algoritmo_id: string
          p_bloqueo_ids: string[]
          p_causa_id: string
          p_modalidad_id: string
          p_paciente_id: string
        }
        Returns: string
      }
      iniciar_tratamiento: {
        Args: { p_entregas_plan?: Json; p_etapa_id: string }
        Returns: Json
      }
      is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_console_user: { Args: { p_user_id?: string }; Returns: boolean }
      list_alertas_admin: {
        Args: { p_terapeuta_id?: string }
        Returns: {
          evento_ref: string
          fecha: string
          paciente_id: string
          paciente_nombre: string
          terapeuta_id: string
          terapeuta_nombre: string
          tipo: string
          valor: number
        }[]
      }
      list_alertas_terapeuta: {
        Args: never
        Returns: {
          evento_ref: string
          fecha: string
          paciente_id: string
          paciente_nombre: string
          terapeuta_id: string
          terapeuta_nombre: string
          tipo: string
          valor: number
        }[]
      }
      list_pacientes_by_terapeuta: {
        Args: { p_terapeuta_id: string }
        Returns: {
          asignacion_id: string
          fecha_inicio_tratamiento: string
          nivel_actual: number
          paciente_nombre: string
          ultima_evaluacion: string
        }[]
      }
      list_terapeutas: {
        Args: never
        Returns: {
          alertas_activas: number
          email: string
          estado: string
          id: string
          nombre: string
          pacientes_activos: number
          score_promedio: number
          sin_iniciar: number
          telefono: string
        }[]
      }
      marcar_alerta_atendida: {
        Args: { p_evento_ref: string; p_paciente_id: string; p_tipo: string }
        Returns: undefined
      }
      marcar_otp_entregado: { Args: { p_otp_id: string }; Returns: undefined }
      normalizar_telefono_ar: { Args: { p_telefono: string }; Returns: string }
      paciente_puede_ver_objeto: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      reactivate_terapeuta: {
        Args: { p_caller_id: string; p_terapeuta_id: string }
        Returns: {
          email: string
          estado: string
          id: string
          nombre: string
          pacientes_activos: number
          telefono: string
        }[]
      }
      regenerar_otp_activacion: {
        Args: { p_paciente_id: string }
        Returns: string
      }
      register_paciente: {
        Args: {
          p_alfabetos: Json
          p_algoritmo_id: string
          p_bloqueo_ids: string[]
          p_causa_id: string
          p_email: string
          p_fecha_nacimiento: string
          p_modalidad_id: string
          p_nombre: string
          p_telefono: string
          p_terapeuta_id?: string
        }
        Returns: string
      }
      registrar_medicion: {
        Args: {
          p_etapa_id: string
          p_medicion_previa_id: string
          p_valores: Json
        }
        Returns: string
      }
      replace_and_delete_contenido: {
        Args: { p_new_id: string; p_old_id: string }
        Returns: {
          affected: number
        }[]
      }
      resolver_documentos_legales_vigentes: {
        Args: { p_documentos: Json }
        Returns: string[]
      }
      semanas_de_etapa: { Args: { p_etapa_id: string }; Returns: number }
      set_contenido_imagenes: {
        Args: { p_contenido_id: string; p_paths: string[] }
        Returns: {
          removed_path: string
        }[]
      }
      set_entregas_plan: {
        Args: { p_entregas_plan?: Json; p_etapa_id: string }
        Returns: undefined
      }
      solicitar_otp_activacion: {
        Args: { p_telefono: string }
        Returns: {
          r_codigo: string
          r_fichas: number
          r_otp_id: string
          r_paciente_id: string
          r_resultado: string
        }[]
      }
      submit_mi_evaluacion: {
        Args: {
          p_nivel_id: string
          p_score_algoritmo: number
          p_score_causa: number
        }
        Returns: Json
      }
      telefono_en_otra_ficha: {
        Args: { p_excluir_paciente_id?: string; p_telefono: string }
        Returns: boolean
      }
      update_contenido: {
        Args: { p_descripcion: string; p_id: string; p_titulo: string }
        Returns: {
          descripcion: string
          duracion_seg: number
          id: string
          recurso_ref: string
          tipo: string
          titulo: string
        }[]
      }
      update_etapa_diagnostico: {
        Args: {
          p_alfabetos: Json
          p_algoritmo_id: string
          p_bloqueo_ids: string[]
          p_causa_id: string
          p_modalidad_id: string
          p_paciente_id: string
        }
        Returns: undefined
      }
      update_paciente_identidad: {
        Args: {
          p_email: string
          p_fecha_nacimiento: string
          p_nombre: string
          p_paciente_id: string
          p_telefono: string
        }
        Returns: undefined
      }
      update_terapeuta: {
        Args: { p_nombre: string; p_telefono: string; p_terapeuta_id: string }
        Returns: {
          email: string
          estado: string
          id: string
          nombre: string
          pacientes_activos: number
          telefono: string
        }[]
      }
      validar_otp: {
        Args: { p_fecha_nacimiento: string; p_otp: string }
        Returns: string
      }
      validar_otp_para_creacion: {
        Args: { p_fecha_nacimiento: string; p_otp: string }
        Returns: {
          codigo: string
          email: string
          paciente_id: string
        }[]
      }
      vincular_cuenta_paciente: {
        Args: { p_documentos: Json; p_otp: string; p_user_id: string }
        Returns: string
      }
    }
    Enums: {
      tipo_documento_legal:
        | 'CONSENTIMIENTO_APP_PACIENTE'
        | 'TERMINOS_CONDICIONES_APP_PACIENTE'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      tipo_documento_legal: [
        'CONSENTIMIENTO_APP_PACIENTE',
        'TERMINOS_CONDICIONES_APP_PACIENTE',
      ],
    },
  },
} as const
