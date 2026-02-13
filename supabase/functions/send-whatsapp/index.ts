import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API_URL = "https://graph.facebook.com/v21.0";

interface SendMessageRequest {
  lead_id: string;
  campaign_id?: string;
  message?: string;
  template_name?: string;
  template_variables?: Record<string, string>;
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

    const body: SendMessageRequest = await req.json();
    const { lead_id, campaign_id, message, template_name, template_variables } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead phone number
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

    // Get WhatsApp credentials
    const { data: credentials } = await supabase
      .from("channel_credentials")
      .select("credential_key, credential_value")
      .eq("channel", "whatsapp")
      .eq("is_active", true);

    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured. Please add your Meta Business API credentials in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credMap: Record<string, string> = {};
    for (const c of credentials) {
      credMap[c.credential_key] = c.credential_value;
    }

    const accessToken = credMap["access_token"];
    const phoneNumberId = credMap["phone_number_id"];

    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials incomplete. Need access_token and phone_number_id." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (remove spaces, ensure + prefix)
    let phone = lead.phone.replace(/[\s\-()]/g, "");
    if (!phone.startsWith("+")) phone = "+" + phone;

    // Build Meta API payload
    let metaPayload: Record<string, unknown>;

    if (template_name) {
      // Template message
      const components: unknown[] = [];
      if (template_variables && Object.keys(template_variables).length > 0) {
        components.push({
          type: "body",
          parameters: Object.values(template_variables).map((val) => ({
            type: "text",
            text: val,
          })),
        });
      }

      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: template_name,
          language: { code: "en" },
          components: components.length > 0 ? components : undefined,
        },
      };
    } else {
      // Regular text message with variable substitution
      let finalMessage = message || "";
      finalMessage = finalMessage
        .replace(/{first_name}/g, lead.name.split(" ")[0])
        .replace(/{name}/g, lead.name)
        .replace(/{phone}/g, lead.phone)
        .replace(/{email}/g, lead.email || "");

      metaPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: finalMessage },
      };
    }

    // Send via Meta API
    const metaResponse = await fetch(
      `${META_API_URL}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta API error:", metaResult);

      // Log failed message
      await supabase.from("messages").insert({
        lead_id,
        campaign_id: campaign_id || null,
        channel: "whatsapp",
        body: message || `Template: ${template_name}`,
        template_name: template_name || null,
        template_variables: template_variables || {},
        status: "failed",
        error_message: metaResult?.error?.message || "WhatsApp API error",
        created_by: userId,
      });

      return new Response(
        JSON.stringify({
          error: metaResult?.error?.message || "Failed to send WhatsApp message",
          details: metaResult?.error,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalMessageId = metaResult?.messages?.[0]?.id;

    // Log successful message
    const { data: msgRecord } = await supabase.from("messages").insert({
      lead_id,
      campaign_id: campaign_id || null,
      channel: "whatsapp",
      body: message || `Template: ${template_name}`,
      template_name: template_name || null,
      template_variables: template_variables || {},
      status: "sent",
      external_message_id: externalMessageId,
      sent_at: new Date().toISOString(),
      created_by: userId,
    }).select().single();

    // Update campaign stats if applicable
    if (campaign_id) {
      await supabase.rpc("increment_campaign_stat", {
        _campaign_id: campaign_id,
        _stat: "sent_count",
      }).catch(() => {
        // Non-critical, just log
        console.warn("Could not update campaign stats");
      });
    }

    // Log activity on lead
    await supabase.from("activities").insert({
      lead_id,
      type: "whatsapp",
      title: `WhatsApp message sent`,
      description: template_name
        ? `Template "${template_name}" sent via WhatsApp`
        : `Message sent via WhatsApp`,
      created_by: userId,
      metadata: { message_id: msgRecord?.id, external_id: externalMessageId },
    });

    console.log(`WhatsApp sent to ${lead.name} (${phone}), msg_id: ${externalMessageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: msgRecord?.id,
        external_message_id: externalMessageId,
        status: "sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
