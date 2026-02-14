import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TIMEZONE UTILS (inline for edge function) ──────────────────────────────

const PHONE_CODE_TO_COUNTRY: Record<string, string> = {
  '1':'US','7':'RU','20':'EG','27':'ZA','30':'GR','31':'NL','33':'FR','34':'ES',
  '39':'IT','41':'CH','44':'GB','49':'DE','55':'BR','61':'AU','65':'SG','81':'JP',
  '82':'KR','86':'CN','91':'IN','92':'PK','971':'AE','966':'SA','974':'QA',
  '965':'KW','973':'BH','968':'OM','962':'JO','961':'LB','972':'IL','964':'IQ',
  '98':'IR','60':'MY','66':'TH','63':'PH','62':'ID','64':'NZ','852':'HK',
  '880':'BD','886':'TW','90':'TR','380':'UA','48':'PL','46':'SE','47':'NO',
  '45':'DK','358':'FI','353':'IE','32':'BE','43':'AT','36':'HU','40':'RO',
  '52':'MX','56':'CL','234':'NG','254':'KE','212':'MA',
};

const COUNTRY_TO_TZ: Record<string, string> = {
  'US':'America/New_York','GB':'Europe/London','FR':'Europe/Paris','DE':'Europe/Berlin',
  'IT':'Europe/Rome','ES':'Europe/Madrid','NL':'Europe/Amsterdam','CH':'Europe/Zurich',
  'AT':'Europe/Vienna','SE':'Europe/Stockholm','NO':'Europe/Oslo','DK':'Europe/Copenhagen',
  'FI':'Europe/Helsinki','PL':'Europe/Warsaw','RO':'Europe/Bucharest','GR':'Europe/Athens',
  'TR':'Europe/Istanbul','UA':'Europe/Kiev','RU':'Europe/Moscow','IE':'Europe/Dublin',
  'BE':'Europe/Brussels','HU':'Europe/Budapest',
  'AE':'Asia/Dubai','SA':'Asia/Riyadh','QA':'Asia/Qatar','KW':'Asia/Kuwait',
  'BH':'Asia/Bahrain','OM':'Asia/Muscat','JO':'Asia/Amman','LB':'Asia/Beirut',
  'IL':'Asia/Jerusalem','IQ':'Asia/Baghdad','IR':'Asia/Tehran',
  'IN':'Asia/Kolkata','PK':'Asia/Karachi','BD':'Asia/Dhaka','LK':'Asia/Colombo',
  'CN':'Asia/Shanghai','HK':'Asia/Hong_Kong','TW':'Asia/Taipei','JP':'Asia/Tokyo',
  'KR':'Asia/Seoul','SG':'Asia/Singapore','MY':'Asia/Kuala_Lumpur','TH':'Asia/Bangkok',
  'PH':'Asia/Manila','ID':'Asia/Jakarta',
  'AU':'Australia/Sydney','NZ':'Pacific/Auckland',
  'EG':'Africa/Cairo','ZA':'Africa/Johannesburg','KE':'Africa/Nairobi','NG':'Africa/Lagos',
  'MA':'Africa/Casablanca','BR':'America/Sao_Paulo','MX':'America/Mexico_City','CL':'America/Santiago',
};

function detectCountryFromPhone(phone: string): string | null {
  const c = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  for (const len of [3, 2, 1]) {
    const code = c.substring(0, len);
    if (PHONE_CODE_TO_COUNTRY[code]) return PHONE_CODE_TO_COUNTRY[code];
  }
  return null;
}

function resolveTimezone(lead: { phone?: string; detected_country?: string | null; detected_timezone?: string | null }): string {
  if (lead.detected_timezone) return lead.detected_timezone;
  const country = lead.detected_country || (lead.phone ? detectCountryFromPhone(lead.phone) : null);
  if (country && COUNTRY_TO_TZ[country]) return COUNTRY_TO_TZ[country];
  return 'UTC'; // Safe default
}

function getLocalHour(tz: string): number {
  try {
    const s = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(s, 10);
  } catch { return -1; }
}

function isWithinSendingWindow(tz: string): boolean {
  const h = getLocalHour(tz);
  return h >= 9 && h < 18;
}

function isBlocked(tz: string): boolean {
  const h = getLocalHour(tz);
  return h >= 20 || h < 8;
}

function isWeekendInTz(tz: string): boolean {
  try {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    return d.getDay() === 0 || d.getDay() === 6;
  } catch { return true; }
}

function localTimeStr(tz: string): string {
  try {
    return new Date().toLocaleString('en-US', { timeZone: tz, hour12: false });
  } catch { return new Date().toISOString(); }
}

// ─── AUTOMATION RULES ───────────────────────────────────────────────────────

const RESTRICTED_SOURCES = ['cold_imported'];
const WHATSAPP_RESTRICTED = ['cold_imported', 'dubai_owner_database'];
const EMAIL_LIMITED_SOURCES = ['dubai_owner_database'];
const STOP_STATUSES = ['viewing', 'closed', 'lost'];

type Lead = {
  id: string; name: string; phone: string; email: string | null;
  status: string; source_classification: string | null;
  contact_verified: boolean; automation_stopped: boolean; automation_stop_reason: string | null;
  email_bounce: boolean; whatsapp_opt_in: boolean; whatsapp_initiated: boolean;
  detected_country: string | null; detected_timezone: string | null;
};

function checkEligibility(lead: Lead): { ok: boolean; reason?: string } {
  if (lead.automation_stopped) return { ok: false, reason: 'Automation previously stopped' };
  if (lead.email_bounce) return { ok: false, reason: 'Email bounced — permanently disabled' };
  if (lead.source_classification && RESTRICTED_SOURCES.includes(lead.source_classification))
    return { ok: false, reason: `Source "${lead.source_classification}" restricted` };
  if (!lead.contact_verified && !lead.whatsapp_initiated)
    return { ok: false, reason: 'Contact not verified and no inbound contact' };
  return { ok: true };
}

function canSendWhatsApp(lead: Lead): boolean {
  if (!lead.whatsapp_initiated && !lead.whatsapp_opt_in) return false;
  if (lead.source_classification && WHATSAPP_RESTRICTED.includes(lead.source_classification)) return false;
  return true;
}

function getMaxEmails(src: string | null): number {
  return src && EMAIL_LIMITED_SOURCES.includes(src) ? 1 : 2;
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface CampaignAction {
  action: "create" | "start" | "pause" | "resume" | "stats" | "list" | "add_leads" | "get" | "schedule" | "retry_failed" | "process_queue" | "stop_lead";
  campaign_id?: string;
  lead_id?: string;
  data?: Record<string, unknown>;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return errorResponse("Invalid token", 401);
    const userId = claimsData.claims.sub;

    const { action, campaign_id, lead_id, data }: CampaignAction = await req.json();

    switch (action) {
      case "list": return await handleList(supabase);
      case "get": return await handleGet(supabase, campaign_id);
      case "create": return await handleCreate(supabase, userId, data);
      case "add_leads": return await handleAddLeads(supabase, campaign_id, data);
      case "start": return await handleStart(supabase, campaign_id, authHeader, userId);
      case "pause": return await handlePause(supabase, campaign_id);
      case "resume": return await handleResume(supabase, campaign_id);
      case "stats": return await handleStats(supabase, campaign_id);
      case "schedule": return await handleSchedule(supabase, campaign_id, data);
      case "retry_failed": return await handleRetryFailed(supabase, campaign_id);
      case "process_queue": return await handleProcessQueue(supabase, authHeader, userId);
      case "stop_lead": return await handleStopLead(supabase, lead_id, data, userId);
      default: return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("campaign-engine error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});

// ─── HANDLERS ───────────────────────────────────────────────────────────────

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

  // Fetch leads with automation fields for eligibility check
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, email, status, source_classification, contact_verified, automation_stopped, email_bounce, whatsapp_opt_in, whatsapp_initiated, detected_country, detected_timezone")
    .in("id", leadIds);

  if (!leads || leads.length === 0) return errorResponse("No valid leads found", 400);

  const channels: string[] = [];
  if (campaign.whatsapp_enabled) channels.push("whatsapp");
  if (campaign.email_enabled) channels.push("email");
  if (campaign.linkedin_enabled) channels.push("linkedin");
  if (channels.length === 0) return errorResponse("Campaign has no channels enabled", 400);

  const inserts: Array<{ campaign_id: string; lead_id: string; channel: string; status: string }> = [];
  const skipped: Array<{ lead_id: string; reason: string }> = [];

  for (const lead of leads) {
    const elig = checkEligibility(lead as Lead);
    if (!elig.ok) {
      skipped.push({ lead_id: lead.id, reason: elig.reason! });
      continue;
    }

    for (const channel of channels) {
      // WhatsApp compliance check
      if (channel === "whatsapp" && !canSendWhatsApp(lead as Lead)) {
        skipped.push({ lead_id: lead.id, reason: "WhatsApp not permitted (no opt-in/initiation)" });
        continue;
      }
      // Email check
      if (channel === "email" && !lead.email) {
        skipped.push({ lead_id: lead.id, reason: "No email address" });
        continue;
      }
      if (channel === "email" && (lead as Lead).email_bounce) {
        skipped.push({ lead_id: lead.id, reason: "Email bounced" });
        continue;
      }
      inserts.push({ campaign_id: campaign_id!, lead_id: lead.id, channel, status: "pending" });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from("campaign_leads").upsert(inserts, { onConflict: "campaign_id,lead_id,channel" });
    if (insertError) throw insertError;
  }

  await supabase.from("campaigns").update({ total_leads: inserts.length }).eq("id", campaign_id);

  // Log
  await logAutomation(supabase, { event_type: "leads_added", campaign_id, metadata: { added: inserts.length, skipped } });

  return jsonResponse({ success: true, added: inserts.length, skipped });
}

async function handleStart(supabase: ReturnType<typeof createClient>, campaign_id?: string, authHeader?: string, userId?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);

  const { data: campaign } = await supabase
    .from("campaigns").select("*").eq("id", campaign_id).single();
  if (!campaign) return errorResponse("Campaign not found", 404);
  if (campaign.status === "active") return errorResponse("Campaign already active", 400);

  const { data: pendingLeads } = await supabase
    .from("campaign_leads")
    .select("*, leads:lead_id(id, name, phone, email, status, source_classification, contact_verified, automation_stopped, email_bounce, whatsapp_opt_in, whatsapp_initiated, detected_country, detected_timezone)")
    .eq("campaign_id", campaign_id)
    .eq("status", "pending");

  if (!pendingLeads || pendingLeads.length === 0) {
    return errorResponse("No pending leads in campaign", 400);
  }

  await supabase.from("campaigns")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", campaign_id);

  const results = { sent: 0, failed: 0, skipped: 0, queued: 0 };
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  for (const cl of pendingLeads) {
    const lead = cl.leads as Lead | null;
    if (!lead) { results.skipped++; continue; }

    // Re-check eligibility
    const elig = checkEligibility(lead);
    if (!elig.ok) {
      results.skipped++;
      await supabase.from("campaign_leads")
        .update({ status: "skipped", error_message: elig.reason }).eq("id", cl.id);
      await logAutomation(supabase, {
        event_type: "lead_skipped", lead_id: lead.id, campaign_id,
        lead_source_classification: lead.source_classification,
        stop_reason: elig.reason,
      });
      continue;
    }

    // Check stop conditions
    if (STOP_STATUSES.includes(lead.status)) {
      results.skipped++;
      await supabase.from("campaign_leads")
        .update({ status: "skipped", error_message: `Lead status "${lead.status}" triggers stop` }).eq("id", cl.id);
      continue;
    }

    // Timezone check
    const tz = resolveTimezone(lead);
    
    if (isBlocked(tz)) {
      // Queue for next sending window instead of skipping
      results.queued++;
      await supabase.from("automation_queue").insert({
        lead_id: lead.id, campaign_id, channel: cl.channel,
        sequence_step: 1, scheduled_at: getNextWindow(tz).toISOString(),
        scheduled_local_time: "09:00", lead_timezone: tz,
        message_body: cl.channel === "email" ? (campaign.email_body || "") : (campaign.whatsapp_template || ""),
        message_subject: cl.channel === "email" ? campaign.email_subject : null,
        max_attempts: 1,
      });
      await supabase.from("campaign_leads")
        .update({ status: "queued" }).eq("id", cl.id);
      continue;
    }

    if (!isWithinSendingWindow(tz)) {
      results.queued++;
      await supabase.from("automation_queue").insert({
        lead_id: lead.id, campaign_id, channel: cl.channel,
        sequence_step: 1, scheduled_at: getNextWindow(tz).toISOString(),
        scheduled_local_time: "09:00", lead_timezone: tz,
        message_body: cl.channel === "email" ? (campaign.email_body || "") : (campaign.whatsapp_template || ""),
        message_subject: cl.channel === "email" ? campaign.email_subject : null,
        max_attempts: 1,
      });
      await supabase.from("campaign_leads")
        .update({ status: "queued" }).eq("id", cl.id);
      continue;
    }

    // Weekend check
    if (isWeekendInTz(tz) && !lead.whatsapp_initiated) {
      results.queued++;
      await supabase.from("campaign_leads")
        .update({ status: "queued", error_message: "Weekend — queued for Monday" }).eq("id", cl.id);
      continue;
    }

    // WhatsApp compliance: max 1 message
    if (cl.channel === "whatsapp") {
      if (!canSendWhatsApp(lead)) {
        results.skipped++;
        await supabase.from("campaign_leads")
          .update({ status: "skipped", error_message: "WhatsApp not permitted" }).eq("id", cl.id);
        continue;
      }
      // Check if already sent a WhatsApp in this campaign
      const { data: existingWA } = await supabase
        .from("campaign_leads")
        .select("id").eq("campaign_id", campaign_id).eq("lead_id", lead.id)
        .eq("channel", "whatsapp").eq("status", "sent").limit(1);
      if (existingWA && existingWA.length > 0) {
        results.skipped++;
        await supabase.from("campaign_leads")
          .update({ status: "skipped", error_message: "WhatsApp limit: max 1 message" }).eq("id", cl.id);
        continue;
      }
    }

    // Email limit check
    if (cl.channel === "email") {
      const maxEmails = getMaxEmails(lead.source_classification);
      const { data: sentEmails } = await supabase
        .from("campaign_leads")
        .select("id").eq("campaign_id", campaign_id).eq("lead_id", lead.id)
        .eq("channel", "email").eq("status", "sent");
      if (sentEmails && sentEmails.length >= maxEmails) {
        results.skipped++;
        await supabase.from("campaign_leads")
          .update({ status: "skipped", error_message: `Email limit reached (max ${maxEmails})` }).eq("id", cl.id);
        continue;
      }
    }

    // Check for existing reply — stop automation
    const { data: replies } = await supabase
      .from("messages")
      .select("id").eq("lead_id", lead.id).eq("direction", "inbound").limit(1);
    if (replies && replies.length > 0) {
      results.skipped++;
      await stopLeadAutomation(supabase, lead.id, "Lead replied", userId);
      await supabase.from("campaign_leads")
        .update({ status: "skipped", error_message: "Lead replied — automation stopped" }).eq("id", cl.id);
      continue;
    }

    // ─── SEND ───────────────────────────────────────────────────────
    try {
      let success = false;

      if (cl.channel === "whatsapp" && campaign.whatsapp_enabled) {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: { Authorization: authHeader!, "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: lead.id, campaign_id,
            message: campaign.whatsapp_template,
          }),
        });
        success = res.ok;
        await res.text(); // consume body
      } else if (cl.channel === "email" && campaign.email_enabled) {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { Authorization: authHeader!, "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: lead.id, campaign_id,
            subject: campaign.email_subject || "Message from CRM",
            body: campaign.email_body || "",
          }),
        });
        success = res.ok;
        if (!res.ok) {
          const errBody = await res.text();
          // Check for bounce
          if (errBody.includes("bounce") || errBody.includes("invalid")) {
            await supabase.from("leads").update({ email_bounce: true, automation_stopped: true, automation_stop_reason: "Email bounced" }).eq("id", lead.id);
          }
        } else {
          await res.text();
        }
      }

      if (success) {
        results.sent++;
        await supabase.from("campaign_leads")
          .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", cl.id);
        await logAutomation(supabase, {
          event_type: "message_sent", lead_id: lead.id, campaign_id,
          channel: cl.channel, lead_source_classification: lead.source_classification,
          lead_timezone: tz, lead_local_timestamp: localTimeStr(tz),
        });
      } else {
        results.failed++;
        await supabase.from("campaign_leads")
          .update({ status: "failed", error_message: "Send failed — no retry (reputation-first)" }).eq("id", cl.id);
        await logAutomation(supabase, {
          event_type: "message_failed", lead_id: lead.id, campaign_id,
          channel: cl.channel, stop_reason: "Send failed",
        });
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

  const finalStatus = results.queued > 0 ? "active" : "completed";
  await supabase.from("campaigns").update({
    sent_count: results.sent, failed_count: results.failed,
    status: finalStatus,
    ...(finalStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
  }).eq("id", campaign_id);

  return jsonResponse({ success: true, results });
}

async function handlePause(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaign_id);
  // Cancel queued items
  await supabase.from("automation_queue")
    .update({ status: "cancelled", cancelled_reason: "Campaign paused" })
    .eq("campaign_id", campaign_id).eq("status", "queued");
  return jsonResponse({ success: true, status: "paused" });
}

async function handleResume(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  await supabase.from("campaigns").update({ status: "active" }).eq("id", campaign_id);
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
    queued: leads?.filter((l) => l.status === "queued").length || 0,
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
  if (!scheduledAt) return errorResponse("scheduled_at required", 400);
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) return errorResponse("Invalid date format", 400);
  const { error } = await supabase.from("campaigns").update({
    scheduled_at: scheduledDate.toISOString(), status: "scheduled",
  }).eq("id", campaign_id);
  if (error) throw error;
  return jsonResponse({ success: true, scheduled_at: scheduledDate.toISOString() });
}

async function handleRetryFailed(supabase: ReturnType<typeof createClient>, campaign_id?: string) {
  if (!campaign_id) return errorResponse("campaign_id required", 400);
  const { data: failedLeads, error } = await supabase
    .from("campaign_leads")
    .update({ status: "pending", error_message: null })
    .eq("campaign_id", campaign_id).eq("status", "failed").lt("retry_count", 3).select();
  if (error) throw error;
  if (!failedLeads?.length) return errorResponse("No retryable failed leads", 400);
  await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaign_id);
  return jsonResponse({ success: true, reset_count: failedLeads.length });
}

// Process queued items that are now within sending windows
async function handleProcessQueue(supabase: ReturnType<typeof createClient>, authHeader: string, userId: string) {
  const now = new Date().toISOString();
  const { data: queuedItems } = await supabase
    .from("automation_queue")
    .select("*, leads:lead_id(id, name, phone, email, status, automation_stopped, email_bounce)")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .limit(50);

  if (!queuedItems || queuedItems.length === 0) {
    return jsonResponse({ success: true, processed: 0 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  let processed = 0;

  for (const item of queuedItems) {
    const lead = item.leads as any;
    if (!lead || lead.automation_stopped || lead.email_bounce) {
      await supabase.from("automation_queue")
        .update({ status: "cancelled", cancelled_reason: "Lead no longer eligible" }).eq("id", item.id);
      continue;
    }

    // Re-check timezone
    const tz = item.lead_timezone || 'UTC';
    if (!isWithinSendingWindow(tz)) continue; // Not yet in window

    // Check for replies
    const { data: replies } = await supabase
      .from("messages").select("id").eq("lead_id", lead.id).eq("direction", "inbound").limit(1);
    if (replies && replies.length > 0) {
      await stopLeadAutomation(supabase, lead.id, "Lead replied", userId);
      await supabase.from("automation_queue")
        .update({ status: "cancelled", cancelled_reason: "Lead replied" }).eq("id", item.id);
      continue;
    }

    try {
      let success = false;
      if (item.channel === "email") {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: lead.id, campaign_id: item.campaign_id,
            subject: item.message_subject || "Message", body: item.message_body,
          }),
        });
        success = res.ok;
        await res.text();
      } else if (item.channel === "whatsapp") {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: lead.id, campaign_id: item.campaign_id, message: item.message_body }),
        });
        success = res.ok;
        await res.text();
      }

      await supabase.from("automation_queue").update({
        status: success ? "sent" : "failed",
        sent_at: success ? new Date().toISOString() : null,
        attempt_count: item.attempt_count + 1,
        error_message: success ? null : "Send failed",
      }).eq("id", item.id);

      if (success) processed++;
    } catch (err) {
      await supabase.from("automation_queue").update({
        status: "failed", error_message: String(err), attempt_count: item.attempt_count + 1,
      }).eq("id", item.id);
    }
  }

  return jsonResponse({ success: true, processed });
}

async function handleStopLead(supabase: ReturnType<typeof createClient>, lead_id?: string, data?: Record<string, unknown>, userId?: string) {
  if (!lead_id) return errorResponse("lead_id required", 400);
  const reason = (data?.reason as string) || "Manual stop";
  await stopLeadAutomation(supabase, lead_id, reason, userId);
  return jsonResponse({ success: true, message: `Automation stopped for lead: ${reason}` });
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function stopLeadAutomation(supabase: ReturnType<typeof createClient>, leadId: string, reason: string, userId?: string) {
  await supabase.from("leads").update({
    automation_stopped: true,
    automation_stop_reason: reason,
    automation_stopped_at: new Date().toISOString(),
    automation_eligible: false,
  }).eq("id", leadId);

  // Cancel all queued items for this lead
  await supabase.from("automation_queue")
    .update({ status: "cancelled", cancelled_reason: reason })
    .eq("lead_id", leadId).eq("status", "queued");

  await logAutomation(supabase, {
    event_type: "automation_stopped", lead_id: leadId,
    stop_condition: "stop_triggered", stop_reason: reason,
  });
}

async function logAutomation(supabase: ReturnType<typeof createClient>, entry: Record<string, unknown>) {
  try {
    await supabase.from("automation_logs").insert({
      lead_id: entry.lead_id || '00000000-0000-0000-0000-000000000000',
      campaign_id: entry.campaign_id || null,
      event_type: entry.event_type as string,
      channel: entry.channel as string || null,
      trigger_source: entry.trigger_source as string || null,
      lead_source_classification: entry.lead_source_classification || null,
      lead_local_timestamp: entry.lead_local_timestamp as string || null,
      lead_timezone: entry.lead_timezone as string || null,
      stop_condition: entry.stop_condition as string || null,
      stop_reason: entry.stop_reason as string || null,
      metadata: entry.metadata || {},
    });
  } catch (e) {
    console.error("Failed to log automation event:", e);
  }
}

function getNextWindow(tz: string): Date {
  const now = new Date();
  try {
    const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const target = new Date(local);
    target.setHours(9, 0, 0, 0);
    if (local.getHours() >= 18) target.setDate(target.getDate() + 1);
    const offset = now.getTime() - local.getTime();
    return new Date(target.getTime() + offset);
  } catch {
    return new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12h fallback
  }
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
