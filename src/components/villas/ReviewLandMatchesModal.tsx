import { useState, useMemo } from 'react';
import { X, Maximize2, Send, FileDown, XCircle, MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { GISSearchResult } from '@/hooks/useVillaGISSearch';
import { normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { toast } from '@/hooks/use-toast';

interface ReviewLandMatchesModalProps {
  open: boolean;
  onClose: () => void;
  gisResults: GISSearchResult[];
}

import { SQM_TO_SQFT } from '@/lib/units';

export function ReviewLandMatchesModal({ open, onClose, gisResults }: ReviewLandMatchesModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(gisResults.map(r => r.plot.id)));
  const [campaign, setCampaign] = useState('default');

  const uniquePlots = useMemo(() => {
    const map = new Map<string, GISSearchResult>();
    gisResults.forEach(r => {
      const existing = map.get(r.plot.id);
      if (!existing || r.confidenceScore > existing.confidenceScore) map.set(r.plot.id, r);
    });
    return Array.from(map.values()).sort((a, b) => b.confidenceScore - a.confidenceScore);
  }, [gisResults]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === uniquePlots.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(uniquePlots.map(r => r.plot.id)));
  };

  const selectedCount = selectedIds.size;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[hsl(220,25%,6%)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#BFFF00]/10">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Review Land Matches</h1>
          <p className="text-[12px] text-gray-500">
            {uniquePlots.length} lands · {selectedCount} selected · <span className="text-[#BFFF00]">Sheet linked</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#BFFF00]/10">
        <Select value={campaign} onValueChange={setCampaign}>
          <SelectTrigger className="w-[180px] h-9 text-xs bg-[hsl(220,22%,12%)] border-gray-700 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(220,22%,12%)] border-gray-700 text-gray-300">
            <SelectItem value="default">Default Campaign</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 px-4 text-xs font-semibold bg-[#BFFF00] hover:bg-[#A8E600] text-black gap-1.5 shadow-[0_0_25px_rgba(191,255,0,0.6)] border border-[#BFFF00]/30"
            onClick={() => toast({ title: 'Outreach queued', description: `${selectedCount} plots selected for outreach` })}>
            <Send className="h-3.5 w-3.5" />
            Send for Outreach ({selectedCount})
          </Button>
          <Button size="sm" className="h-9 px-4 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-100 gap-1.5"
            onClick={() => toast({ title: 'Export started', description: `${selectedCount} plots exporting to CRM` })}>
            <FileDown className="h-3.5 w-3.5" />
            Export to CRM ({selectedCount})
          </Button>
          <Button size="sm" variant="outline" className="h-9 px-4 text-xs font-semibold border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5"
            onClick={() => { setSelectedIds(new Set()); toast({ title: 'Rejected', description: 'All selections cleared' }); }}>
            <XCircle className="h-3.5 w-3.5" />
            Reject Selected
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow className="border-[#BFFF00]/10 hover:bg-transparent">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === uniquePlots.length}
                  onCheckedChange={toggleAll}
                  className="border-[#BFFF00] data-[state=checked]:bg-[#BFFF00] data-[state=checked]:border-[#BFFF00] data-[state=checked]:shadow-[0_0_8px_rgba(191,255,0,0.5)]"
                />
              </TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Land Number</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Owner</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Location</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold text-right">Area (sqft)</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold text-right">GFA (sqft)</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Zoning</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Status</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">Contact</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold text-center">Match %</TableHead>
              <TableHead className="text-[11px] text-gray-600 font-semibold">CRM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniquePlots.map(({ plot, confidenceScore }) => {
              const isSelected = selectedIds.has(plot.id);
              const areaSqft = plot.area ? Math.round(plot.area * SQM_TO_SQFT) : 0;
              const gfaSqft = plot.gfa ? Math.round(plot.gfa * SQM_TO_SQFT) : 0;
              const zoning = plot.zoning || plot.landUseDetails || '—';
              const location = plot.location || '—';
              const ownerName = (plot as any).ownerName || '—';

              return (
                <TableRow key={plot.id}
                  className={cn(
                    'border-gray-900 transition-colors',
                    isSelected ? 'bg-[#BFFF00]/5' : 'hover:bg-gray-900/50'
                  )}>
                  <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(plot.id)}
                        className="border-[#BFFF00]/50 data-[state=checked]:bg-[#BFFF00] data-[state=checked]:border-[#BFFF00] data-[state=checked]:shadow-[0_0_12px_rgba(191,255,0,0.6)]"
                      />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-[#BFFF00] shrink-0 drop-shadow-[0_0_8px_#BFFF00]" />}
                      <span className="text-[13px] font-bold text-gray-100 tabular-nums">{plot.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-gray-100">{ownerName}</span>
                      <Badge className="text-[8px] h-4 px-1.5 bg-[#BFFF00]/10 text-[#BFFF00] border-[#BFFF00]/30 shadow-[0_0_8px_rgba(191,255,0,0.25)]">Sheet</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-gray-400">{location}</TableCell>
                  <TableCell className="text-[12px] text-gray-200 tabular-nums text-right">{areaSqft.toLocaleString()}</TableCell>
                  <TableCell className="text-[12px] text-gray-200 tabular-nums text-right">{gfaSqft.toLocaleString()}</TableCell>
                  <TableCell className="text-[12px] text-gray-200 uppercase">{zoning}</TableCell>
                  <TableCell className="text-[12px] text-gray-200">Available</TableCell>
                  <TableCell className="text-[12px] text-gray-500">—</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      'inline-block text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_12px_rgba(191,255,0,0.4)]',
                      confidenceScore >= 90
                        ? 'bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40'
                        : confidenceScore >= 70
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                          : 'bg-gray-800 text-gray-500 border border-gray-700'
                    )}>
                      {confidenceScore}%
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px] text-gray-600">—</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
