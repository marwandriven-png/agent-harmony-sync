import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlotData {
  id: string;
  plot_number: string;
  area_name: string;
  master_plan?: string;
  plot_size: number;
  gfa?: number;
  floors_allowed?: number;
  zoning?: string;
  price?: number;
}

interface FeasibilityResult {
  estimated_units: number;
  build_potential: string;
  roi_range: string;
  risk_notes: string[];
  recommendation: string;
  market_comparison: {
    avg_price_sqft: number;
    similar_plots: number;
    demand_level: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { plot } = await req.json() as { plot: PlotData };

    if (!plot || !plot.id) {
      return new Response(
        JSON.stringify({ error: "Plot data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt for AI analysis
    const systemPrompt = `You are an expert real estate analyst specializing in Dubai land development and plot feasibility analysis. 
Analyze the provided plot data and return a structured JSON response with development recommendations.

Consider these factors:
- Plot size and GFA (Gross Floor Area) for unit estimation
- Zoning regulations and allowed floors
- Location (area name) for market demand
- Current market conditions in Dubai
- Risk factors and development potential

Always respond with valid JSON only, no additional text.`;

    const userPrompt = `Analyze this plot for development feasibility:

Plot Number: ${plot.plot_number}
Area: ${plot.area_name}
Master Plan: ${plot.master_plan || "Not specified"}
Plot Size: ${plot.plot_size} sqft
GFA (Gross Floor Area): ${plot.gfa || "Not specified"} sqft
Floors Allowed: ${plot.floors_allowed || "Not specified"}
Zoning: ${plot.zoning || "Residential"}
Listed Price: ${plot.price ? `AED ${plot.price.toLocaleString()}` : "Not listed"}

Return a JSON object with this exact structure:
{
  "estimated_units": <number of residential/commercial units possible>,
  "build_potential": "<description of what can be built, e.g., 'Mid-rise residential tower with 40 apartments'>",
  "roi_range": "<expected ROI percentage range, e.g., '12-18%'>",
  "risk_notes": ["<risk factor 1>", "<risk factor 2>", ...],
  "recommendation": "<overall recommendation and best use case>",
  "market_comparison": {
    "avg_price_sqft": <average price per sqft in the area>,
    "similar_plots": <estimated number of similar plots in market>,
    "demand_level": "<high/medium/low>"
  }
}`;

    console.log(`Analyzing feasibility for plot: ${plot.plot_number} in ${plot.area_name}`);

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the AI response
    let feasibilityResult: FeasibilityResult;
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      feasibilityResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a default structure if parsing fails
      feasibilityResult = {
        estimated_units: Math.floor((plot.gfa || plot.plot_size * 2) / 1000),
        build_potential: `Development potential based on ${plot.plot_size} sqft plot`,
        roi_range: "10-15%",
        risk_notes: ["AI analysis incomplete - manual review recommended"],
        recommendation: "Consult with development experts for detailed analysis",
        market_comparison: {
          avg_price_sqft: 1500,
          similar_plots: 10,
          demand_level: "medium",
        },
      };
    }

    // Store the feasibility result
    const { error: insertError } = await supabase.from("plot_feasibility").insert({
      plot_id: plot.id,
      estimated_units: feasibilityResult.estimated_units,
      build_potential: feasibilityResult.build_potential,
      roi_range: feasibilityResult.roi_range,
      risk_notes: feasibilityResult.risk_notes,
      recommendation: feasibilityResult.recommendation,
      market_comparison: feasibilityResult.market_comparison,
      ai_raw_response: aiData,
    });

    if (insertError) {
      console.error("Failed to store feasibility result:", insertError);
    }

    // Log activity
    await supabase.from("plot_activity_logs").insert({
      plot_id: plot.id,
      action: "AI_FEASIBILITY_ANALYSIS",
      new_values: feasibilityResult,
      user_id: claimsData.claims.sub,
      source: "ai_assistant",
    });

    console.log(`Feasibility analysis complete for plot ${plot.plot_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        result: feasibilityResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Plot feasibility error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
