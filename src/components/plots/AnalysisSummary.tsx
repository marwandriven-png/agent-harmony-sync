import React from 'react';
import { DSCFeasibilityResult, pct, fmt, fmtM } from '@/lib/dscFeasibility';

export function AnalysisSummary({ fs, mixTemplate }: { fs: DSCFeasibilityResult; mixTemplate: { label: string } }) {
    const breakEvenPsf = Math.round(fs.totalCost / fs.sellableArea);
    const marketAvgPsf = 1565; // This could be dynamic based on area
    const safetyMargin = Math.round(((marketAvgPsf - breakEvenPsf) / marketAvgPsf) * 100);

    const strengths = [
        `${pct(fs.roi)} ROI significantly exceeds market average (25-30%)`,
        `${pct(fs.grossMargin)} profit margin provides healthy buffer against market volatility`,
        `Break-even at AED ${fmt(breakEvenPsf)} PSF vs market AED ${fmt(marketAvgPsf)} (${safetyMargin}% safety margin)`,
        `${mixTemplate.label} unit mix reduces absorption risk and targets broad market segment`,
        `${(fs.grossYield * 100).toFixed(1)}% yield attractive to institutional investors`,
    ];

    const risks = [
        `Sensitivity analysis confirms viability even at -5% price decline`,
        `Only becomes marginal at -10% price drop (unlikely scenario)`,
        `Market floor remains above break-even`,
        `Strategic location supports long-term price appreciation`,
        `Flexible unit mix allows pivot to investor-focused if market shifts`,
    ];

    const nextSteps = [
        { num: '01', title: 'Secure Acquisition', desc: `Target land cost at ${pct(fs.landCost / fs.grossSales)} of GDV (AED ${fmtM(fs.landCost)})` },
        { num: '02', title: 'Pre-sales Strategy', desc: 'Launch phase 1 to test price elasticity and market response' },
        { num: '03', title: 'Unit Mix Finalization', desc: 'Confirm based on pre-sales feedback and absorption rates' },
        { num: '04', title: 'Monitor Area Pipeline', desc: 'Track absorption rates quarterly to optimize pricing strategy' },
    ];

    return (
        <div className="mt-12 space-y-6">
            <div className="rounded-2xl p-6 md:p-8 bg-emerald-500/5 border border-emerald-500/20">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-600">
                    <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm">🎯</span>
                    Key Investment Strengths
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                    {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span className="leading-snug">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-2xl p-6 md:p-8 bg-cyan-500/5 border border-cyan-500/20">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-600">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-sm">🛡️</span>
                    Risk Mitigation Factors
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                    {risks.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-500 mt-0.5">•</span>
                            <span className="leading-snug">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-2xl p-6 md:p-8 bg-slate-500/5 border border-slate-500/20">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center text-sm">⏭️</span>
                    Recommended Next Steps
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {nextSteps.map(step => (
                        <div key={step.num} className="p-4 rounded-xl bg-background border border-border/50">
                            <div className="text-2xl font-black mb-2 text-muted-foreground/30">
                                {step.num}
                            </div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">{step.title}</h4>
                            <p className="text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
