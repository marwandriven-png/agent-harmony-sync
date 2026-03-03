import { useState, useMemo, useEffect } from 'react';
import { X, Link2, Copy, Check, Calendar, Shield, Eye, Download, Clock, Trash2, Users, AlertTriangle, RefreshCw, Settings, UserPlus, Phone, Building2, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { DSCFeasibilityResult, DSCPlotInput, MixKey, MIX_TEMPLATES } from '@/lib/dscFeasibility';
import { supabase } from '@/integrations/supabase/client';

export interface DCShareLink {
    id: string;
    plotId: string;
    mixStrategy: MixKey;
    plotInput: DSCPlotInput;
    overrides?: Record<string, number | string | undefined>;
    createdAt: string;
    expiresAt: string | null;
    views: number;
    downloads: number;
    isActive: boolean;
    url: string;
}

export interface PreApprovedContact {
    id: string;
    email: string;
    phone: string;
    company: string;
    source: 'manual' | 'sheets';
    accessed: boolean;
    addedAt: string;
}

export interface SecurityLog {
    id: string;
    event: 'access_granted' | 'access_denied' | 'link_forwarded' | 'link_expired' | 'link_revoked';
    name: string;
    email: string;
    mobile: string;
    device: string;
    time: string;
    linkId: string;
}

interface DCShareModalProps {
    open: boolean;
    onClose: () => void;
    plotId: string;
    activeMix: MixKey;
    fs: DSCFeasibilityResult;
    plotInput?: DSCPlotInput;
    overrides?: Record<string, number | string | undefined>;
}

const CONTACTS_KEY = 'hyperplot_dc_contacts';
const SHEETS_URL_KEY = 'hyperplot_sheets_url';

export async function loadShareLinksFromDB(): Promise<DCShareLink[]> {
    const { data, error } = await supabase.from('dc_share_links').select('*');
    if (error || !data) return [];
    return data.map((r: any) => ({
        id: r.id,
        plotId: r.plot_id,
        mixStrategy: r.mix_strategy as MixKey,
        plotInput: r.plot_input as DSCPlotInput,
        overrides: r.overrides as Record<string, number | string | undefined>,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        views: r.views,
        downloads: r.downloads,
        isActive: r.is_active,
        url: `${window.location.origin}/dc/${r.id}`,
    }));
}

function loadContacts(): PreApprovedContact[] {
    try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); } catch { return []; }
}
function saveContacts(c: PreApprovedContact[]) { localStorage.setItem(CONTACTS_KEY, JSON.stringify(c)); }

async function loadLogsFromDB(): Promise<SecurityLog[]> {
    const { data, error } = await supabase.from('dc_access_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error || !data) return [];
    return data.map((r: any) => ({
        id: r.id,
        event: r.event as SecurityLog['event'],
        name: r.name || '—',
        email: r.email || '—',
        mobile: r.mobile || '—',
        device: r.device || '—',
        time: new Date(r.created_at).toLocaleString(),
        linkId: r.link_id,
    }));
}

type ModalTab = 'link' | 'contacts' | 'logs';

export function DCShareModal({ open, onClose, plotId, activeMix, fs, plotInput, overrides }: DCShareModalProps) {
    const [links, setLinks] = useState<DCShareLink[]>([]);
    const [contacts, setContacts] = useState<PreApprovedContact[]>(loadContacts);
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [tab, setTab] = useState<ModalTab>('link');
    const [expiryDays, setExpiryDays] = useState(7);
    const [captcha, setCaptcha] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showAddContact, setShowAddContact] = useState(false);
    const [newContact, setNewContact] = useState({ email: '', phone: '', company: '' });

    const refreshData = async () => {
        const [linksData, logsData] = await Promise.all([
            loadShareLinksFromDB(),
            loadLogsFromDB(),
        ]);
        setLinks(linksData);
        setLogs(logsData);
    };

    useEffect(() => {
        if (open) refreshData();
    }, [open]);

    const generateLink = async () => {
        const id = Math.random().toString(36).slice(2, 10);
        const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000).toISOString() : null;
        const input: DSCPlotInput = plotInput || {
            id: plotId,
            name: `Plot ${plotId}`,
            area: fs.plot.area,
            ratio: fs.plot.ratio,
            height: fs.plot.height,
            zone: fs.plot.zone,
            constraints: fs.plot.constraints,
        };

        const { error } = await supabase.from('dc_share_links').insert({
            id,
            plot_id: plotId,
            mix_strategy: activeMix,
            plot_input: input,
            overrides: overrides || {},
            created_at: new Date().toISOString(),
            expires_at: expiresAt,
        });

        if (error) {
            toast.error('Failed to generate link');
            return;
        }

        refreshData();
        toast.success('Secure link generated');
    };

    const copyLink = (link: DCShareLink) => {
        navigator.clipboard.writeText(link.url);
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success('Link copied');
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold">Share & Access Control</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold">Generate New Secure Link</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Expiry</label>
                                <select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} className="w-full text-sm rounded-lg bg-muted border px-3 h-9">
                                    <option value={1}>24 Hours</option>
                                    <option value={7}>7 Days</option>
                                    <option value={30}>30 Days</option>
                                    <option value={0}>Permanent</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted border">
                                <span className="text-xs">CAPTCHA</span>
                                <Switch checked={captcha} onCheckedChange={setCaptcha} />
                            </div>
                        </div>
                        <Button onClick={generateLink} className="w-full">Generate Link</Button>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                        <h3 className="text-sm font-bold">Active Links</h3>
                        {links.filter(l => l.isActive).map(l => (
                            <div key={l.id} className="p-3 rounded-lg border bg-muted/50 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="text-xs font-mono truncate">{l.url}</div>
                                    <div className="text-[10px] text-muted-foreground">Created: {new Date(l.createdAt).toLocaleDateString()}</div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => copyLink(l)}>
                                    {copiedId === l.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
