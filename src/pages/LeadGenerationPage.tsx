import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Search,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  UserSearch,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  ChevronLeft,
  Shuffle,
  RefreshCw,
  Download,
  CheckCircle2,
  Circle,
  Globe,
} from 'lucide-react';
import xEstateLogo from '@/assets/x-estate-logo.svg';
import { useLeadExportsStore } from '@/store/leadExportsStore';
import { toast } from 'sonner';

// --- DUMMY DATA ---
const dummyPeople = [
  { id: '1', name: 'Joe Anis', title: 'President and CEO, Europe, Middle East and Africa, Gas Power', company: 'GE Vernova', location: 'Dubai, AE', email: '@gmail.com', phone: '624-XXXX', linkedin: true, education: null },
  { id: '2', name: 'Alberto Canteli Suarez', title: 'Chairman and CEO Nordics, CEE, Middle East and Africa', company: 'Havas', location: 'United Arab Emirates', email: '@gmail.com', phone: '', linkedin: true, education: null },
  { id: '3', name: 'Elie Chaillot', title: 'President and CEO | International', company: 'GE HealthCare', location: 'Dubai, AE', email: '@gehealthcare.com', phone: '', linkedin: true, education: null },
  { id: '4', name: 'Tamara Bakir', title: 'Partner', company: 'Driven Properties', location: 'Dubai, AE', email: '@drivenproperties.ae', phone: '324-XXXX', linkedin: true, education: null },
  { id: '5', name: 'Hadi Hamra', title: 'Managing Partner', company: 'Driven Properties', location: 'United Arab Emirates', email: '@drivenproperties.com', phone: '', linkedin: true, education: { school: 'American University of Sharjah', degree: 'Bachelor of Science (B.Sc.), Civil Engineering' } },
  { id: '6', name: 'Emily Wade', title: 'Director of People and Culture', company: 'Driven Properties', location: 'Dubai, AE', email: '@drivenproperties.com', phone: '8848XXXX', linkedin: true, education: null },
  { id: '7', name: 'Jelena Stanković', title: 'Partner', company: 'Driven Properties', location: 'Dubai, AE', email: '@drivenproperties.com', phone: '322 XXXX', linkedin: true, education: null },
  { id: '8', name: 'Fatma Hashim', title: 'Partner', company: 'Driven Properties L.L.C.', location: 'United Arab Emirates', email: '@drivenproperties.ae', phone: '', linkedin: true, education: null },
  { id: '9', name: 'Kelly Robinson', title: 'Senior Property Consultant', company: 'Driven Properties', location: 'Dubai, AE', email: '@drivenproperties.com', phone: '551-XXXX', linkedin: true, education: null },
  { id: '10', name: 'Sarah Al Madani', title: 'CEO', company: 'Refresh Market', location: 'Dubai, AE', email: '@refreshmarket.ae', phone: '500-XXXX', linkedin: true, education: null },
];

const dummyCompanies = [
  { id: 'c1', name: 'Driven Properties', location: 'Dubai, Dubai', selected: false },
  { id: 'c2', name: 'Driven Properties Egypt', location: '', selected: false },
  { id: 'c3', name: 'Driven Properties', location: '', selected: false },
  { id: 'c4', name: 'Driven Properties Spain | Forbes', location: 'Madrid, Community of Madrid', selected: false },
  { id: 'c5', name: 'Driven Properties South Africa', location: '', selected: false },
  { id: 'c6', name: 'Driven Properties India', location: 'Hyderabad, Telangana', selected: false },
  { id: 'c7', name: 'Al Habtoor Real Estate', location: 'Dubai, AE', selected: false },
];

const locationTree = [
  { label: 'US > States', count: 56 },
  { label: 'US > Metro Areas', count: 217 },
  { label: 'CAN > Provinces', count: 13 },
  { label: 'CAN > Metro Areas', count: 34 },
  { label: 'Africa', count: 52 },
  { label: 'Asia', count: 45 },
  { label: 'Europe', count: 42 },
  { label: 'North America', count: 22 },
  { label: 'Oceania', count: 11 },
  { label: 'South America', count: 12 },
  { label: 'Middle East', count: 15 },
];

const industryTree = [
  { label: 'Agriculture & Fishing', count: 6 },
  { label: 'Business Services', count: 28 },
  { label: 'Construction', count: 14 },
  { label: 'Consumer Services', count: 12 },
  { label: 'Education', count: 11 },
  { label: 'Energy, Utilities & Waste Treatment', count: 9 },
  { label: 'Finance', count: 13 },
  { label: 'Government & Public Services', count: 14 },
  { label: 'Healthcare', count: 19 },
  { label: 'Leisure & Hospitality', count: 20 },
  { label: 'Law Firms & Legal Services', count: 2 },
  { label: 'Manufacturing', count: 57 },
  { label: 'Media & Internet', count: 18 },
  { label: 'Metals & Mining', count: 2 },
  { label: 'Organizations', count: 6 },
  { label: 'Real Estate', count: 5 },
  { label: 'Research & Technology', count: 9 },
  { label: 'Retail', count: 21 },
  { label: 'IT & Software', count: 16 },
  { label: 'Telecommunications', count: 3 },
  { label: 'Supply Chain & Logistics', count: 5 },
  { label: 'Transportation', count: 13 },
];

// --- PEOPLE SIDEBAR FILTERS ---
function PeopleSidebar({ filters, setFilters }: { filters: any; setFilters: (f: any) => void }) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  return (
    <>
      {/* Name */}
      <FilterSection label="Name">
        <Input value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} placeholder="Enter Name..." className="text-sm" />
      </FilterSection>

      {/* Location */}
      <FilterSection label="Location">
        <Input value={locationFilter} onChange={e => setLocationFilter(e.target.value)} placeholder="Enter Location..." className="text-sm mb-3" />
        {filters.selectedLocations?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {filters.selectedLocations.map((loc: string) => (
              <span key={loc} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                {loc}
                <button onClick={() => setFilters({ ...filters, selectedLocations: filters.selectedLocations.filter((l: string) => l !== loc) })} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="space-y-0.5">
          {locationTree.filter(l => !locationFilter || l.label.toLowerCase().includes(locationFilter.toLowerCase())).map(loc => (
            <button
              key={loc.label}
              onClick={() => {
                const locs = filters.selectedLocations || [];
                setFilters({ ...filters, selectedLocations: locs.includes(loc.label) ? locs.filter((l: string) => l !== loc.label) : [...locs, loc.label] });
              }}
              className={cn('flex items-center gap-2 w-full py-1.5 text-sm transition-colors', (filters.selectedLocations || []).includes(loc.label) ? 'text-primary bg-primary/5 rounded-lg px-2' : 'text-muted-foreground hover:text-foreground')}
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 shrink-0', (filters.selectedLocations || []).includes(loc.label) ? 'border-primary bg-primary' : 'border-muted-foreground/30')} />
              <span className="flex-1 text-left">{loc.label}</span>
              <span className="text-xs text-muted-foreground">({loc.count})</span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Radius */}
      <FilterSection label="Radius (mi)" defaultClosed>
        <div className="px-1">
          <Slider defaultValue={[0]} max={100} step={5} className="mt-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>
      </FilterSection>

      {/* Job Title */}
      <FilterSection label="Job Title">
        <Input value={filters.jobTitle || ''} onChange={e => setFilters({ ...filters, jobTitle: e.target.value })} placeholder="Enter Job Title..." className="text-sm" />
      </FilterSection>

      {/* Company */}
      <FilterSection label="Company">
        <Input value={filters.company || ''} onChange={e => setFilters({ ...filters, company: e.target.value })} placeholder="Enter Company Name..." className="text-sm" />
      </FilterSection>

      {/* Department */}
      <FilterSection label="Department" defaultClosed />

      {/* Management Levels */}
      <FilterSection label="Management Levels" defaultClosed />

      {/* Enrichment Options */}
      <FilterSection label="Enrichment Options" defaultClosed>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />
            Personal Email
          </label>
        </div>
      </FilterSection>
    </>
  );
}

// --- COMPANIES SIDEBAR FILTERS ---
function CompaniesSidebar({ filters, setFilters }: { filters: any; setFilters: (f: any) => void }) {
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  return (
    <>
      {/* Company Name */}
      <FilterSection label="Company Name">
        <Input value={filters.companyName || ''} onChange={e => setFilters({ ...filters, companyName: e.target.value })} placeholder="Enter Company Name..." className="text-sm" />
        {filters.companyTags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {filters.companyTags.map((tag: string) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                {tag}
                <button onClick={() => setFilters({ ...filters, companyTags: filters.companyTags.filter((t: string) => t !== tag) })} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
      </FilterSection>

      {/* Company Domain */}
      <FilterSection label="Company Domain">
        <Input value={filters.companyDomain || ''} onChange={e => setFilters({ ...filters, companyDomain: e.target.value })} placeholder="Enter Domain (e.g. google.com)..." className="text-sm" />
      </FilterSection>

      {/* Industry */}
      <FilterSection label="Industry">
        <Input value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} placeholder="Enter Industry..." className="text-sm mb-3" />
        <div className="space-y-0.5">
          {industryTree.filter(i => !industryFilter || i.label.toLowerCase().includes(industryFilter.toLowerCase())).map(ind => (
            <button
              key={ind.label}
              onClick={() => {
                const selected = filters.selectedIndustries || [];
                setFilters({ ...filters, selectedIndustries: selected.includes(ind.label) ? selected.filter((i: string) => i !== ind.label) : [...selected, ind.label] });
              }}
              className={cn('flex items-center gap-2 w-full py-1.5 text-sm transition-colors', (filters.selectedIndustries || []).includes(ind.label) ? 'text-primary bg-primary/5 rounded-lg px-2' : 'text-muted-foreground hover:text-foreground')}
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 shrink-0', (filters.selectedIndustries || []).includes(ind.label) ? 'border-primary bg-primary' : 'border-muted-foreground/30')} />
              <span className="flex-1 text-left">{ind.label}</span>
              <span className="text-xs text-muted-foreground">({ind.count})</span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection label="Location">
        <Input value={locationFilter} onChange={e => setLocationFilter(e.target.value)} placeholder="Enter Location..." className="text-sm mb-3" />
        <div className="space-y-0.5">
          {locationTree.filter(l => !locationFilter || l.label.toLowerCase().includes(locationFilter.toLowerCase())).map(loc => (
            <button
              key={loc.label}
              onClick={() => {
                const locs = filters.selectedLocations || [];
                setFilters({ ...filters, selectedLocations: locs.includes(loc.label) ? locs.filter((l: string) => l !== loc.label) : [...locs, loc.label] });
              }}
              className={cn('flex items-center gap-2 w-full py-1.5 text-sm transition-colors', (filters.selectedLocations || []).includes(loc.label) ? 'text-primary bg-primary/5 rounded-lg px-2' : 'text-muted-foreground hover:text-foreground')}
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 shrink-0', (filters.selectedLocations || []).includes(loc.label) ? 'border-primary bg-primary' : 'border-muted-foreground/30')} />
              <span className="flex-1 text-left">{loc.label}</span>
              <span className="text-xs text-muted-foreground">({loc.count})</span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Industry Keywords */}
      <FilterSection label="Industry Keywords" defaultClosed />

      {/* SIC Code */}
      <FilterSection label="SIC Code" defaultClosed />
    </>
  );
}

// --- FILTER SECTION COMPONENT ---
function FilterSection({ label, children, defaultClosed }: { label: string; children?: React.ReactNode; defaultClosed?: boolean }) {
  const [open, setOpen] = useState(!defaultClosed);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-2">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-pointer">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {label}
        </label>
        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && children}
    </div>
  );
}

// --- PERSON CARD ---
function PersonCard({ person, selected, onToggle, expanded, onToggleExpand }: { person: typeof dummyPeople[0]; selected: boolean; onToggle: () => void; expanded: boolean; onToggleExpand: () => void }) {
  return (
    <Card className={cn('transition-shadow', selected && 'ring-2 ring-primary bg-primary/5')}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={onToggle} className="mt-1 shrink-0">
            {selected ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5 text-muted-foreground/30" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{person.name}</span>
              {person.linkedin && <Linkedin className="w-4 h-4 text-[#0A66C2]" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Building2 className="w-3 h-3" />
              <span>{person.title}</span>
              <span className="text-muted-foreground/50">at</span>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> <span className="font-medium">{person.company}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3" />
              <span>{person.location}</span>
            </div>
            {expanded && person.education && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </div>
                <p className="text-xs text-muted-foreground">{person.education.school}</p>
                <p className="text-xs text-muted-foreground">{person.education.degree}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {person.email && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                <Mail className="w-3 h-3" /> {person.email}
              </span>
            )}
            {person.phone && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs rounded-full">
                <Phone className="w-3 h-3" /> {person.phone}
              </span>
            )}
            <button onClick={onToggleExpand} className="text-primary text-xs font-medium hover:underline whitespace-nowrap flex items-center gap-1">
              {expanded ? 'View Less' : 'View More'} {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- COMPANY CARD ---
function CompanyCard({ company, selected, onToggle }: { company: typeof dummyCompanies[0]; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn('w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left', selected ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:bg-muted/50')}
    >
      <div className={cn('w-4 h-4 rounded-full border-2 shrink-0', selected ? 'border-primary bg-primary' : 'border-muted-foreground/30')} />
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{company.name}</p>
        {company.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {company.location}</p>
        )}
      </div>
    </button>
  );
}

// --- MAIN PAGE ---
export default function LeadGenerationPage() {
  const navigate = useNavigate();
  const addExport = useLeadExportsStore((s) => s.addExport);
  const [activeTab, setActiveTab] = useState<'people' | 'companies'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fileName, setFileName] = useState('leads_export');

  // People filters
  const [peopleFilters, setPeopleFilters] = useState<any>({ name: '', selectedLocations: [], jobTitle: '', company: '' });
  // Companies filters
  const [companiesFilters, setCompaniesFilters] = useState<any>({ companyName: '', companyTags: [], companyDomain: '', selectedIndustries: [], selectedLocations: [] });

  // Selection
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Search context (companies → people)
  const [searchingWithinCompanies, setSearchingWithinCompanies] = useState(false);

  const filteredPeople = useMemo(() => {
    if (!hasSearched && !peopleFilters.name && !peopleFilters.jobTitle && !peopleFilters.company && !(peopleFilters.selectedLocations?.length > 0) && !searchQuery) return [];
    return dummyPeople.filter(p => {
      if (peopleFilters.name && !p.name.toLowerCase().includes(peopleFilters.name.toLowerCase())) return false;
      if (peopleFilters.jobTitle && !p.title.toLowerCase().includes(peopleFilters.jobTitle.toLowerCase())) return false;
      if (peopleFilters.company && !p.company.toLowerCase().includes(peopleFilters.company.toLowerCase())) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [hasSearched, peopleFilters, searchQuery]);

  const filteredCompanies = useMemo(() => {
    if (!companiesFilters.companyName && !(companiesFilters.companyTags?.length > 0) && !searchQuery) return [];
    return dummyCompanies.filter(c => {
      if (companiesFilters.companyName && !c.name.toLowerCase().includes(companiesFilters.companyName.toLowerCase())) return false;
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [companiesFilters, searchQuery]);

  const totalResults = activeTab === 'people' ? filteredPeople.length : filteredCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
  const selectedCount = activeTab === 'people' ? selectedPeople.length : selectedCompanies.length;

  const handleSearch = () => setHasSearched(true);
  const handleReset = () => {
    setSearchQuery('');
    setHasSearched(false);
    setPeopleFilters({ name: '', selectedLocations: [], jobTitle: '', company: '' });
    setCompaniesFilters({ companyName: '', companyTags: [], companyDomain: '', selectedIndustries: [], selectedLocations: [] });
    setSelectedPeople([]);
    setSelectedCompanies([]);
    setCurrentPage(1);
  };

  const selectAll = () => {
    if (activeTab === 'people') setSelectedPeople(filteredPeople.map(p => p.id));
    else setSelectedCompanies(filteredCompanies.map(c => c.id));
  };
  const deselectAll = () => {
    if (activeTab === 'people') setSelectedPeople([]);
    else setSelectedCompanies([]);
  };

  const handleSearchEmployees = () => {
    const selectedComps = dummyCompanies.filter(c => selectedCompanies.includes(c.id));
    if (selectedComps.length === 0) return;
    setSearchingWithinCompanies(true);
    setPeopleFilters({ ...peopleFilters, company: selectedComps[0].name });
    setActiveTab('people');
    setHasSearched(true);
  };

  const handleGetContactInfo = () => {
    const selectedItems = activeTab === 'people'
      ? dummyPeople.filter(p => selectedPeople.includes(p.id))
      : [];

    if (selectedItems.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    const exportEntry = {
      id: Date.now().toString(),
      name: fileName || `leads_export_${Date.now()}`,
      date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
      leads: selectedItems.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        jobTitle: p.title,
        company: p.company,
        phone: p.phone || '',
        location: p.location,
        linkedin: !!p.linkedin,
      })),
      hasContact: true,
    };

    addExport(exportEntry);
    toast.success(`${selectedItems.length} leads exported to Leads Exports`);
    setSelectedPeople([]);
    navigate('/all-leads');
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold italic text-primary">Lead Generation</h1>
            <p className="text-sm text-muted-foreground">Search for the perfect leads</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div className="w-[300px] border-r border-border bg-card p-5 overflow-y-auto shrink-0">
            {/* People / Companies Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-border mb-6">
              <button
                onClick={() => { setActiveTab('people'); setCurrentPage(1); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all', activeTab === 'people' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}
              >
                <Users className="w-4 h-4" /> People
              </button>
              <button
                onClick={() => { setActiveTab('companies'); setCurrentPage(1); setSearchingWithinCompanies(false); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all', activeTab === 'companies' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}
              >
                <Building2 className="w-4 h-4" /> Companies
              </button>
            </div>

            {activeTab === 'people' ? (
              <PeopleSidebar filters={peopleFilters} setFilters={setPeopleFilters} />
            ) : (
              <CompaniesSidebar filters={companiesFilters} setFilters={setCompaniesFilters} />
            )}
          </div>
        )}

        {/* Sidebar collapse handle */}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="w-5 bg-muted/30 hover:bg-muted flex items-center justify-center shrink-0 border-r border-border transition-colors">
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
        </button>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 relative">
          {/* Company context banner */}
          {searchingWithinCompanies && activeTab === 'people' && (
            <Card className="mb-4 bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Searching within {selectedCompanies.length} selected companies</span>
                <Button variant="ghost" size="sm" onClick={() => { setSearchingWithinCompanies(false); setPeopleFilters({ ...peopleFilters, company: '' }); }}>Clear Companies</Button>
              </CardContent>
            </Card>
          )}

          {/* Search bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary/30" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={activeTab === 'people' ? 'e.g. CEOs in San Francisco, Marketing Directors in SaaS...' : 'Describe what companies you\'re looking for...'}
                className="pl-8 py-5 text-sm"
              />
            </div>
            <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90 rounded-full px-6 py-5">
              <Search className="w-4 h-4 mr-2" /> Search
            </Button>
            <Button variant="outline" onClick={handleReset} className="rounded-full px-4 py-5">
              <RotateCcw className="w-4 h-4 mr-2" /> Reset Filters
            </Button>
          </div>

          {/* Results header */}
          {totalResults > 0 && (
            <Card className="mb-4 bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeTab === 'people' ? <Users className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
                  <span className="font-bold text-foreground">Showing {totalResults.toLocaleString()} {activeTab === 'people' ? 'results' : 'companies'}</span>
                  {activeTab === 'people' && (
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Shuffle className="w-3.5 h-3.5" /> Shuffled
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">{selectedCount} selected</span>
                  {activeTab === 'people' && (
                    <Button variant="outline" size="sm" onClick={() => { setHasSearched(false); setSearchQuery(''); }}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Search
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company tab: helper banner */}
          {activeTab === 'companies' && filteredCompanies.length > 0 && (
            <Card className="mb-4 bg-primary text-primary-foreground border-primary">
              <CardContent className="py-3 px-4 text-center text-sm">
                Select the companies you want, click "Search Employees", then use people filters to find the exact match
              </CardContent>
            </Card>
          )}

          {/* Companies: filter + Select All + Search Employees */}
          {activeTab === 'companies' && filteredCompanies.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Companies Found ({filteredCompanies.length} total) <span className="text-muted-foreground font-normal ml-2">{selectedCompanies.length} selected</span></span>
              <Button onClick={handleSearchEmployees} className="bg-primary hover:bg-primary/90 rounded-full" disabled={selectedCompanies.length === 0}>
                <Users className="w-4 h-4 mr-1" /> Search Employees ({selectedCompanies.length})
              </Button>
            </div>
          )}

          {/* Pagination */}
          {totalResults > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Deselect</Button>
              </div>
            </div>
          )}

          {/* Results list */}
          {activeTab === 'people' ? (
            filteredPeople.length > 0 ? (
              <div className="space-y-3">
                {filteredPeople.slice((currentPage - 1) * perPage, currentPage * perPage).map(person => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    selected={selectedPeople.includes(person.id)}
                    onToggle={() => setSelectedPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}
                    expanded={expandedPerson === person.id}
                    onToggleExpand={() => setExpandedPerson(prev => prev === person.id ? null : person.id)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <img src={xEstateLogo} alt="X-Estate" className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-semibold text-foreground">
                    {hasSearched ? 'No results found' : 'Tell us what you are looking for'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasSearched ? 'Try adjusting your filters or search query' : 'Use the sidebar to add filters or describe what you\'re looking for above'}
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            filteredCompanies.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Input placeholder="Filter companies..." className="max-w-sm text-sm" />
                  <button onClick={selectAll} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><CheckCircle2 className="w-4 h-4" /> Select All</button>
                </div>
                {filteredCompanies.map(company => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    selected={selectedCompanies.includes(company.id)}
                    onToggle={() => setSelectedCompanies(prev => prev.includes(company.id) ? prev.filter(id => id !== company.id) : [...prev, company.id])}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Building2 className="w-12 h-12 text-muted-foreground/20 mb-3" />
                  <p className="text-lg font-semibold text-foreground">Add filters to search companies</p>
                  <p className="text-sm text-muted-foreground mt-1">Use the sidebar to add company filters or describe what you're looking for above</p>
                </CardContent>
              </Card>
            )
          )}

          {/* Bottom sticky bar - Get Contact Info / Export CSV */}
          {selectedCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
              <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  {selectedCount} leads selected
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">File name:</span>
                  <Input value={fileName} onChange={e => setFileName(e.target.value)} className="w-40 text-sm" />
                  <Button onClick={handleGetContactInfo} className="bg-primary hover:bg-primary/90 rounded-full px-6">
                    <UserSearch className="w-4 h-4 mr-2" /> Get Contact Info
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
