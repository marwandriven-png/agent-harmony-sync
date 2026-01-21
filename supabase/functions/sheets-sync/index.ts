import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action: 'pull' | 'push' | 'check_conflicts';
  sourceId?: string;
  tableName?: string;
  record?: Record<string, unknown>;
  recordId?: string;
}

interface SheetRow {
  row_index: number;
  row_id: string;
  values: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!GOOGLE_SHEETS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google Sheets API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, sourceId, tableName, record, recordId }: SyncRequest = await req.json();

    // PULL: Fetch data from Google Sheets and sync to CRM
    if (action === 'pull') {
      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: "Source ID is required for pull" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get data source config
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

      // Fetch from Google Sheets
      const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${dataSource.sheet_id}/values/A1:Z1000?key=${GOOGLE_SHEETS_API_KEY}`;
      const sheetResponse = await fetch(sheetUrl);

      if (!sheetResponse.ok) {
        const errorText = await sheetResponse.text();
        console.error("Sheets API error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch sheet data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sheetData = await sheetResponse.json();
      const values = sheetData.values || [];

      if (values.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced: 0, conflicts: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const headers = values[0] as string[];
      const mappings = dataSource.column_mappings as Record<string, string>;
      const targetTable = dataSource.table_name;

      const conflicts: Array<{
        row_id: string;
        crm_data: Record<string, unknown>;
        sheet_data: Record<string, unknown>;
        field_diffs: string[];
      }> = [];

      let syncedCount = 0;
      let errorCount = 0;

      for (let i = 1; i < values.length; i++) {
        const row = values[i] as string[];
        const rowId = `${dataSource.sheet_id}_row_${i}`;

        // Map row to CRM fields
        const mappedRow: Record<string, unknown> = {
          google_sheet_row_id: rowId,
        };

        for (const [crmField, sheetColumn] of Object.entries(mappings)) {
          const colIndex = headers.indexOf(sheetColumn);
          if (colIndex >= 0 && row[colIndex] !== undefined) {
            let value: unknown = row[colIndex];

            // Type conversions
            if (["budget", "budget_min", "budget_max", "price", "size"].includes(crmField)) {
              value = parseFloat(String(value).replace(/[^0-9.-]/g, "")) || null;
            } else if (["bedrooms", "bathrooms"].includes(crmField)) {
              value = parseInt(String(value)) || null;
            } else if (["locations", "property_types", "features", "tags"].includes(crmField)) {
              value = String(value).split(",").map(s => s.trim()).filter(Boolean);
            }

            mappedRow[crmField] = value;
          }
        }

        // Check for existing record
        const { data: existing } = await supabase
          .from(targetTable)
          .select("*")
          .eq("google_sheet_row_id", rowId)
          .single();

        if (existing) {
          // Check for conflicts (compare updated_at timestamps)
          const fieldDiffs: string[] = [];
          for (const [field, newValue] of Object.entries(mappedRow)) {
            if (field === 'google_sheet_row_id') continue;
            const existingValue = existing[field];
            if (JSON.stringify(existingValue) !== JSON.stringify(newValue)) {
              fieldDiffs.push(field);
            }
          }

          if (fieldDiffs.length > 0) {
            conflicts.push({
              row_id: rowId,
              crm_data: existing,
              sheet_data: mappedRow,
              field_diffs: fieldDiffs,
            });
          }
        } else {
          // Insert new record
          const { error } = await supabase.from(targetTable).insert(mappedRow);
          if (error) {
            console.error("Insert error:", error);
            errorCount++;
          } else {
            syncedCount++;
          }
        }
      }

      // Update last synced timestamp
      await supabase
        .from("data_sources")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: conflicts.length > 0 ? "conflicts" : "success",
        })
        .eq("id", sourceId);

      return new Response(
        JSON.stringify({
          success: true,
          synced: syncedCount,
          errors: errorCount,
          conflicts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUSH: Update Google Sheet from CRM
    if (action === 'push') {
      if (!tableName || !record || !recordId) {
        return new Response(
          JSON.stringify({ error: "tableName, record, and recordId are required for push" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find data source for this table
      const { data: dataSource } = await supabase
        .from("data_sources")
        .select("*")
        .eq("table_name", tableName)
        .eq("type", "google_sheets")
        .limit(1)
        .single();

      if (!dataSource || !dataSource.sheet_id) {
        // No sheet connected, just succeed
        return new Response(
          JSON.stringify({ success: true, message: "No sheet connected" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the sync operation
      await supabase.from("sync_logs").insert({
        table_name: tableName,
        record_id: recordId,
        operation: "push",
        source: "crm",
        status: "pending",
        new_data: record,
      });

      // Note: Full Google Sheets write requires OAuth, not just API key
      // For now, log the intent and mark as pending
      return new Response(
        JSON.stringify({
          success: true,
          message: "Sync queued. Full Sheets write requires OAuth setup.",
          logged: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK_CONFLICTS: Compare CRM and Sheet data
    if (action === 'check_conflicts') {
      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: "Source ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get data source
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

      // Get all CRM records with sheet IDs
      const { data: crmRecords } = await supabase
        .from(dataSource.table_name)
        .select("*")
        .not("google_sheet_row_id", "is", null);

      return new Response(
        JSON.stringify({
          success: true,
          crm_records: crmRecords?.length || 0,
          last_synced: dataSource.last_synced_at,
          sync_status: dataSource.sync_status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sheets sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
