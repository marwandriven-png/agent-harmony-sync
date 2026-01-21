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
    const { sheetId, range = "A1:Z1000" } = await req.json();

    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    
    if (!GOOGLE_SHEETS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google Sheets API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch data from Google Sheets API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", errorText);
      
      // Check for specific error types
      let errorMessage = "Failed to fetch sheet data.";
      if (errorText.includes("FAILED_PRECONDITION") || errorText.includes("not supported")) {
        errorMessage = "This appears to be an Excel file uploaded to Google Drive, not a native Google Sheet. Please open the file in Google Sheets and re-share the new URL.";
      } else if (errorText.includes("NOT_FOUND")) {
        errorMessage = "Sheet not found. Make sure the sheet is shared publicly ('Anyone with the link can view').";
      } else if (errorText.includes("PERMISSION_DENIED")) {
        errorMessage = "Permission denied. Make sure the sheet is shared publicly ('Anyone with the link can view').";
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const values = data.values || [];

    if (values.length === 0) {
      return new Response(
        JSON.stringify({ headers: [], rows: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First row is headers
    const headers = values[0] as string[];
    
    // Convert remaining rows to objects
    const rows = values.slice(1).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return new Response(
      JSON.stringify({ headers, rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing sheet:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
