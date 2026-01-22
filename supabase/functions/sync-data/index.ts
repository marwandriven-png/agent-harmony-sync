import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Sheets column mappings for properties (exact 1:1 match with sheet headers)
// IMPORTANT: Column names must match EXACTLY character-for-character with Google Sheet headers
const PROPERTY_COLUMN_MAPPINGS: Record<string, string> = {
  // Exact column names from user's Google Sheet (as shown in screenshot)
  "BuildingNameEn": "building_name",      // Column A
  "ProcedureValue": "procedure_value",    // Column B
  "Size": "size",                         // Column C
  "UnitNumber": "unit_number",            // Column D
  "PropertyTypeEn": "type",               // Column E
  "ProcedurePartyTypeName": "party_type", // Column F (Buyer/Seller)
  "NameEn": "owner_name",                 // Column G (Owner name)
  "Mobile": "owner_mobile",               // Column H
  "CountryNameEn": "country",             // Country column
  "IdNumber": "id_number",
  "UaeIdNumber": "uae_id_number",
  "PassportExpiryDate": "passport_expiry_date",
  "BirthDate": "birth_date",
  "UnifiedNumber": "unified_number",
  "Status": "status",
  "Matches": "matches",
  // Alternative names (fallbacks for compatibility)
  "BuildingName": "building_name",
  "PropertyType": "type",
  "Name": "owner_name",
  "CountryName": "country",
  "Country": "country",
  "Buyer / Seller": "party_type",
  "Owner": "owner_name",
};

// Reverse mappings for CRM to Sheets (push operations)
const PROPERTY_REVERSE_MAPPINGS: Record<string, string> = Object.fromEntries(
  Object.entries(PROPERTY_COLUMN_MAPPINGS).map(([k, v]) => [v, k])
);

// Function to fetch Excel file from Google Drive and parse it
async function fetchExcelFromDrive(fileId: string, apiKey: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  console.log("Attempting to fetch Excel file from Google Drive:", fileId);
  
  // Try to export as xlsx using Google Drive API
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&key=${apiKey}`;
  
  let response = await fetch(exportUrl);
  
  // If export fails, try direct download (for actual Excel files)
  if (!response.ok) {
    console.log("Export failed, trying direct download...");
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    response = await fetch(downloadUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Drive download error:", errorText);
      throw new Error("Could not download file from Google Drive. Make sure the file is shared publicly.");
    }
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  console.log("File downloaded, size:", data.length, "bytes");
  
  // Parse the Excel file using SheetJS
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: ""
  }) as unknown[][];
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = (jsonData[0] || []).map(h => String(h || "").trim());
  console.log("Excel headers found:", headers);
  
  const rows = jsonData.slice(1).map(row => {
    const obj: Record<string, string> = {};
    const rowArray = row as unknown[];
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = String(rowArray[index] ?? "");
      }
    });
    return obj;
  });
  
  return { headers, rows };
}

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

      // First try Google Sheets API (for native sheets)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${dataSource.sheet_id}/values/A1:Z1000?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Sheets API response:", errorText);
        
        // Check if it's an Excel file - try to parse it directly
        if (errorText.includes("FAILED_PRECONDITION") || errorText.includes("not supported")) {
          console.log("Detected Excel file, attempting to parse with SheetJS...");
          
          try {
            const result = await fetchExcelFromDrive(dataSource.sheet_id, GOOGLE_SHEETS_API_KEY);
            headers = result.headers;
            rows = result.rows;
            console.log(`Successfully parsed Excel file: ${rows.length} rows`);
          } catch (excelError) {
            console.error("Excel parsing failed:", excelError);
            throw new Error("Could not parse the file. If it's an Excel file on Google Drive, make sure it's shared as 'Anyone with the link can view'.");
          }
        } else if (errorText.includes("NOT_FOUND") || errorText.includes("PERMISSION_DENIED")) {
          throw new Error("Sheet not accessible. Make sure it's shared publicly.");
        } else {
          throw new Error("Failed to fetch sheet data: " + errorText);
        }
      } else {
        // Native Google Sheets - parse normally
        const data = await response.json();
        const values = data.values || [];

        if (values.length > 0) {
          headers = values[0] as string[];
          console.log("Sheet headers found:", headers);
          
          rows = values.slice(1).map((row: string[]) => {
            const obj: Record<string, string> = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || "";
            });
            return obj;
          });
        }
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

    console.log("Using column mappings:", columnMappings);
    console.log("Total rows to process:", rows.length);

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
              "apartment": "apartment",
              "Flat": "apartment",
              "flat": "apartment",
              "Unit": "apartment",
              "unit": "apartment",
              "Villa": "villa",
              "villa": "villa",
              "Townhouse": "townhouse",
              "townhouse": "townhouse",
              "Penthouse": "penthouse",
              "penthouse": "penthouse",
              "Studio": "studio",
              "studio": "studio",
              "Commercial": "commercial",
              "commercial": "commercial",
              "Land": "land",
              "land": "land",
            };
            value = typeMap[String(value)] || "apartment";
          } else if (crmField === "status" && tableName === "properties") {
            // Map status from sheet to enum value
            const statusMap: Record<string, string> = {
              "Active": "available",
              "active": "available",
              "Available": "available",
              "available": "available",
              "Sold": "sold",
              "sold": "sold",
              "Rented": "rented",
              "rented": "rented",
              "Under Offer": "under_offer",
              "under_offer": "under_offer",
              "Off-Market": "sold",
              "Archived": "sold",
              "archived": "sold",
            };
            value = statusMap[String(value)] || "available";
          } else if (["passport_expiry_date", "birth_date"].includes(crmField)) {
            // Parse date fields
            if (value) {
              try {
                const dateVal = new Date(String(value));
                if (!isNaN(dateVal.getTime())) {
                  value = dateVal.toISOString().split('T')[0];
                } else {
                  value = null;
                }
              } catch {
                value = null;
              }
            }
          } else if (["locations", "property_types", "features", "tags"].includes(crmField)) {
            value = String(value).split(",").map(s => s.trim()).filter(Boolean);
          }
          
          mappedRow[crmField] = value;
        }
      }

      // Skip empty rows
      if (Object.keys(mappedRow).length === 0) {
        continue;
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
          mappedRow.title = `Property Row ${rowIndex + 1}`;
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

      console.log(`Processing row ${rowIndex}:`, JSON.stringify(mappedRow));

      try {
        // Check if record exists
        const { data: existing } = await supabase
          .from(tableName)
          .select("*")
          .eq("google_sheet_row_id", sheetRowId)
          .single();

        if (existing) {
          // Field-level conflict detection
          const fieldDiffs: string[] = [];
          for (const [field, newValue] of Object.entries(mappedRow)) {
            if (field === "google_sheet_row_id" || field === "matches") continue;
            const existingValue = existing[field];
            
            // Compare values (handle null/undefined properly)
            const existingStr = existingValue === null || existingValue === undefined ? "" : String(existingValue);
            const newStr = newValue === null || newValue === undefined ? "" : String(newValue);
            
            if (existingStr !== newStr && newStr !== "") {
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
            // No conflicts, update record with field-level update only
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
    const syncStatus = errorCount === 0 && conflicts.length === 0 
      ? "success" 
      : conflicts.length > 0 
        ? "conflicts" 
        : "error";
        
    await supabase
      .from("data_sources")
      .update({
        sync_status: syncStatus,
        sync_error: errorCount > 0 
          ? `${errorCount} rows failed to import` 
          : conflicts.length > 0 
            ? `${conflicts.length} conflicts detected` 
            : null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    // Log sync activity
    await supabase.from("sync_logs").insert({
      table_name: tableName,
      operation: "sync",
      source: "google_sheets",
      status: errorCount === 0 ? "success" : "partial",
      new_data: { 
        inserted: insertedCount, 
        updated: updatedCount, 
        errors: errorCount, 
        conflicts: conflicts.length,
        headers_found: headers,
      },
    });

    console.log(`Sync complete: ${insertedCount} inserted, ${updatedCount} updated, ${errorCount} errors, ${conflicts.length} conflicts`);

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
