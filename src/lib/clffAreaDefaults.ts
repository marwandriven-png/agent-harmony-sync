export interface CLFFAreaProfile {
    code: string;
    name: string;
    zoneType: 'RESIDENTIAL' | 'MIXED_USE' | 'INDUSTRIAL' | 'COMMERCIAL';
    subZone: string;
    marketTier: 'PREMIUM' | 'MID_HIGH' | 'MID' | 'AFFORDABLE';
    far: number;
    buaMultiplier: number;
    constructionPsf: number;
    sellablePct: number;
    serviceCharge: string;
    recommendedMix: { studio: number; br1: number; br2: number; br3: number };
    keyNote: string;
}

export interface CLFFMarketData {
    areaCode: string;
    period: string;
    salesTransactions: number;
    offPlanPct: number | null;
    studioPsfAvg: number | null;
    oneBrPsfAvg: number | null;
    twoBrPsfAvg: number | null;
    threeBrPsfAvg?: number | null;
    avgRentPsfYr: number | null;
    rentalContracts: number;
    grossYieldEst: number;
    dataSource: string;
}

export const CLFF_AREAS: Record<string, CLFFAreaProfile> = {
    MAJAN: {
        code: 'MAJAN', name: 'Majan', zoneType: 'RESIDENTIAL', subZone: 'Dubailand',
        marketTier: 'MID', far: 5.0, buaMultiplier: 1.0, constructionPsf: 420,
        sellablePct: 95, serviceCharge: 'AED 14–17',
        recommendedMix: { studio: 0.62, br1: 0.22, br2: 0.10, br3: 0.05 },
        keyNote: 'Most affordable entry; highest yield in 6-area study; strong studio investor demand',
    },
    DLRC: {
        code: 'DLRC', name: 'Dubai Land Residential Complex', zoneType: 'RESIDENTIAL', subZone: 'Dubailand',
        marketTier: 'MID_HIGH', far: 4.5, buaMultiplier: 1.45, constructionPsf: 420,
        sellablePct: 95, serviceCharge: 'AED 10–17',
        recommendedMix: { studio: 0.50, br1: 0.37, br2: 0.10, br3: 0.03 },
        keyNote: 'Volume leader; 48.2% renewal rate; easiest sales velocity',
    },
    ALSATWA: {
        code: 'ALSATWA', name: 'Al Satwa (Jumeirah Garden City)', zoneType: 'MIXED_USE', subZone: 'Jumeirah Garden City',
        marketTier: 'PREMIUM', far: 3.5, buaMultiplier: 1.0, constructionPsf: 450,
        sellablePct: 95, serviceCharge: 'AED 18–20',
        recommendedMix: { studio: 0.39, br1: 0.48, br2: 0.10, br3: 0.03 },
        keyNote: '70.4% rental renewal; 6 active competitors; JGC = 99% of Al Satwa transactions',
    },
    DSC: {
        code: 'DSC', name: 'Dubai Sports City', zoneType: 'RESIDENTIAL', subZone: 'Dubai Sports City',
        marketTier: 'MID', far: 4.5, buaMultiplier: 1.45, constructionPsf: 420,
        sellablePct: 95, serviceCharge: 'AED 12–15',
        recommendedMix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
        keyNote: 'Lower transaction velocity; golf/sports amenity premium; end-user + investor split',
    },
    MEYDAN: {
        code: 'MEYDAN', name: 'Meydan Horizon', zoneType: 'MIXED_USE', subZone: 'Meydan',
        marketTier: 'PREMIUM', far: 4.75, buaMultiplier: 1.0, constructionPsf: 450,
        sellablePct: 95, serviceCharge: 'AED 18–22',
        recommendedMix: { studio: 0, br1: 0.45, br2: 0.40, br3: 0.15 },
        keyNote: 'Racecourse/Canal proximity drives premium; 94.9% off-plan rate',
    },
    DIC: {
        code: 'DIC', name: 'Dubai Industrial City', zoneType: 'MIXED_USE', subZone: 'Dubai Industrial City',
        marketTier: 'MID', far: 4.5, buaMultiplier: 1.6, constructionPsf: 420,
        sellablePct: 95, serviceCharge: 'AED 12–15',
        recommendedMix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
        keyNote: 'Only area with significant commercial/office rental income; corporate tenant demand',
    },
    BUKADRA: {
        code: 'BUKADRA', name: 'Bukadra', zoneType: 'RESIDENTIAL', subZone: 'Ras Al Khor',
        marketTier: 'MID_HIGH', far: 4.0, buaMultiplier: 1.45, constructionPsf: 430,
        sellablePct: 95, serviceCharge: 'AED 15–18',
        recommendedMix: { studio: 0.30, br1: 0.40, br2: 0.22, br3: 0.08 },
        keyNote: 'Strategic location near Ras Al Khor; end-user focus with growing developer interest',
    },
};

export const AREA_ALIAS_MAP: Record<string, string> = {
    'dubai industrial city': 'DIC',
    'dic': 'DIC',
    'saih shuaib 2': 'DIC',
    'saih shuaib2': 'DIC',
    'dlrc': 'DLRC',
    'dubai land residential complex': 'DLRC',
    'dubai land residential': 'DLRC',
    'dubailand residential complex': 'DLRC',
    'dubailand residential': 'DLRC',
    'dubai residence complex': 'DLRC',
    'dubai residential complex': 'DLRC',
    'al satwa': 'ALSATWA',
    'alsatwa': 'ALSATWA',
    'jumeirah garden city': 'ALSATWA',
    'jgc': 'ALSATWA',
    'majan': 'MAJAN',
    'wadi al safa 3': 'MAJAN',
    'wadi al safa3': 'MAJAN',
    'wadi alsafa 3': 'MAJAN',
    'dubai sports city': 'DSC',
    'dsc': 'DSC',
    'sports city': 'DSC',
    'meydan': 'MEYDAN',
    'meydan horizon': 'MEYDAN',
    'bukadra': 'BUKADRA',
    'ras al khor industrial': 'BUKADRA',
};

export function normalizeAreaCode(input: string): string | null {
    if (!input) return null;
    const normalized = input.trim().toLowerCase();
    if (AREA_ALIAS_MAP[normalized]) return AREA_ALIAS_MAP[normalized];
    const normalizedText = ` ${normalized.replace(/[^a-z0-9]+/g, ' ').trim()} `;
    for (const [alias, code] of Object.entries(AREA_ALIAS_MAP)) {
        const aliasText = ` ${alias.replace(/[^a-z0-9]+/g, ' ').trim()} `;
        if (aliasText.trim() && normalizedText.includes(aliasText)) {
            return code;
        }
    }
    return null;
}

export const CLFF_MARKET_DATA: Record<string, CLFFMarketData> = {
    MAJAN: {
        areaCode: 'MAJAN', period: 'FEB_2026',
        salesTransactions: 2559, offPlanPct: 85.0,
        studioPsfAvg: 1812, oneBrPsfAvg: 1322, twoBrPsfAvg: 1147, threeBrPsfAvg: 1125,
        avgRentPsfYr: 79, rentalContracts: 1444, grossYieldEst: 6.8,
        dataSource: 'Cross-Area Master v2',
    },
    DLRC: {
        areaCode: 'DLRC', period: 'FEB_2026',
        salesTransactions: 2018, offPlanPct: 87.5,
        studioPsfAvg: 1560, oneBrPsfAvg: 1248, twoBrPsfAvg: 1130, threeBrPsfAvg: 1100,
        avgRentPsfYr: 66, rentalContracts: 2360, grossYieldEst: 5.8,
        dataSource: 'Cross-Area Master v2',
    },
    ALSATWA: {
        areaCode: 'ALSATWA', period: 'FEB_2026',
        salesTransactions: 327, offPlanPct: 92.0,
        studioPsfAvg: 2408, oneBrPsfAvg: 2151, twoBrPsfAvg: 2073, threeBrPsfAvg: null,
        avgRentPsfYr: 106, rentalContracts: 3307, grossYieldEst: 5.1,
        dataSource: 'Cross-Area Master v2',
    },
    DSC: {
        areaCode: 'DSC', period: 'FEB_2026',
        salesTransactions: 25, offPlanPct: null,
        studioPsfAvg: 1565, oneBrPsfAvg: 1200, twoBrPsfAvg: 1095, threeBrPsfAvg: null,
        avgRentPsfYr: 84, rentalContracts: 800, grossYieldEst: 6.0,
        dataSource: 'Cross-Area Master v2',
    },
    MEYDAN: {
        areaCode: 'MEYDAN', period: 'FEB_2026',
        salesTransactions: 742, offPlanPct: 94.9,
        studioPsfAvg: null, oneBrPsfAvg: 2250, twoBrPsfAvg: 2148, threeBrPsfAvg: null,
        avgRentPsfYr: null, rentalContracts: 600, grossYieldEst: 4.8,
        dataSource: 'Cross-Area Master v2',
    },
    DIC: {
        areaCode: 'DIC', period: 'FEB_2026',
        salesTransactions: 285, offPlanPct: 94.7,
        studioPsfAvg: 1498, oneBrPsfAvg: 1521, twoBrPsfAvg: 1366, threeBrPsfAvg: null,
        avgRentPsfYr: 79, rentalContracts: 2034, grossYieldEst: 5.9,
        dataSource: 'Cross-Area Master v2',
    },
    BUKADRA: {
        areaCode: 'BUKADRA', period: 'FEB_2026',
        salesTransactions: 180, offPlanPct: 88.0,
        studioPsfAvg: 2200, oneBrPsfAvg: 2200, twoBrPsfAvg: 2200, threeBrPsfAvg: null,
        avgRentPsfYr: 78, rentalContracts: 950, grossYieldEst: 6.0,
        dataSource: 'Cross-Area Master v2',
    },
};

export const CLFF_COST_CATEGORIES = [
    { code: 'LAND', name: 'Land Acquisition Cost', basis: 'PSF_GFA', defaultRate: null },
    { code: 'CONSTRUCTION', name: 'Construction Cost', basis: 'PSF_BUA', defaultRate: 420 },
    { code: 'AUTHORITY', name: 'Authority / DLD Fees', basis: 'PCT_LAND', defaultRate: 4.0 },
    { code: 'CONSULTANT', name: 'Consultant & Design Fees', basis: 'PCT_CONSTRUCTION', defaultRate: 3.0 },
    { code: 'CONTINGENCY', name: 'Contingency Reserve', basis: 'PCT_CONSTRUCTION', defaultRate: 5.0 },
    { code: 'MARKETING', name: 'Sales & Marketing', basis: 'PCT_GDV', defaultRate: 2.0 },
    { code: 'FINANCE', name: 'Finance / Interest Cost', basis: 'PCT_GDV', defaultRate: 3.0 },
] as const;

export function matchCLFFArea(location: string): { area: CLFFAreaProfile; market: CLFFMarketData } | null {
    if (!location) return null;
    const normalizedCode = normalizeAreaCode(location);
    if (normalizedCode && CLFF_AREAS[normalizedCode]) {
        return { area: CLFF_AREAS[normalizedCode], market: CLFF_MARKET_DATA[normalizedCode] };
    }
    const loc = location.toLowerCase();
    const matchers: [string[], string][] = [
        [['majan', 'wadi al safa'], 'MAJAN'],
        [['dlrc', 'dubai land residential', 'dubailand residential'], 'DLRC'],
        [['al satwa', 'satwa', 'jgc', 'jumeirah garden'], 'ALSATWA'],
        [['sports city', 'dsc'], 'DSC'],
        [['meydan'], 'MEYDAN'],
        [['industrial city', 'saih shuaib', 'dic'], 'DIC'],
        [['bukadra', 'ras al khor industrial'], 'BUKADRA'],
    ];
    for (const [keywords, code] of matchers) {
        if (keywords.some(k => loc.includes(k))) {
            return { area: CLFF_AREAS[code], market: CLFF_MARKET_DATA[code] };
        }
    }
    return null;
}

export function findAnchorArea(location: string): { area: CLFFAreaProfile; market: CLFFMarketData; confidence: number } | null {
    if (!location) return null;
    const exact = matchCLFFArea(location);
    if (exact) return { ...exact, confidence: 1.0 };
    const loc = location.toLowerCase();
    const contextMatchers: [string[], string, number][] = [
        [['downtown', 'business bay', 'difc', 'burj', 'sheikh zayed', 'bur dubai', 'deira', 'creek', 'jumeirah', 'marina', 'palm', 'jlt', 'jbr', 'tecom', 'barsha'], 'ALSATWA', 0.7],
        [['motor city', 'falcon city', 'global village', 'studio city', 'arjan'], 'DSC', 0.65],
        [['dubailand', 'liwan', 'wadi al safa', 'villanova', 'remraam', 'al barari'], 'MAJAN', 0.6],
        [['south', 'jafza', 'dip', 'techno', 'impz', 'al quoz'], 'DIC', 0.6],
        [['mbr city', 'ras al khor', 'nad al sheba', 'al khail', 'sobha'], 'MEYDAN', 0.65],
        [['silicon oasis', 'academic city', 'international city', 'warsan', 'muhaisnah'], 'DLRC', 0.55],
    ];
    for (const [keywords, code, confidence] of contextMatchers) {
        if (keywords.some(k => loc.includes(k))) {
            return { area: CLFF_AREAS[code], market: CLFF_MARKET_DATA[code], confidence };
        }
    }
    return { area: CLFF_AREAS['DLRC'], market: CLFF_MARKET_DATA['DLRC'], confidence: 0.4 };
}

export function getCLFFOverrides(areaCode: string): Record<string, unknown> {
    const area = CLFF_AREAS[areaCode];
    const market = CLFF_MARKET_DATA[areaCode];
    if (!area || !market) return {};
    return {
        constructionPsf: area.constructionPsf,
        buaMultiplier: area.buaMultiplier,
        efficiency: area.sellablePct / 100,
        unitPsf: {
            studio: market.studioPsfAvg || 0,
            br1: market.oneBrPsfAvg || 0,
            br2: market.twoBrPsfAvg || 0,
            br3: market.threeBrPsfAvg || 0,
        },
        unitRents: {
            studio: market.avgRentPsfYr || 0,
            br1: market.avgRentPsfYr || 0,
            br2: market.avgRentPsfYr ? market.avgRentPsfYr * 0.95 : 0,
            br3: market.avgRentPsfYr ? market.avgRentPsfYr * 0.88 : 0,
        },
    };
}

export function getCLFFOverridesWithMasterData(
    areaCode: string,
    salesByUnit: Record<string, { avgPsf: number }>,
    rentalByUnit: Record<string, { avgRentPsf: number }>
): Record<string, unknown> {
    const area = CLFF_AREAS[areaCode];
    if (!area) return {};

    const studioPsf = salesByUnit['studio']?.avgPsf || 0;
    const br1Psf = salesByUnit['br1']?.avgPsf || 0;
    const br2Psf = salesByUnit['br2']?.avgPsf || 0;
    const br3Psf = salesByUnit['br3']?.avgPsf || 0;

    const studioRent = rentalByUnit['studio']?.avgRentPsf || 0;
    const br1Rent = rentalByUnit['br1']?.avgRentPsf || 0;
    const br2Rent = rentalByUnit['br2']?.avgRentPsf || 0;
    const br3Rent = rentalByUnit['br3']?.avgRentPsf || 0;

    return {
        constructionPsf: area.constructionPsf,
        buaMultiplier: area.buaMultiplier,
        efficiency: area.sellablePct / 100,
        unitPsf: {
            studio: studioPsf,
            br1: br1Psf,
            br2: br2Psf,
            br3: br3Psf,
        },
        unitRents: {
            studio: studioRent,
            br1: br1Rent,
            br2: br2Rent,
            br3: br3Rent,
        },
    };
}
