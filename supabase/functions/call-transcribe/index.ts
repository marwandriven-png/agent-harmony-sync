import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_id, audio_base64, notes, direction, duration_seconds } = await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({ success: false, error: "call_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let transcript = "";

    if (audio_base64) {
      // Use Lovable AI (Gemini) to transcribe audio
      // Send audio as base64 in a multimodal message
      await supabase
        .from("called_calls")
        .update({ transcript_status: "processing" })
        .eq("id", call_id);

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
              content: `You are a professional transcription service. Transcribe the following audio recording of a real estate sales call accurately. Format the transcript with speaker labels (Agent: / Client:) when you can distinguish speakers. Include all spoken content. Return ONLY the transcript text, no other commentary.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: audio_base64,
                    format: "wav",
                  },
                },
                {
                  type: "text",
                  text: `Transcribe this ${direction || "outbound"} sales call recording (${duration_seconds || 0} seconds). Provide a detailed transcript with speaker labels.`,
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI transcription error:", errText);

        // Fallback: generate transcript from notes if available
        if (notes) {
          transcript = `[Auto-generated summary from agent notes]\n\n${notes}`;
        } else {
          await supabase
            .from("called_calls")
            .update({ transcript_status: "failed" })
            .eq("id", call_id);

          // Check for rate limiting
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResponse.status === 402) {
            return new Response(
              JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: false, error: `Transcription failed: ${errText}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const aiResult = await aiResponse.json();
        transcript = aiResult.choices?.[0]?.message?.content || "";
      }
    } else if (notes) {
      // No audio, generate a structured transcript from notes
      transcript = `[Agent notes - no audio recorded]\n\n${notes}`;
    }

    if (transcript) {
      const { error: updateError } = await supabase
        .from("called_calls")
        .update({
          transcript_text: transcript,
          transcript_status: "completed",
          transcript_provider: "lovable-ai",
        })
        .eq("id", call_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, call_id, transcript_length: transcript.length, has_transcript: !!transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
