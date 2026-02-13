import { useMemo } from 'react';
import { FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Target } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

interface Props {
  leads: Lead[];
}

const FUNNEL_COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(200, 70%, 55%)',
  'hsl(38, 92%, 50%)',
  'hsl(82, 84%, 45%)',
  'hsl(142, 70%, 40%)',
  'hsl(280, 60%, 50%)',
  'hsl(0, 60%, 50%)',
];

const STATUS_ORDER = ['new', 'contacted', 'viewing', 'viewed', 'negotiation', 'closed', 'lost'] as const;
const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  viewing: 'Viewing',
  viewed: 'Viewed',
  negotiation: 'Negotiation',
  closed: 'Closed',
  lost: 'Lost',
};

export function LeadConversionFunnel({ leads }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return STATUS_ORDER.map((s) => ({
      name: STATUS_LABELS[s],
      value: counts[s] || 0,
    })).filter((d) => d.value > 0);
  }, [leads]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Lead Conversion Funnel</h3>
        </div>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No leads data</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <FunnelChart>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Funnel dataKey="value" data={data} isAnimationActive>
                <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" fontSize={12} />
                <LabelList position="center" fill="#fff" stroke="none" fontSize={14} fontWeight={700} dataKey="value" />
                {data.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
