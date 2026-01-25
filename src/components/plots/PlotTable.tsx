import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit3, Trash2, FileText, Users, DollarSign, Brain, 
  ChevronDown, ChevronUp, MapPin, Building, Ruler, Layers, 
  Phone, Plus, ExternalLink, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Plot } from '@/hooks/usePlots';

interface PlotTableProps {
  plots: Plot[];
  onEdit: (plot: Plot) => void;
  onDelete: (plot: Plot) => void;
  onViewOffers: (plot: Plot) => void;
  onViewInterested: (plot: Plot) => void;
  onRunFeasibility: (plot: Plot) => void;
  isRunningFeasibility: boolean;
  runningPlotId: string | null;
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  under_negotiation: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-red-100 text-red-800',
  reserved: 'bg-blue-100 text-blue-800',
  pending: 'bg-orange-100 text-orange-800',
};

const zoningColors: Record<string, string> = {
  residential: 'bg-emerald-100 text-emerald-800',
  commercial: 'bg-purple-100 text-purple-800',
  mixed: 'bg-indigo-100 text-indigo-800',
  industrial: 'bg-gray-100 text-gray-800',
};

export function PlotTable({
  plots,
  onEdit,
  onDelete,
  onViewOffers,
  onViewInterested,
  onRunFeasibility,
  isRunningFeasibility,
  runningPlotId,
}: PlotTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (plotId: string) => {
    setExpandedId(expandedId === plotId ? null : plotId);
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A';
    if (price >= 1000000) return `AED ${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `AED ${(price / 1000).toFixed(0)}K`;
    return `AED ${price.toLocaleString()}`;
  };

  const formatSize = (size: number) => {
    return `${size.toLocaleString()} sqft`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Plot #</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Area</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden md:table-cell">Size</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden lg:table-cell">GFA</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden lg:table-cell">Floors</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden md:table-cell">Zoning</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Price</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((plot) => (
            <>
              <tr 
                key={plot.id}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => toggleExpand(plot.id)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {expandedId === plot.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-foreground">{plot.plot_number}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{plot.area_name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className="text-muted-foreground">{formatSize(plot.plot_size)}</span>
                </td>
                <td className="py-3 px-4 hidden lg:table-cell">
                  <span className="text-muted-foreground">
                    {plot.gfa ? formatSize(plot.gfa) : 'N/A'}
                  </span>
                </td>
                <td className="py-3 px-4 hidden lg:table-cell">
                  <span className="text-muted-foreground">
                    {plot.floors_allowed || 'N/A'}
                  </span>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  {plot.zoning && (
                    <Badge className={cn('text-xs', zoningColors[plot.zoning.toLowerCase()] || 'bg-gray-100 text-gray-800')}>
                      {plot.zoning}
                    </Badge>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="font-medium text-foreground">{formatPrice(plot.price)}</span>
                </td>
                <td className="py-3 px-4">
                  <Badge className={cn('text-xs', statusColors[plot.status] || 'bg-gray-100 text-gray-800')}>
                    {plot.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(plot)}
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onViewOffers(plot)}
                      title="View Offers"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onViewInterested(plot)}
                      title="Interested Buyers"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRunFeasibility(plot)}
                      disabled={isRunningFeasibility && runningPlotId === plot.id}
                      title="AI Feasibility"
                    >
                      {isRunningFeasibility && runningPlotId === plot.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(plot)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              <AnimatePresence>
                {expandedId === plot.id && (
                  <motion.tr
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <td colSpan={9} className="bg-muted/20 px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Plot Details */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-foreground">Plot Details</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Building className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Master Plan:</span>
                              <span className="text-foreground">{plot.master_plan || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Price/sqft:</span>
                              <span className="text-foreground">
                                {plot.price_per_sqft ? `AED ${plot.price_per_sqft.toLocaleString()}` : 'N/A'}
                              </span>
                            </div>
                            {plot.pdf_source_link && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <a 
                                  href={plot.pdf_source_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  View PDF <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Owner Info */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-foreground">Owner Info</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Name:</span>
                              <span className="text-foreground">{plot.owner_name || 'N/A'}</span>
                            </div>
                            {plot.owner_mobile && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`tel:${plot.owner_mobile}`} className="text-primary hover:underline">
                                  {plot.owner_mobile}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-foreground">Notes</h4>
                          <p className="text-sm text-muted-foreground">
                            {plot.notes || 'No notes added'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
