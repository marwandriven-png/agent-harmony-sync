import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeads, useCreateLead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { CreateLeadDialog } from '@/components/forms/CreateLeadDialog';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  RotateCcw,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  Shuffle,
  ChevronLeft,
  Filter,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadType = Database['public']['Enums']['lead_type'];

// Location tree data for real estate CRM
const locationTree = [
  {
    label: 'Dubai',
    children: ['Downtown Dubai', 'Dubai Marina', 'JBR', 'Business Bay', 'Palm Jumeirah', 'JLT', 'DIFC', 'Dubai Hills'],
  },
  {
    label: 'Abu Dhabi',
    children: ['Al Reem Island', 'Saadiyat Island', 'Yas Island', 'Al Raha Beach', 'Khalifa City'],
  },
  {
    label: 'Sharjah',
    children: ['Al Majaz', 'Al Khan', 'Al Nahda', 'Muwaileh'],
  },
  {
    label: 'Other Emirates',
    children: ['Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
  },
];

const ITEMS_PER_PAGE = 50;

export default function LeadGenerationPage() {
  const { data: leads = [], isLoading } = useLeads();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'people' | 'companies'>('people');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Dubai']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesName = !nameFilter || l.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesLocation =
        !selectedLocation ||
        l.area_name?.toLowerCase().includes(selectedLocation.toLowerCase()) ||
        l.locations?.some((loc) => loc.toLowerCase().includes(selectedLocation.toLowerCase()));
      const matchesSearch =
        !searchQuery ||
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone.includes(searchQuery) ||
        l.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab =
        activeTab === 'people'
          ? l.lead_type === 'buyer' || l.lead_type === 'tenant' || !l.lead_type
          : l.lead_type === 'landlord';
      return matchesName && matchesLocation && matchesSearch && matchesTab;
    });
  }, [leads, nameFilter, selectedLocation, searchQuery, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedLeads = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSelect = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const ids = paginatedLeads.map((l) => l.id);
    setSelectedLeadIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleDeselectAll = () => {
    setSelectedLeadIds([]);
  };

  const handleReset = () => {
    setNameFilter('');
    setSelectedLocation('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      {/* Purple-tinted header */}
      <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Lead Generation</h1>
              <p className="text-sm text-muted-foreground">Search for the perfect leads</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CreateLeadDialog
              trigger={
                <Button className="bg-primary hover:bg-primary/90">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Filter Sidebar */}
        <div className="w-[280px] border-r border-border bg-card p-4 overflow-y-auto shrink-0">
          {/* People / Companies Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border mb-6">
            <button
              onClick={() => setActiveTab('people')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
                activeTab === 'people'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
                activeTab === 'companies'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <Building2 className="w-4 h-4" />
              Companies
            </button>
          </div>

          {/* Name Filter */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground">Name</label>
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Enter Name..."
              className="text-sm"
            />
          </div>

          {/* Location Tree */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground">Location</label>
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {selectedLocation && (
              <div className="mb-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedLocation}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={() => setSelectedLocation('')}
                  >
                    ×
                  </button>
                </Badge>
              </div>
            )}
            <div className="space-y-0.5">
              {locationTree.map((group) => (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center gap-2 w-full py-1.5 text-sm hover:text-primary transition-colors"
                  >
                    {expandedGroups.includes(group.label) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLocation(selectedLocation === group.label ? '' : group.label);
                      }}
                      className={cn(
                        'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                        selectedLocation === group.label
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {selectedLocation === group.label && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </button>
                    <span className={cn(
                      'font-medium',
                      selectedLocation === group.label ? 'text-primary' : 'text-foreground'
                    )}>
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({group.children.length})
                    </span>
                  </button>
                  {expandedGroups.includes(group.label) && (
                    <div className="ml-6 space-y-0.5">
                      {group.children.map((child) => (
                        <button
                          key={child}
                          onClick={() => setSelectedLocation(selectedLocation === child ? '' : child)}
                          className={cn(
                            'flex items-center gap-2 w-full py-1 text-sm transition-colors',
                            selectedLocation === child ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                              selectedLocation === child
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/40'
                            )}
                          >
                            {selectedLocation === child && (
                              <div className="w-1 h-1 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                          {child}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Results Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Showing {filtered.length} results
              </span>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Shuffle className="w-3 h-3" />
                Shuffled
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{selectedLeadIds.length} selected</span>
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                New Search
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Describe what you're looking for..."
                className="pl-10"
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Pagination & Actions */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Deselect
              </Button>
            </div>
          </div>

          {/* Results Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : paginatedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="w-14 h-14 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No leads found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className={cn(
                    'cursor-pointer hover:shadow-card-hover transition-all border',
                    selectedLeadIds.includes(lead.id) && 'ring-2 ring-primary border-primary'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                        className="mt-1"
                      />
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                            {lead.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{lead.name}</p>
                            {lead.lead_type && (
                              <Badge variant="outline" className="text-[10px] capitalize">{lead.lead_type}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </span>
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[140px]">{lead.email}</span>
                            </span>
                          )}
                          {(lead.area_name || (lead.locations && lead.locations[0])) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lead.area_name || lead.locations?.[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'text-[10px] shrink-0',
                          lead.priority === 'hot' && 'bg-destructive/10 text-destructive border-destructive/20',
                          lead.priority === 'warm' && 'bg-warning/10 text-warning border-warning/20',
                          lead.priority === 'cold' && 'bg-primary/10 text-primary border-primary/20'
                        )}
                        variant="outline"
                      >
                        {lead.priority}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
