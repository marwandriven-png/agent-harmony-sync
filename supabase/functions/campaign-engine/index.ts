import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CampaignAction {
  action: "create" | "start" | "pause" | "resume" | "stats" | "list" | "add_leads" | "get";
  campaign_id?: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { action, campaign_id, data }: CampaignAction = await req.json();

    switch (action) {
      case "list": {
        const { data: campaigns, error } = await supabase
          .from("campaigns")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return jsonResponse({ success: true, campaigns });
      }

      case "get": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);

        const { data: campaign, error } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaign_id)
          .single();

        if (error) throw error;

        // Get campaign leads with lead info
        const { data: campaignLeads } = await supabase
          .from("campaign_leads")
          .select("*, leads:lead_id(id, name, phone, email, status, priority)")
          .eq("campaign_id", campaign_id);

        return jsonResponse({ success: true, campaign, leads: campaignLeads || [] });
      }

      case "create": {
        const campaignData = {
          name: data?.name as string,
          description: data?.description as string || null,
          campaign_type: data?.campaign_type as string || "outreach",
          whatsapp_enabled: data?.whatsapp_enabled as boolean || false,
          email_enabled: data?.email_enabled as boolean || false,
          linkedin_enabled: data?.linkedin_enabled as boolean || false,
          whatsapp_template: data?.whatsapp_template as string || null,
          email_subject: data?.email_subject as string || null,
          email_body: data?.email_body as string || null,
          send_interval_seconds: data?.send_interval_seconds as number || 30,
          scheduled_at: data?.scheduled_at as string || null,
          created_by: userId,
        };

        if (!campaignData.name) return errorResponse("Campaign name is required", 400);

        const { data: campaign, error } = await supabase
          .from("campaigns")
          .insert(campaignData)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, campaign });
      }

      case "add_leads": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);
        const leadIds = data?.lead_ids as string[];
        if (!leadIds || leadIds.length === 0) return errorResponse("lead_ids required", 400);

        // Determine channels from campaign
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("whatsapp_enabled, email_enabled, linkedin_enabled")
          .eq("id", campaign_id)
          .single();

        if (!campaign) return errorResponse("Campaign not found", 404);

        const channels: string[] = [];
        if (campaign.whatsapp_enabled) channels.push("whatsapp");
        if (campaign.email_enabled) channels.push("email");
        if (campaign.linkedin_enabled) channels.push("linkedin");

        if (channels.length === 0) {
          return errorResponse("Campaign has no channels enabled", 400);
        }

        // Create campaign_leads entries for each lead × channel
        const inserts = leadIds.flatMap((leadId) =>
          channels.map((channel) => ({
            campaign_id,
            lead_id: leadId,
            channel,
            status: "pending",
          }))
        );

        const { error: insertError } = await supabase
          .from("campaign_leads")
          .upsert(inserts, { onConflict: "campaign_id,lead_id,channel" });

        if (insertError) throw insertError;

        // Update total leads count
        await supabase
          .from("campaigns")
          .update({ total_leads: leadIds.length })
          .eq("id", campaign_id);

        return jsonResponse({ success: true, added: inserts.length });
      }

      case "start": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);

        // Get campaign with leads
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaign_id)
          .single();

        if (!campaign) return errorResponse("Campaign not found", 404);
        if (campaign.status === "active") return errorResponse("Campaign already active", 400);

        // Get pending leads
        const { data: pendingLeads } = await supabase
          .from("campaign_leads")
          .select("*, leads:lead_id(id, name, phone, email)")
          .eq("campaign_id", campaign_id)
          .eq("status", "pending");

        if (!pendingLeads || pendingLeads.length === 0) {
          return errorResponse("No pending leads in campaign", 400);
        }

        // Update campaign status
        await supabase
          .from("campaigns")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", campaign_id);

        // Process messages (in a real production system, this would be a background job)
        const results = { sent: 0, failed: 0, skipped: 0 };
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

        for (const cl of pendingLeads) {
          const lead = cl.leads as { id: string; name: string; phone: string; email: string } | null;
          if (!lead) {
            results.skipped++;
            continue;
          }

          try {
            if (cl.channel === "whatsapp" && campaign.whatsapp_enabled) {
              const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  lead_id: lead.id,
                  campaign_id,
                  message: campaign.whatsapp_template,
                  template_name: campaign.whatsapp_template?.startsWith("template:")
                    ? campaign.whatsapp_template.replace("template:", "")
                    : undefined,
                }),
              });

              if (response.ok) {
                results.sent++;
              } else {
                results.failed++;
                const errBody = await response.json();
                await supabase
                  .from("campaign_leads")
                  .update({ status: "failed", error_message: errBody?.error })
                  .eq("id", cl.id);
              }
            } else if (cl.channel === "email" && campaign.email_enabled) {
              if (!lead.email) {
                results.skipped++;
                await supabase
                  .from("campaign_leads")
                  .update({ status: "skipped", error_message: "No email address" })
                  .eq("id", cl.id);
                continue;
              }

              const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  lead_id: lead.id,
                  campaign_id,
                  subject: campaign.email_subject || "Message from CRM",
                  body: campaign.email_body || "",
                }),
              });

              if (response.ok) {
                results.sent++;
              } else {
                results.failed++;
                const errBody = await response.json();
                await supabase
                  .from("campaign_leads")
                  .update({ status: "failed", error_message: errBody?.error })
                  .eq("id", cl.id);
              }
            }

            // Rate limiting delay
            if (campaign.send_interval_seconds > 0) {
              await new Promise((r) => setTimeout(r, campaign.send_interval_seconds * 1000));
            }
          } catch (err) {
            results.failed++;
            console.error(`Failed to send to lead ${lead.id}:`, err);
          }
        }

        // Update campaign stats
        await supabase
          .from("campaigns")
          .update({
            sent_count: results.sent,
            failed_count: results.failed,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);

        return jsonResponse({ success: true, results });
      }

      case "pause": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);
        const { error } = await supabase
          .from("campaigns")
          .update({ status: "paused" })
          .eq("id", campaign_id);
        if (error) throw error;
        return jsonResponse({ success: true, status: "paused" });
      }

      case "resume": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);
        const { error } = await supabase
          .from("campaigns")
          .update({ status: "active" })
          .eq("id", campaign_id);
        if (error) throw error;
        return jsonResponse({ success: true, status: "active" });
      }

      case "stats": {
        if (!campaign_id) return errorResponse("campaign_id required", 400);

        const { data: campaign } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaign_id)
          .single();

        if (!campaign) return errorResponse("Campaign not found", 404);

        // Get real-time stats from campaign_leads
        const { data: leads } = await supabase
          .from("campaign_leads")
          .select("status, channel")
          .eq("campaign_id", campaign_id);

        const stats = {
          total: leads?.length || 0,
          pending: leads?.filter((l) => l.status === "pending").length || 0,
          sent: leads?.filter((l) => l.status === "sent").length || 0,
          delivered: leads?.filter((l) => l.status === "delivered").length || 0,
          read: leads?.filter((l) => l.status === "read").length || 0,
          replied: leads?.filter((l) => l.status === "replied").length || 0,
          failed: leads?.filter((l) => l.status === "failed").length || 0,
          skipped: leads?.filter((l) => l.status === "skipped").length || 0,
          by_channel: {
            whatsapp: leads?.filter((l) => l.channel === "whatsapp").length || 0,
            email: leads?.filter((l) => l.channel === "email").length || 0,
            linkedin: leads?.filter((l) => l.channel === "linkedin").length || 0,
          },
        };

        return jsonResponse({ success: true, campaign, stats });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("campaign-engine error:", error);
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
