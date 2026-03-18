import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Share2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

interface Props {
  messages: Message[];
}

const CHANNEL_COLORS: Record<string, string> = {
  email: 'hsl(220, 70%, 50%)',
  whatsapp: 'hsl(142, 70%, 40%)',
  linkedin: 'hsl(200, 70%, 55%)',
};

export function ChannelComparisonChart({ messages }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, { total: number; delivered: number; read: number; replied: number }> = {};
    messages.forEach((m) => {
      const ch = m.channel || 'email';
      if (!counts[ch]) counts[ch] = { total: 0, delivered: 0, read: 0, replied: 0 };
      counts[ch].total++;
      if (m.delivered_at) counts[ch].delivered++;
      if (m.read_at) counts[ch].read++;
      if (m.replied_at) counts[ch].replied++;
    });
    return Object.entries(counts).map(([channel, stats]) => ({
      name: channel.charAt(0).toUpperCase() + channel.slice(1),
      value: stats.total,
      delivered: stats.delivered,
      read: stats.read,
      replied: stats.replied,
      color: CHANNEL_COLORS[channel] || 'hsl(var(--muted-foreground))',
    }));
  }, [messages]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Channel Comparison</h3>
        </div>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No messages sent yet</p>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={280}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={4}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {data.map((ch) => (
                <div key={ch.name} className="p-3 rounded-lg border border-border">
                  <p className="font-semibold text-foreground text-sm">{ch.name}</p>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                    <div><p className="font-bold text-foreground text-lg">{ch.value}</p>Sent</div>
                    <div><p className="font-bold text-foreground text-lg">{ch.delivered}</p>Delivered</div>
                    <div><p className="font-bold text-foreground text-lg">{ch.read}</p>Read</div>
                    <div><p className="font-bold text-foreground text-lg">{ch.replied}</p>Replied</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
