import { 
  Building, TrendingUp, AlertTriangle, CheckCircle, 
  Home, BarChart3, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { PlotFeasibility } from '@/hooks/usePlots';

interface PlotFeasibilityCardProps {
  feasibility: PlotFeasibility;
}

export function PlotFeasibilityCard({ feasibility }: PlotFeasibilityCardProps) {
  const marketComparison = feasibility.market_comparison as {
    avg_price_sqft?: number;
    similar_plots?: number;
    demand_level?: string;
  } | null;

  const demandColor = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
  };

  // Parse ROI range to get a percentage for progress bar
  const roiMatch = feasibility.roi_range?.match(/(\d+)/);
  const roiValue = roiMatch ? parseInt(roiMatch[1]) : 0;

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          AI Feasibility Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Generated {new Date(feasibility.created_at).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Est. Units</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {feasibility.estimated_units || 'N/A'}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">ROI Range</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {feasibility.roi_range || 'N/A'}
            </p>
          </div>
        </div>

        {/* ROI Progress */}
        {roiValue > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ROI Potential</span>
              <span className="font-medium">{roiValue}%</span>
            </div>
            <Progress value={Math.min(roiValue * 5, 100)} className="h-2" />
          </div>
        )}

        {/* Build Potential */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Build Potential</span>
          </div>
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
            {feasibility.build_potential || 'No analysis available'}
          </p>
        </div>

        {/* Market Comparison */}
        {marketComparison && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Avg Price/sqft</p>
              <p className="font-medium text-foreground">
                AED {marketComparison.avg_price_sqft?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Similar Plots</p>
              <p className="font-medium text-foreground">
                {marketComparison.similar_plots || 'N/A'}
              </p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Demand</p>
              <Badge 
                className={cn(
                  'text-xs',
                  demandColor[marketComparison.demand_level as keyof typeof demandColor] || demandColor.medium
                )}
              >
                {marketComparison.demand_level || 'N/A'}
              </Badge>
            </div>
          </div>
        )}

        {/* Risk Notes */}
        {feasibility.risk_notes && feasibility.risk_notes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-foreground">Risk Factors</span>
            </div>
            <ul className="space-y-1">
              {feasibility.risk_notes.map((note, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-green-600" />
            <span className="font-medium text-foreground">Recommendation</span>
          </div>
          <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200">
              {feasibility.recommendation || 'No recommendation available'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
