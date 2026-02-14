import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EVALUATION_PROMPT = `You are an expert real estate sales call analyst. Evaluate the following sales call transcript and provide a detailed analysis.

Transcript:
{transcript}

Call Context:
- Direction: {direction}
- Duration: {duration} seconds

Provide your analysis in the following JSON format:
{
    "overall_score": <number 0-100>,
    "confidence_score": <number 0-100>,
    "lead_intent_score": <number 0-100>,
    "closing_probability": <number 0-100>,
    "strengths": [
        "<specific strength with example from transcript>"
    ],
    "weaknesses": [
        "<specific weakness with example from transcript>"
    ],
    "detailed_analysis": {
        "communication_clarity": "<assessment>",
        "objection_handling": "<assessment>",
        "discovery_quality": "<how well they understood needs>",
        "closing_attempts": "<assessment of closing>",
        "missed_opportunities": "<what was missed>"
    },
    "key_quotes": [
        "<important quote from transcript>"
    ],
    "recommendations": [
        "<actionable recommendation>"
    ]
}

Scoring Guidelines:
- Overall Score: General quality of the call (0-100)
- Confidence Score: Agent's confidence and authority (0-100)
- Lead Intent Score: How interested the lead appears (0-100)
- Closing Probability: Likelihood of conversion (0-100)

Be objective and specific. Reference actual quotes from the transcript.
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

    // Fetch call record
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

    // Update status to processing
    await supabase
      .from("called_calls")
      .update({ ai_evaluation_status: "processing" })
      .eq("id", call_id);

    // Build prompt
    const prompt = EVALUATION_PROMPT
      .replace("{transcript}", call.transcript_text.substring(0, 8000))
      .replace("{direction}", call.direction || "outbound")
      .replace("{duration}", String(call.duration_seconds || 0));

    // Call Lovable AI
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
            content: "You are a professional real estate sales call analyst. Return ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      await supabase
        .from("called_calls")
        .update({ ai_evaluation_status: "failed" })
        .eq("id", call_id);
      return new Response(
        JSON.stringify({ success: false, error: `AI API error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
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

    // Store evaluation results
    const { error: updateError } = await supabase
      .from("called_calls")
      .update({
        ai_evaluation_status: "completed",
        ai_overall_score: analysis.overall_score || 0,
        ai_confidence_score: analysis.confidence_score || 0,
        ai_lead_intent_score: analysis.lead_intent_score || 0,
        ai_closing_probability: analysis.closing_probability || 0,
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
        scores: {
          overall: analysis.overall_score,
          confidence: analysis.confidence_score,
          lead_intent: analysis.lead_intent_score,
          closing_probability: analysis.closing_probability,
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
