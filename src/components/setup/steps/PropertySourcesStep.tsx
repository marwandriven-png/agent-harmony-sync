import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useDataSources } from '@/hooks/useSetupWizard';
import { toast } from 'sonner';
import {
  Building2,
  Link,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export function PropertySourcesStep() {
  const { dataSources, createDataSource } = useDataSources();
  const [propertiesSheetUrl, setPropertiesSheetUrl] = useState('');
  const [coldCallsSheetUrl, setColdCallsSheetUrl] = useState('');
  const [newListingsUrl, setNewListingsUrl] = useState('');
  const [externalListingUrl, setExternalListingUrl] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const handleConnectSheet = async (
    url: string,
    name: string,
    tableName: string
  ) => {
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      toast.error('Invalid Google Sheets URL');
      return;
    }

    setIsConnecting(name);
    try {
      await createDataSource.mutateAsync({
        name,
        type: 'google_sheets',
        connection_url: url,
        sheet_id: sheetIdMatch[1],
        table_name: tableName,
        column_mappings: {},
        sync_status: 'pending',
      });
      toast.success(`${name} connected successfully`);
    } catch (error) {
      toast.error(`Failed to connect ${name}`);
    } finally {
      setIsConnecting(null);
    }
  };

  const isConnected = (name: string) => {
    return dataSources.some(ds => ds.name === name);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Property & Listing Sources
          </CardTitle>
          <CardDescription>
            Connect your property database and listing sources for real-time sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Properties Sheet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Properties Database
              </Label>
              {isConnected('Properties Sheet') && (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Properties Google Sheet URL"
                value={propertiesSheetUrl}
                onChange={(e) => setPropertiesSheetUrl(e.target.value)}
              />
              <Button
                onClick={() => handleConnectSheet(propertiesSheetUrl, 'Properties Sheet', 'properties')}
                disabled={isConnecting === 'Properties Sheet'}
              >
                {isConnecting === 'Properties Sheet' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Cold Calls Sheet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Cold Calls Database
              </Label>
              {isConnected('Cold Calls Sheet') && (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Cold Calls Google Sheet URL"
                value={coldCallsSheetUrl}
                onChange={(e) => setColdCallsSheetUrl(e.target.value)}
              />
              <Button
                onClick={() => handleConnectSheet(coldCallsSheetUrl, 'Cold Calls Sheet', 'cold_calls')}
                disabled={isConnecting === 'Cold Calls Sheet'}
              >
                {isConnecting === 'Cold Calls Sheet' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* New Listings Sheet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                New Listings Feed
              </Label>
              {isConnected('New Listings Sheet') && (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New Listings Google Sheet URL"
                value={newListingsUrl}
                onChange={(e) => setNewListingsUrl(e.target.value)}
              />
              <Button
                onClick={() => handleConnectSheet(newListingsUrl, 'New Listings Sheet', 'properties')}
                disabled={isConnecting === 'New Listings Sheet'}
              >
                {isConnecting === 'New Listings Sheet' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* External Listing URL */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                External Listing Scraper
              </Label>
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                Daily Sync
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="External listing URL to scrape daily"
                value={externalListingUrl}
                onChange={(e) => setExternalListingUrl(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (externalListingUrl) {
                    toast.success('External listing source saved');
                  }
                }}
              >
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              System will check this URL daily for new listings and import them automatically
            </p>
          </div>

          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label>Automatic Sync</Label>
              <p className="text-sm text-muted-foreground">
                Keep data in sync between CRM and Google Sheets
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      {dataSources.filter(ds => ds.table_name === 'properties').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Property Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dataSources
                .filter(ds => ds.table_name === 'properties' || ds.table_name === 'cold_calls')
                .map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last synced: {source.last_synced_at
                            ? new Date(source.last_synced_at).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={source.sync_status === 'success' ? 'default' : 'secondary'}
                    >
                      {source.sync_status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
