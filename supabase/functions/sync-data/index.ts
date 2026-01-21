import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceId } = await req.json();

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: "Source ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the data source
    const { data: dataSource, error: sourceError } = await supabase
      .from("data_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !dataSource) {
      return new Response(
        JSON.stringify({ error: "Data source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to syncing
    await supabase
      .from("data_sources")
      .update({ sync_status: "syncing" })
      .eq("id", sourceId);

    let rows: Record<string, string>[] = [];

    // Fetch data based on source type
    if (dataSource.type === "google_sheets" && dataSource.sheet_id) {
      const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
      
      if (!GOOGLE_SHEETS_API_KEY) {
        throw new Error("Google Sheets API key not configured");
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${dataSource.sheet_id}/values/A1:Z1000?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sheets API error:", errorText);
        
        let errorMessage = "Failed to fetch sheet data";
        if (errorText.includes("FAILED_PRECONDITION") || errorText.includes("not supported")) {
          errorMessage = "This appears to be an Excel file, not a native Google Sheet. Please open it in Google Sheets and re-share.";
        } else if (errorText.includes("NOT_FOUND") || errorText.includes("PERMISSION_DENIED")) {
          errorMessage = "Sheet not accessible. Make sure it's shared publicly.";
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const values = data.values || [];

      if (values.length > 0) {
        const headers = values[0] as string[];
        rows = values.slice(1).map((row: string[]) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || "";
          });
          return obj;
        });
      }
    }

    // Map and insert data
    const mappings = dataSource.column_mappings as Record<string, string>;
    const tableName = dataSource.table_name;

    let insertedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const mappedRow: Record<string, unknown> = {};
      
      for (const [targetField, sourceColumn] of Object.entries(mappings)) {
        if (row[sourceColumn] !== undefined) {
          let value: unknown = row[sourceColumn];
          
          // Type conversions based on field
          if (["budget", "budget_min", "budget_max", "price", "size"].includes(targetField)) {
            value = parseFloat(String(value).replace(/[^0-9.-]/g, "")) || null;
          } else if (["bedrooms", "bathrooms"].includes(targetField)) {
            value = parseInt(String(value)) || null;
          } else if (["locations", "property_types", "features", "tags"].includes(targetField)) {
            value = String(value).split(",").map(s => s.trim()).filter(Boolean);
          }
          
          mappedRow[targetField] = value;
        }
      }

      // Add google_sheet_row_id for tracking
      mappedRow.google_sheet_row_id = `${dataSource.sheet_id}_${insertedCount}`;

      try {
        const { error } = await supabase
          .from(tableName)
          .upsert(mappedRow, { onConflict: "google_sheet_row_id" });

        if (error) {
          console.error("Insert error:", error);
          errorCount++;
        } else {
          insertedCount++;
        }
      } catch (e) {
        console.error("Row error:", e);
        errorCount++;
      }
    }

    // Update sync status
    await supabase
      .from("data_sources")
      .update({
        sync_status: errorCount === 0 ? "success" : "error",
        sync_error: errorCount > 0 ? `${errorCount} rows failed to import` : null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    // Log sync activity
    await supabase.from("sync_logs").insert({
      table_name: tableName,
      operation: "sync",
      source: "google_sheets",
      status: errorCount === 0 ? "success" : "partial",
      new_data: { inserted: insertedCount, errors: errorCount },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount, 
        errors: errorCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
