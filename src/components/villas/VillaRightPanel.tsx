import { useState, useCallback, useMemo, memo } from 'react';
import { haversineDistance, formatDistance } from '@/lib/geo';
import { Search, MapPin, Compass, CornerDownRight, TreePine, Eye, Hash, Sparkles, X, ChevronDown, ChevronUp, Home, Radar, Loader2, Target, Navigation, Ruler, MapPinned, FileText, ShoppingBag } from 'lucide-react';
import { ReviewLandMatchesModal } from './ReviewLandMatchesModal';
import { propertyIntelligence, parseNaturalLanguageQuery, describeFilters } from '@/services/PropertyIntelligenceService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CommunityVilla, VillaSearchFilters } from '@/hooks/useVillas';
import type { GISSearchResult } from '@/hooks/useVillaGISSearch';
import { normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { resolveVillaClass, VILLA_CLASSES, type VillaClass } from '@/components/villas/VillaMapView';
import { SQFT_TO_SQM, SQM_TO_SQFT } from '@/lib/units';
import type { VillaIntelligence } from '@/hooks/usePropertyIntelligence';
import { hasActiveClassFilter, normalizePlotKey, resolveDisplayedVillaClass } from '@/services/property-intelligence/unit-reference';
import { isVillaWithinSearchRadius, resolveVillaSearchCoordinates, type SearchCenterPoint } from '@/services/property-intelligence/search-radius';

interface VillaRightPanelProps {
  villas: CommunityVilla[];
  selectedVillaId: string | null;
  onSelectVilla: (villaId: string) => void;
  listingCounts: Record<string, number>;
  isLoading: boolean;
  filters: VillaSearchFilters;
  onFiltersChange: (filters: VillaSearchFilters) => void;
  onAISearch: (query: string) => void;
  communities: string[];
  onGISSearch?: (params: { community?: string; plotNumber?: string; googleLocation?: string; radiusMeters?: number }) => void;
  isGISSearching?: boolean;
  gisResults?: GISSearchResult[];
  onClearGIS?: () => void;
  searchCenter?: { lat: number; lng: number } | null;
  matchedVillaIds?: Set<string>;
  searchRadius?: number;
  onSearchRadiusChange?: (radius: number) => void;
  onGoToPlotLocation?: (lat: number, lng: number, plotId: string) => void;
  intelligenceMap?: Map<string, import('@/hooks/usePropertyIntelligence').VillaIntelligence>;
  matchedPlotIds?: Set<string>;
  plotCoordinateLookup?: Map<string, SearchCenterPoint>;
}

export const VillaRightPanel = memo(function VillaRightPanel({
  villas, selectedVillaId, onSelectVilla, listingCounts, isLoading,
  filters, onFiltersChange, onAISearch,
  onGISSearch, isGISSearching, gisResults = [], onClearGIS,
  searchCenter, matchedVillaIds, searchRadius = 1000, onSearchRadiusChange,
  onGoToPlotLocation, intelligenceMap, matchedPlotIds, plotCoordinateLookup,
}: VillaRightPanelProps) {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [showPosition, setShowPosition] = useState(true);
  const [showAmenity, setShowAmenity] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sizeUnit, setSizeUnit] = useState<'sqft' | 'sqm'>('sqft');

  const updateFilter = useCallback(<K extends keyof VillaSearchFilters>(key: K, value: VillaSearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const toggleFilter = useCallback((key: keyof VillaSearchFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  }, [filters, onFiltersChange]);

  const clearAll = useCallback(() => { onFiltersChange({}); setAiQuery(''); onClearGIS?.(); }, [onFiltersChange, onClearGIS]);

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '' && v !== 'all' && v !== false).length;
  const activeSearchRadius = searchRadius;
  const hasClassFilter = hasActiveClassFilter(filters);

  const handleAISearch = () => {
    if (aiQuery.trim()) onAISearch(aiQuery.trim());
  };

  const handleGISSearch = () => {
    if (!onGISSearch) return;
    onGISSearch({
      community: filters.community,
      plotNumber: filters.plotNumber,
      googleLocation: filters.googleLocation,
      radiusMeters: activeSearchRadius,
    });
  };

  const canGISSearch = !!(filters.community || filters.plotNumber || filters.googleLocation);

  // Size conversion helpers
  const convertSize = (sqft: number | undefined): string => {
    if (!sqft) return '';
    if (sizeUnit === 'sqm') return Math.round(sqft * SQFT_TO_SQM).toString();
    return sqft.toString();
  };

  const parseSize = (val: string): number | undefined => {
    if (!val) return undefined;
    const num = parseInt(val);
    if (isNaN(num)) return undefined;
    if (sizeUnit === 'sqm') return Math.round(num * SQM_TO_SQFT);
    return num;
  };

  const formatSizeDisplay = (sqft: number | null | undefined): string => {
    if (!sqft) return '—';
    if (sizeUnit === 'sqm') return `${Math.round(sqft * SQFT_TO_SQM).toLocaleString()}`;
    return sqft.toLocaleString();
  };

  // Ranked villas for results tab
  const rankedVillas = useMemo(() => {
    return villas
      .filter((villa) => isVillaWithinSearchRadius(villa, searchCenter, searchRadius, plotCoordinateLookup))
      .map(villa => {
        const coords = resolveVillaSearchCoordinates(villa, plotCoordinateLookup);
        const distance = searchCenter && coords
          ? haversineDistance(searchCenter.lat, searchCenter.lng, coords.lat, coords.lng)
          : undefined;
      const isMatched = matchedVillaIds?.has(villa.id) ?? false;
      const intel = intelligenceMap?.get(villa.id);
      // Composite score: match status + intel score + proximity bonus
      let matchScore = 0;
      if (isMatched)   matchScore += 1000;           // Matched villas always first
      if (intel)       matchScore += intel.score;     // Intelligence ranking score
      if (distance != null) matchScore -= distance / 50; // Closer = better
      return { villa, distance, isMatched, matchScore, intel };
    })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [villas, searchCenter, searchRadius, matchedVillaIds, intelligenceMap, plotCoordinateLookup]);

  const rankedPlots = useMemo(() => {
    if (hasClassFilter) return [];

    const unique = new Map<string, GISSearchResult>();

    gisResults.forEach((result) => {
      const plotKey = normalizePlotKey(result.plot.id);
      if (!plotKey) return;
      if (matchedPlotIds?.has(plotKey)) return;
      // Exclude plots with zero or missing GFA
      if (!result.plot.gfa || result.plot.gfa <= 0) return;
      const existing = unique.get(plotKey);
      if (!existing || result.confidenceScore > existing.confidenceScore) {
        unique.set(plotKey, result);
      }
    });

    return Array.from(unique.values())
      .map((result) => {
        const coords = normalizeCoordinatesForSearch(result.plot.y, result.plot.x);
        const distance = searchCenter && coords
          ? haversineDistance(searchCenter.lat, searchCenter.lng, coords.lat, coords.lng)
          : undefined;
        if (searchCenter && (!coords || distance == null || distance > searchRadius)) {
          return null;
        }
        return { result, distance };
      })
      .filter((entry): entry is { result: GISSearchResult; distance: number | undefined } => entry !== null)
      .sort((a, b) => {
        if (a.result.confidenceScore !== b.result.confidenceScore) {
          return b.result.confidenceScore - a.result.confidenceScore;
        }
        if (a.distance != null && b.distance != null) {
          return a.distance - b.distance;
        }
        return 0;
      });
  }, [gisResults, hasClassFilter, searchCenter, searchRadius, matchedPlotIds]);

  const handleGoToPlot = useCallback((result: GISSearchResult) => {
    if (!onGoToPlotLocation) return;
    const coords = normalizeCoordinatesForSearch(result.plot.y, result.plot.x);
    if (coords) {
      onGoToPlotLocation(coords.lat, coords.lng, result.plot.id);
      return;
    }
    if (searchCenter) {
      onGoToPlotLocation(searchCenter.lat, searchCenter.lng, result.plot.id);
    }
  }, [onGoToPlotLocation, searchCenter]);

  const totalResultCount = rankedVillas.length + rankedPlots.length;

  return (
    <div className="h-full flex flex-col bg-black border-l border-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-900">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="text-sm font-bold text-gray-100 tracking-tight flex items-center gap-1.5">
              <Home className="h-4 w-4 text-white" />
              Villa Intelligence
            </h2>
            <span className="text-[11px] text-[hsl(220,10%,50%)]">
              {totalResultCount} results • Smart Search
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors flex items-center gap-0.5">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <div className="h-6 min-w-[28px] rounded-md bg-[#BFFF00] text-black flex items-center justify-center text-[11px] font-bold tabular-nums">
              {totalResultCount}
            </div>
          </div>
        </div>

        {/* AI Search */}
        <div className="relative">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#BFFF00]" />
          <Input
            placeholder="e.g. corner Vastu villa near park in Arabian Ranches..."
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAISearch(); }}
            className="pl-8 pr-[72px] h-9 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)] focus:border-[#BFFF00]/40 focus:ring-[#BFFF00]/20"
          />
          <Button size="sm" onClick={handleAISearch} disabled={!aiQuery.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2.5 text-[10px] bg-[#BFFF00]/15 text-[#BFFF00] hover:bg-[#BFFF00]/25 border border-[#BFFF00]/20">
            AI Search
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 bg-[hsl(220,22%,12%)] border border-[hsl(220,20%,16%)] h-8">
          <TabsTrigger value="search" className="text-[11px] h-6 data-[state=active]:bg-[#BFFF00] data-[state=active]:text-black font-semibold text-gray-500">
            <Search className="h-3 w-3 mr-1" /> Filters
          </TabsTrigger>
          <TabsTrigger value="results" className="text-[11px] h-6 data-[state=active]:bg-[#BFFF00] data-[state=active]:text-black font-semibold text-gray-500">
            <MapPin className="h-3 w-3 mr-1" /> Results ({totalResultCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">

              {/* ─── Location & Identification ─── */}
              <div className="space-y-2">
                <SectionLabel icon={MapPin} label="Location & Identification" />

                <div>
                  <FieldLabel>Community / Project</FieldLabel>
                  <Input
                    placeholder="e.g. Arabian Ranches, Damac Hills..."
                    value={filters.community || ''}
                    onChange={e => updateFilter('community', e.target.value || undefined)}
                    onKeyDown={e => { if (e.key === 'Enter') handleGISSearch(); }}
                    className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Plot Number</FieldLabel>
                    <Input
                      placeholder="e.g. 3730170"
                      value={filters.plotNumber || ''}
                      onChange={e => updateFilter('plotNumber', e.target.value || undefined)}
                      onKeyDown={e => { if (e.key === 'Enter') handleGISSearch(); }}
                      className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Villa #</FieldLabel>
                    <Input
                      placeholder="e.g. 245"
                      value={filters.villaNumber || ''}
                      onChange={e => updateFilter('villaNumber', e.target.value || undefined)}
                      className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Google Location</FieldLabel>
                  <Input
                    placeholder="Paste Google Maps link or coordinates"
                    value={filters.googleLocation || ''}
                    onChange={e => updateFilter('googleLocation', e.target.value || undefined)}
                    onKeyDown={e => { if (e.key === 'Enter') handleGISSearch(); }}
                    className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]"
                  />
                </div>

                {/* Search Radius Slider */}
                <div className="p-2.5 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="text-[11px] text-white font-medium">Search Radius</span>
                    </div>
                    <span className="text-[11px] font-bold text-cyan-400 tabular-nums">
                      {activeSearchRadius >= 1000 ? `${(activeSearchRadius / 1000).toFixed(1)}km` : `${activeSearchRadius}m`}
                    </span>
                  </div>
                  <Slider
                    value={[activeSearchRadius]}
                    onValueChange={([v]) => onSearchRadiusChange?.(v)}
                    min={100}
                    max={5000}
                    step={100}
                    className="[&_[role=slider]]:bg-cyan-400 [&_[role=slider]]:border-cyan-500 [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_.relative>div]:bg-cyan-500/40"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[hsl(220,10%,40%)]">100m</span>
                    <span className="text-[9px] text-[hsl(220,10%,40%)]">5km</span>
                  </div>
                </div>

                {/* GIS Search Button */}
                {onGISSearch && (
                  <Button
                    size="sm"
                    onClick={handleGISSearch}
                    disabled={!canGISSearch || isGISSearching}
                    className="w-full h-9 text-xs font-semibold bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20 gap-2"
                  >
                    {isGISSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Radar className="h-3.5 w-3.5" />
                    )}
                    {isGISSearching ? 'Searching GIS/DDA...' : 'Search GIS / DDA API'}
                  </Button>
                )}

                {/* GIS Results Summary removed */}
              </div>

              {/* ─── Villa Identification ─── */}
              <div className="space-y-2">
                <SectionLabel icon={Hash} label="Villa Identification" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Near Villa</FieldLabel>
                    <Input placeholder="e.g. 312" value={filters.nearVilla || ''} onChange={e => updateFilter('nearVilla', e.target.value || undefined)}
                      className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]" />
                  </div>
                  <div>
                    <FieldLabel>Cluster</FieldLabel>
                    <Input placeholder="e.g. Cluster A" value={filters.cluster || ''} onChange={e => updateFilter('cluster', e.target.value || undefined)}
                      className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Odd / Even Numbers</FieldLabel>
                  <Select value={filters.oddEven || 'all'} onValueChange={v => updateFilter('oddEven', v === 'all' ? undefined : v as 'odd' | 'even')}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-[hsl(220,10%,70%)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white">
                      <SelectItem value="all">All Numbers</SelectItem>
                      <SelectItem value="odd">Odd Only</SelectItem>
                      <SelectItem value="even">Even Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ─── Position & Layout ─── */}
              <div>
                <button onClick={() => setShowPosition(!showPosition)} className="flex items-center justify-between w-full mb-2">
                  <SectionLabel icon={CornerDownRight} label="Position & Layout" />
                  {showPosition ? <ChevronUp className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />}
                </button>
                {showPosition && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                      <FilterChip label="Corner" active={!!filters.isCorner} onClick={() => toggleFilter('isCorner')} emoji="◻" />
                      <FilterChip label="End Unit" active={!!filters.isEndUnit} onClick={() => toggleFilter('isEndUnit')} emoji="↔️" />
                      <FilterChip label="Single Row" active={!!filters.isSingleRow} onClick={() => toggleFilter('isSingleRow')} emoji="▬" />
                      <FilterChip label="Back-to-Back" active={!!filters.isBackToBack} onClick={() => toggleFilter('isBackToBack')} emoji="🏘" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <FilterChip label="Backs Park" active={!!filters.backsPark} onClick={() => toggleFilter('backsPark')} emoji="🌳" />
                      <FilterChip label="Backs Road" active={!!filters.backsRoad} onClick={() => toggleFilter('backsRoad')} emoji="🛣" />
                      <FilterChip label="Open View" active={!!filters.backsOpenSpace} onClick={() => toggleFilter('backsOpenSpace')} emoji="🏞️" />
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Vastu ─── */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-orange-400" />
                  <div>
                    <span className="text-[11px] text-white font-medium">Vastu Compliant</span>
                    <span className="text-[9px] text-[hsl(220,10%,45%)] block">East/North facing entrance</span>
                  </div>
                </div>
                <Switch checked={!!filters.vastuCompliant} onCheckedChange={v => updateFilter('vastuCompliant', v || undefined)}
                  className="data-[state=checked]:bg-orange-500" />
              </div>

              {/* ─── Near Amenities ─── */}
              <div>
                <button onClick={() => setShowAmenity(!showAmenity)} className="flex items-center justify-between w-full mb-2">
                  <SectionLabel icon={TreePine} label="Near Amenities" />
                  {showAmenity ? <ChevronUp className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />}
                </button>
                {showAmenity && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <FilterChip label="Pool" active={!!filters.nearPool || filters.nearAmenity?.includes('pool')} onClick={() => toggleFilter('nearPool')} emoji="🏊" />
                      <FilterChip label="School" active={!!filters.nearSchool || filters.nearAmenity?.includes('school')} onClick={() => toggleFilter('nearSchool')} emoji="🏫" />
                      <FilterChip label="Mosque" active={filters.nearAmenity?.includes('mosque') || false} onClick={() => {
                        const arr = filters.nearAmenity || [];
                        updateFilter('nearAmenity', arr.includes('mosque') ? arr.filter(a => a !== 'mosque') : [...arr, 'mosque']);
                      }} emoji="🕌" />
                      <FilterChip label="Mall" active={filters.nearAmenity?.includes('mall') || false} onClick={() => {
                        const arr = filters.nearAmenity || [];
                        updateFilter('nearAmenity', arr.includes('mall') ? arr.filter(a => a !== 'mall') : [...arr, 'mall']);
                      }} emoji="🛍" />
                      <FilterChip label="Healthcare" active={filters.nearAmenity?.includes('healthcare') || false} onClick={() => {
                        const arr = filters.nearAmenity || [];
                        updateFilter('nearAmenity', arr.includes('healthcare') ? arr.filter(a => a !== 'healthcare') : [...arr, 'healthcare']);
                      }} emoji="🏥" />
                      <FilterChip label="Entrance" active={!!filters.nearEntrance} onClick={() => toggleFilter('nearEntrance')} emoji="🚪" />
                    </div>
                    <p className="text-[8px] text-[hsl(220,10%,35%)] px-0.5">
                      💡 Amenity proximity is auto-detected from GIS data. Use AI Search for queries like "villa near park" or "townhouse near pool".
                    </p>
                  </div>
                )}
              </div>

              {/* ─── Listing Status ─── */}
              <div className="space-y-2">
                <SectionLabel icon={Eye} label="Listing Status" />
                <div className="grid grid-cols-3 gap-1.5">
                  <FilterChip label="All" active={!filters.isListed} onClick={() => updateFilter('isListed', undefined)} />
                  <FilterChip label="Listed" active={filters.isListed === true} onClick={() => updateFilter('isListed', true)} />
                  <FilterChip label="Unlisted" active={filters.isListed === false} onClick={() => updateFilter('isListed', false)} />
                </div>
              </div>

              {/* ─── Size & Bedrooms ─── */}
              <div>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-between w-full mb-2">
                  <SectionLabel icon={Ruler} label="Size & Bedrooms" />
                  {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />}
                </button>
                {showAdvanced && (
                  <div className="space-y-2">
                    {/* Unit Toggle */}
                    <div className="flex items-center justify-between p-1.5 rounded-md bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
                      <span className="text-[9px] text-[hsl(220,10%,50%)] uppercase tracking-wider font-medium">Size Unit</span>
                      <div className="flex gap-0.5 bg-[hsl(220,22%,14%)] rounded-md p-0.5">
                        <button
                          onClick={() => setSizeUnit('sqft')}
                          className={cn(
                            'px-2 py-0.5 rounded text-[9px] font-bold transition-colors',
                            sizeUnit === 'sqft'
                              ? 'bg-[hsl(82,84%,45%,0.2)] text-[hsl(82,84%,55%)]'
                              : 'text-[hsl(220,10%,45%)] hover:text-white'
                          )}
                        >
                          SQFT
                        </button>
                        <button
                          onClick={() => setSizeUnit('sqm')}
                          className={cn(
                            'px-2 py-0.5 rounded text-[9px] font-bold transition-colors',
                            sizeUnit === 'sqm'
                              ? 'bg-[hsl(82,84%,45%,0.2)] text-[hsl(82,84%,55%)]'
                              : 'text-[hsl(220,10%,45%)] hover:text-white'
                          )}
                        >
                          SQM
                        </button>
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Bedrooms</FieldLabel>
                      <Select value={filters.bedrooms?.toString() || 'all'} onValueChange={v => updateFilter('bedrooms', v === 'all' ? undefined : parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-[hsl(220,10%,70%)]">
                          <SelectValue placeholder="Bedrooms" />
                        </SelectTrigger>
                        <SelectContent className="bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white">
                          <SelectItem value="all">Any BR</SelectItem>
                          {[2, 3, 4, 5, 6, 7].map(n => <SelectItem key={n} value={n.toString()}>{n} BR</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Min Size ({sizeUnit.toUpperCase()})</FieldLabel>
                        <Input type="number" placeholder="0" value={convertSize(filters.minSize)} onChange={e => updateFilter('minSize', parseSize(e.target.value))}
                          className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white" />
                      </div>
                      <div>
                        <FieldLabel>Max Size ({sizeUnit.toUpperCase()})</FieldLabel>
                        <Input type="number" placeholder="∞" value={convertSize(filters.maxSize)} onChange={e => updateFilter('maxSize', parseSize(e.target.value))}
                          className="h-8 text-xs bg-[hsl(220,22%,12%)] border-[hsl(220,20%,18%)] text-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Active Filters ─── */}
              {activeCount > 0 && (
                <div className="pt-3 border-t border-[hsl(220,20%,14%)]">
                  <span className="text-[9px] text-[hsl(220,10%,45%)] uppercase tracking-wider font-medium">Active Filters</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filters.community && <ActiveBadge label={filters.community} onRemove={() => updateFilter('community', undefined)} />}
                    {filters.plotNumber && <ActiveBadge label={`Plot: ${filters.plotNumber}`} onRemove={() => updateFilter('plotNumber', undefined)} />}
                    {filters.googleLocation && <ActiveBadge label="📍 Location" onRemove={() => updateFilter('googleLocation', undefined)} />}
                    {filters.isCorner && <ActiveBadge label={VILLA_CLASSES.corner.label} onRemove={() => updateFilter('isCorner', undefined)} />}
                    {filters.isEndUnit && <ActiveBadge label={VILLA_CLASSES.end_unit.label} onRemove={() => updateFilter('isEndUnit', undefined)} />}
                    {filters.isSingleRow && <ActiveBadge label={VILLA_CLASSES.single_row.label} onRemove={() => updateFilter('isSingleRow', undefined)} />}
                    {filters.isBackToBack && <ActiveBadge label={VILLA_CLASSES.back_to_back.label} onRemove={() => updateFilter('isBackToBack', undefined)} />}
                    {filters.backsPark && <ActiveBadge label={VILLA_CLASSES.backs_park.label} onRemove={() => updateFilter('backsPark', undefined)} />}
                    {filters.backsRoad && <ActiveBadge label={VILLA_CLASSES.backs_road.label} onRemove={() => updateFilter('backsRoad', undefined)} />}
                    {filters.backsOpenSpace && <ActiveBadge label={VILLA_CLASSES.open_view.label} onRemove={() => updateFilter('backsOpenSpace', undefined)} />}
                    {filters.vastuCompliant && <ActiveBadge label={VILLA_CLASSES.vastu.label} onRemove={() => updateFilter('vastuCompliant', undefined)} />}
                    {filters.nearPool && <ActiveBadge label="Pool" onRemove={() => updateFilter('nearPool', undefined)} />}
                    {filters.nearEntrance && <ActiveBadge label="Entrance" onRemove={() => updateFilter('nearEntrance', undefined)} />}
                    {filters.nearSchool && <ActiveBadge label="School" onRemove={() => updateFilter('nearSchool', undefined)} />}
                    {filters.nearAmenity?.map(amenity => (
                       <ActiveBadge key={amenity} label={`Near ${amenity.charAt(0).toUpperCase() + amenity.slice(1)}`} onRemove={() => {
                         const arr = filters.nearAmenity || [];
                         const remaining = arr.filter(a => a !== amenity);
                         updateFilter('nearAmenity', remaining.length > 0 ? remaining : undefined);
                       }} />
                    ))}
                    {filters.oddEven && <ActiveBadge label={`${filters.oddEven} #`} onRemove={() => updateFilter('oddEven', undefined)} />}
                    {filters.villaNumber && <ActiveBadge label={`Villa #${filters.villaNumber}`} onRemove={() => updateFilter('villaNumber', undefined)} />}
                    {filters.cluster && <ActiveBadge label={filters.cluster} onRemove={() => updateFilter('cluster', undefined)} />}
                    {filters.bedrooms && <ActiveBadge label={`${filters.bedrooms} BR`} onRemove={() => updateFilter('bedrooms', undefined)} />}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="results" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            {/* Unit toggle in results header */}
            <div className="px-3 py-2 border-b border-[hsl(220,20%,14%)] flex items-center justify-between">
              <span className="text-[10px] text-[hsl(220,10%,50%)]">
                {rankedPlots.length > 0
                  ? `${rankedPlots.length} plot matches • ${rankedVillas.length} villas`
                  : `${rankedVillas.length} villas`}
              </span>
              <div className="flex gap-0.5 bg-[hsl(220,22%,14%)] rounded-md p-0.5">
                <button onClick={() => setSizeUnit('sqft')} className={cn('px-2 py-0.5 rounded text-[8px] font-bold transition-colors', sizeUnit === 'sqft' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white')}>SQFT</button>
                <button onClick={() => setSizeUnit('sqm')} className={cn('px-2 py-0.5 rounded text-[8px] font-bold transition-colors', sizeUnit === 'sqm' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white')}>SQM</button>
              </div>
            </div>

            <div className="p-2 space-y-1.5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[92px] rounded-lg bg-[hsl(220,22%,12%)] animate-pulse" />
                ))
              ) : totalResultCount === 0 ? (
                <div className="text-center py-12">
                  <Home className="h-8 w-8 text-[hsl(220,10%,20%)] mx-auto mb-3" />
                  <p className="text-xs text-[hsl(220,10%,45%)] font-medium">No matching results</p>
                  <p className="text-[10px] text-[hsl(220,10%,35%)] mt-1">Adjust search filters or try GIS search</p>
                </div>
              ) : (
                <>
                  {rankedPlots.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {/* Action buttons */}
                      <div className="flex gap-2 px-1 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { onClearGIS?.(); }}
                          className="flex-1 h-9 text-[11px] font-semibold bg-transparent border-gray-700 text-gray-400 hover:bg-white/5 hover:text-white"
                        >
                          New Search
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-9 text-[11px] font-semibold bg-[#BFFF00] hover:bg-[#BFFF00]/90 text-black border-[#BFFF00] gap-1.5"
                          onClick={() => setReviewModalOpen(true)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Review Data ({rankedPlots.length})
                        </Button>
                      </div>

                      {/* Plot cards */}
                      {rankedPlots.map(({ result, distance }) => {
                        const plot = result.plot;
                        const areaName = plot.location || 'Unknown';
                        const zoning = plot.zoning || plot.landUseDetails || '—';
                        const landSizeSqm = plot.area ? Math.round(plot.area * 100) / 100 : 0;
                        const gfa = plot.gfa ?? 0;

                        return (
                          <div
                            key={`plot-${plot.id}`}
                            className="rounded-lg border border-gray-700 bg-gray-950 hover:bg-gray-900 hover:border-gray-600 p-3.5 transition-all"
                          >
                            <div className="flex items-start justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <Checkbox checked className="border-[#BFFF00] data-[state=checked]:bg-[#BFFF00] data-[state=checked]:border-[#BFFF00] data-[state=checked]:text-black h-4 w-4" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[14px] font-bold text-white">Plot {plot.id}</span>
                                    <MapPinned className="h-3.5 w-3.5 text-gray-400" />
                                  </div>
                                  <span className="text-[11px] text-gray-300 uppercase tracking-wide font-medium">{areaName}</span>
                                </div>
                              </div>
                              <span className={cn(
                                'text-[11px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap border',
                                result.confidenceScore >= 90
                                  ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]/40'
                                  : result.confidenceScore >= 70
                                    ? 'bg-[#BFFF00]/10 text-[#BFFF00] border-[#BFFF00]/30'
                                    : 'bg-gray-800 text-gray-300 border-gray-600'
                              )}>
                                {result.confidenceScore}%
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2.5">
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-gray-400 font-medium">Land Size:</span>
                                <span className="text-[12px] text-white font-bold">{landSizeSqm.toLocaleString()} m²</span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-gray-400 font-medium">GFA:</span>
                                <span className="text-[12px] text-white font-bold">{gfa.toLocaleString()} m²</span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-gray-400 font-medium">Zoning:</span>
                                <span className="text-[12px] text-white font-semibold uppercase truncate ml-1">{zoning}</span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-gray-400 font-medium">Status:</span>
                                <span className="text-[12px] text-emerald-400 font-semibold">Available</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 mb-2.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-300 truncate font-medium">{areaName}</span>
                              {distance != null && (
                                <span className="text-[10px] text-[#BFFF00] font-bold ml-auto shrink-0">{formatDistance(distance)}</span>
                              )}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-[11px] font-semibold bg-white text-black border-white hover:bg-white/90"
                              onClick={() => handleGoToPlot(result)}
                            >
                              <MapPinned className="h-3.5 w-3.5 mr-1.5" />
                              Go to Location on Map
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {rankedPlots.length > 0 && rankedVillas.length > 0 && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-[hsl(220,20%,16%)]" />
                      <span className="text-[9px] text-[hsl(220,10%,40%)] uppercase tracking-widest">Villa Results</span>
                      <div className="flex-1 h-px bg-[hsl(220,20%,16%)]" />
                    </div>
                  )}

                  {rankedVillas.map(({ villa, distance, isMatched }) => {
                    const isSelected = villa.id === selectedVillaId;
                    const listings = listingCounts[villa.id] || 0;
                    const intel = intelligenceMap?.get(villa.id);
                    const intelLoaded = (intelligenceMap?.size ?? 0) > 0;
                    const primaryClass = resolveDisplayedVillaClass(villa, intel, intelLoaded, filters);
                    const indicators = intel ? getIndicatorsFromIntel(intel) : getIndicators(villa);
                    const classTags   = indicators.filter(i => !i.label.match(/\d+m\)/));
                    const amenityTags = indicators.filter(i => i.label.match(/\d+m\)/) || i.label.toLowerCase().startsWith('near'));

                    return (
                      <button key={villa.id} onClick={() => onSelectVilla(villa.id)}
                        style={primaryClass && !isSelected ? { borderLeftColor: primaryClass.fill, borderLeftWidth: '3px' } : undefined}
                        className={cn(
                          'w-full text-left rounded-xl p-3 transition-all duration-150 border group',
                          isSelected
                            ? 'bg-[hsl(220,25%,14%)] border-[hsl(82,84%,45%,0.3)] shadow-[0_0_16px_hsl(82,84%,45%,0.06)]'
                            : isMatched
                              ? 'bg-[hsl(190,30%,10%)] border-cyan-500/20 hover:border-cyan-500/30'
                              : 'bg-[hsl(220,22%,10%)] border-[hsl(220,20%,14%)] hover:bg-[hsl(220,22%,12%)] hover:border-[hsl(220,20%,18%)]'
                        )}>
                        {/* Header: villa number + class badge + listing status */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-bold text-white text-[13px] tabular-nums leading-none">
                              {villa.villa_number.startsWith('gis:') ? `Plot ${villa.plot_number}` : `Villa ${villa.villa_number}`}
                            </span>
                            {villa.plot_number && !villa.villa_number.startsWith('gis:') && (
                              <span className="text-[9px] text-[hsl(220,10%,38%)] font-mono">#{villa.plot_number}</span>
                            )}
                            {primaryClass && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-black leading-none shrink-0"
                                style={{ background:`${primaryClass.fill}22`, color:primaryClass.fill, border:`1px solid ${primaryClass.fill}44` }}>
                                {primaryClass.badge} {primaryClass.label}
                              </span>
                            )}
                            {!primaryClass && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-black leading-none shrink-0 bg-[hsl(220,22%,16%)] text-[hsl(220,10%,72%)] border border-[hsl(220,20%,24%)]">
                                Matched Result
                              </span>
                            )}
                            {isMatched && <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-semibold shrink-0">MATCH</span>}
                          </div>
                          {listings > 0 ? (
                            <Badge className="text-[8px] h-[18px] px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                              <Eye className="h-2.5 w-2.5 mr-0.5" />{listings}
                            </Badge>
                          ) : (
                            <Badge className="text-[8px] h-[18px] px-1.5 bg-[hsl(220,20%,15%)] text-[hsl(220,10%,38%)] border-[hsl(220,20%,20%)] shrink-0">Off-mkt</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="h-2.5 w-2.5 text-[hsl(220,10%,38%)] shrink-0" />
                            <span className="text-[10px] text-[hsl(220,10%,52%)] truncate">{villa.community_name}</span>
                            {villa.cluster_name && <span className="text-[9px] text-[hsl(220,10%,38%)] shrink-0">· {villa.cluster_name}</span>}
                          </div>
                          {distance != null && (
                            <span className="text-[9px] text-cyan-400 font-medium flex items-center gap-0.5 shrink-0">
                              <Navigation className="h-2.5 w-2.5" />{formatDistance(distance)}
                            </span>
                          )}
                        </div>
                        {classTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {classTags.slice(0, 4).map((ind, i) => (
                              <span key={i} className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', ind.color)}>
                                {ind.icon} {ind.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {amenityTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {amenityTags.slice(0, 3).map((ind, i) => (
                              <span key={i} className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', ind.color)}>
                                {ind.icon} {ind.label}
                              </span>
                            ))}
                            {amenityTags.length > 3 && <span className="text-[8px] text-[hsl(220,10%,42%)]">+{amenityTags.length-3}</span>}
                          </div>
                        )}
                        {intel && intel.score > 0 && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[8px] text-[hsl(220,10%,38%)]">Score</span>
                            <div className="flex-1 h-1 bg-[hsl(220,20%,16%)] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width:`${Math.min(100,intel.score)}%`, background: primaryClass?.fill ?? '#4ade80' }} />
                            </div>
                            <span className="text-[8px] font-bold tabular-nums" style={{ color: primaryClass?.fill ?? '#4ade80' }}>{intel.score}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-[hsl(220,20%,13%)]">
                          <MiniMetric label={`Plot ${sizeUnit}`} value={formatSizeDisplay(villa.plot_size_sqft)} />
                          <MiniMetric label={`BUA ${sizeUnit}`} value={formatSizeDisplay(villa.built_up_area_sqft)} />
                          <MiniMetric label="BR" value={villa.bedrooms?.toString() || '—'} />
                          <MiniMetric label="Vastu" value={villa.vastu_compliant ? '✓' : '—'} align="right" />
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <ReviewLandMatchesModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        gisResults={gisResults}
      />
    </div>
  );
});

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-[hsl(220,10%,45%)] uppercase tracking-wider font-medium mb-1 block">{children}</label>;
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Search; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-white" />
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FilterChip({ label, active, onClick, emoji }: { label: string; active: boolean; onClick: () => void; emoji?: string }) {
  return (
    <button onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all border',
        active
          ? 'bg-white/10 border-white/30 text-white'
          : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
      )}>
      {emoji && <span className="text-[10px]">{emoji}</span>}
      {label}
    </button>
  );
}

function ActiveBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 h-5 text-[9px] gap-0.5 bg-white/10 text-white border-white/20 hover:bg-white/15 cursor-pointer"
    >
      {label} <X className="h-2.5 w-2.5" />
    </button>
  );
}

function MiniMetric({ label, value, align }: { label: string; value: string; align?: 'right' }) {
  return (
    <div className={cn('flex flex-col', align === 'right' && 'items-end')}>
      <span className="text-[8px] text-[hsl(220,10%,40%)] uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-[hsl(220,10%,70%)] font-medium tabular-nums">{value}</span>
    </div>
  );
}

interface Indicator { label: string; icon: string; color: string; }
function getIndicators(villa: CommunityVilla): Indicator[] {
  const tags = propertyIntelligence.generateBasicTags(villa);
  return tags.map(tag => ({
    label: tag.detail ? `${tag.label} (${tag.detail})` : tag.label,
    icon: tag.emoji,
    color: tag.color,
  }));
}

function getIndicatorsFromIntel(intel: import('@/hooks/usePropertyIntelligence').VillaIntelligence): Indicator[] {
  if (!intel?.tags) return [];
  return intel.tags.map(tag => ({
    label: tag.detail ? `${tag.label} (${tag.detail})` : tag.label,
    icon: tag.emoji,
    color: tag.color,
  }));
}
