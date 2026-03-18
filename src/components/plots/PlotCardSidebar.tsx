import { useState } from 'react';
import { Search, Filter, ChevronDown, MapPin, Layers, Building, Pencil, Trash2, Plus, Wifi, DollarSign, TrendingUp, Target, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Plot } from '@/hooks/usePlots';
import { cn } from '@/lib/utils';

interface PlotCardSidebarProps {
  plots: Plot[];
  filteredPlots: Plot[];
  selectedPlotId: string | null;
  searchQuery: string;
  statusFilter: string;
  zoningFilter: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: (q: string) => void | Promise<void>;
  onStatusFilterChange: (v: string) => void;
  onZoningFilterChange: (v: string) => void;
  onSelectPlot: (plotId: string) => void;
  onEditPlot: (plot: Plot) => void;
  onDeletePlot: (plot: Plot) => void;
  onListPlot: (plot: Plot) => void;
  isLoading: boolean;
}

const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
  available: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  under_negotiation: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  sold: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  reserved: { dot: 'bg-sky-500', bg: 'bg-sky-500/10', text: 'text-sky-400' },
  pending: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
};

function formatPrice(price: number | null): string {
  if (!price) return '—';
  if (price >= 1e6) return `${(price / 1e6).toFixed(2)}M`;
  if (price >= 1e3) return `${(price / 1e3).toFixed(0)}K`;
  return price.toLocaleString();
}

function computeROI(plot: Plot): { value: string; positive: boolean } {
  if (!plot.price || !plot.gfa || !plot.plot_size) return { value: '—', positive: false };
  const estimatedRevenue = plot.gfa * (plot.price_per_sqft || 1500);
  const roi = ((estimatedRevenue - plot.price) / plot.price) * 100;
  if (!isFinite(roi)) return { value: '—', positive: false };
  return { value: `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`, positive: roi > 0 };
}

export function PlotCardSidebar({
  plots, filteredPlots, selectedPlotId, searchQuery, statusFilter, zoningFilter,
  onSearchChange, onSearchSubmit, onStatusFilterChange, onZoningFilterChange, onSelectPlot,
  onEditPlot, onDeletePlot, onListPlot, isLoading,
}: PlotCardSidebarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[hsl(220,25%,8%)] border-l border-[hsl(220,20%,14%)]">
      {/* Header */}
      <div className="p-3 border-b border-[hsl(220,20%,14%)]">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="text-[13px] font-bold text-white tracking-tight">Plot Inventory</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-[hsl(220,10%,50%)]">
                {filteredPlots.length} plots • Live GIS
              </span>
            </div>
          </div>
          <div className="h-7 min-w-[28px] rounded-md bg-[hsl(82,84%,45%,0.15)] text-[hsl(82,84%,55%)] flex items-center justify-center text-xs font-bold tabular-nums">
            {filteredPlots.length}
          </div>
        </div>

        {/* Search */}
        <div className="relative flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
            <Input
              placeholder="Search plot ID, area, owner..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onSearchSubmit?.(searchQuery);
                }
              }}
              className="pl-8 pr-7 h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,35%)] focus:border-[hsl(82,84%,45%,0.5)] focus:ring-[hsl(82,84%,45%,0.2)]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(220,10%,40%)] hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => void onSearchSubmit?.(searchQuery)}
            className="h-8 w-8 shrink-0 rounded-md bg-[hsl(82,84%,45%,0.15)] border border-[hsl(82,84%,45%,0.25)] flex items-center justify-center hover:bg-[hsl(82,84%,45%,0.25)] transition-colors"
            title="Search GIS/DDA"
          >
            <Target className="h-3.5 w-3.5 text-[hsl(82,84%,55%)]" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mt-2">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-7 text-[10px] bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-[hsl(220,10%,70%)] flex-1 px-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="under_negotiation">Negotiation</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zoningFilter} onValueChange={onZoningFilterChange}>
            <SelectTrigger className="h-7 text-[10px] bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-[hsl(220,10%,70%)] flex-1 px-2">
              <SelectValue placeholder="Zoning" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white">
              <SelectItem value="all">All Zoning</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="mixed">Mixed Use</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 mt-2 text-[10px] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
        >
          <Filter className="h-2.5 w-2.5" />
          Advanced Filters
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', showAdvanced && 'rotate-180')} />
        </button>

        {showAdvanced && (
          <div className="mt-1.5 p-2.5 rounded-md bg-[hsl(220,22%,12%)] border border-[hsl(220,20%,18%)] text-[10px] text-[hsl(220,10%,45%)]">
            Price range, size range, and owner filters coming soon.
          </div>
        )}
      </div>

      {/* Plot cards */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-lg bg-[hsl(220,22%,12%)] animate-pulse" />
            ))
          ) : filteredPlots.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-6 w-6 text-[hsl(220,10%,25%)] mx-auto mb-2" />
              <p className="text-[11px] text-[hsl(220,10%,45%)]">No plots match filters</p>
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="mt-2 text-[10px] text-[hsl(82,84%,55%)] hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredPlots.map(plot => {
              const isSelected = plot.id === selectedPlotId;
              const roi = computeROI(plot);
              const status = statusConfig[plot.status] || { dot: 'bg-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-400' };

              return (
                <button
                  key={plot.id}
                  onClick={() => onSelectPlot(plot.id)}
                  className={cn(
                    'w-full text-left rounded-lg p-2.5 transition-all duration-150 border group',
                    isSelected
                      ? 'bg-[hsl(220,25%,14%)] border-[hsl(82,84%,45%,0.3)] shadow-[0_0_16px_hsl(82,84%,45%,0.06)]'
                      : 'bg-[hsl(220,22%,10%)] border-[hsl(220,20%,14%)] hover:bg-[hsl(220,22%,12%)] hover:border-[hsl(220,20%,18%)]'
                  )}
                >
                  {/* Row 1: Plot ID + Status badge */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', status.dot)} />
                      <span className="font-bold text-white text-[12px] tabular-nums">{plot.plot_number}</span>
                    </div>
                    <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full capitalize', status.bg, status.text)}>
                      {plot.status === 'available' ? 'Available' : plot.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Row 2: Location */}
                  <div className="flex items-center gap-1 mb-1.5">
                    <MapPin className="h-2.5 w-2.5 text-[hsl(220,10%,40%)]" />
                    <span className="text-[10px] text-[hsl(220,10%,55%)] truncate">{plot.area_name}</span>
                    {plot.zoning && (
                      <span className="text-[9px] text-[hsl(220,10%,40%)] ml-auto capitalize">{plot.zoning}</span>
                    )}
                  </div>

                  {/* Row 3: Metrics grid */}
                  <div className="grid grid-cols-3 gap-1 mb-1.5">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Size</span>
                      <span className="text-[11px] text-[hsl(220,10%,70%)] font-medium tabular-nums">
                        {(plot.plot_size || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-[hsl(220,10%,40%)] uppercase tracking-wider">GFA</span>
                      <span className="text-[11px] text-[hsl(220,10%,70%)] font-medium tabular-nums">
                        {(plot.gfa || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Price</span>
                      <span className="text-[11px] text-white font-semibold tabular-nums">
                        {formatPrice(plot.price)}
                      </span>
                    </div>
                  </div>

                  {/* Row 4: ROI + Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-[hsl(220,20%,14%)]">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <TrendingUp className={cn('h-2.5 w-2.5', roi.positive ? 'text-emerald-400' : 'text-red-400')} />
                        <span className={cn('text-[10px] font-semibold tabular-nums', roi.positive ? 'text-emerald-400' : 'text-red-400')}>
                          {roi.value}
                        </span>
                      </div>
                      {plot.google_sheet_row_id ? (
                        <Badge className="text-[8px] h-4 px-1 bg-[hsl(82,84%,45%,0.1)] text-[hsl(82,84%,55%)] border-[hsl(82,84%,45%,0.2)] hover:bg-[hsl(82,84%,45%,0.15)]">
                          SYNC
                        </Badge>
                      ) : (
                        <Badge className="text-[8px] h-4 px-1 bg-[hsl(220,20%,16%)] text-[hsl(220,10%,45%)] border-[hsl(220,20%,20%)] hover:bg-[hsl(220,20%,20%)]">
                          MAN
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onEditPlot(plot)}
                        className="p-1 rounded hover:bg-[hsl(220,20%,18%)] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onDeletePlot(plot)}
                        className="p-1 rounded hover:bg-red-500/10 text-[hsl(220,10%,45%)] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onListPlot(plot)}
                        className="px-1.5 py-0.5 rounded bg-[hsl(82,84%,45%,0.1)] text-[hsl(82,84%,55%)] text-[9px] font-semibold hover:bg-[hsl(82,84%,45%,0.2)] transition-colors flex items-center gap-0.5"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        List
                      </button>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

    </div>
  );
}
