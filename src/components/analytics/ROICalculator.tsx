import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

interface Props {
  leads: Lead[];
  campaigns: { sent_count: number; total_leads: number }[];
}

export function ROICalculator({ leads, campaigns }: Props) {
  const [avgDealValue, setAvgDealValue] = useState(250000);
  const [costPerLead, setCostPerLead] = useState(50);
  const [campaignCost, setCampaignCost] = useState(500);

  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const closedDeals = leads.filter((l) => l.status === 'closed').length;
    const conversionRate = totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;
    const totalRevenue = closedDeals * avgDealValue;
    const totalCost = totalLeads * costPerLead + campaigns.length * campaignCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    const costPerAcquisition = closedDeals > 0 ? totalCost / closedDeals : 0;

    return { totalLeads, closedDeals, conversionRate, totalRevenue, totalCost, roi, costPerAcquisition };
  }, [leads, campaigns, avgDealValue, costPerLead, campaignCost]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">ROI Calculator</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <Label className="text-xs">Avg Deal Value (AED)</Label>
            <Input type="number" value={avgDealValue} onChange={(e) => setAvgDealValue(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cost per Lead (AED)</Label>
            <Input type="number" value={costPerLead} onChange={(e) => setCostPerLead(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Campaign Cost (AED)</Label>
            <Input type="number" value={campaignCost} onChange={(e) => setCampaignCost(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Est. Revenue</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className={`text-xl font-bold ${stats.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.roi.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">ROI</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-xl font-bold text-foreground">{formatCurrency(stats.costPerAcquisition)}</p>
            <p className="text-xs text-muted-foreground">Cost/Acquisition</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
