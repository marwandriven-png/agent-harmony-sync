import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json();

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Integration type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let isConnected = false;
    let message = "";

    switch (type) {
      case "google_sheets": {
        const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
        if (apiKey) {
          // Test with a simple API call
          const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/values/A1?key=${apiKey}`;
          const response = await fetch(testUrl);
          isConnected = response.ok;
          message = isConnected ? "API key is valid" : "API key is invalid or expired";
        } else {
          message = "API key not configured";
        }
        break;
      }

      case "google_calendar":
      case "google_drive": {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        isConnected = !!(clientId && clientSecret);
        message = isConnected ? "OAuth credentials configured" : "OAuth credentials not set";
        break;
      }

      case "openai": {
        // Lovable AI is always available
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        isConnected = !!lovableKey;
        message = isConnected ? "Lovable AI is ready" : "AI gateway not configured";
        break;
      }

      case "whatsapp": {
        // Check for WhatsApp configuration
        const whatsappKey = Deno.env.get("WHATSAPP_API_KEY");
        isConnected = !!whatsappKey;
        message = isConnected ? "WhatsApp API configured" : "WhatsApp API key not set";
        break;
      }

      default:
        message = "Unknown integration type";
    }

    return new Response(
      JSON.stringify({ isConnected, message, type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Test integration error:", error);
    return new Response(
      JSON.stringify({ 
        isConnected: false, 
        error: error instanceof Error ? error.message : "Test failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
