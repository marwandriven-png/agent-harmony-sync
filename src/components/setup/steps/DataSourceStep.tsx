import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDataSources, TableName, CRM_FIELDS } from '@/hooks/useSetupWizard';
import { ColumnMapper } from '../ColumnMapper';
import { FileUploadZone } from '../FileUploadZone';
import { DataPreview } from '../DataPreview';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  Upload,
  Link,
  Database,
  CheckCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
}

export function DataSourceStep() {
  const { dataSources, createDataSource, deleteDataSource, isLoading } = useDataSources();
  const [activeTab, setActiveTab] = useState<'sheets' | 'upload'>('sheets');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [selectedTable, setSelectedTable] = useState<TableName>('leads');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSheetsConnect = async () => {
    if (!sheetsUrl) {
      toast.error('Please enter a Google Sheets URL');
      return;
    }

    // Extract sheet ID from URL
    const sheetIdMatch = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      toast.error('Invalid Google Sheets URL');
      return;
    }

    setIsProcessing(true);
    try {
      // Fetch sheet data via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ sheetId: sheetIdMatch[1] }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Check for Excel file error
        if (data.error?.includes('Excel file') || data.error?.includes('not supported for this document')) {
          toast.error(
            'This appears to be an Excel file (.xlsx), not a native Google Sheet. Please open the file in Google Drive, click File → Save as Google Sheets, then share the new Google Sheets URL.',
            { duration: 10000 }
          );
          return;
        }
        throw new Error(data.error || 'Failed to fetch sheet data');
      }

      setParsedData({
        headers: data.headers,
        rows: data.rows.slice(0, 10), // Preview first 10 rows
      });
      toast.success('Sheet connected! Map columns below.');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('Excel') || errorMsg.includes('not supported')) {
        toast.error(
          'This appears to be an Excel file (.xlsx), not a native Google Sheet. Please open the file in Google Drive, click File → Save as Google Sheets, then share the new Google Sheets URL.',
          { duration: 10000 }
        );
      } else {
        toast.error('Failed to connect to Google Sheets. Check the URL and try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse file');
      }

      const data = await response.json();
      setParsedData({
        headers: data.headers,
        rows: data.rows.slice(0, 10),
      });
      toast.success('File parsed! Map columns below.');
    } catch (error) {
      toast.error('Failed to parse file. Please check the format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveMapping = async () => {
    // Validate required fields are mapped
    const requiredFields = CRM_FIELDS[selectedTable].filter(f => f.required);
    const missingFields = requiredFields.filter(f => !columnMappings[f.key]);

    if (missingFields.length > 0) {
      toast.error(`Please map required fields: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    // Extract sheet ID from URL if it's a Google Sheets source
    let sheetId: string | undefined;
    if (activeTab === 'sheets' && sheetsUrl) {
      const sheetIdMatch = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetIdMatch) {
        sheetId = sheetIdMatch[1];
      }
    }

    createDataSource.mutate({
      name: `${selectedTable.replace('_', ' ')} - ${activeTab === 'sheets' ? 'Google Sheets' : 'File Upload'}`,
      type: activeTab === 'sheets' ? 'google_sheets' : 'csv',
      connection_url: sheetsUrl || undefined,
      sheet_id: sheetId,
      table_name: selectedTable,
      column_mappings: columnMappings,
      sync_status: 'pending',
    }, {
      onSuccess: async (data) => {
        // Auto-trigger sync after saving
        if (data?.id) {
          await handleSync(data.id);
        }
        // Reset form
        setParsedData(null);
        setColumnMappings({});
        setSheetsUrl('');
      }
    });
  };

  const handleSync = async (sourceId: string) => {
    const source = dataSources.find(s => s.id === sourceId);
    
    // Check if column mappings are configured
    if (!source || Object.keys(source.column_mappings || {}).length === 0) {
      toast.error('No column mappings configured. Please delete and re-connect the data source with proper column mappings.');
      return;
    }
    
    toast.info('Syncing data...');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ sourceId }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }
      
      if (result.inserted > 0 || result.updated > 0) {
        toast.success(`Data synced! ${result.inserted || 0} records imported.`);
      } else if (result.rows === 0) {
        toast.warning('No data found in the sheet. Check if the sheet has data.');
      } else {
        toast.success('Sync completed!');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync data');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Connect Data Sources
          </CardTitle>
          <CardDescription>
            Import your leads, cold calls, and properties from Google Sheets or CSV files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Table Selection */}
          <div className="space-y-2">
            <Label>Import to</Label>
            <div className="flex gap-2">
              {(['leads', 'cold_calls', 'properties'] as TableName[]).map((table) => (
                <Button
                  key={table}
                  variant={selectedTable === table ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTable(table)}
                >
                  {table.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>

          {/* Source Type Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sheets' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sheets" className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Google Sheets
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sheets" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Paste Google Sheets URL..."
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                  />
                </div>
                <Button onClick={handleSheetsConnect} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  <span className="ml-2">Connect</span>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Make sure the sheet is shared publicly or with the service account
              </p>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <FileUploadZone onFileSelect={handleFileUpload} isProcessing={isProcessing} />
            </TabsContent>
          </Tabs>

          {/* Data Preview & Column Mapping */}
          {parsedData && (
            <div className="space-y-6 border-t pt-6">
              <DataPreview headers={parsedData.headers} rows={parsedData.rows} />
              
              <ColumnMapper
                sourceColumns={parsedData.headers}
                targetFields={[...CRM_FIELDS[selectedTable]]}
                mappings={columnMappings}
                onMappingChange={setColumnMappings}
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedData(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveMapping} disabled={createDataSource.isPending}>
                  {createDataSource.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Save & Sync
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Sources */}
      {dataSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dataSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {source.table_name} • {source.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={source.sync_status === 'success' ? 'default' : 'secondary'}
                      className={cn(
                        source.sync_status === 'success' && 'bg-status-closed text-white',
                        source.sync_status === 'error' && 'bg-destructive text-destructive-foreground'
                      )}
                    >
                      {source.sync_status}
                    </Badge>
                    {Object.keys(source.column_mappings || {}).length === 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">
                        No mappings
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(source.id)}
                    >
                      Sync
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{source.name}"? This will disconnect the sheet from the CRM but won't delete any imported data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDataSource.mutate(source.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
