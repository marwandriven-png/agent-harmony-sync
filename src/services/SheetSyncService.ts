const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getUnifiedSheetConfig() {
    const wizardSheetUrl = localStorage.getItem('hp_sheetId') || '';
    const settingsSheetUrl = localStorage.getItem('hyperplot_sheet_url') || '';
    const sheetUrl = wizardSheetUrl || settingsSheetUrl;
    const fallbackSheetUrl = settingsSheetUrl && settingsSheetUrl !== sheetUrl ? settingsSheetUrl : '';
    const dataSheetName = localStorage.getItem('hp_sheetName') || '';
    return { sheetUrl, fallbackSheetUrl, dataSheetName };
}

const LISTING_SHEET_NAME = 'DATA BASE';

export async function syncListingToSheet(plotNumber: string, data: {
    owner?: string;
    contact?: string;
    status?: string;
    price?: string;
    notes?: string;
    area?: string;
    location?: string;
    gfa?: string;
    zoning?: string;
}): Promise<boolean> {
    const { sheetUrl } = getUnifiedSheetConfig();
    if (!sheetUrl) return false;

    try {
        const updateData: Record<string, string> = {};
        if (data.owner) updateData['owner'] = data.owner;
        if (data.contact) updateData['contact'] = data.contact;
        if (data.status) updateData['status'] = data.status;
        if (data.price) updateData['price'] = data.price;
        if (data.notes) updateData['actions'] = data.notes;
        if (data.location) updateData['location'] = data.location;
        if (data.area) updateData['area (sqft)'] = data.area;
        if (data.gfa) updateData['gfa (sqft)'] = data.gfa;
        if (data.zoning) updateData['zoning'] = data.zoning;

        if (Object.keys(updateData).length === 0) return false;

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/sheets-proxy?action=update`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId: sheetUrl,
                    sheetName: LISTING_SHEET_NAME,
                    updates: [{ plotNumber, data: updateData }],
                }),
            }
        );

        const result = await response.json();
        if (!response.ok || result.error) return false;
        if (result.updatedRows === 0) return await appendListingToSheet(plotNumber, data);
        return true;
    } catch {
        return false;
    }
}

export async function appendListingToSheet(plotNumber: string, data: {
    owner?: string;
    contact?: string;
    status?: string;
    price?: string;
    notes?: string;
    area?: string;
    location?: string;
    gfa?: string;
    zoning?: string;
}): Promise<boolean> {
    const { sheetUrl } = getUnifiedSheetConfig();
    if (!sheetUrl) return false;

    try {
        const lookupRes = await fetch(
            `${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId: sheetUrl,
                    sheetName: LISTING_SHEET_NAME,
                    plotNumbers: ['__dummy__'],
                }),
            }
        );

        const lookupData = await lookupRes.json();
        const headers: string[] = lookupData.headers || [];
        if (headers.length === 0) return false;

        const headerLower = headers.map((h: string) => h.toString().trim().toLowerCase());
        const row: string[] = new Array(headers.length).fill('');

        const mappings: Record<string, string[]> = {
            'plotNumber': ['land number', 'plot number', 'plot', 'land', 'p-number'],
            'owner': ['owner', 'name', 'owner name', 'owner reference'],
            'contact': ['contact', 'mobile', 'phone', 'phone number', 'mobile number'],
            'status': ['status'],
            'price': ['price', 'asking price', 'amount'],
            'notes': ['notes', 'remarks', 'comment', 'actions'],
            'area': ['area (sqft)', 'land size', 'area', 'area sqm'],
            'location': ['location', 'project', 'community'],
            'gfa': ['gfa (sqft)', 'gfa', 'gfa sqft'],
            'zoning': ['zoning', 'land use', 'landuse'],
        };

        const values: Record<string, string> = {
            plotNumber,
            owner: data.owner || '',
            contact: data.contact || '',
            status: data.status || 'Available',
            price: data.price || '',
            notes: data.notes || '',
            area: data.area || '',
            location: data.location || '',
            gfa: data.gfa || '',
            zoning: data.zoning || '',
        };

        for (const [field, possibleHeaders] of Object.entries(mappings)) {
            const val = values[field];
            if (!val) continue;
            for (const ph of possibleHeaders) {
                const idx = headerLower.indexOf(ph);
                if (idx !== -1) {
                    row[idx] = val;
                    break;
                }
            }
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/sheets-proxy?action=append`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId: sheetUrl,
                    sheetName: LISTING_SHEET_NAME,
                    rows: [row],
                }),
            }
        );

        const result = await response.json();
        return !result.error;
    } catch {
        return false;
    }
}

export async function deleteListingFromSheet(plotNumber: string): Promise<boolean> {
    const { sheetUrl } = getUnifiedSheetConfig();
    if (!sheetUrl) return false;
    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/sheets-proxy?action=delete`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId: sheetUrl,
                    sheetName: LISTING_SHEET_NAME,
                    plotNumber,
                }),
            }
        );
        const result = await response.json();
        return !!result.deleted;
    } catch {
        return false;
    }
}

export async function lookupOwnerFromSheet(plotNumber: string): Promise<{ owner: string; mobile: string } | null> {
    const { sheetUrl, fallbackSheetUrl, dataSheetName } = getUnifiedSheetConfig();
    if (!sheetUrl) return null;
    const ownerKeys = ['owner', 'owner name', 'name', 'owner_reference', 'owner reference', 'owner ref'];
    const mobileKeys = ['mobile', 'phone', 'contact', 'phone number', 'contact number', 'mobile number'];
    const pickOwnerMobile = (row: any) => {
        if (!row) return null;
        let owner = '', mobile = '';
        for (const key of ownerKeys) { if (row[key]) { owner = row[key]; break; } }
        for (const key of mobileKeys) { if (row[key]) { mobile = row[key]; break; } }
        return owner || mobile ? { owner, mobile } : null;
    };
    const runLookup = async (target: string) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetId: target, sheetName: dataSheetName || undefined, plotNumbers: [plotNumber] }),
            });
            const data = await res.json();
            return pickOwnerMobile(data.matches?.[plotNumber]);
        } catch { return null; }
    };
    const primary = await runLookup(sheetUrl);
    if (primary) return primary;
    if (fallbackSheetUrl) return await runLookup(fallbackSheetUrl);
    return null;
}

export async function importPlotsFromSheet(): Promise<any[]> {
    const { sheetUrl, dataSheetName } = getUnifiedSheetConfig();
    if (!sheetUrl) return [];
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId: sheetUrl, sheetName: dataSheetName || undefined, plotNumbers: ['__all__'], returnAll: true }),
        });
        const data = await res.json();
        if (data.error || !data.matches) return [];
        const results: any[] = [];
        for (const [plotNum, rowData] of Object.entries(data.matches)) {
            const row = rowData as any;
            const ownerKeys = ['owner', 'owner name', 'name', 'owner_reference', 'owner reference'];
            const mobileKeys = ['mobile', 'phone', 'contact', 'phone number', 'contact number'];
            const areaKeys = ['land size', 'area (sqft)', 'area', 'area sqm'];
            const priceKeys = ['price', 'asking price', 'amount'];
            let owner = '', contact = '', area = '', price = '';
            for (const key of ownerKeys) { if (row[key]) { owner = row[key]; break; } }
            for (const key of mobileKeys) { if (row[key]) { contact = row[key]; break; } }
            for (const key of areaKeys) { if (row[key]) { area = row[key]; break; } }
            for (const key of priceKeys) { if (row[key]) { price = row[key]; break; } }
            results.push({ plotNumber: plotNum.trim(), owner, contact, area, price, rawData: row });
        }
        return results;
    } catch { return []; }
}
