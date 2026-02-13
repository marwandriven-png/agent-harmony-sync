import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CampaignAction {
  action: "create" | "start" | "pause" | "resume" | "stats" | "list" | "add_leads" | "get" | "schedule" | "retry_failed";
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
      return errorResponse("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse("Invalid token", 401);
    }
    const userId = claimsData.claims.sub;

    const { action, campaign_id, data }: CampaignAction = await req.json();

    switch (action) {
      case "list":
        return await handleList(supabase);
      case "get":
        return await handleGet(supabase, campaign_id);
      case "create":
        return await handleCreate(supabase, userId, data);
      case "add_leads":
        return await handleAddLeads(supabase, campaign_id, data);
      case "start":
        return await handleStart(supabase, campaign_id, authHeader);
      case "pause":
        return await handlePause(supabase, campaign_id);
      case "resume":
        return await handleResume(supabase, campaign_id);
      case "stats":
        return await handleStats(supabase, campaign_id);
      case "schedule":
        return await handleSchedule(supabase, campaign_id, data);
      case "retry_failed":
        return await handleRetryFailed(supabase, campaign_id, authHeader);
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("campaign-engine error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});

// ─── HANDLERS ────────────────────────────────────────────────────────────────

async function handleList(supabase: ReturnType<typeof createClient>) {
  const { data: campaigns, error } = await supabase
    .from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse({ success: true, campaigns });
}

async function handleGet(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const { data: campaign, error } = await supabase
    .from("campaigns").select("*").eq("id", campaign_id).single();
  if (error) throw error;
  const { data: campaignLeads } = await supabase
    .from("campaign_leads")
    .select("*, leads:lead_id(id, name, phone, email, status, priority)")
    .eq("campaign_id", campaign_id);
  return jsonResponse({ success: true, campaign, leads: campaignLeads || [] });
}

async function handleCreate(supabase: ReturnType<typeof createClient>, userId: string, data?: Record<string, unknown>) {
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
    .from("campaigns").insert(campaignData).select().single();
  if (error) throw error;
  return jsonResponse({ success: true, campaign });
}

async function handleAddLeads(supabase: ReturnType<typeof createClient>, campaign_id?: string, data?: Record<string, unknown>) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const leadIds = data?.lead_ids as string[];
  if (!leadIds || leadIds.length === 0) return errorResponse("lead_ids required", 400);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("whatsapp_enabled, email_enabled, linkedin_enabled")
    .eq("id", campaign_id).single();
  if (!campaign) return errorResponse("Campaign not found", 404);

  const channels: string[] = [];
  if (campaign.whatsapp_enabled) channels.push("whatsapp");
  if (campaign.email_enabled) channels.push("email");
  if (campaign.linkedin_enabled) channels.push("linkedin");
  if (channels.length === 0) return errorResponse("Campaign has no channels enabled", 400);

  const inserts = leadIds.flatMap((leadId) =>
    channels.map((channel) => ({ campaign_id, lead_id: leadId, channel, status: "pending" }))
  );
  const { error: insertError } = await supabase
    .from("campaign_leads").upsert(inserts, { onConflict: "campaign_id,lead_id,channel" });
  if (insertError) throw insertError;

  await supabase.from("campaigns").update({ total_leads: leadIds.length }).eq("id", campaign_id);
  return jsonResponse({ success: true, added: inserts.length });
}

async function handleStart(supabase: ReturnType<typeof createClient>, campaign_id?: string, authHeader?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);

  const { data: campaign } = await supabase
    .from("campaigns").select("*").eq("id", campaign_id).single();
  if (!campaign) return errorResponse("Campaign not found", 404);
  if (campaign.status === "active") return errorResponse("Campaign already active", 400);

  const { data: pendingLeads } = await supabase
    .from("campaign_leads")
    .select("*, leads:lead_id(id, name, phone, email)")
    .eq("campaign_id", campaign_id)
    .eq("status", "pending");

  if (!pendingLeads || pendingLeads.length === 0) {
    return errorResponse("No pending leads in campaign", 400);
  }

  await supabase.from("campaigns")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", campaign_id);

  const results = { sent: 0, failed: 0, skipped: 0 };
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const MAX_RETRIES = 3;

  for (const cl of pendingLeads) {
    const lead = cl.leads as { id: string; name: string; phone: string; email: string } | null;
    if (!lead) { results.skipped++; continue; }

    try {
      let success = false;

      if (cl.channel === "whatsapp" && campaign.whatsapp_enabled) {
        success = await sendWithRetry(async () => {
          const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: { Authorization: authHeader!, "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: lead.id, campaign_id,
              message: campaign.whatsapp_template,
              template_name: campaign.whatsapp_template?.startsWith("template:")
                ? campaign.whatsapp_template.replace("template:", "") : undefined,
            }),
          });
          return res.ok;
        }, MAX_RETRIES);
      } else if (cl.channel === "email" && campaign.email_enabled) {
        if (!lead.email) {
          results.skipped++;
          await supabase.from("campaign_leads")
            .update({ status: "skipped", error_message: "No email address" }).eq("id", cl.id);
          continue;
        }
        success = await sendWithRetry(async () => {
          const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { Authorization: authHeader!, "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: lead.id, campaign_id,
              subject: campaign.email_subject || "Message from CRM",
              body: campaign.email_body || "",
            }),
          });
          return res.ok;
        }, MAX_RETRIES);
      }

      if (success) {
        results.sent++;
        await supabase.from("campaign_leads")
          .update({ status: "sent", sent_at: new Date().toISOString(), retry_count: 0 }).eq("id", cl.id);
      } else {
        results.failed++;
        await supabase.from("campaign_leads")
          .update({ status: "failed", error_message: "Max retries exceeded", retry_count: MAX_RETRIES }).eq("id", cl.id);
      }

      // Rate limiting
      if (campaign.send_interval_seconds > 0) {
        await new Promise((r) => setTimeout(r, campaign.send_interval_seconds * 1000));
      }
    } catch (err) {
      results.failed++;
      console.error(`Failed to send to lead ${lead.id}:`, err);
      await supabase.from("campaign_leads")
        .update({ status: "failed", error_message: String(err) }).eq("id", cl.id);
    }
  }

  await supabase.from("campaigns").update({
    sent_count: results.sent, failed_count: results.failed,
    status: "completed", completed_at: new Date().toISOString(),
  }).eq("id", campaign_id);

  return jsonResponse({ success: true, results });
}

async function handlePause(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const { error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaign_id);
  if (error) throw error;
  return jsonResponse({ success: true, status: "paused" });
}

async function handleResume(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const { error } = await supabase.from("campaigns").update({ status: "active" }).eq("id", campaign_id);
  if (error) throw error;
  return jsonResponse({ success: true, status: "active" });
}

async function handleStats(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
  if (!campaign) return errorResponse("Campaign not found", 404);

  const { data: leads } = await supabase.from("campaign_leads").select("status, channel").eq("campaign_id", campaign_id);

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

async function handleSchedule(supabase: ReturnType<typeof createClient>, campaign_id?: string, data?: Record<string, unknown>) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const scheduledAt = data?.scheduled_at as string;
  const timezone = data?.timezone as string || "UTC";
  
  if (!scheduledAt) return errorResponse("scheduled_at required", 400);

  // Convert to UTC if timezone provided
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) return errorResponse("Invalid date format", 400);

  const { error } = await supabase.from("campaigns").update({
    scheduled_at: scheduledDate.toISOString(),
    status: "scheduled",
  }).eq("id", campaign_id);

  if (error) throw error;
  return jsonResponse({ success: true, scheduled_at: scheduledDate.toISOString(), timezone });
}

async function handleRetryFailed(supabase: ReturnType<typeof createClient>, campaign_id?: string, authHeader?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);

  // Reset failed leads back to pending
  const { data: failedLeads, error } = await supabase
    .from("campaign_leads")
    .update({ status: "pending", error_message: null })
    .eq("campaign_id", campaign_id)
    .eq("status", "failed")
    .lt("retry_count", 3)
    .select();

  if (error) throw error;
  const resetCount = failedLeads?.length || 0;

  if (resetCount === 0) return errorResponse("No retryable failed leads", 400);

  // Reset campaign status so it can be started again
  await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaign_id);

  return jsonResponse({ success: true, reset_count: resetCount, message: `${resetCount} leads reset for retry` });
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

async function sendWithRetry(fn: () => Promise<boolean>, maxRetries: number): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (await fn()) return true;
    } catch (e) {
      console.error(`Attempt ${attempt + 1} failed:`, e);
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
    }
  }
  return false;
}

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
