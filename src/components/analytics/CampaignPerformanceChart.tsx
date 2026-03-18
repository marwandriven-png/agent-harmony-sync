import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Campaign } from '@/hooks/useCampaigns';

interface Props {
  campaigns: Campaign[];
}

export function CampaignPerformanceChart({ campaigns }: Props) {
  const data = useMemo(() => {
    return campaigns.slice(0, 10).map((c) => ({
      name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
      Sent: c.sent_count,
      Delivered: c.delivered_count,
      Read: c.read_count,
      Replied: c.replied_count,
      Failed: c.failed_count,
    }));
  }, [campaigns]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Campaign Performance</h3>
        </div>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No campaigns yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Legend />
              <Bar dataKey="Sent" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Delivered" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Read" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Replied" fill="hsl(142, 70%, 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
