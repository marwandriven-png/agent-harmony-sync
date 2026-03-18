import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Layers, Building2, MapPin, ArrowUpRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { Plot } from '@/hooks/usePlots';
import type { AffectionPlanData } from '@/services/DDAGISService';
import { cn } from '@/lib/utils';

interface PlotDetailPanelProps {
  plot: Plot | null;
  onClose: () => void;
  onGoToLand?: (plot: Plot) => void;
}

const SQM_TO_SQFT = 10.7639;

export function PlotDetailPanel({ plot, onClose, onGoToLand }: PlotDetailPanelProps) {
  const [affectionPlan, setAffectionPlan] = useState<AffectionPlanData | null>(null);
  const [isLoadingAP, setIsLoadingAP] = useState(false);
  const [showSetbacks, setShowSetbacks] = useState(true);

  const plotNumber = plot?.plot_number || '';
  const isGisPlot = plot?.id?.startsWith('gis:');

  const fetchAffectionPlan = useCallback(async (plotNum: string) => {
    setIsLoadingAP(true);
    setAffectionPlan(null);
    try {
      const { gisService } = await import('@/services/DDAGISService');
      const ap = await gisService.fetchAffectionPlan(plotNum);
      setAffectionPlan(ap);
    } catch (err) {
      console.error('Failed to fetch affection plan:', err);
    } finally {
      setIsLoadingAP(false);
    }
  }, []);

  useEffect(() => {
    if (plotNumber) {
      fetchAffectionPlan(plotNumber);
    } else {
      setAffectionPlan(null);
    }
  }, [plotNumber, fetchAffectionPlan]);

  if (!plot) return null;

  const zoning = affectionPlan?.subLanduse || plot.zoning || '—';
  const floors = affectionPlan?.maxHeightFloors || (plot.floors_allowed ? `G+${plot.floors_allowed}` : '—');

  const formatDate = (ts: number | null) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(220,25%,7%)]">
      {/* Header with neon glow top bar */}
      <div className="p-4 border-b border-[hsl(200,100%,50%,0.12)]">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[11px] text-[hsl(200,100%,70%)] hover:text-[hsl(200,100%,85%)] transition-colors mb-3 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Inventory
        </button>

        {/* Hero card — Floors + Zoning */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-[hsl(220,22%,10%)] rounded-lg border border-[hsl(200,100%,50%,0.15)] p-3 text-center shadow-[0_0_15px_hsl(200,100%,50%,0.08)]">
            <span className="text-2xl font-bold text-white">{floors}</span>
          </div>
          <div className="flex-1 bg-[hsl(220,22%,10%)] rounded-lg border border-[hsl(200,100%,50%,0.15)] p-3 text-center shadow-[0_0_15px_hsl(200,100%,50%,0.08)]">
            <span className="text-sm font-semibold text-[hsl(200,100%,75%)]">{zoning}</span>
          </div>
        </div>

        {/* Developer / Project rows */}
        <div className="space-y-1.5">
          <InfoRow label="Developer" value={affectionPlan?.entityName || '—'} />
          <InfoRow label="Project" value={affectionPlan?.projectName || plot.master_plan || plot.area_name || '—'} />
          <InfoRow label="Plot" value={plotNumber} />
        </div>

        {onGoToLand && !isGisPlot && (
          <Button
            size="sm"
            className="mt-3 w-full h-7 text-[10px] gap-1 bg-[hsl(200,100%,50%,0.1)] border border-[hsl(200,100%,50%,0.25)] text-[hsl(200,100%,70%)] hover:bg-[hsl(200,100%,50%,0.2)] hover:text-white shadow-[0_0_8px_hsl(200,100%,50%,0.1)]"
            onClick={() => onGoToLand(plot)}
          >
            <ArrowUpRight className="h-3 w-3" /> Go to Land
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {isLoadingAP ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[hsl(200,100%,60%)]" />
              <span className="text-[11px] text-[hsl(220,10%,45%)]">Loading affection plan...</span>
            </div>
          ) : affectionPlan ? (
            <>
              {/* ─── Affection Plan Header ─── */}
              <SectionTitle icon="📋" title="Affection Plan" />

              {/* LAND USE */}
              <SectionBlock title="LAND USE">
                {affectionPlan.mainLanduse && <InfoRow label="Main" value={affectionPlan.mainLanduse} />}
                {affectionPlan.subLanduse && <InfoRow label="Sub" value={affectionPlan.subLanduse} />}
                {affectionPlan.landuseCategory && <InfoRow label="Category" value={affectionPlan.landuseCategory} />}
                {affectionPlan.landuseDetails && (
                  <div className="text-[10px] text-[hsl(200,100%,65%)] pt-1 mt-1 border-t border-[hsl(200,100%,50%,0.08)]">
                    {affectionPlan.landuseDetails}
                  </div>
                )}
              </SectionBlock>

              {/* HEIGHT & COVERAGE */}
              <SectionBlock title="HEIGHT & COVERAGE">
                <InfoRow label="Max Height" value={floors} />
                {affectionPlan.heightCategory && <InfoRow label="Height Category" value={String(affectionPlan.heightCategory)} />}
                {affectionPlan.gfaType && <InfoRow label="GFA Type" value={affectionPlan.gfaType} />}
                {affectionPlan.plotCoverage && <InfoRow label="Plot Coverage" value={affectionPlan.plotCoverage} />}
              </SectionBlock>

              {/* BUILDING SETBACKS */}
              <div>
                <button
                  onClick={() => setShowSetbacks(!showSetbacks)}
                  className="flex items-center justify-between w-full text-[10px] font-bold text-[hsl(200,100%,65%)] uppercase tracking-widest mb-2"
                >
                  <span>BUILDING SETBACKS</span>
                  {showSetbacks ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showSetbacks && (
                  <div className="bg-[hsl(220,22%,9%)] rounded-lg border border-[hsl(200,100%,50%,0.1)] p-3 space-y-1.5 shadow-[0_0_12px_hsl(200,100%,50%,0.04)]">
                    <InfoRow label="Side 1" value={affectionPlan.buildingSetbacks.side1 || '—'} />
                    <InfoRow label="Side 2" value={affectionPlan.buildingSetbacks.side2 || '—'} />
                    <InfoRow label="Side 3" value={affectionPlan.buildingSetbacks.side3 || '—'} />
                    <InfoRow label="Side 4" value={affectionPlan.buildingSetbacks.side4 || '—'} />
                  </div>
                )}
              </div>

              {/* PODIUM SETBACKS */}
              {affectionPlan.podiumSetbacks && (
                <SectionBlock title="PODIUM SETBACKS">
                  <InfoRow label="Side 1" value={affectionPlan.podiumSetbacks.side1 || 'N/A'} />
                  <InfoRow label="Side 2" value={affectionPlan.podiumSetbacks.side2 || 'N/A'} />
                  <InfoRow label="Side 3" value={affectionPlan.podiumSetbacks.side3 || 'N/A'} />
                  <InfoRow label="Side 4" value={affectionPlan.podiumSetbacks.side4 || 'N/A'} />
                </SectionBlock>
              )}

              {/* SITE PLAN */}
              <SectionBlock title="SITE PLAN">
                <InfoRow label="Issue Date" value={formatDate(affectionPlan.siteplanIssueDate)} />
                <InfoRow label="Expiry Date" value={formatDate(affectionPlan.siteplanExpiryDate)} />
                {affectionPlan.siteStatus && <InfoRow label="Status" value={affectionPlan.siteStatus} />}
                {affectionPlan.isFrozen && (
                  <InfoRow label="Frozen" value={affectionPlan.freezeReason || 'Yes'} highlight />
                )}
              </SectionBlock>

              {/* GENERAL NOTES */}
              {affectionPlan.generalNotes && (
                <SectionBlock title="NOTES">
                  <p className="text-[10px] text-[hsl(220,10%,65%)] leading-relaxed">{affectionPlan.generalNotes}</p>
                </SectionBlock>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-[11px] text-[hsl(220,10%,40%)]">No affection plan data available</p>
            </div>
          )}

          {/* Owner Info */}
          {(plot.owner_name || plot.owner_mobile) && (
            <SectionBlock title="OWNER">
              {plot.owner_name && <InfoRow label="Name" value={plot.owner_name} />}
              {plot.owner_mobile && <InfoRow label="Mobile" value={plot.owner_mobile} />}
            </SectionBlock>
          )}

          {/* Pricing */}
          {plot.price && (
            <SectionBlock title="PRICING">
              <InfoRow label="Price" value={`AED ${(plot.price / 1e6).toFixed(2)}M`} />
              {plot.price_per_sqft && <InfoRow label="PSF" value={`AED ${plot.price_per_sqft.toLocaleString()}`} />}
            </SectionBlock>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <span className="text-[12px] font-bold text-white tracking-tight">{title}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-[hsl(200,100%,50%,0.2)] to-transparent" />
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[hsl(200,100%,60%)] uppercase tracking-widest mb-2">{title}</div>
      <div className="bg-[hsl(220,22%,9%)] rounded-lg border border-[hsl(200,100%,50%,0.1)] p-3 space-y-1.5 shadow-[0_0_12px_hsl(200,100%,50%,0.04)]">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-[11px] text-[hsl(220,10%,50%)] shrink-0">{label}</span>
      <span className={cn(
        'text-[11px] font-semibold text-right truncate',
        highlight ? 'text-red-400' : 'text-white'
      )}>
        {value}
      </span>
    </div>
  );
}
