import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST - Incoming webhook events
  if (req.method === "POST") {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const body = await req.json();
      console.log("Webhook event:", JSON.stringify(body).substring(0, 500));

      const entries = body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const statuses = value?.statuses || [];
          const messages = value?.messages || [];

          // Handle status updates (sent, delivered, read)
          for (const status of statuses) {
            const externalId = status.id;
            const statusValue = status.status; // sent, delivered, read, failed

            const updateData: Record<string, unknown> = {
              status: statusValue,
            };

            if (statusValue === "delivered") {
              updateData.delivered_at = new Date().toISOString();
            } else if (statusValue === "read") {
              updateData.read_at = new Date().toISOString();
            } else if (statusValue === "failed") {
              updateData.error_message = status?.errors?.[0]?.title || "Delivery failed";
            }

            const { error } = await supabase
              .from("messages")
              .update(updateData)
              .eq("external_message_id", externalId);

            if (error) {
              console.error(`Failed to update message ${externalId}:`, error);
            } else {
              console.log(`Message ${externalId} status → ${statusValue}`);
            }

            // Update campaign_leads status too
            const { data: msg } = await supabase
              .from("messages")
              .select("campaign_id, lead_id")
              .eq("external_message_id", externalId)
              .single();

            if (msg?.campaign_id) {
              await supabase
                .from("campaign_leads")
                .update({
                  status: statusValue,
                  ...(statusValue === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
                  ...(statusValue === "read" ? { read_at: new Date().toISOString() } : {}),
                })
                .eq("campaign_id", msg.campaign_id)
                .eq("lead_id", msg.lead_id)
                .eq("channel", "whatsapp");
            }
          }

          // Handle incoming messages (replies)
          for (const msg of messages) {
            const from = msg.from; // phone number
            const text = msg?.text?.body || msg?.type || "Media message";
            const timestamp = msg.timestamp;

            // Find lead by phone
            const { data: leads } = await supabase
              .from("leads")
              .select("id, name")
              .or(`phone.eq.${from},phone.eq.+${from}`)
              .limit(1);

            if (leads && leads.length > 0) {
              const lead = leads[0];

              // Store inbound message
              await supabase.from("messages").insert({
                lead_id: lead.id,
                channel: "whatsapp",
                direction: "inbound",
                body: text,
                status: "delivered",
                external_message_id: msg.id,
                delivered_at: new Date(parseInt(timestamp) * 1000).toISOString(),
              });

              // Log activity
              await supabase.from("activities").insert({
                lead_id: lead.id,
                type: "whatsapp",
                title: "WhatsApp reply received",
                description: `Reply from ${lead.name}: "${text.substring(0, 100)}"`,
                metadata: { direction: "inbound", external_id: msg.id },
              });

              // Update last contacted
              await supabase
                .from("leads")
                .update({ last_contacted_at: new Date().toISOString() })
                .eq("id", lead.id);

              console.log(`Inbound WhatsApp from ${lead.name}: ${text.substring(0, 50)}`);
            } else {
              console.log(`Inbound WhatsApp from unknown number: ${from}`);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      // Always return 200 to Meta to prevent retry storms
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
