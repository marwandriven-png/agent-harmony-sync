import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeads, LeadWithProfile } from '@/hooks/useLeads';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateLeadDialog } from '@/components/forms/CreateLeadDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Flame,
  Thermometer,
  Snowflake,
  ArrowUpDown,
  Users,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadPriority = Database['public']['Enums']['lead_priority'];
type LeadSource = Database['public']['Enums']['lead_source'];

const statusBadgeClass: Record<string, string> = {
  new: 'status-badge-new',
  contacted: 'status-badge-contacted',
  viewing: 'status-badge-viewing',
  viewed: 'status-badge-viewed',
  negotiation: 'status-badge-negotiation',
  closed: 'status-badge-closed',
  lost: 'status-badge-lost',
};

const priorityConfig: Record<LeadPriority, { icon: React.ElementType; color: string }> = {
  hot: { icon: Flame, color: 'text-priority-hot' },
  warm: { icon: Thermometer, color: 'text-priority-warm' },
  cold: { icon: Snowflake, color: 'text-priority-cold' },
};

type SortKey = 'name' | 'status' | 'priority' | 'created_at' | 'budget_max';

export default function AllLeadsPage() {
  const { data: leads = [], isLoading } = useLeads();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search) ||
        (l.email?.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || l.priority === filterPriority;
      const matchesSource = filterSource === 'all' || l.source === filterSource;
      return matchesSearch && matchesStatus && matchesPriority && matchesSource;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'priority': cmp = a.priority.localeCompare(b.priority); break;
        case 'budget_max': cmp = (a.budget_max || 0) - (b.budget_max || 0); break;
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [leads, search, filterStatus, filterPriority, filterSource, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const uniqueSources = useMemo(() => {
    const sources = new Set(leads.map((l) => l.source));
    return Array.from(sources);
  }, [leads]);

  return (
    <MainLayout>
      <PageHeader
        title="All Leads"
        subtitle={`${filtered.length} of ${leads.length} leads`}
        actions={
          <CreateLeadDialog
            trigger={
              <Button className="bg-gradient-primary hover:opacity-90">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            }
          />
        }
      />

      <PageContent>
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['new', 'contacted', 'viewing', 'viewed', 'negotiation', 'closed', 'lost'].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No leads found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <SortableHead label="Name" sortKey="name" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                    <TableHead>Contact</TableHead>
                    <SortableHead label="Status" sortKey="status" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortableHead label="Priority" sortKey="priority" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                    <TableHead>Source</TableHead>
                    <SortableHead label="Budget" sortKey="budget_max" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                    <TableHead>Agent</TableHead>
                    <TableHead>Location</TableHead>
                    <SortableHead label="Created" sortKey="created_at" currentKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <LeadTableRow key={lead.id} lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageContent>
    </MainLayout>
  );
}

function SortableHead({
  label, sortKey, currentKey, asc, onSort,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn('w-3 h-3', currentKey === sortKey ? 'text-primary' : 'text-muted-foreground/50')} />
      </span>
    </TableHead>
  );
}

function LeadTableRow({ lead, onClick }: { lead: LeadWithProfile; onClick: () => void }) {
  const PriorityIcon = priorityConfig[lead.priority].icon;
  const currency = lead.budget_currency || 'AED';

  return (
    <TableRow className="premium-table-row" onClick={onClick}>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {lead.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-foreground">{lead.name}</p>
            {(lead as any).lead_type && (
              <Badge variant="outline" className="text-[10px] capitalize">{(lead as any).lead_type}</Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </div>
          {lead.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{lead.email}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className={cn('status-badge capitalize', statusBadgeClass[lead.status])}>
          {lead.status}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <PriorityIcon className={cn('w-4 h-4', priorityConfig[lead.priority].color)} />
          <span className="text-sm capitalize">{lead.priority}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground capitalize">{lead.source.replace(/_/g, ' ')}</span>
      </TableCell>
      <TableCell>
        {lead.budget_max ? (
          <span className="text-sm font-medium text-foreground">
            {formatCurrency(lead.budget_max, currency)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {lead.profiles?.full_name?.split(' ')[0] || 'Unassigned'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span className="truncate max-w-[120px]">
            {(lead as any).area_name || (lead.locations && lead.locations[0]) || '—'}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(lead.created_at)}</span>
      </TableCell>
    </TableRow>
  );
}
