export interface LastSeenEntry {
    plotId: string;
    plotName: string;
    location: string;
    coordinates: { x: number; y: number };
    area: number;
    gfa: number;
    zoning: string;
    status: string;
    timestamp: number;
}

const STORAGE_KEY = 'hyperplot_last_seen';
const MAX_ENTRIES = 20;

export function getLastSeen(): LastSeenEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as LastSeenEntry[];
    } catch {
        return [];
    }
}

export function addLastSeen(entry: Omit<LastSeenEntry, 'timestamp'>): void {
    if (!entry.coordinates || (entry.coordinates.x === 0 && entry.coordinates.y === 0)) return;
    if (!entry.plotId) return;

    const existing = getLastSeen();
    const filtered = existing.filter(e => e.plotId !== entry.plotId);
    const newEntry: LastSeenEntry = { ...entry, timestamp: Date.now() };
    filtered.unshift(newEntry);
    const capped = filtered.slice(0, MAX_ENTRIES);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    } catch { }
}

export function removeLastSeen(plotId: string): void {
    const existing = getLastSeen().filter(e => e.plotId !== plotId);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch { }
}

export function clearLastSeen(): void {
    localStorage.removeItem(STORAGE_KEY);
}
