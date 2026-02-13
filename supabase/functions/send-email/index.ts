import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailRequest {
  lead_id: string;
  campaign_id?: string;
  subject: string;
  body: string;  // HTML or plain text
  from_name?: string;
  from_email?: string;
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

    const { lead_id, campaign_id, subject, body: emailBody, from_name, from_email }: SendEmailRequest = await req.json();

    if (!lead_id || !subject || !emailBody) {
      return new Response(JSON.stringify({ error: "lead_id, subject, and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, phone, email")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead.email) {
      return new Response(JSON.stringify({ error: "Lead has no email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Resend API key from channel_credentials or env
    let resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      const { data: credentials } = await supabase
        .from("channel_credentials")
        .select("credential_key, credential_value")
        .eq("channel", "email")
        .eq("credential_key", "resend_api_key")
        .eq("is_active", true)
        .limit(1);

      if (credentials && credentials.length > 0) {
        resendApiKey = credentials[0].credential_value;
      }
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email not configured. Add RESEND_API_KEY secret or configure email credentials in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Variable substitution
    const processText = (text: string) =>
      text
        .replace(/{first_name}/g, lead.name.split(" ")[0])
        .replace(/{name}/g, lead.name)
        .replace(/{email}/g, lead.email || "")
        .replace(/{phone}/g, lead.phone);

    const finalSubject = processText(subject);
    const finalBody = processText(emailBody);

    // Send via Resend
    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${from_name || "CRM"} <${from_email || "onboarding@resend.dev"}>`,
        to: [lead.email],
        subject: finalSubject,
        html: finalBody,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendResult);

      await supabase.from("messages").insert({
        lead_id,
        campaign_id: campaign_id || null,
        channel: "email",
        subject: finalSubject,
        body: finalBody,
        status: "failed",
        error_message: resendResult?.message || "Email send failed",
        created_by: userId,
      });

      return new Response(
        JSON.stringify({ error: resendResult?.message || "Failed to send email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log message
    const { data: msgRecord } = await supabase.from("messages").insert({
      lead_id,
      campaign_id: campaign_id || null,
      channel: "email",
      subject: finalSubject,
      body: finalBody,
      status: "sent",
      external_message_id: resendResult.id,
      sent_at: new Date().toISOString(),
      created_by: userId,
    }).select().single();

    // Log activity
    await supabase.from("activities").insert({
      lead_id,
      type: "email",
      title: `Email sent: ${finalSubject}`,
      description: `Email sent to ${lead.email}`,
      created_by: userId,
      metadata: { message_id: msgRecord?.id, resend_id: resendResult.id },
    });

    console.log(`Email sent to ${lead.name} (${lead.email}), resend_id: ${resendResult.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: msgRecord?.id,
        external_message_id: resendResult.id,
        status: "sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
