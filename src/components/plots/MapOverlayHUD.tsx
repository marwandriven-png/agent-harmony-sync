import { useMemo } from 'react';
import { TrendingUp, Layers, DollarSign, MapPin } from 'lucide-react';
import type { Plot } from '@/hooks/usePlots';
import { cn } from '@/lib/utils';

interface MapOverlayHUDProps {
  plots: Plot[];
  filteredCount: number;
  selectedPlotId: string | null;
}

const statusColors: Record<string, string> = {
  available: 'bg-emerald-500',
  under_negotiation: 'bg-amber-500',
  sold: 'bg-red-500',
  reserved: 'bg-sky-500',
  pending: 'bg-orange-500',
};

export function MapOverlayHUD({ plots, filteredCount, selectedPlotId }: MapOverlayHUDProps) {
  const stats = useMemo(() => {
    const totalArea = plots.reduce((sum, p) => sum + (p.plot_size || 0), 0);
    const totalValue = plots.reduce((sum, p) => sum + (p.price || 0), 0);
    const available = plots.filter(p => p.status === 'available').length;
    const avgPsf = plots.length > 0
      ? plots.reduce((sum, p) => sum + (p.price_per_sqft || 0), 0) / plots.length
      : 0;
    return { totalArea, totalValue, available, avgPsf };
  }, [plots]);

  const selectedPlot = selectedPlotId ? plots.find(p => p.id === selectedPlotId) : null;

  return (
    <>
      {/* Top-left: Live stats bar */}
      <div className="absolute top-3 left-3 z-[1000] flex gap-1.5">
        {[
          { icon: Layers, label: 'Total Area', value: `${(stats.totalArea / 1000).toFixed(0)}K sqft` },
          { icon: DollarSign, label: 'Portfolio', value: stats.totalValue > 1e6 ? `${(stats.totalValue / 1e6).toFixed(1)}M` : `${(stats.totalValue / 1e3).toFixed(0)}K` },
          { icon: TrendingUp, label: 'Avg PSF', value: `${stats.avgPsf.toFixed(0)} AED` },
          { icon: MapPin, label: 'Available', value: `${stats.available}/${plots.length}` },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(220,25%,8%,0.85)] backdrop-blur-md border border-[hsl(220,20%,20%,0.5)] text-white"
          >
            <Icon className="h-3 w-3 text-[hsl(82,84%,50%)] shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-[hsl(220,10%,55%)] uppercase tracking-wider">{label}</span>
              <span className="text-[11px] font-semibold tabular-nums">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom-left: Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3 px-3 py-2 rounded-lg bg-[hsl(220,25%,8%,0.85)] backdrop-blur-md border border-[hsl(220,20%,20%,0.5)]">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', color)} />
            <span className="text-[10px] text-[hsl(220,10%,65%)] capitalize">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Center-bottom: Selected plot info card (above legend bar) */}
      {selectedPlot && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[1000] w-72 rounded-xl bg-[hsl(220,25%,8%,0.92)] backdrop-blur-md border border-[hsl(200,100%,50%,0.25)] p-3.5 text-white shadow-[0_0_20px_hsl(200,100%,50%,0.12),0_0_40px_hsl(200,100%,50%,0.06)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-white">{selectedPlot.plot_number}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(200,100%,50%,0.1)] text-[hsl(200,100%,70%)] border border-[hsl(200,100%,50%,0.2)] capitalize font-medium">
              {selectedPlot.status.replace('_', ' ')}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[hsl(220,10%,50%)]">Area</span>
              <span className="font-semibold">{selectedPlot.area_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(220,10%,50%)]">Size</span>
              <span className="font-semibold tabular-nums">{(selectedPlot.plot_size || 0).toLocaleString()} sqft</span>
            </div>
            {selectedPlot.gfa && (
              <div className="flex justify-between">
                <span className="text-[hsl(220,10%,50%)]">GFA</span>
                <span className="font-semibold tabular-nums">{selectedPlot.gfa.toLocaleString()} sqft</span>
              </div>
            )}
            {selectedPlot.price && (
              <div className="flex justify-between">
                <span className="text-[hsl(220,10%,50%)]">Price</span>
                <span className="font-semibold tabular-nums text-[hsl(200,100%,70%)]">
                  AED {(selectedPlot.price / 1e6).toFixed(2)}M
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
