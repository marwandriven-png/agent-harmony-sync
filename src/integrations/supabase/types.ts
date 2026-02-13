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
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          source: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          source?: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          source?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          is_connected: boolean
          last_tested_at: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_connected?: boolean
          last_tested_at?: string | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_connected?: boolean
          last_tested_at?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_integrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          campaign_id: string
          channel: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          lead_id: string
          read_at: string | null
          replied_at: string | null
          retry_count: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id: string
          read_at?: string | null
          replied_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string
          read_at?: string | null
          replied_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number
          description: string | null
          email_body: string | null
          email_enabled: boolean
          email_subject: string | null
          failed_count: number
          id: string
          linkedin_enabled: boolean
          linkedin_message: string | null
          name: string
          read_count: number
          replied_count: number
          scheduled_at: string | null
          send_interval_seconds: number | null
          sent_count: number
          started_at: string | null
          status: string
          total_leads: number
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_template: string | null
        }
        Insert: {
          campaign_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          description?: string | null
          email_body?: string | null
          email_enabled?: boolean
          email_subject?: string | null
          failed_count?: number
          id?: string
          linkedin_enabled?: boolean
          linkedin_message?: string | null
          name: string
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          send_interval_seconds?: number | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_template?: string | null
        }
        Update: {
          campaign_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          description?: string | null
          email_body?: string | null
          email_enabled?: boolean
          email_subject?: string | null
          failed_count?: number
          id?: string
          linkedin_enabled?: boolean
          linkedin_message?: string | null
          name?: string
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          send_interval_seconds?: number | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      channel_credentials: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          credential_key: string
          credential_value: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          credential_key: string
          credential_value: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          credential_key?: string
          credential_value?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cold_calls: {
        Row: {
          assigned_agent_id: string | null
          bedrooms: number | null
          budget: number | null
          converted_lead_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          google_sheet_row_id: string | null
          id: string
          last_call_date: string | null
          location: string | null
          name: string
          next_follow_up: string | null
          notes: string | null
          phone: string
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["cold_call_status"]
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          bedrooms?: number | null
          budget?: number | null
          converted_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_sheet_row_id?: string | null
          id?: string
          last_call_date?: string | null
          location?: string | null
          name: string
          next_follow_up?: string | null
          notes?: string | null
          phone: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["cold_call_status"]
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          bedrooms?: number | null
          budget?: number | null
          converted_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_sheet_row_id?: string | null
          id?: string
          last_call_date?: string | null
          location?: string | null
          name?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["cold_call_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cold_calls_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_calls_converted_lead_id_fkey"
            columns: ["converted_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          column_mappings: Json
          connection_url: string | null
          created_at: string
          created_by: string | null
          id: string
          last_synced_at: string | null
          name: string
          sheet_id: string | null
          sync_error: string | null
          sync_status: string
          table_name: string
          type: string
          updated_at: string
        }
        Insert: {
          column_mappings?: Json
          connection_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          sheet_id?: string | null
          sync_error?: string | null
          sync_status?: string
          table_name: string
          type: string
          updated_at?: string
        }
        Update: {
          column_mappings?: Json
          connection_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          sheet_id?: string | null
          sync_error?: string | null
          sync_status?: string
          table_name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          day: number
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          day: number
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          day?: number
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          folder: string
          id: string
          lead_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder?: string
          id?: string
          lead_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder?: string
          id?: string
          lead_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area_name: string | null
          assigned_agent_id: string | null
          bedrooms: number | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          building_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          google_sheet_row_id: string | null
          id: string
          last_contacted_at: string | null
          lead_type: Database["public"]["Enums"]["lead_type"] | null
          locations: string[] | null
          name: string
          next_follow_up: string | null
          phone: string
          priority: Database["public"]["Enums"]["lead_priority"]
          property_types: Database["public"]["Enums"]["property_type"][] | null
          requirements_notes: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          area_name?: string | null
          assigned_agent_id?: string | null
          bedrooms?: number | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          building_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_sheet_row_id?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          locations?: string[] | null
          name: string
          next_follow_up?: string | null
          phone: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          requirements_notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          area_name?: string | null
          assigned_agent_id?: string | null
          bedrooms?: number | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          building_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_sheet_row_id?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_type?: Database["public"]["Enums"]["lead_type"] | null
          locations?: string[] | null
          name?: string
          next_follow_up?: string | null
          phone?: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          requirements_notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          campaign_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          lead_id: string
          read_at: string | null
          replied_at: string | null
          retry_count: number
          sent_at: string | null
          status: string
          subject: string | null
          template_name: string | null
          template_variables: Json | null
          updated_at: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          lead_id: string
          read_at?: string | null
          replied_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          lead_id?: string
          read_at?: string | null
          replied_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          template_variables?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      plot_activity_logs: {
        Row: {
          action: string
          id: string
          new_values: Json | null
          old_values: Json | null
          plot_id: string
          source: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          plot_id: string
          source?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          plot_id?: string
          source?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plot_activity_logs_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plot_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plot_feasibility: {
        Row: {
          ai_raw_response: Json | null
          build_potential: string | null
          created_at: string
          estimated_units: number | null
          id: string
          market_comparison: Json | null
          plot_id: string
          recommendation: string | null
          risk_notes: string[] | null
          roi_range: string | null
        }
        Insert: {
          ai_raw_response?: Json | null
          build_potential?: string | null
          created_at?: string
          estimated_units?: number | null
          id?: string
          market_comparison?: Json | null
          plot_id: string
          recommendation?: string | null
          risk_notes?: string[] | null
          roi_range?: string | null
        }
        Update: {
          ai_raw_response?: Json | null
          build_potential?: string | null
          created_at?: string
          estimated_units?: number | null
          id?: string
          market_comparison?: Json | null
          plot_id?: string
          recommendation?: string | null
          risk_notes?: string[] | null
          roi_range?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plot_feasibility_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      plot_interested_buyers: {
        Row: {
          buyer_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_id: string | null
          mobile: string | null
          notes: string | null
          plot_id: string
          source: string | null
          viewed_at: string | null
        }
        Insert: {
          buyer_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          mobile?: string | null
          notes?: string | null
          plot_id: string
          source?: string | null
          viewed_at?: string | null
        }
        Update: {
          buyer_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          mobile?: string | null
          notes?: string | null
          plot_id?: string
          source?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plot_interested_buyers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plot_interested_buyers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plot_interested_buyers_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      plot_offers: {
        Row: {
          buyer_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_id: string | null
          mobile: string | null
          notes: string | null
          offer_amount: number
          offer_status: string
          plot_id: string
          updated_at: string
        }
        Insert: {
          buyer_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          mobile?: string | null
          notes?: string | null
          offer_amount: number
          offer_status?: string
          plot_id: string
          updated_at?: string
        }
        Update: {
          buyer_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          mobile?: string | null
          notes?: string | null
          offer_amount?: number
          offer_status?: string
          plot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plot_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plot_offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plot_offers_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      plots: {
        Row: {
          area_name: string
          created_at: string
          created_by: string | null
          floors_allowed: number | null
          gfa: number | null
          google_sheet_row_id: string | null
          id: string
          location_coordinates: Json | null
          master_plan: string | null
          notes: string | null
          owner_mobile: string | null
          owner_name: string | null
          pdf_source_link: string | null
          plot_number: string
          plot_size: number
          price: number | null
          price_per_sqft: number | null
          status: string
          updated_at: string
          zoning: string | null
        }
        Insert: {
          area_name: string
          created_at?: string
          created_by?: string | null
          floors_allowed?: number | null
          gfa?: number | null
          google_sheet_row_id?: string | null
          id?: string
          location_coordinates?: Json | null
          master_plan?: string | null
          notes?: string | null
          owner_mobile?: string | null
          owner_name?: string | null
          pdf_source_link?: string | null
          plot_number: string
          plot_size: number
          price?: number | null
          price_per_sqft?: number | null
          status?: string
          updated_at?: string
          zoning?: string | null
        }
        Update: {
          area_name?: string
          created_at?: string
          created_by?: string | null
          floors_allowed?: number | null
          gfa?: number | null
          google_sheet_row_id?: string | null
          id?: string
          location_coordinates?: Json | null
          master_plan?: string | null
          notes?: string | null
          owner_mobile?: string | null
          owner_name?: string | null
          pdf_source_link?: string | null
          plot_number?: string
          plot_size?: number
          price?: number | null
          price_per_sqft?: number | null
          status?: string
          updated_at?: string
          zoning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          assigned_agent_id: string | null
          bathrooms: number
          bedrooms: number
          birth_date: string | null
          building_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          database_status: string | null
          description: string | null
          features: string[] | null
          google_sheet_row_id: string | null
          id: string
          id_number: string | null
          images: string[] | null
          last_activity_at: string | null
          listing_state: string | null
          listing_type: string | null
          location: string
          master_project: string | null
          matches: number | null
          owner_mobile: string | null
          owner_name: string | null
          party_type: string | null
          passport_expiry_date: string | null
          price: number
          procedure_name: string | null
          procedure_value: number | null
          regis: string | null
          section: string
          size: number
          size_unit: string | null
          status: Database["public"]["Enums"]["property_status"]
          title: string
          type: Database["public"]["Enums"]["property_type"]
          uae_id_number: string | null
          unified_number: string | null
          unit_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          bathrooms: number
          bedrooms: number
          birth_date?: string | null
          building_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          database_status?: string | null
          description?: string | null
          features?: string[] | null
          google_sheet_row_id?: string | null
          id?: string
          id_number?: string | null
          images?: string[] | null
          last_activity_at?: string | null
          listing_state?: string | null
          listing_type?: string | null
          location: string
          master_project?: string | null
          matches?: number | null
          owner_mobile?: string | null
          owner_name?: string | null
          party_type?: string | null
          passport_expiry_date?: string | null
          price: number
          procedure_name?: string | null
          procedure_value?: number | null
          regis?: string | null
          section?: string
          size: number
          size_unit?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          type: Database["public"]["Enums"]["property_type"]
          uae_id_number?: string | null
          unified_number?: string | null
          unit_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          bathrooms?: number
          bedrooms?: number
          birth_date?: string | null
          building_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          database_status?: string | null
          description?: string | null
          features?: string[] | null
          google_sheet_row_id?: string | null
          id?: string
          id_number?: string | null
          images?: string[] | null
          last_activity_at?: string | null
          listing_state?: string | null
          listing_type?: string | null
          location?: string
          master_project?: string | null
          matches?: number | null
          owner_mobile?: string | null
          owner_name?: string | null
          party_type?: string | null
          passport_expiry_date?: string | null
          price?: number
          procedure_name?: string | null
          procedure_value?: number | null
          regis?: string | null
          section?: string
          size?: number
          size_unit?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          uae_id_number?: string | null
          unified_number?: string | null
          unit_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_matches: {
        Row: {
          created_at: string
          created_by: string | null
          external_data: Json | null
          external_listing_id: string | null
          id: string
          is_flagged: boolean
          lead_id: string
          match_reasons: string[] | null
          match_score: number
          match_type: string
          notes: string | null
          property_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_data?: Json | null
          external_listing_id?: string | null
          id?: string
          is_flagged?: boolean
          lead_id: string
          match_reasons?: string[] | null
          match_score?: number
          match_type?: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_data?: Json | null
          external_listing_id?: string | null
          id?: string
          is_flagged?: boolean
          lead_id?: string
          match_reasons?: string[] | null
          match_score?: number
          match_type?: string
          notes?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_wizard_progress: {
        Row: {
          completed_steps: number[]
          created_at: string
          current_step: number
          id: string
          is_complete: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: number[]
          created_at?: string
          current_step?: number
          id?: string
          is_complete?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: number[]
          created_at?: string
          current_step?: number
          id?: string
          is_complete?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_wizard_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          source: string
          status: string
          table_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          source?: string
          status?: string
          table_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          source?: string
          status?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          google_sheet_row_id: string | null
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          google_sheet_row_id?: string | null
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          google_sheet_row_id?: string | null
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_lead: { Args: { _lead_id: string }; Returns: boolean }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_agent_assigned_to_lead: {
        Args: { _lead_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "email"
        | "whatsapp"
        | "meeting"
        | "note"
        | "task"
        | "status_change"
        | "property_sent"
      app_role: "admin" | "agent"
      cold_call_status:
        | "new"
        | "called"
        | "interested"
        | "not_interested"
        | "converted"
      lead_priority: "hot" | "warm" | "cold"
      lead_source:
        | "website"
        | "referral"
        | "cold_call"
        | "social_media"
        | "property_portal"
        | "walk_in"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "viewing"
        | "viewed"
        | "negotiation"
        | "closed"
        | "lost"
      lead_type: "buyer" | "landlord" | "tenant"
      property_status: "available" | "under_offer" | "sold" | "rented"
      property_type:
        | "apartment"
        | "villa"
        | "townhouse"
        | "penthouse"
        | "studio"
        | "commercial"
        | "land"
      task_status: "pending" | "completed" | "overdue"
      task_type:
        | "call"
        | "viewing"
        | "follow_up"
        | "meeting"
        | "document"
        | "other"
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
      activity_type: [
        "call",
        "email",
        "whatsapp",
        "meeting",
        "note",
        "task",
        "status_change",
        "property_sent",
      ],
      app_role: ["admin", "agent"],
      cold_call_status: [
        "new",
        "called",
        "interested",
        "not_interested",
        "converted",
      ],
      lead_priority: ["hot", "warm", "cold"],
      lead_source: [
        "website",
        "referral",
        "cold_call",
        "social_media",
        "property_portal",
        "walk_in",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "viewing",
        "viewed",
        "negotiation",
        "closed",
        "lost",
      ],
      lead_type: ["buyer", "landlord", "tenant"],
      property_status: ["available", "under_offer", "sold", "rented"],
      property_type: [
        "apartment",
        "villa",
        "townhouse",
        "penthouse",
        "studio",
        "commercial",
        "land",
      ],
      task_status: ["pending", "completed", "overdue"],
      task_type: [
        "call",
        "viewing",
        "follow_up",
        "meeting",
        "document",
        "other",
      ],
    },
  },
} as const
