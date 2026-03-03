import { useState, useMemo, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3, Target, Shield, Printer, Maximize2, Minimize2, Settings2, GitCompareArrows, X, Lightbulb, StickyNote, ChevronRight, Share2, FileWarning } from 'lucide-react';
import { DCShareModal } from './DCShareModal';
import { Checkbox } from '@/components/ui/checkbox';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { FeasibilityParams, DEFAULT_FEASIBILITY_PARAMS } from './FeasibilityCalculator';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, UNIT_SIZES, RENT_PSF_YR, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { matchCLFFArea, findAnchorArea, normalizeAreaCode, CLFF_AREAS, CLFF_MARKET_DATA, getCLFFOverrides, getCLFFOverridesWithMasterData, type CLFFAreaProfile, type CLFFMarketData } from '@/lib/clffAreaDefaults';
import { getAreaScopedMarketData, resolvePlotAreaCode, matchesAreaCode, extractAreaCodes } from '@/lib/areaResearch';
import { findReportForLocation, AreaReport } from '@/data/areaReports';
import { getAreaData, getCompetitorsAsComparables, getAreaSalesData, getAreaRentalData, generateAreaInsights, evaluateTemplateViability, type AreaMarketData } from '@/data/crossAreaMasterData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisSummary } from './AnalysisSummary';
import { useDBComparables, useDBMarketSnapshot } from '@/hooks/useMarketDataFromDB';

interface DecisionConfidenceProps {
    plot: PlotData;
    comparisonPlots?: PlotData[];
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    onExitComparison?: () => void;
    sharedFeasibilityParams?: FeasibilityParams;
    onFeasibilityParamsChange?: (params: FeasibilityParams) => void;
}

// Convert PlotData + AffectionPlan into DSCPlotInput (sqft)
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
        constraints: plan?.generalNotes || (plan?.maxPlotCoverage ? `Max coverage ${plan.maxPlotCoverage}%` : 'Standard guidelines'),
    };
}

// KPI Card
function KpiCard({ label, value, sub, accent, positive, negative }: {
    label: string; value: string; sub?: string; accent?: boolean; positive?: boolean; negative?: boolean;
}) {
    const colorClass = negative ? 'text-destructive' : positive ? 'text-success' : accent ? 'text-primary' : 'text-foreground';
    return (
        <div className={`data-card min-w-[130px] flex-1 ${accent ? 'border-primary/40' : ''}`}>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-xl font-bold font-mono ${colorClass}`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

// Section wrapper
function Section({ num, title, badge, children }: { num?: number; title: string; badge?: string; children: React.ReactNode }) {
    return (
        <div className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
                {num != null && (
                    <span className="w-8 h-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground font-extrabold text-xs shrink-0">{num}</span>
                )}
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
                {badge && <Badge variant="outline" className="text-xs border-primary/40 text-primary ml-auto">{badge}</Badge>}
            </div>
            {children}
        </div>
    );
}

// Progress bar component
function ProgressBar({ label, value, suffix, percent }: { label: string; value: string; suffix?: string; percent: number }) {
    return (
        <div className="mb-3">
            <div className="flex justify-between mb-1.5 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}{suffix ? ` ${suffix}` : ''}</span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(percent, 100)}%` }} />
            </div>
        </div>
    );
}


// Viability indicator
function Viability({ pass, label }: { pass: boolean; label: string }) {
    return (
        <span className={`text-xs font-bold ${pass ? 'text-emerald-600' : 'text-destructive'}`}>
            {pass ? '✓' : '⚠'} {label}
        </span>
    );
}

// Generate comparison insights
function generateComparisonNotes(
    allResults: { id: string; result: DSCFeasibilityResult; input: DSCPlotInput }[]
): string[] {
    if (allResults.length < 2) return [];
    const notes: string[] = [];

    // Best ROI
    const bestRoi = allResults.reduce((a, b) => a.result.roi > b.result.roi ? a : b);
    const worstRoi = allResults.reduce((a, b) => a.result.roi < b.result.roi ? a : b);
    if (bestRoi.id !== worstRoi.id) {
        const diff = ((bestRoi.result.roi - worstRoi.result.roi) * 100).toFixed(1);
        notes.push(`${bestRoi.id} offers the highest ROI at ${pct(bestRoi.result.roi)}, outperforming ${worstRoi.id} by ${diff}pp.`);
    }

    // Best margin
    const bestMargin = allResults.reduce((a, b) => a.result.grossMargin > b.result.grossMargin ? a : b);
    if (bestMargin.id !== bestRoi.id) {
        notes.push(`${bestMargin.id} has the best margin (${pct(bestMargin.result.grossMargin)}), making it lower risk despite not having the highest ROI.`);
    }

    // Highest profit
    const bestProfit = allResults.reduce((a, b) => a.result.grossProfit > b.result.grossProfit ? a : b);
    notes.push(`${bestProfit.id} generates the highest absolute profit at ${fmtM(bestProfit.result.grossProfit)}.`);

    return notes;
}

const toNum = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '');
        if (!cleaned) return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

export function DecisionConfidence({ plot, comparisonPlots = [], isFullscreen, onToggleFullscreen, onExitComparison, sharedFeasibilityParams, onFeasibilityParamsChange }: DecisionConfidenceProps) {
    const [activeMix, setActiveMix] = useState<MixKey>('balanced');
    const [plan, setPlan] = useState<AffectionPlanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [overrides, setOverrides] = useState<{ area?: number; ratio?: number; height?: string; efficiency?: number; landCostPsf?: number; constructionPsf?: number; buaMultiplier?: number; avgPsfOverride?: number; contingencyPct?: number; financePct?: number }>({});
    const [activeTab, setActiveTab] = useState<'feasibility' | 'comparison' | 'sensitivity' | 'plotCompare'>('feasibility');
    const [includeContingency, setIncludeContingency] = useState(true);
    const [includeFinance, setIncludeFinance] = useState(true);
    const [userNotes, setUserNotes] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);

    const allPlots = useMemo(() => {
        const allPlotsRaw = [plot, ...comparisonPlots];
        const seen = new Set<string>();
        return allPlotsRaw.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });
    }, [plot, comparisonPlots]);

    const [activeTabPlotId, setActiveTabPlotId] = useState(plot.id);

    const activePlot = allPlots.find(p => p.id === activeTabPlotId) || plot;

    useEffect(() => {
        setLoading(true);
        gisService.fetchAffectionPlan(activePlot.id).then(data => {
            setPlan(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [activePlot.id]);

    const effectiveOverrides = useMemo(() => {
        const sp = sharedFeasibilityParams || DEFAULT_FEASIBILITY_PARAMS;
        return {
            ...overrides,
            efficiency: overrides.efficiency ?? sp.efficiency,
            landCostPsf: overrides.landCostPsf ?? sp.landCostPsf,
            constructionPsf: overrides.constructionPsf ?? sp.constructionPsf,
            buaMultiplier: overrides.buaMultiplier ?? sp.buaMultiplier,
            contingencyPct: overrides.contingencyPct ?? (sp.contingencyPct / 100),
            financePct: overrides.financePct ?? (sp.financePct / 100),
            avgPsfOverride: overrides.avgPsfOverride ?? sp.avgPsfOverride,
        };
    }, [overrides, sharedFeasibilityParams]);

    const dscInput = useMemo(() => {
        const base = toDSCInput(activePlot, plan);
        if (overrides.area) base.area = overrides.area;
        if (overrides.ratio) base.ratio = overrides.ratio;
        if (overrides.height) base.height = overrides.height;
        return base;
    }, [activePlot, plan, overrides]);

    const clffMatch = useMemo(() => {
        if (plan?.landName) {
            const codeFromPlan = normalizeAreaCode(plan.landName);
            if (codeFromPlan && CLFF_AREAS[codeFromPlan]) {
                return { area: CLFF_AREAS[codeFromPlan], market: CLFF_MARKET_DATA[codeFromPlan] };
            }
        }
        return matchCLFFArea(activePlot.location || activePlot.project || '');
    }, [activePlot, plan]);

    const plotAreaCode = useMemo(() => {
        return resolvePlotAreaCode(activePlot.location || activePlot.project || '', plan?.landName, clffMatch?.area.code || null);
    }, [activePlot, plan?.landName, clffMatch?.area.code]);

    const scopedAreaCode = plotAreaCode || clffMatch?.area.code || null;
    const areaName = (scopedAreaCode && CLFF_AREAS[scopedAreaCode]?.name) || clffMatch?.area.name || 'Unknown Area';

    const masterAreaData = useMemo(() => {
        if (!scopedAreaCode) return null;
        return getAreaData(scopedAreaCode);
    }, [scopedAreaCode]);

    const areaMarketOverrides = useMemo(() => {
        if (clffMatch && masterAreaData) {
            return getCLFFOverridesWithMasterData(
                clffMatch.area.code,
                masterAreaData.salesByUnit as any,
                masterAreaData.rentalByUnit as any
            );
        } else if (clffMatch) {
            return getCLFFOverrides(clffMatch.area.code);
        }
        return {};
    }, [clffMatch, masterAreaData]);

    const fs = useMemo(() => {
        return calcDSCFeasibility(dscInput, activeMix, {
            ...areaMarketOverrides,
            efficiency: effectiveOverrides.efficiency,
            landCostPsf: effectiveOverrides.landCostPsf,
            constructionPsf: effectiveOverrides.constructionPsf,
            buaMultiplier: effectiveOverrides.buaMultiplier,
            avgPsfOverride: effectiveOverrides.avgPsfOverride,
            contingencyPct: includeContingency ? effectiveOverrides.contingencyPct : 0,
            financePct: includeFinance ? effectiveOverrides.financePct : 0,
        });
    }, [dscInput, activeMix, effectiveOverrides, includeContingency, includeFinance, areaMarketOverrides]);

    const allResults = useMemo(() => {
        return allPlots.map(p => {
            const input = toDSCInput(p, null);
            const result = calcDSCFeasibility(input, activeMix, areaMarketOverrides);
            return { id: p.id, plot: p, input, result };
        });
    }, [allPlots, activeMix, areaMarketOverrides]);

    const compNotes = useMemo(() => generateComparisonNotes(allResults), [allResults]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const masterTxnData = getAreaSalesData(scopedAreaCode || '') || { avgPsf: {}, medianPsf: {}, count: { total: 0 }, sharePct: {}, insufficient: {}, noData: {} };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            <div className="shrink-0 px-6 py-4 border-b">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Shield className="w-6 h-6 text-primary" />
                            Decision Confidence Report
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Plot {activePlot.id} · {areaName} · {dscInput.zone}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowShareModal(true)}>
                            <Share2 className="w-4 h-4 mr-2" /> Share
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4">
                    <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Avg PSF AED ${fmt(Math.round(fs.avgPsf))}`} accent />
                    <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} positive={fs.grossMargin > 0.2} negative={fs.grossMargin < 0} />
                    <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" positive={fs.roi > 0.2} negative={fs.roi < 0} />
                    <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} />
                </div>
            </div>

            <div className="flex border-b px-6 bg-muted/30">
                {[
                    ['feasibility', 'Feasibility'],
                    ['comparison', 'Benchmarks'],
                    ['sensitivity', 'Sensitivity'],
                    ['plotCompare', `Compare (${allPlots.length})`],
                ].map(([k, l]) => (
                    <button
                        key={k}
                        onClick={() => setActiveTab(k as any)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {l}
                    </button>
                ))}
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6">
                    {activeTab === 'feasibility' && (
                        <div className="space-y-8">
                            <Section num={1} title="Development Configuration">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="data-card p-4 border rounded-xl">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">Plot Characteristics</h4>
                                        <div className="space-y-3">
                                            {[
                                                ['Plot Area', `${fmt(Math.round(dscInput.area))} sqft`],
                                                ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
                                                ['Efficiency', `${pct(effectiveOverrides.efficiency || 0.95)}`],
                                                ['Sellable Area', `${fmt(Math.round(fs.sellableArea))} sqft`],
                                            ].map(([l, v]) => (
                                                <div key={l} className="flex justify-between text-sm py-1 border-b last:border-0 border-border/50">
                                                    <span className="text-muted-foreground">{l}</span>
                                                    <span className="font-mono font-bold">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="data-card p-4 border rounded-xl">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">Utilization</h4>
                                        <ProgressBar label="GFA Usage" value="100%" percent={100} />
                                        <ProgressBar label="Sellable Ratio" value={pct(fs.sellableArea / fs.gfa)} percent={(fs.sellableArea / fs.gfa) * 100} />
                                    </div>
                                </div>
                            </Section>

                            <Section num={2} title="Project Financials">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cost Item</TableHead>
                                            <TableHead className="text-right">Basis</TableHead>
                                            <TableHead className="text-right">Amount (AED)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Land Acquisition</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">Market Appraised</TableCell>
                                            <TableCell className="text-right font-mono">{fmtA(fs.landCost)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Construction</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">AED {effectiveOverrides.constructionPsf}/sqft</TableCell>
                                            <TableCell className="text-right font-mono">{fmtA(fs.constructionCost)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total Development Cost</TableCell>
                                            <TableCell />
                                            <TableCell className="text-right font-bold font-mono">{fmtA(fs.totalCost)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </Section>
                        </div>
                    )}

                    {activeTab === 'plotCompare' && (
                        <div className="space-y-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Metric</TableHead>
                                        {allResults.map(r => (
                                            <TableHead key={r.id} className="text-right">{r.id}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">ROI</TableCell>
                                        {allResults.map(r => (
                                            <TableCell key={r.id} className="text-right font-mono font-bold text-primary">{pct(r.result.roi)}</TableCell>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Gross Margin</TableCell>
                                        {allResults.map(r => (
                                            <TableCell key={r.id} className="text-right font-mono">{pct(r.result.grossMargin)}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="shrink-0 border-t p-4 bg-muted/30">
                <div className="flex gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground self-center">Strategy:</span>
                    {Object.entries(MIX_TEMPLATES).map(([k, v]) => (
                        <button
                            key={k}
                            onClick={() => setActiveMix(k as any)}
                            className={`flex-1 p-3 rounded-xl border text-center transition-all ${activeMix === k ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                                }`}
                        >
                            <div className="text-lg">{v.icon}</div>
                            <div className="text-[10px] font-bold uppercase">{v.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <DCShareModal
                open={showShareModal}
                onClose={() => setShowShareModal(false)}
                plotId={activePlot.id}
                activeMix={activeMix}
                fs={fs}
                plotInput={dscInput}
                overrides={effectiveOverrides}
            />
        </div>
    );
}
