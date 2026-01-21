import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiIntegrations, ApiIntegration } from '@/hooks/useSetupWizard';
import { cn } from '@/lib/utils';
import {
  Key,
  Calendar,
  FileSpreadsheet,
  FolderOpen,
  MessageCircle,
  Brain,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const INTEGRATIONS: {
  type: ApiIntegration['type'];
  name: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync tasks and viewings to calendar',
    icon: Calendar,
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets',
    description: 'Bidirectional data sync',
    icon: FileSpreadsheet,
  },
  {
    type: 'google_drive',
    name: 'Google Drive',
    description: 'Attachments and documents',
    icon: FolderOpen,
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send messages to leads',
    icon: MessageCircle,
  },
  {
    type: 'openai',
    name: 'AI (Lovable AI)',
    description: 'Matching & content generation',
    icon: Brain,
  },
];

export function ApiKeysStep() {
  const { integrations, upsertIntegration, testConnection } = useApiIntegrations();
  const [testingType, setTestingType] = useState<string | null>(null);

  const getIntegrationStatus = (type: ApiIntegration['type']) => {
    const integration = integrations.find((i) => i.type === type);
    return integration?.is_connected ?? false;
  };

  const handleTestConnection = async (type: ApiIntegration['type']) => {
    setTestingType(type);
    try {
      await testConnection.mutateAsync(type);
      await upsertIntegration.mutateAsync({
        name: INTEGRATIONS.find(i => i.type === type)?.name ?? type,
        type,
        is_connected: true,
        config: {},
        last_tested_at: new Date().toISOString(),
      });
    } catch {
      await upsertIntegration.mutateAsync({
        name: INTEGRATIONS.find(i => i.type === type)?.name ?? type,
        type,
        is_connected: false,
        config: {},
        last_tested_at: new Date().toISOString(),
      });
    } finally {
      setTestingType(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Integrations
          </CardTitle>
          <CardDescription>
            Connect external services to enable advanced features. API keys are stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {INTEGRATIONS.map((integration) => {
              const Icon = integration.icon;
              const isConnected = getIntegrationStatus(integration.type);
              const isTesting = testingType === integration.type;
              const isAI = integration.type === 'openai';

              return (
                <div
                  key={integration.type}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    isConnected ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isConnected ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{integration.name}</p>
                        {isAI && (
                          <Badge variant="secondary" className="text-xs">
                            Pre-configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isConnected ? (
                      <Badge className="bg-green-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Not Connected
                      </Badge>
                    )}
                    
                    <Button
                      size="sm"
                      variant={isConnected ? 'outline' : 'default'}
                      onClick={() => handleTestConnection(integration.type)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-2">
                        {isConnected ? 'Retest' : 'Test'}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">💡 Note</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Lovable AI</strong> is pre-configured and ready to use</li>
              <li>• Google APIs require OAuth credentials added in project secrets</li>
              <li>• WhatsApp requires a Business API account</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
