import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIRequest {
  type: 'lead_profile' | 'property_match' | 'message_generate' | 'market_insight' | 'follow_up_suggest';
  data: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, data }: AIRequest = await req.json();

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Request type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case 'lead_profile':
        systemPrompt = `You are an expert real estate CRM AI assistant. Analyze lead data and create a comprehensive profile.
Output a JSON object with:
- intent: "buy" | "rent" | "invest"
- urgency: "high" | "medium" | "low"
- budget_tier: "luxury" | "premium" | "mid_range" | "budget"
- property_preferences: string[]
- communication_style: "formal" | "casual" | "professional"
- key_insights: string[]
- recommended_approach: string`;
        userPrompt = `Analyze this lead and create a profile:\n${JSON.stringify(data.lead, null, 2)}`;
        break;

      case 'property_match':
        systemPrompt = `You are an expert real estate matching AI. Score how well properties match a lead's requirements.
For each property, provide a JSON object with:
- property_id: string
- match_score: number (0-10)
- match_reasons: string[]
- concerns: string[]
- recommended_pitch: string`;
        userPrompt = `Lead Requirements:\n${JSON.stringify(data.lead, null, 2)}\n\nProperties to match:\n${JSON.stringify(data.properties, null, 2)}`;
        break;

      case 'message_generate':
        systemPrompt = `You are an expert real estate sales copywriter. Generate personalized messages for WhatsApp, Email, or SMS.
The message should be:
- Personalized to the lead's profile and preferences
- Professional but warm
- Include a clear call-to-action
- Reference specific properties if provided
Output JSON with: { subject?: string, message: string, cta: string }`;
        userPrompt = `Generate a ${data.channel} message for this lead:\n${JSON.stringify(data.lead, null, 2)}\n\nContext: ${data.context || 'General follow-up'}\n\nProperties to mention:\n${JSON.stringify(data.properties || [], null, 2)}`;
        break;

      case 'market_insight':
        systemPrompt = `You are a real estate market analyst. Provide market insights for the given area.
Output JSON with:
- market_trend: "rising" | "stable" | "declining"
- price_per_sqft_range: { min: number, max: number }
- comparable_transactions: { price: number, type: string, size: number, date: string }[]
- investment_rating: number (1-10)
- key_factors: string[]
- recommendation: string`;
        userPrompt = `Provide market insights for:\nLocation: ${data.location}\nProperty Type: ${data.property_type}\nBudget Range: ${data.budget_min} - ${data.budget_max}`;
        break;

      case 'follow_up_suggest':
        systemPrompt = `You are a real estate follow-up strategist. Create a multi-week engagement plan.
Output JSON with:
- week_1: { tasks: { title: string, type: string, description: string, day: number }[] }
- week_2: { tasks: { title: string, type: string, description: string, day: number }[] }
- week_3: { tasks: { title: string, type: string, description: string, day: number }[] }
- key_milestones: string[]
- success_metrics: string[]`;
        userPrompt = `Create a follow-up plan for this lead:\n${JSON.stringify(data.lead, null, 2)}\n\nCurrent stage: ${data.stage}\nPrevious interactions:\n${JSON.stringify(data.activities || [], null, 2)}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid request type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("AI service unavailable");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Try to parse as JSON, fall back to raw text
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      result = JSON.parse(jsonStr);
    } catch {
      result = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, result, type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "AI request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
