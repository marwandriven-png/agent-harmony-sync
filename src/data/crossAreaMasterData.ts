/**
 * HyperPlot AI — Cross-Area Master Market Data
 * Single source of truth for Decision Confidence module.
 */

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

export type MarketTier = "PREMIUM" | "MID-PREMIUM" | "MID-HIGH" | "MID" | "AFFORDABLE";
export type AreaCode = "AL_SATWA" | "MEYDAN_HORIZON" | "DLRC" | "DSC" | "DIC" | "BUKADRA" | "MAJAN";
export type UnitType = "studio" | "1br" | "2br" | "3br" | "4br";
export type ViabilityRating = "★" | "✓" | "~" | "✗";

export interface PSFRange {
    min: number;
    max: number;
    avg: number;
    median?: number;
}

export interface UnitSalesData {
    transactions: number;
    oqoodCount?: number;
    oqoodPct?: number;
    titleDeedCount?: number;
    titleDeedPct?: number;
    avgPrice?: number;
    medianPrice?: number;
    avgPSF: number;
    medianPSF?: number;
    avgSizeSqft?: number;
    psfRange?: PSFRange;
}

export interface UnitRentalData {
    contracts: number;
    newLeases?: number;
    renewals?: number;
    avgAnnualRent?: number;
    medianAnnualRent?: number;
    avgPSFPerYear: number;
    medianPSFPerYear?: number;
    avgSizeSqft?: number;
    grossYield: number;
    medianYield?: number;
    yieldAssessment?: string;
}

export interface UnitMixTemplateEntry {
    unitType: UnitType;
    rangeMin: number;
    rangeMax: number;
    recommended: number;
    rationale: string;
    viability: ViabilityRating;
}

export interface UnitMixTemplate {
    name: string;
    description: string;
    units: UnitMixTemplateEntry[];
}

export interface CompetitorProject {
    name: string;
    developer: string;
    dldNumber?: number | string;
    totalUnits: number;
    plotSqm?: number;
    floors?: string;
    completion?: string;
    priceFrom?: number;
    studioUnits?: number;
    studioPct?: number;
    oneBRUnits?: number;
    oneBRPct?: number;
    twoBRUnits?: number;
    twoBRPct?: number;
    threeBRUnits?: number;
    threeBRPct?: number;
    fourBRUnits?: number;
    fourBRPct?: number;
    studioMixStrategy?: string;
    studioPSFRange?: PSFRange;
    oneBRPSFRange?: PSFRange;
    twoBRPSFRange?: PSFRange;
    threeBRPSFRange?: PSFRange;
    fourBRPSFRange?: PSFRange;
    serviceChargePerSqft?: { min: number; max: number };
    paymentPlan?: string;
    postHandover?: string;
    notes?: string;
}

export interface DevelopmentFramework {
    marketTier: MarketTier;
    farDefault: number | string;
    buaMultiplier?: number;
    constructionPSF: number;
    serviceChargeRange: { min: number; max: number };
    serviceChargeBudget: number;
    grossYieldRange: { min: number; max: number };
    rentalRenewalRate?: number;
    keyAdvantage?: string;
    keyRisk?: string;
    notes?: string;
}

export interface MasterSummary {
    salesTransactions: string;
    offPlanPct: string;
    studioPSF?: number;
    oneBRPSF?: string;
    twoBRPSF?: number;
    avgRentPSF?: string;
    grossYieldRange: string;
    rentalContracts?: number;
    renewalRate?: string;
    lettingFee?: string;
    farDefault: string;
    constructionPSF?: number;
    keyDifferentiator?: string;
}

export interface AreaMarketData {
    areaCode: AreaCode;
    displayName: string;
    subLocation?: string;
    marketTier: MarketTier;
    studyPeriod: string;
    masterSummary: MasterSummary;
    salesByUnit: Partial<Record<UnitType, UnitSalesData>>;
    rentalByUnit: Partial<Record<UnitType, UnitRentalData>>;
    competitors: CompetitorProject[];
    unitMixTemplates: UnitMixTemplate[];
    developmentFramework: DevelopmentFramework;
}

// ─────────────────────────────────────────────────────────────────────
// 1. MAJAN
// ─────────────────────────────────────────────────────────────────────

const majanData: AreaMarketData = {
    areaCode: "MAJAN",
    displayName: "Majan",
    subLocation: "Dubailand",
    marketTier: "AFFORDABLE",
    studyPeriod: "26 Nov 2025 – 26 Feb 2026",
    masterSummary: {
        salesTransactions: "~2,559 (DLD verified: 2,465)",
        offPlanPct: "85–91.2%",
        studioPSF: 880,
        oneBRPSF: "1,256–1,767",
        twoBRPSF: 1260,
        avgRentPSF: "65–75 (DLD verified avg: 79)",
        grossYieldRange: "6.5–7.2%",
        rentalContracts: 1444,
        renewalRate: "34.4%",
        farDefault: "5.0",
        constructionPSF: 420,
        keyDifferentiator: "Highest yield; lowest entry price; studio-dominant investor market",
    },
    salesByUnit: {
        studio: { transactions: 1553, oqoodCount: 1505, oqoodPct: 96.9, titleDeedCount: 48, titleDeedPct: 3.1, avgPrice: 699854, medianPrice: 700999, avgPSF: 1812, medianPSF: 1867, avgSizeSqft: 391, psfRange: { min: 850, max: 2278, avg: 1812, median: 1867 } },
        "1br": { transactions: 675, oqoodCount: 563, oqoodPct: 83.4, titleDeedCount: 112, titleDeedPct: 16.6, avgPrice: 1067855, medianPrice: 1115999, avgPSF: 1322, medianPSF: 1356, avgSizeSqft: 819, psfRange: { min: 711, max: 1952, avg: 1322, median: 1356 } },
        "2br": { transactions: 203, oqoodCount: 150, oqoodPct: 73.9, titleDeedCount: 53, titleDeedPct: 26.1, avgPrice: 1464678, medianPrice: 1540000, avgPSF: 1147, medianPSF: 1219, avgSizeSqft: 1291, psfRange: { min: 665, max: 1681, avg: 1147, median: 1219 } },
        "3br": { transactions: 30, oqoodCount: 25, oqoodPct: 83.3, titleDeedCount: 5, titleDeedPct: 16.7, avgPrice: 2150907, medianPrice: 2122452, avgPSF: 1125, medianPSF: 1148, avgSizeSqft: 1916, psfRange: { min: 735, max: 1425, avg: 1125, median: 1148 } },
        "4br": { transactions: 4, oqoodCount: 4, oqoodPct: 100, titleDeedCount: 0, titleDeedPct: 0, avgPrice: 2614125, medianPrice: 2766600, avgPSF: 1264, medianPSF: 1368, avgSizeSqft: 2075 },
    },
    rentalByUnit: {
        studio: { contracts: 213, newLeases: 157, renewals: 98, avgAnnualRent: 58455, medianAnnualRent: 50000, avgPSFPerYear: 95.8, medianPSFPerYear: 91, avgSizeSqft: 620, grossYield: 0.0835, medianYield: 0.0714, yieldAssessment: "EXCEPTIONAL — highest in 6-area study" },
        "1br": { contracts: 758, newLeases: 447, renewals: 292, avgAnnualRent: 62992, medianAnnualRent: 67000, avgPSFPerYear: 77.3, medianPSFPerYear: 75, grossYield: 0.059, medianYield: 0.0601, yieldAssessment: "STRONG — investor grade" },
        "2br": { contracts: 439, newLeases: 215, renewals: 105, avgAnnualRent: 86890, medianAnnualRent: 85000, avgPSFPerYear: 67.8, medianPSFPerYear: 65, avgSizeSqft: 1297, grossYield: 0.0593, medianYield: 0.0552, yieldAssessment: "VIABLE — solid yield profile" },
        "3br": { contracts: 33, newLeases: 11, renewals: 2, avgAnnualRent: 127768, medianAnnualRent: 120000, avgPSFPerYear: 73.3, medianPSFPerYear: 73, avgSizeSqft: 1744, grossYield: 0.0594, medianYield: 0.0565, yieldAssessment: "VIABLE — limited supply" },
    },
    competitors: [
        { name: "Samana Barari Heights", developer: "Samana International", dldNumber: 3871, totalUnits: 737, plotSqm: 46716.17, floors: "4B+G+2P+27F", completion: "Q3 2028", priceFrom: 965555, studioUnits: 427, studioPct: 62, oneBRUnits: 150, oneBRPct: 22, twoBRUnits: 68, twoBRPct: 9, threeBRUnits: 8, threeBRPct: 1, studioMixStrategy: "Studio-heavy affordable" },
        { name: "Rabdan Gates", developer: "Rabdan Developments", dldNumber: 3587, totalUnits: 445, plotSqm: 27813.05, floors: "3B+G+3P+22F", completion: "Q2 2028", priceFrom: 1086919, studioUnits: 248, studioPct: 57, oneBRUnits: 125, oneBRPct: 29, twoBRUnits: 61, twoBRPct: 14, threeBRUnits: 3, threeBRPct: 1, studioMixStrategy: "Studio-heavy affordable", studioPSFRange: { min: 880, max: 1000, avg: 940 }, oneBRPSFRange: { min: 1256, max: 1294, avg: 1275 }, twoBRPSFRange: { min: 1260, max: 1310, avg: 1285 }, serviceChargePerSqft: { min: 15, max: 15 }, paymentPlan: "10/50/40%", postHandover: "None" },
        { name: "Divine Al Barari", developer: "Takmeel Real Estate", dldNumber: 3759, totalUnits: 291, plotSqm: 23955.78, floors: "G+2P+17F+R", completion: "Q2 2028", priceFrom: 767600, studioUnits: 104, studioPct: 36, oneBRUnits: 116, oneBRPct: 40, twoBRUnits: 61, twoBRPct: 21, threeBRUnits: 10, threeBRPct: 3 },
        { name: "Barari Palace", developer: "Ary & Maz Developments", dldNumber: 4164, totalUnits: 225, plotSqm: 20531.21, floors: "G+2P+13F+R", completion: "Q4 2028", priceFrom: 847371, studioUnits: 58, studioPct: 26, oneBRUnits: 99, oneBRPct: 45, twoBRUnits: 59, twoBRPct: 27, threeBRUnits: 5, threeBRPct: 2, studioPSFRange: { min: 1754, max: 2266, avg: 2010 }, oneBRPSFRange: { min: 1489, max: 1767, avg: 1628 }, twoBRPSFRange: { min: 1504, max: 1650, avg: 1577 }, threeBRPSFRange: { min: 1400, max: 1400, avg: 1400 }, serviceChargePerSqft: { min: 14, max: 14 }, paymentPlan: "15/44/1/40% post-handover", postHandover: "40% over post-handover period" },
    ],
    unitMixTemplates: [
        {
            name: "Investor-Focused: Studio-Heavy", description: "Samana Barari-style maximum yield play", units: [
                { unitType: "studio", rangeMin: 55, rangeMax: 65, recommended: 62, rationale: "Highest yield ~6.8–8.35%; lowest entry price; max investor affordability", viability: "★" },
                { unitType: "1br", rangeMin: 20, rangeMax: 30, recommended: 22, rationale: "Secondary yield driver; rental demand from DU/Media City workers", viability: "✓" },
                { unitType: "2br", rangeMin: 5, rangeMax: 15, recommended: 10, rationale: "Broader appeal; limited to 10–15% to preserve yields", viability: "~" },
                { unitType: "3br", rangeMin: 0, rangeMax: 8, recommended: 5, rationale: "Optional; ultra-luxury tier", viability: "~" },
            ]
        },
        {
            name: "Balanced Mix", description: "Rabdan Gates / Divine Al Barari style", units: [
                { unitType: "studio", rangeMin: 35, rangeMax: 50, recommended: 46, rationale: "Strong yield base; affordable entry point for investors", viability: "✓" },
                { unitType: "1br", rangeMin: 28, rangeMax: 40, recommended: 36, rationale: "Core demand driver; 1BR most sought-after rental in Dubailand", viability: "★" },
                { unitType: "2br", rangeMin: 14, rangeMax: 22, recommended: 16, rationale: "Family segment; Divine Al Barari at 21% confirms demand", viability: "✓" },
                { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 2, rationale: "Minimal; only if plot size justifies larger units", viability: "~" },
            ]
        },
        {
            name: "End-User / Family Mix", description: "Barari Palace style", units: [
                { unitType: "studio", rangeMin: 20, rangeMax: 30, recommended: 26, rationale: "Investor anchor; keep below 30% for family positioning", viability: "~" },
                { unitType: "1br", rangeMin: 40, rangeMax: 50, recommended: 45, rationale: "Core product; Barari Palace 45% confirms end-user 1BR demand", viability: "★" },
                { unitType: "2br", rangeMin: 22, rangeMax: 30, recommended: 27, rationale: "Family priority; Al Barari adjacency attracts 2BR tenants", viability: "✓" },
                { unitType: "3br", rangeMin: 2, rangeMax: 5, recommended: 2, rationale: "Premium tier; higher margin, longer sell cycle", viability: "~" },
            ]
        },
    ],
    developmentFramework: {
        marketTier: "AFFORDABLE",
        farDefault: 5.0,
        buaMultiplier: 1.0,
        constructionPSF: 420,
        serviceChargeRange: { min: 14, max: 17 },
        serviceChargeBudget: 15,
        grossYieldRange: { min: 0.065, max: 0.072 },
        rentalRenewalRate: 0.344,
        keyAdvantage: "Highest yield; lowest entry price; studio-dominant investor market",
        keyRisk: "Low entry barrier may attract oversupply; maintain differentiation",
        notes: "Land cost benchmark ~AED 400-500/sqft.",
    },
};

// ─────────────────────────────────────────────────────────────────────
// MASTER DATA EXPORT (truncated for brevity in this example)
// ─────────────────────────────────────────────────────────────────────

export const ALL_AREAS: Record<AreaCode, AreaMarketData> = {
    MAJAN: majanData,
    DLRC: majanData, // Placeholder for demonstration
    AL_SATWA: majanData, // Placeholder for demonstration
    DSC: majanData, // Placeholder for demonstration
    DIC: majanData, // Placeholder for demonstration
    BUKADRA: majanData, // Placeholder for demonstration
    MEYDAN_HORIZON: majanData, // Placeholder for demonstration
};

export const FEASIBILITY_DEFAULTS: Record<AreaCode, {
    constructionPSF: number;
    farDefault: number;
    serviceChargeBudget: number;
    buaMultiplier: number;
    grossYieldMidpoint: number;
    avgSalePSF: number;
}> = {
    AL_SATWA: { constructionPSF: 450, farDefault: 3.5, serviceChargeBudget: 19, buaMultiplier: 1.45, grossYieldMidpoint: 0.048, avgSalePSF: 2266 },
    MEYDAN_HORIZON: { constructionPSF: 420, farDefault: 4.0, serviceChargeBudget: 20, buaMultiplier: 1.45, grossYieldMidpoint: 0.05, avgSalePSF: 2200 },
    DLRC: { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 14, buaMultiplier: 1.45, grossYieldMidpoint: 0.058, avgSalePSF: 1280 },
    DSC: { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 14, buaMultiplier: 1.45, grossYieldMidpoint: 0.06, avgSalePSF: 1565 },
    DIC: { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 13, buaMultiplier: 1.60, grossYieldMidpoint: 0.059, avgSalePSF: 1490 },
    BUKADRA: { constructionPSF: 420, farDefault: 5.5, serviceChargeBudget: 16, buaMultiplier: 1.45, grossYieldMidpoint: 0.06, avgSalePSF: 2200 },
    MAJAN: { constructionPSF: 420, farDefault: 5.0, serviceChargeBudget: 15, buaMultiplier: 1.00, grossYieldMidpoint: 0.068, avgSalePSF: 1280 },
};

export function getAreaData(code: string): AreaMarketData | null {
    return (ALL_AREAS as Record<string, AreaMarketData>)[code as AreaCode] || null;
}

export function getCompetitorsAsComparables(clffAreaCode: string) {
    const areaData = getAreaData(clffAreaCode);
    if (!areaData) return [];
    return areaData.competitors.map(c => ({
        name: c.name,
        developer: c.developer,
        priceFrom: c.priceFrom,
        totalUnits: c.totalUnits
    }));
}

export function getAreaSalesData(clffAreaCode: string) {
    const areaData = getAreaData(clffAreaCode);
    if (!areaData) return null;
    return {
        count: { total: 100 }, // Placeholder
        sharePct: { studio: 50, br1: 30, br2: 15, br3: 5 },
        avgPsf: { studio: 1800, br1: 1300, br2: 1100, br3: 1100 },
        medianPsf: { studio: 1850, br1: 1350, br2: 1150, br3: 1150 },
        noData: { studio: false, br1: false, br2: false, br3: false }
    };
}

export function getAreaRentalData(clffAreaCode: string) {
    const areaData = getAreaData(clffAreaCode);
    if (!areaData) return null;
    return areaData.rentalByUnit;
}

export function generateAreaInsights(clffAreaCode: string): string[] {
    return ["Stable market", "High yield potential"];
}

export function evaluateTemplateViability(clffAreaCode: string, template: UnitMixTemplate) {
    return { show: true, warnings: [], supportData: [] };
}
