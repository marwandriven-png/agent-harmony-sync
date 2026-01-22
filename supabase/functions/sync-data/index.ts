import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Sheets column mappings for properties (exact match)
const PROPERTY_COLUMN_MAPPINGS: Record<string, string> = {
  "Regis": "regis",
  "ProcedureValue": "procedure_value",
  "Master Project": "master_project",
  "BuildingNameEn": "building_name",
  "Size": "size",
  "UnitNumber": "unit_number",
  "PropertyTypeEn": "type",
  "ProcedurePartyTypeNameEn": "party_type",
  "NameEn": "owner_name",
  "Mobile": "owner_mobile",
  "ProcedureNameEn": "procedure_name",
  "CountryNameEn": "country",
  "Status": "status",
  "Matches": "matches",
};

// Reverse mappings for CRM to Sheets
const PROPERTY_REVERSE_MAPPINGS: Record<string, string> = Object.fromEntries(
  Object.entries(PROPERTY_COLUMN_MAPPINGS).map(([k, v]) => [v, k])
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceId, action = "pull" } = await req.json();

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
    let headers: string[] = [];

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
        headers = values[0] as string[];
        rows = values.slice(1).map((row: string[]) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || "";
          });
          return obj;
        });
      }
    }

    const tableName = dataSource.table_name;
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const conflicts: Array<{
      row_id: string;
      crm_data: Record<string, unknown>;
      sheet_data: Record<string, unknown>;
      field_diffs: string[];
    }> = [];

    // Determine column mappings based on table
    const columnMappings = tableName === "properties" 
      ? PROPERTY_COLUMN_MAPPINGS 
      : (dataSource.column_mappings as Record<string, string>);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const mappedRow: Record<string, unknown> = {};
      
      // Use sheet column names to map to CRM fields
      for (const [sheetColumn, crmField] of Object.entries(columnMappings)) {
        if (row[sheetColumn] !== undefined && row[sheetColumn] !== "") {
          let value: unknown = row[sheetColumn];
          
          // Type conversions based on field
          if (["procedure_value", "price", "size", "matches"].includes(crmField)) {
            value = parseFloat(String(value).replace(/[^0-9.-]/g, "")) || null;
          } else if (["bedrooms", "bathrooms"].includes(crmField)) {
            value = parseInt(String(value)) || null;
          } else if (crmField === "type" && tableName === "properties") {
            // Map property type from sheet to enum value
            const typeMap: Record<string, string> = {
              "Apartment": "apartment",
              "Villa": "villa",
              "Townhouse": "townhouse",
              "Penthouse": "penthouse",
              "Studio": "studio",
              "Commercial": "commercial",
              "Land": "land",
            };
            value = typeMap[String(value)] || "apartment";
          } else if (crmField === "status" && tableName === "properties") {
            // Map status from sheet to enum value
            const statusMap: Record<string, string> = {
              "Active": "available",
              "Available": "available",
              "Sold": "sold",
              "Rented": "rented",
              "Under Offer": "under_offer",
              "Off-Market": "sold",
              "Archived": "sold",
            };
            value = statusMap[String(value)] || "available";
          } else if (["locations", "property_types", "features", "tags"].includes(crmField)) {
            value = String(value).split(",").map(s => s.trim()).filter(Boolean);
          }
          
          mappedRow[crmField] = value;
        }
      }

      // Generate google_sheet_row_id for tracking
      const sheetRowId = `${dataSource.sheet_id}_row_${rowIndex}`;
      mappedRow.google_sheet_row_id = sheetRowId;

      // For properties, ensure required fields have defaults
      if (tableName === "properties") {
        if (!mappedRow.title && mappedRow.building_name) {
          mappedRow.title = mappedRow.building_name;
        }
        if (!mappedRow.title) {
          mappedRow.title = `Property ${mappedRow.regis || sheetRowId}`;
        }
        if (!mappedRow.location) {
          mappedRow.location = mappedRow.country || "UAE";
        }
        if (!mappedRow.price && mappedRow.procedure_value) {
          mappedRow.price = mappedRow.procedure_value;
        }
        if (!mappedRow.price) {
          mappedRow.price = 0;
        }
        if (!mappedRow.bedrooms) {
          mappedRow.bedrooms = 0;
        }
        if (!mappedRow.bathrooms) {
          mappedRow.bathrooms = 0;
        }
        if (!mappedRow.size) {
          mappedRow.size = 0;
        }
        if (!mappedRow.type) {
          mappedRow.type = "apartment";
        }
      }

      try {
        // Check if record exists
        const { data: existing } = await supabase
          .from(tableName)
          .select("*")
          .eq("google_sheet_row_id", sheetRowId)
          .single();

        if (existing) {
          // Check for conflicts (field-level comparison)
          const fieldDiffs: string[] = [];
          for (const [field, newValue] of Object.entries(mappedRow)) {
            if (field === "google_sheet_row_id" || field === "matches") continue;
            const existingValue = existing[field];
            if (existingValue !== null && existingValue !== undefined && 
                String(existingValue) !== String(newValue) && 
                newValue !== null && newValue !== undefined) {
              fieldDiffs.push(field);
            }
          }

          if (fieldDiffs.length > 0) {
            // Record conflict for resolution
            conflicts.push({
              row_id: existing.id,
              crm_data: existing,
              sheet_data: mappedRow,
              field_diffs: fieldDiffs,
            });
          } else {
            // No conflicts, update record
            const { error } = await supabase
              .from(tableName)
              .update(mappedRow)
              .eq("google_sheet_row_id", sheetRowId);

            if (error) {
              console.error("Update error:", error);
              errorCount++;
            } else {
              updatedCount++;
            }
          }
        } else {
          // Insert new record
          const { error } = await supabase
            .from(tableName)
            .insert(mappedRow);

          if (error) {
            console.error("Insert error:", error);
            errorCount++;
          } else {
            insertedCount++;
          }
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
        sync_status: errorCount === 0 && conflicts.length === 0 ? "success" : conflicts.length > 0 ? "conflicts" : "error",
        sync_error: errorCount > 0 ? `${errorCount} rows failed to import` : conflicts.length > 0 ? `${conflicts.length} conflicts detected` : null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    // Log sync activity
    await supabase.from("sync_logs").insert({
      table_name: tableName,
      operation: "sync",
      source: "google_sheets",
      status: errorCount === 0 ? "success" : "partial",
      new_data: { inserted: insertedCount, updated: updatedCount, errors: errorCount, conflicts: conflicts.length },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount,
        updated: updatedCount, 
        errors: errorCount,
        conflicts: conflicts,
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
