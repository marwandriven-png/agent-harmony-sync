import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Kimi Agent Gateway - API adapter for external Kimi Agent to interact with CRM
 * 
 * Endpoints (via action parameter):
 * - get_leads: Fetch leads with filters
 * - get_lead: Get single lead details
 * - update_lead: Update lead fields
 * - create_lead: Create new lead
 * - get_campaigns: List campaigns
 * - start_campaign: Trigger campaign execution
 * - send_message: Send message to a lead
 * - get_analytics: Dashboard-level analytics
 * - log_action: Log an activity/action on a lead
 */

interface GatewayRequest {
  action: string;
  params?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via API key header or Bearer token
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("X-API-Key");
    const kimiApiKey = Deno.env.get("KIMI_GATEWAY_API_KEY");

    let supabase;

    if (apiKey && kimiApiKey && apiKey === kimiApiKey) {
      // API key auth for Kimi Agent (uses service role for full access)
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
    } else if (authHeader?.startsWith("Bearer ")) {
      // Standard user auth
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { error } = await supabase.auth.getClaims(token);
      if (error) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized. Provide Bearer token or X-API-Key header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, params }: GatewayRequest = await req.json();

    switch (action) {
      // ============ LEADS ============
      case "get_leads": {
        let query = supabase.from("leads").select("*");

        if (params?.status) query = query.eq("status", params.status);
        if (params?.priority) query = query.eq("priority", params.priority);
        if (params?.source) query = query.eq("source", params.source);
        if (params?.search) {
          query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%`);
        }
        if (params?.limit) query = query.limit(params.limit as number);

        query = query.order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        return jsonResponse({ success: true, leads: data, count: data?.length || 0 });
      }

      case "get_lead": {
        if (!params?.lead_id) return errorResponse("lead_id required", 400);

        const { data: lead, error } = await supabase
          .from("leads")
          .select("*")
          .eq("id", params.lead_id)
          .single();

        if (error) throw error;

        // Get activities
        const { data: activities } = await supabase
          .from("activities")
          .select("*")
          .eq("lead_id", params.lead_id)
          .order("created_at", { ascending: false })
          .limit(20);

        // Get messages
        const { data: messages } = await supabase
          .from("messages")
          .select("*")
          .eq("lead_id", params.lead_id)
          .order("created_at", { ascending: false })
          .limit(20);

        // Get tasks
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("lead_id", params.lead_id)
          .order("due_date", { ascending: true });

        return jsonResponse({
          success: true,
          lead,
          activities: activities || [],
          messages: messages || [],
          tasks: tasks || [],
        });
      }

      case "create_lead": {
        const leadData = {
          name: params?.name as string,
          phone: params?.phone as string,
          email: params?.email as string || null,
          source: params?.source as string || "other",
          priority: params?.priority as string || "warm",
          status: "new",
          budget_min: params?.budget_min as number || null,
          budget_max: params?.budget_max as number || null,
          locations: params?.locations as string[] || [],
          requirements_notes: params?.notes as string || null,
          lead_type: params?.lead_type as string || "buyer",
        };

        if (!leadData.name || !leadData.phone) {
          return errorResponse("name and phone are required", 400);
        }

        const { data, error } = await supabase.from("leads").insert(leadData).select().single();
        if (error) throw error;
        return jsonResponse({ success: true, lead: data });
      }

      case "update_lead": {
        if (!params?.lead_id) return errorResponse("lead_id required", 400);
        const { lead_id, ...updateData } = params;

        const { data, error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", lead_id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, lead: data });
      }

      // ============ CAMPAIGNS ============
      case "get_campaigns": {
        const { data, error } = await supabase
          .from("campaigns")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return jsonResponse({ success: true, campaigns: data });
      }

      case "start_campaign": {
        if (!params?.campaign_id) return errorResponse("campaign_id required", 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const response = await fetch(`${supabaseUrl}/functions/v1/campaign-engine`, {
          method: "POST",
          headers: {
            Authorization: authHeader || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "start", campaign_id: params.campaign_id }),
        });

        const result = await response.json();
        return jsonResponse(result);
      }

      // ============ MESSAGING ============
      case "send_message": {
        if (!params?.lead_id || !params?.channel) {
          return errorResponse("lead_id and channel required", 400);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const channel = params.channel as string;

        if (channel === "whatsapp") {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              Authorization: authHeader || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lead_id: params.lead_id,
              message: params.message,
              template_name: params.template_name,
              template_variables: params.template_variables,
            }),
          });
          return new Response(await response.text(), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else if (channel === "email") {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              Authorization: authHeader || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lead_id: params.lead_id,
              subject: params.subject,
              body: params.body,
            }),
          });
          return new Response(await response.text(), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return errorResponse(`Unsupported channel: ${channel}`, 400);
      }

      // ============ ANALYTICS ============
      case "get_analytics": {
        const { data: leads } = await supabase.from("leads").select("status, priority, source, created_at");
        const { data: campaigns } = await supabase.from("campaigns").select("status, sent_count, delivered_count, read_count, replied_count");
        const { data: messages } = await supabase.from("messages").select("channel, status, created_at");

        const analytics = {
          leads: {
            total: leads?.length || 0,
            by_status: groupBy(leads || [], "status"),
            by_priority: groupBy(leads || [], "priority"),
            by_source: groupBy(leads || [], "source"),
          },
          campaigns: {
            total: campaigns?.length || 0,
            active: campaigns?.filter((c) => c.status === "active").length || 0,
            total_sent: campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0,
            total_delivered: campaigns?.reduce((sum, c) => sum + (c.delivered_count || 0), 0) || 0,
          },
          messages: {
            total: messages?.length || 0,
            by_channel: groupBy(messages || [], "channel"),
            by_status: groupBy(messages || [], "status"),
          },
        };

        return jsonResponse({ success: true, analytics });
      }

      // ============ ACTIVITY LOGGING ============
      case "log_action": {
        if (!params?.lead_id || !params?.type || !params?.title) {
          return errorResponse("lead_id, type, and title required", 400);
        }

        const { data, error } = await supabase.from("activities").insert({
          lead_id: params.lead_id,
          type: params.type,
          title: params.title,
          description: params.description as string || null,
          metadata: params.metadata || {},
        }).select().single();

        if (error) throw error;
        return jsonResponse({ success: true, activity: data });
      }

      // ============ PROPERTIES ============
      case "get_properties": {
        let query = supabase.from("properties").select("*");
        if (params?.status) query = query.eq("status", params.status);
        if (params?.type) query = query.eq("type", params.type);
        if (params?.limit) query = query.limit(params.limit as number);
        query = query.order("created_at", { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        return jsonResponse({ success: true, properties: data });
      }

      default:
        return errorResponse(`Unknown action: ${action}. Available: get_leads, get_lead, create_lead, update_lead, get_campaigns, start_campaign, send_message, get_analytics, log_action, get_properties`, 400);
    }
  } catch (error) {
    console.error("kimi-gateway error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function groupBy(arr: Record<string, unknown>[], key: string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const val = (item[key] as string) || "unknown";
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
