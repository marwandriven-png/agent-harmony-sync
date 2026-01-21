import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataSources, useApiIntegrations } from '@/hooks/useSetupWizard';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  Database,
  Key,
  Building2,
  Sparkles,
} from 'lucide-react';

export function ReviewStep() {
  const { dataSources } = useDataSources();
  const { integrations } = useApiIntegrations();

  const connectedIntegrations = integrations.filter(i => i.is_connected);
  const connectedSources = dataSources.filter(ds => ds.sync_status === 'success' || ds.sync_status === 'pending');

  const sections = [
    {
      title: 'Data Sources',
      icon: Database,
      items: dataSources.map(ds => ({
        name: ds.name,
        status: ds.sync_status === 'success' || ds.sync_status === 'pending',
        detail: `${ds.table_name} • ${ds.type}`,
      })),
      emptyMessage: 'No data sources connected',
    },
    {
      title: 'API Integrations',
      icon: Key,
      items: [
        { name: 'Google Calendar', status: integrations.some(i => i.type === 'google_calendar' && i.is_connected), detail: 'Task sync' },
        { name: 'Google Sheets', status: integrations.some(i => i.type === 'google_sheets' && i.is_connected), detail: 'Data sync' },
        { name: 'Google Drive', status: integrations.some(i => i.type === 'google_drive' && i.is_connected), detail: 'Attachments' },
        { name: 'WhatsApp', status: integrations.some(i => i.type === 'whatsapp' && i.is_connected), detail: 'Messaging' },
        { name: 'Lovable AI', status: true, detail: 'Pre-configured' },
      ],
    },
    {
      title: 'Property Sources',
      icon: Building2,
      items: dataSources
        .filter(ds => ds.table_name === 'properties')
        .map(ds => ({
          name: ds.name,
          status: true,
          detail: ds.type,
        })),
      emptyMessage: 'No property sources configured',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Setup Review
          </CardTitle>
          <CardDescription>
            Review your configuration before completing setup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;
            const hasItems = section.items.length > 0;

            return (
              <div key={section.title} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">{section.title}</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {section.items.filter(i => i.status).length} / {section.items.length}
                  </Badge>
                </div>

                {hasItems ? (
                  <div className="grid gap-2">
                    {section.items.map((item, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border',
                          item.status
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-border bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {item.status ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                        <Badge
                          variant={item.status ? 'default' : 'secondary'}
                          className={item.status ? 'bg-green-500' : ''}
                        >
                          {item.status ? 'Ready' : 'Not configured'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    {section.emptyMessage}
                  </p>
                )}
              </div>
            );
          })}

          {/* Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium mb-2">🎉 You're ready to go!</h4>
            <p className="text-sm text-muted-foreground">
              Your CRM is configured with {connectedSources.length} data source(s) 
              and {connectedIntegrations.length + 1} integration(s). 
              You can always add more later in Settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
