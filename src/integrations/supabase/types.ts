export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alertas_graduacao: {
        Row: {
          aluno_id: string
          created_at: string
          ct_id: string | null
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id: string
          status: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          ct_id?: string | null
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          status?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          ct_id?: string | null
          faixa_destino?: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem?: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_graduacao_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_documentos: {
        Row: {
          aluno_id: string
          created_at: string
          ct_id: string | null
          id: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo_documento: string
          uploaded_by: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          ct_id?: string | null
          id?: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo_documento: string
          uploaded_by?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          ct_id?: string | null
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_documentos_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_planos: {
        Row: {
          aluno_id: string
          ativo: boolean
          created_at: string
          ct_id: string | null
          dia_vencimento: number
          id: string
          payment_status: string
          plano_id: string
          updated_at: string
          valor_override: number | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          created_at?: string
          ct_id?: string | null
          dia_vencimento?: number
          id?: string
          payment_status?: string
          plano_id: string
          updated_at?: string
          valor_override?: number | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          created_at?: string
          ct_id?: string | null
          dia_vencimento?: number
          id?: string
          payment_status?: string
          plano_id?: string
          updated_at?: string
          valor_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_planos_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_planos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_mensalidade"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          aluno_id: string
          avaliador_id: string
          created_at: string
          ct_id: string | null
          id: string
          nota_disciplina: number
          nota_frequencia: number
          nota_tecnica: number
          observacoes: string | null
        }
        Insert: {
          aluno_id: string
          avaliador_id: string
          created_at?: string
          ct_id?: string | null
          id?: string
          nota_disciplina: number
          nota_frequencia: number
          nota_tecnica: number
          observacoes?: string | null
        }
        Update: {
          aluno_id?: string
          avaliador_id?: string
          created_at?: string
          ct_id?: string | null
          id?: string
          nota_disciplina?: number
          nota_frequencia?: number
          nota_tecnica?: number
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      aula_chamadas: {
        Row: {
          created_at: string
          ct_id: string
          encerrada_em: string | null
          expira_em: string
          horario_aula_id: string | null
          id: string
          iniciada_em: string
          iniciada_por: string
          mensagem: string | null
          status: string
          titulo: string
        }
        Insert: {
          created_at?: string
          ct_id: string
          encerrada_em?: string | null
          expira_em?: string
          horario_aula_id?: string | null
          id?: string
          iniciada_em?: string
          iniciada_por: string
          mensagem?: string | null
          status?: string
          titulo: string
        }
        Update: {
          created_at?: string
          ct_id?: string
          encerrada_em?: string | null
          expira_em?: string
          horario_aula_id?: string | null
          id?: string
          iniciada_em?: string
          iniciada_por?: string
          mensagem?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "aula_chamadas_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aula_chamadas_horario_aula_id_fkey"
            columns: ["horario_aula_id"]
            isOneToOne: false
            referencedRelation: "horarios_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_treinamento: {
        Row: {
          banner_position: string | null
          banner_url: string | null
          cor_fundo: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_texto: string | null
          created_at: string
          endereco: string | null
          endereco_color: string | null
          endereco_font_family: string | null
          endereco_font_size: string | null
          favicon_url: string | null
          id: string
          latitude: number | null
          logo_bg_color: string | null
          logo_bg_enabled: boolean | null
          logo_size: string | null
          logo_url: string | null
          longitude: number | null
          mestre_lider_id: string | null
          neve_ativa: boolean
          nome: string
          nome_color: string | null
          nome_font_family: string | null
          nome_font_size: string | null
          raio_presenca_metros: number
          subtitulo: string | null
          subtitulo_color: string | null
          subtitulo_font_family: string | null
          subtitulo_font_size: string | null
        }
        Insert: {
          banner_position?: string | null
          banner_url?: string | null
          cor_fundo?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto?: string | null
          created_at?: string
          endereco?: string | null
          endereco_color?: string | null
          endereco_font_family?: string | null
          endereco_font_size?: string | null
          favicon_url?: string | null
          id?: string
          latitude?: number | null
          logo_bg_color?: string | null
          logo_bg_enabled?: boolean | null
          logo_size?: string | null
          logo_url?: string | null
          longitude?: number | null
          mestre_lider_id?: string | null
          neve_ativa?: boolean
          nome: string
          nome_color?: string | null
          nome_font_family?: string | null
          nome_font_size?: string | null
          raio_presenca_metros?: number
          subtitulo?: string | null
          subtitulo_color?: string | null
          subtitulo_font_family?: string | null
          subtitulo_font_size?: string | null
        }
        Update: {
          banner_position?: string | null
          banner_url?: string | null
          cor_fundo?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto?: string | null
          created_at?: string
          endereco?: string | null
          endereco_color?: string | null
          endereco_font_family?: string | null
          endereco_font_size?: string | null
          favicon_url?: string | null
          id?: string
          latitude?: number | null
          logo_bg_color?: string | null
          logo_bg_enabled?: boolean | null
          logo_size?: string | null
          logo_url?: string | null
          longitude?: number | null
          mestre_lider_id?: string | null
          neve_ativa?: boolean
          nome?: string
          nome_color?: string | null
          nome_font_family?: string | null
          nome_font_size?: string | null
          raio_presenca_metros?: number
          subtitulo?: string | null
          subtitulo_color?: string | null
          subtitulo_font_family?: string | null
          subtitulo_font_size?: string | null
        }
        Relationships: []
      }
      chat: {
        Row: {
          created_at: string
          ct_id: string
          id: string
          mensagem: string
          remetente_id: string
        }
        Insert: {
          created_at?: string
          ct_id: string
          id?: string
          mensagem: string
          remetente_id: string
        }
        Update: {
          created_at?: string
          ct_id?: string
          id?: string
          mensagem?: string
          remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          aluno_id: string
          asaas_boleto_url: string | null
          asaas_payment_id: string | null
          asaas_pix_copia_cola: string | null
          asaas_pix_qrcode: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          ct_id: string | null
          data_vencimento: string
          id: string
          pago_em: string | null
          payment_method: string | null
          plano_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          valor: number
        }
        Insert: {
          aluno_id: string
          asaas_boleto_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copia_cola?: string | null
          asaas_pix_qrcode?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ct_id?: string | null
          data_vencimento: string
          id?: string
          pago_em?: string | null
          payment_method?: string | null
          plano_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          valor: number
        }
        Update: {
          aluno_id?: string
          asaas_boleto_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copia_cola?: string | null
          asaas_pix_qrcode?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ct_id?: string | null
          data_vencimento?: string
          id?: string
          pago_em?: string | null
          payment_method?: string | null
          plano_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_mensalidade"
            referencedColumns: ["id"]
          },
        ]
      }
      config_pagamento: {
        Row: {
          config_key: string
          config_value: string
          ct_id: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: string
          ct_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          ct_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_pagamento_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      faixa_historico: {
        Row: {
          aluno_id: string
          created_at: string
          ct_id: string | null
          data_graduacao: string
          faixa_anterior: Database["public"]["Enums"]["faixa_tipo"] | null
          faixa_nova: Database["public"]["Enums"]["faixa_tipo"]
          grau_anterior: number | null
          grau_novo: number
          id: string
          observacoes: string | null
          registrado_por: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          ct_id?: string | null
          data_graduacao?: string
          faixa_anterior?: Database["public"]["Enums"]["faixa_tipo"] | null
          faixa_nova: Database["public"]["Enums"]["faixa_tipo"]
          grau_anterior?: number | null
          grau_novo?: number
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          ct_id?: string | null
          data_graduacao?: string
          faixa_anterior?: Database["public"]["Enums"]["faixa_tipo"] | null
          faixa_nova?: Database["public"]["Enums"]["faixa_tipo"]
          grau_anterior?: number | null
          grau_novo?: number
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faixa_historico_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro: {
        Row: {
          ct_id: string | null
          id: string
          saldo: number
          updated_at: string | null
        }
        Insert: {
          ct_id?: string | null
          id?: string
          saldo?: number
          updated_at?: string | null
        }
        Update: {
          ct_id?: string | null
          id?: string
          saldo?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: true
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_aulas: {
        Row: {
          created_at: string
          created_by: string
          ct_id: string
          descricao: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ct_id: string
          descricao?: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ct_id?: string
          descricao?: string | null
          dia_semana?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_aulas_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mensagem_grupo_membros: {
        Row: {
          created_at: string
          destinatario_id: string
          grupo_id: string
          id: string
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          grupo_id: string
          id?: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          grupo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "mensagem_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem_grupos: {
        Row: {
          created_at: string
          created_by: string
          ct_id: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ct_id: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ct_id?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_grupos_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem_destinatarios: {
        Row: {
          created_at: string
          destinatario_id: string
          id: string
          mensagem_id: string
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          id?: string
          mensagem_id: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          id?: string
          mensagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_destinatarios_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mensagem_destinatarios_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conteudo: string
          created_at: string
          ct_id: string
          id: string
          remetente_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          ct_id: string
          id?: string
          remetente_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          ct_id?: string
          id?: string
          remetente_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_enviadas: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          assunto: string
          canal: string
          created_at: string
          email_destinatario: string | null
          enviado_por: string
          erro: string | null
          id: string
          mensagem: string
          status: string
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          assunto: string
          canal?: string
          created_at?: string
          email_destinatario?: string | null
          enviado_por: string
          erro?: string | null
          id?: string
          mensagem: string
          status?: string
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          assunto?: string
          canal?: string
          created_at?: string
          email_destinatario?: string | null
          enviado_por?: string
          erro?: string | null
          id?: string
          mensagem?: string
          status?: string
        }
        Relationships: []
      }
      metricas_graduacao: {
        Row: {
          ativo: boolean
          classe: string
          created_at: string
          created_by: string
          ct_id: string
          descricao: string | null
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id: string
          nome: string
          tipo_metrica: string
          valor_meta: number
        }
        Insert: {
          ativo?: boolean
          classe?: string
          created_at?: string
          created_by: string
          ct_id: string
          descricao?: string | null
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          nome: string
          tipo_metrica: string
          valor_meta?: number
        }
        Update: {
          ativo?: boolean
          classe?: string
          created_at?: string
          created_by?: string
          ct_id?: string
          descricao?: string | null
          faixa_destino?: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem?: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          nome?: string
          tipo_metrica?: string
          valor_meta?: number
        }
        Relationships: [
          {
            foreignKeyName: "metricas_graduacao_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aluno_id: string | null
          asaas_payment_id: string | null
          billing_type: string | null
          created_at: string | null
          ct_id: string | null
          customer_id: string | null
          id: string
          status: string | null
          valor: number | null
        }
        Insert: {
          aluno_id?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string | null
          ct_id?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          valor?: number | null
        }
        Update: {
          aluno_id?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string | null
          ct_id?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          aluno_id: string
          cobranca_id: string
          created_at: string
          ct_id: string
          file_size_bytes: number
          id: string
          mime_type: string
          rejection_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          cobranca_id: string
          created_at?: string
          ct_id: string
          file_size_bytes: number
          id?: string
          mime_type: string
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          cobranca_id?: string
          created_at?: string
          ct_id?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_mensalidade: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string
          ct_id: string
          descricao: string | null
          id: string
          nome: string
          periodicidade: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by: string
          ct_id: string
          descricao?: string | null
          id?: string
          nome: string
          periodicidade?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string
          ct_id?: string
          descricao?: string | null
          id?: string
          nome?: string
          periodicidade?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "planos_mensalidade_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aluno_id: string
          chamada_id: string | null
          created_at: string
          ct_id: string | null
          data_treino: string
          distancia_metros: number | null
          horario_aula_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacao_validacao: string | null
          origem: string
          registrada_por: string | null
          validada_geolocalizacao: boolean
        }
        Insert: {
          aluno_id: string
          chamada_id?: string | null
          created_at?: string
          ct_id?: string | null
          data_treino?: string
          distancia_metros?: number | null
          horario_aula_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao_validacao?: string | null
          origem?: string
          registrada_por?: string | null
          validada_geolocalizacao?: boolean
        }
        Update: {
          aluno_id?: string
          chamada_id?: string | null
          created_at?: string
          ct_id?: string | null
          data_treino?: string
          distancia_metros?: number | null
          horario_aula_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao_validacao?: string | null
          origem?: string
          registrada_por?: string | null
          validada_geolocalizacao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "presencas_chamada_id_fkey"
            columns: ["chamada_id"]
            isOneToOne: false
            referencedRelation: "aula_chamadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_horario_aula_id_fkey"
            columns: ["horario_aula_id"]
            isOneToOne: false
            referencedRelation: "horarios_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          ct_id: string | null
          email: string | null
          faixa: Database["public"]["Enums"]["faixa_tipo"] | null
          grau: number
          id: string
          mestre_id: string | null
          nome: string
          sexo: string | null
          sobrenome: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          ct_id?: string | null
          email?: string | null
          faixa?: Database["public"]["Enums"]["faixa_tipo"] | null
          grau?: number
          id?: string
          mestre_id?: string | null
          nome: string
          sexo?: string | null
          sobrenome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          ct_id?: string | null
          email?: string | null
          faixa?: Database["public"]["Enums"]["faixa_tipo"] | null
          grau?: number
          id?: string
          mestre_id?: string | null
          nome?: string
          sexo?: string | null
          sobrenome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      progresso_metricas: {
        Row: {
          aluno_id: string
          atingido: boolean
          ct_id: string | null
          data_aula: string
          id: string
          mes_referencia: string
          metrica_id: string
          updated_at: string
          valor_atual: number
        }
        Insert: {
          aluno_id: string
          atingido?: boolean
          ct_id?: string | null
          data_aula?: string
          id?: string
          mes_referencia?: string
          metrica_id: string
          updated_at?: string
          valor_atual?: number
        }
        Update: {
          aluno_id?: string
          atingido?: boolean
          ct_id?: string | null
          data_aula?: string
          id?: string
          mes_referencia?: string
          metrica_id?: string
          updated_at?: string
          valor_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "progresso_metricas_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_metricas_metrica_id_fkey"
            columns: ["metrica_id"]
            isOneToOne: false
            referencedRelation: "metricas_graduacao"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_mensagem: {
        Row: {
          assunto: string
          created_at: string
          created_by: string
          id: string
          mensagem: string
          nome: string
        }
        Insert: {
          assunto: string
          created_at?: string
          created_by: string
          id?: string
          mensagem: string
          nome: string
        }
        Update: {
          assunto?: string
          created_at?: string
          created_by?: string
          id?: string
          mensagem?: string
          nome?: string
        }
        Relationships: []
      }
      tempo_graduacao: {
        Row: {
          classe: string
          created_at: string
          ct_id: string
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id: string
          meses: number
          updated_at: string
        }
        Insert: {
          classe?: string
          created_at?: string
          ct_id: string
          faixa_destino: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          meses?: number
          updated_at?: string
        }
        Update: {
          classe?: string
          created_at?: string
          ct_id?: string
          faixa_destino?: Database["public"]["Enums"]["faixa_tipo"]
          faixa_origem?: Database["public"]["Enums"]["faixa_tipo"]
          id?: string
          meses?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tempo_graduacao_ct_id_fkey"
            columns: ["ct_id"]
            isOneToOne: false
            referencedRelation: "centros_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          config_key: string
          config_value: string
          ct_id: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: string
          ct_id?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          ct_id?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_ct: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "mestre" | "aluno"
      faixa_tipo:
        | "branca"
        | "cinza"
        | "amarela"
        | "laranja"
        | "verde"
        | "azul"
        | "roxa"
        | "marrom"
        | "preta"
        | "coral"
        | "vermelha"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "mestre", "aluno"],
      faixa_tipo: [
        "branca",
        "cinza",
        "amarela",
        "laranja",
        "verde",
        "azul",
        "roxa",
        "marrom",
        "preta",
        "coral",
        "vermelha",
      ],
    },
  },
} as const
