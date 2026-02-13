import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  UserSearch,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

// Location tree data for real estate CRM
const locationTree = [
  { label: 'Dubai', children: ['Downtown Dubai', 'Dubai Marina', 'JBR', 'Business Bay', 'Palm Jumeirah', 'JLT', 'DIFC', 'Dubai Hills'] },
  { label: 'Abu Dhabi', children: ['Al Reem Island', 'Saadiyat Island', 'Yas Island', 'Al Raha Beach', 'Khalifa City'] },
  { label: 'Sharjah', children: ['Al Majaz', 'Al Khan', 'Al Nahda', 'Muwaileh'] },
  { label: 'Other Emirates', children: ['Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'] },
];

export default function LeadGenerationPage() {
  const { data: leads = [], isLoading } = useLeads();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'people' | 'companies'>('people');
  const [nameFilter, setNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Dubai']);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleReset = () => {
    setNameFilter('');
    setLocationFilter('');
    setSelectedLocation('');
    setSearchQuery('');
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold italic text-primary">Lead Generation</h1>
            <p className="text-sm text-muted-foreground">Search for the perfect leads</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
        {/* Left Filter Sidebar */}
        <div className="w-[300px] border-r border-border bg-card p-5 overflow-y-auto shrink-0">
          {/* People / Companies Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-border mb-6">
            <button
              onClick={() => setActiveTab('people')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all',
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
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all',
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
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                <ChevronDown className="w-3.5 h-3.5" />
                Name
              </label>
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Enter Name..."
              className="text-sm"
            />
          </div>

          {/* Location Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                <ChevronDown className="w-3.5 h-3.5" />
                Location
              </label>
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Input
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Enter Location..."
              className="text-sm mb-3"
            />

            {/* Location Tree */}
            <div className="space-y-1">
              {locationTree.map((group) => (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center gap-2 w-full py-2 text-sm hover:text-primary transition-colors"
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
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        selectedLocation === group.label
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/30'
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
                    <div className="ml-7 space-y-0.5">
                      {group.children.map((child) => (
                        <button
                          key={child}
                          onClick={() => setSelectedLocation(selectedLocation === child ? '' : child)}
                          className={cn(
                            'flex items-center gap-2 w-full py-1.5 text-sm transition-colors',
                            selectedLocation === child ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div
                            className={cn(
                              'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                              selectedLocation === child
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/30'
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

        {/* Collapsible sidebar handle */}
        <button className="w-5 bg-muted/30 hover:bg-muted flex items-center justify-center shrink-0 border-r border-border transition-colors">
          <ChevronRight className="w-3 h-3 text-muted-foreground rotate-180" />
        </button>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Search prompt card */}
          <Card className="mb-6">
            <CardContent className="py-8 px-6 text-center">
              <p className="text-lg font-semibold text-foreground mb-4">
                Tell us what you are looking for
              </p>
              <div className="flex items-center gap-3 max-w-2xl mx-auto">
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary/30" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. CEOs in Dubai Marina, Property Investors in Business Bay..."
                    className="pl-8 py-5 text-sm"
                  />
                </div>
                <Button className="bg-primary hover:bg-primary/90 rounded-full px-6 py-5">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto mt-4 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Filters
              </button>
            </CardContent>
          </Card>

          {/* Results or empty state */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : searchQuery || nameFilter || selectedLocation ? (
            filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <UserSearch className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-lg font-semibold text-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-2">{filtered.length} results found</p>
                {filtered.slice(0, 20).map((lead) => (
                  <Card
                    key={lead.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {lead.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone} {lead.email && `· ${lead.email}`}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {lead.area_name || (lead.locations && lead.locations[0]) || ''}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UserSearch className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-lg font-semibold text-foreground">Add filters to search</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use the sidebar to add filters or describe what you're looking for above
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
