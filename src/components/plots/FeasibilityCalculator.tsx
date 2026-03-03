import { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Building2, Edit3, Check } from 'lucide-react';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { Input } from '@/components/ui/input';
import { calcDSCFeasibility, DSCPlotInput, MIX_TEMPLATES, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { matchCLFFArea, findAnchorArea, getCLFFOverrides, getCLFFOverridesWithMasterData } from '@/lib/clffAreaDefaults';
import { resolvePlotAreaCode } from '@/lib/areaResearch';
import { getAreaData } from '@/data/crossAreaMasterData';

export interface FeasibilityParams {
    constructionPsf: number;
    landCostPsf: number;
    landCost?: number;
    authorityFeePct: number;
    consultantFeePct: number;
    buaMultiplier: number;
    efficiency: number;
    contingencyPct: number;
    financePct: number;
    avgPsfOverride?: number;
}

export const DEFAULT_FEASIBILITY_PARAMS: FeasibilityParams = {
    constructionPsf: 420,
    landCostPsf: 148,
    authorityFeePct: 4,
    consultantFeePct: 3,
    buaMultiplier: 1.45,
    efficiency: 0.95,
    contingencyPct: 5,
    financePct: 3,
};

interface FeasibilityCalculatorProps {
    plot: PlotData;
    sharedParams?: FeasibilityParams;
    onParamsChange?: (params: FeasibilityParams) => void;
}

function toDSCInput(plot: PlotData, plan: AffectionPlanData | null): DSCPlotInput {
    const areaSqft = plot.area * 10.764;
    const gfaSqft = plot.gfa * 10.764;
    const ratio = areaSqft > 0 ? gfaSqft / areaSqft : 4.5;
    return {
        id: plot.id,
        name: plot.project || plot.location || plot.id,
        area: areaSqft,
        ratio,
        height: plan?.maxHeight || (plot.maxHeight ? `${plot.maxHeight}m` : plot.floors),
        zone: plan?.mainLanduse || plot.zoning,
        constraints: plan?.generalNotes || '',
    };
}

function resolveAreaMarketOverrides(plot: PlotData): Record<string, unknown> {
    const location = plot.location || plot.project || '';
    const clffMatch = matchCLFFArea(location);
    const anchor = !clffMatch ? findAnchorArea(location) : null;
    const effectiveMatch = clffMatch || anchor;

    if (effectiveMatch) {
        const masterArea = getAreaData(effectiveMatch.area.code);
        if (masterArea) {
            return getCLFFOverridesWithMasterData(
                effectiveMatch.area.code,
                masterArea.salesByUnit as any,
                masterArea.rentalByUnit as any
            );
        }
        return getCLFFOverrides(effectiveMatch.area.code);
    }

    return {};
}

export function FeasibilityCalculator({ plot, sharedParams, onParamsChange }: FeasibilityCalculatorProps) {
    const [params, setParams] = useState<FeasibilityParams>(sharedParams || DEFAULT_FEASIBILITY_PARAMS);
    const [editing, setEditing] = useState(false);
    const [plan, setPlan] = useState<AffectionPlanData | null>(null);

    useEffect(() => {
        if (sharedParams) setParams(sharedParams);
    }, [sharedParams]);

    useEffect(() => {
        setEditing(false);
        gisService.fetchAffectionPlan(plot.id).then(setPlan).catch(() => { });
    }, [plot.id]);

    const dscInput = useMemo(() => toDSCInput(plot, plan), [plot, plan]);
    const areaMarketOverrides = useMemo(() => resolveAreaMarketOverrides(plot), [plot]);

    const fs = useMemo(() => calcDSCFeasibility(dscInput, 'balanced', {
        ...params,
        contingencyPct: params.contingencyPct / 100,
        financePct: params.financePct / 100,
        ...areaMarketOverrides,
        landCost: params.landCost,
        landCostPsf: params.landCostPsf,
    }), [dscInput, params, areaMarketOverrides]);

    const updateParam = (key: keyof FeasibilityParams, value: string) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
            const updated = { ...params, [key]: num };
            setParams(updated);
            onParamsChange?.(updated);
        }
    };

    return (
        <div className="border-t border-border/50 pt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Feasibility Study</h3>
                </div>
                <button
                    onClick={() => setEditing(!editing)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                    {editing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                    {editing ? 'Done' : 'Edit Params'}
                </button>
            </div>

            {editing && (
                <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div>
                        <label className="text-xs text-muted-foreground">Construction (PSF)</label>
                        <Input type="number" value={params.constructionPsf} onChange={(e) => updateParam('constructionPsf', e.target.value)} className="h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Land Cost (PSF)</label>
                        <Input type="number" value={params.landCostPsf || ''}
                            onChange={(e) => {
                                const psf = parseFloat(e.target.value);
                                if (!isNaN(psf)) {
                                    const total = Math.round(psf * fs.gfa);
                                    const updated = { ...params, landCostPsf: psf, landCost: total };
                                    setParams(updated);
                                    onParamsChange?.(updated);
                                }
                            }}
                            className="h-8 text-sm mt-0.5"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Authority Fees (%)</label>
                        <Input type="number" value={params.authorityFeePct} onChange={(e) => updateParam('authorityFeePct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Consultant Fees (%)</label>
                        <Input type="number" value={params.consultantFeePct} onChange={(e) => updateParam('consultantFeePct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">BUA Multiplier (×)</label>
                        <Input type="number" value={params.buaMultiplier} onChange={(e) => updateParam('buaMultiplier', e.target.value)} className="h-8 text-sm mt-0.5" step="0.05" min="1" max="2" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Floor Plate Eff. (%)</label>
                        <Input type="number" value={Math.round(params.efficiency * 100)} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) { const updated = { ...params, efficiency: v / 100 }; setParams(updated); onParamsChange?.(updated); } }} className="h-8 text-sm mt-0.5" />
                    </div>
                </div>
            )}

            <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Selling PSF</span>
                    <span className="text-foreground font-medium">AED {fmt(Math.round(fs.avgPsf))}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">GDV</span>
                    <span className="text-foreground">{fmtA(fs.grossSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="text-foreground font-medium">{fmtA(fs.totalCost)}</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="data-card py-2 text-center bg-muted/20 border border-border/50 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase">Revenue</div>
                    <div className="text-xs font-bold">{fmtM(fs.grossSales)}</div>
                </div>
                <div className="data-card py-2 text-center bg-muted/20 border border-border/50 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase">Profit</div>
                    <div className={`text-xs font-bold ${fs.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmtM(fs.grossProfit)}</div>
                </div>
                <div className="data-card py-2 text-center bg-muted/20 border border-border/50 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase">ROI</div>
                    <div className={`text-xs font-bold ${fs.roi >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{pct(fs.roi)}</div>
                </div>
            </div>
        </div>
    );
}
