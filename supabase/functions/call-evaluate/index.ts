import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EVALUATION_PROMPT = `You are a senior real estate valuation analyst and decision-science system.

Evaluate this residential real estate call transcript and generate a "Final Adjusted Call Valuation Score (F-CVS)".

Transcript:
{transcript}

Call Context:
- Direction: {direction}
- Duration: {duration} seconds

Follow these steps EXACTLY:

STEP 1 — CALL CLASSIFICATION
Classify the call as EXACTLY one: "SELLER" or "BUYER"

STEP 2 — CORE CALL KPI SCORING (score each 0-5)

If SELLER:
1) Seller Authority (weight ×2) - Legal owner / decision-maker?
2) Tenant & Vacancy Status (×1.5) - Vacant or rented? Eviction notice?
3) Multi-Agent Exposure & Control (×1.5) - Listed with other agents? Exclusive?
4) Market Activity Reality Check (×1.5) - Viewings happening? Offers?
5) Seller Price Anchor Quality (×2) - Asking price aligned with market?
6) Urgency & Reason for Selling (×1.5) - Time pressure? Reason?
7) Time-to-Value Commitment (×1) - Willing to adjust in 30 days?

If BUYER:
1) Financial Readiness (×2) - Cash or mortgage? Pre-approved?
2) Occupancy Requirement (×1.5) - Vacant possession needed?
3) Investment Logic (×2) - Investment or end-use? Target ROI?
4) Price Sensitivity & Budget Ceiling (×1.5) - Max price stated?
5) Time-to-Decision (×1.5) - Need to buy within 30 days?
6) Objection Specificity (×1) - Specific or vague objections?

STEP 3 — AGENT PERFORMANCE INDEX (score each 0-5)
1) Market Knowledge Accuracy (×2)
2) Communication Discipline (×1.5)
3) Behavioral Tone Control (×1.5)
4) Client Comfort Signal (×2)
5) Trust & Ice-Break Effectiveness (×2)
6) Client Satisfaction Indicator (×1)

STEP 4 — FINAL SCORE
Agent Performance Score (APS) = sum of weighted agent KPIs
Core CVS = sum of weighted call KPIs
If APS < 15 → F-CVS = Core CVS × 0.7
If APS 15-25 → F-CVS = Core CVS × 1.0
If APS > 25 → F-CVS = Core CVS × 1.1

Return ONLY valid JSON in this exact format:
{
  "call_type": "SELLER" or "BUYER",
  "core_kpis": [
    {"name": "KPI name", "score": 0-5, "weight": multiplier, "weighted_score": score*weight, "notes": "brief justification"}
  ],
  "core_cvs": <number>,
  "agent_kpis": [
    {"name": "KPI name", "score": 0-5, "weight": multiplier, "weighted_score": score*weight, "notes": "brief justification"}
  ],
  "agent_performance_score": <number>,
  "aps_multiplier": 0.7 or 1.0 or 1.1,
  "final_cvs": <number>,
  "confidence_level": "Low" or "Medium" or "High",
  "risk_flags": ["specific risk flag"],
  "action_recommendations": ["specific recommendation"],
  "strengths": ["key strength from the call"],
  "weaknesses": ["key weakness from the call"]
}

IMPORTANT: Return ONLY valid JSON, no markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_id } = await req.json();
    if (!call_id) {
      return new Response(
        JSON.stringify({ success: false, error: "call_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: call, error: fetchError } = await supabase
      .from("called_calls")
      .select("*")
      .eq("id", call_id)
      .single();

    if (fetchError || !call) {
      return new Response(
        JSON.stringify({ success: false, error: "Call not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!call.transcript_text) {
      return new Response(
        JSON.stringify({ success: false, error: "No transcript available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("called_calls")
      .update({ ai_evaluation_status: "processing" })
      .eq("id", call_id);

    const prompt = EVALUATION_PROMPT
      .replace("{transcript}", call.transcript_text.substring(0, 8000))
      .replace("{direction}", call.direction || "outbound")
      .replace("{duration}", String(call.duration_seconds || 0));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a professional real estate call valuation analyst. Return ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      await supabase
        .from("called_calls")
        .update({ ai_evaluation_status: "failed" })
        .eq("id", call_id);

      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `AI API error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      await supabase
        .from("called_calls")
        .update({ ai_evaluation_status: "failed" })
        .eq("id", call_id);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map F-CVS scores to existing DB columns
    // ai_overall_score = final_cvs (normalized to 0-100 scale based on max possible)
    const maxCoreCvs = analysis.call_type === "SELLER" ? 55 : 47.5; // sum of all max weighted scores
    const normalizedCoreCvs = Math.min(100, Math.round((analysis.core_cvs / maxCoreCvs) * 100));
    const normalizedFcvs = Math.min(100, Math.round((analysis.final_cvs / (maxCoreCvs * 1.1)) * 100));
    const normalizedAps = Math.min(100, Math.round((analysis.agent_performance_score / 52.5) * 100));

    const { error: updateError } = await supabase
      .from("called_calls")
      .update({
        ai_evaluation_status: "completed",
        ai_overall_score: normalizedFcvs,
        ai_confidence_score: normalizedAps,
        ai_lead_intent_score: normalizedCoreCvs,
        ai_closing_probability: analysis.confidence_level === "High" ? 80 : analysis.confidence_level === "Medium" ? 50 : 20,
        ai_strengths: analysis.strengths || [],
        ai_weaknesses: analysis.weaknesses || [],
        ai_full_analysis: analysis,
      })
      .eq("id", call_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        analysis: {
          call_type: analysis.call_type,
          final_cvs: analysis.final_cvs,
          core_cvs: analysis.core_cvs,
          agent_performance_score: analysis.agent_performance_score,
          confidence_level: analysis.confidence_level,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
