import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_id, period_type } = await req.json();
    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const periodStart = new Date();
    if (period_type === "monthly") {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      periodStart.setDate(periodStart.getDate() - 7);
    }

    const { data: calls, error } = await supabase
      .from("called_calls")
      .select("*")
      .eq("agent_id", agent_id)
      .gte("call_date", periodStart.toISOString())
      .lte("call_date", now.toISOString());

    if (error) throw error;

    const totalCalls = calls?.length || 0;
    const answered = calls?.filter((c: any) => ["completed", "answered"].includes(c.status)).length || 0;
    const missed = calls?.filter((c: any) => c.status === "missed").length || 0;
    const outbound = calls?.filter((c: any) => c.direction === "outbound").length || 0;
    const inbound = calls?.filter((c: any) => c.direction === "inbound").length || 0;
    const totalDuration = calls?.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) || 0;
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const answerRate = totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0;

    const scored = calls?.filter((c: any) => c.ai_overall_score != null) || [];
    const avgAiScore = scored.length > 0
      ? Math.round(scored.reduce((s: number, c: any) => s + (c.ai_overall_score || 0), 0) / scored.length)
      : null;

    const highIntent = calls?.filter((c: any) => (c.ai_lead_intent_score || 0) >= 70).length || 0;
    const weakCalls = calls?.filter((c: any) => c.ai_overall_score != null && c.ai_overall_score < 50).length || 0;

    // Aggregate strengths/weaknesses
    const allStrengths: Record<string, number> = {};
    const allWeaknesses: Record<string, number> = {};
    calls?.forEach((c: any) => {
      (c.ai_strengths || []).forEach((s: string) => { allStrengths[s] = (allStrengths[s] || 0) + 1; });
      (c.ai_weaknesses || []).forEach((w: string) => { allWeaknesses[w] = (allWeaknesses[w] || 0) + 1; });
    });

    const topStrengths = Object.entries(allStrengths).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);
    const topWeaknesses = Object.entries(allWeaknesses).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);

    const kpiData = {
      agent_id,
      period_type: period_type || "weekly",
      period_start: periodStart.toISOString(),
      period_end: now.toISOString(),
      total_calls: totalCalls,
      answered_calls: answered,
      missed_calls: missed,
      outbound_calls: outbound,
      inbound_calls: inbound,
      total_duration_seconds: totalDuration,
      avg_duration_seconds: avgDuration,
      answer_rate: answerRate,
      avg_ai_score: avgAiScore,
      high_intent_calls: highIntent,
      weak_calls: weakCalls,
      common_strengths: topStrengths,
      common_weaknesses: topWeaknesses,
    };

    const { error: upsertError } = await supabase.from("call_kpis").insert(kpiData);
    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, kpis: kpiData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
