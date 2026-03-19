import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, Target, Plus, Loader2, Map, Satellite, Home, Building2 } from 'lucide-react';
import proj4 from 'proj4';
import { MainLayout } from '@/components/layout/MainLayout';
import { LandMatchingWizard } from '@/components/plots/LandMatchingWizard';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LandOSMapView } from '@/components/plots/LandOSMapView';
import { PlotCardSidebar } from '@/components/plots/PlotCardSidebar';
import { PlotOffersDialog, PlotInterestedDialog } from '@/components/plots/PlotDialogs';
import { CreatePlotDialog } from '@/components/plots/CreatePlotDialog';
import { PlotDetailPanel } from '@/components/plots/PlotDetailPanel';
import { MapOverlayHUD } from '@/components/plots/MapOverlayHUD';
import { VillaMapView } from '@/components/villas/VillaMapView';
import { VillaRightPanel } from '@/components/villas/VillaRightPanel';
import { VillaDetailPanel } from '@/components/villas/VillaDetailPanel';
import {
  usePlots, useDeletePlot, useRunFeasibility, type Plot,
} from '@/hooks/usePlots';
import { useVillas, useCommunities, useVillaListingCounts, useVillasByIds, type VillaSearchFilters } from '@/hooks/useVillas';
import { useVillaGISSearch } from '@/hooks/useVillaGISSearch';
import type { PlotData } from '@/services/DDAGISService';
import { parseNaturalLanguageQuery } from '@/services/PropertyIntelligenceService';
import { usePropertyIntelligence } from '@/hooks/usePropertyIntelligence';
import { MOCK_COMMUNITIES, convertMockCommunityToPlots } from '@/data/mock/communities';
import { cn } from '@/lib/utils';

type LandOSView = 'map' | 'villas';

const SQM_TO_SQFT = 10.7639;
const GIS_PLOT_ID_PREFIX = 'gis:';

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

function toWgs84FromDda(x: number, y: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const isUaeBounds = (lat: number, lng: number) => lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57;

  // Already in WGS84
  if (Math.abs(y) <= 90 && Math.abs(x) <= 180) {
    return isUaeBounds(y, x) ? { lat: y, lng: x } : null;
  }

  // DDA projected CRS (EPSG:3997)
  try {
    const [lng, lat] = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && isUaeBounds(lat, lng)) {
      return { lat, lng };
    }
  } catch (error) {
    console.warn('Failed to convert DDA coordinates:', { x, y, error });
  }

  return null;
}

function normalizePlotStatus(status?: string | null): string {
  const normalized = (status || 'available').toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('negotiation')) return 'under_negotiation';
  if (['available', 'under_negotiation', 'sold', 'reserved', 'pending'].includes(normalized)) return normalized;
  return 'available';
}

function mapGisPlotToSidebarPlot(plot: PlotData): Plot {
  return {
    id: `${GIS_PLOT_ID_PREFIX}${plot.id}`,
    plot_number: plot.id,
    area_name: plot.location || 'Dubai',
    master_plan: plot.project || null,
    plot_size: Math.round((plot.area || 0) * SQM_TO_SQFT),
    gfa: plot.gfa ? Math.round(plot.gfa * SQM_TO_SQFT) : null,
    floors_allowed: plot.floors ? (parseInt(plot.floors.replace(/[^0-9]/g, ''), 10) || null) : null,
    zoning: plot.zoning || null,
    status: normalizePlotStatus(plot.status),
    pdf_source_link: null, notes: null, price: null, price_per_sqft: null,
    owner_name: null, owner_mobile: null,
    location_coordinates: (() => {
      const coords = toWgs84FromDda(plot.x, plot.y);
      console.log('[GIS→WGS84]', { x: plot.x, y: plot.y, result: coords });
      return coords ? { lng: coords.lng, lat: coords.lat } : null;
    })(),
    google_sheet_row_id: null, created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default function PlotsPage() {
  const { data: plots = [], isLoading, refetch } = usePlots();
  const deletePlot = useDeletePlot();

  // Plot state
  const [activeView, setActiveView] = useState<LandOSView>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoningFilter, setZoningFilter] = useState('all');
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [gisSearchPlot, setGisSearchPlot] = useState<Plot | null>(null);
  const [isGisSearching, setIsGisSearching] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [detailPlot, setDetailPlot] = useState<Plot | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [interestedOpen, setInterestedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Villa state
  const [villaFilters, setVillaFilters] = useState<VillaSearchFilters>({});
  const [selectedVillaId, setSelectedVillaId] = useState<string | null>(null);
  const [villaSearchRadius, setVillaSearchRadius] = useState(1000);
  const [villaManualCenter, setVillaManualCenter] = useState<{ lat: number; lng: number } | null>(null);
  const { data: villas = [], isLoading: villasLoading, refetch: refetchVillas } = useVillas(villaFilters);
  const { data: communities = [] } = useCommunities();
  const { gisResults, gisVillaIds, isSearching: isVillaGISSearching, searchGIS: searchVillaGIS, clearGISResults: clearVillaGIS, resolvedCenter } = useVillaGISSearch();
  const { data: gisMatchedVillas = [] } = useVillasByIds(gisVillaIds);
  
  // Property Intelligence Layer logic
  // Merge GIS results with any selected mock community plots for richer PI detection
  const [selectedMockCommunityId, setSelectedMockCommunityId] = useState<string>('');

  const mockCommunityPlots = useMemo<PlotData[]>(() => {
    if (!selectedMockCommunityId) return [];
    const community = MOCK_COMMUNITIES[selectedMockCommunityId];
    return community ? convertMockCommunityToPlots(community) : [];
  }, [selectedMockCommunityId]);

  const nearbyPlots = useMemo<PlotData[]>(() => {
    const gisPlots = gisResults.map(r => r.plot);
    if (mockCommunityPlots.length === 0) return gisPlots;
    // Merge, preferring real GIS plots where IDs collide
    const ids = new Set(gisPlots.map(p => p.id));
    return [...gisPlots, ...mockCommunityPlots.filter(p => !ids.has(p.id))];
  }, [gisResults, mockCommunityPlots]);

  const { intelligenceMap, allAmenities, isProcessing: piIsProcessing } = usePropertyIntelligence(villas, nearbyPlots);

  // When a mock community is selected: clear stale filters and load that community's villas
  const handleMockCommunityChange = useCallback((communityId: string) => {
    setSelectedMockCommunityId(communityId);
    if (communityId) {
      const community = MOCK_COMMUNITIES[communityId];
      if (community) {
        // Reset filters to just this community — clears any stale Single Row / Vastu / Plot filters
        setVillaFilters({ community: community.name });
        // Center map on this community
        setVillaManualCenter({ lat: community.centerLat, lng: community.centerLng });
        // Trigger GIS radius search centered on community
        searchVillaGIS({
          googleLocation: `${community.centerLat}, ${community.centerLng}`,
          radiusMeters: 2000,
        });
      }
    } else {
      // Cleared — reset everything
      setVillaFilters({});
      setVillaManualCenter(null);
    }
  }, [searchVillaGIS]);

  const villaSearchCenter = villaManualCenter || resolvedCenter;

  // Client-side filter function for GIS-matched villas (apply active filters)
  const applyVillaFilters = useCallback((villa: typeof villas[0]): boolean => {
    const intel = intelligenceMap.get(villa.id);
    // If PI intelligence is still loading (intel undefined) and a PI-only filter
    // is active, let the villa pass — we apply the filter only when we have data.
    const piReady = intel !== undefined;

    if (villaFilters.bedrooms && villa.bedrooms !== villaFilters.bedrooms) return false;
    if (villaFilters.minSize && (villa.plot_size_sqft ?? 0) < villaFilters.minSize) return false;
    if (villaFilters.maxSize && (villa.plot_size_sqft ?? 0) > villaFilters.maxSize) return false;

    // Layout match: pass villa through while PI not loaded yet; enforce once ready
    if (villaFilters.isCorner) {
      if (!villa.is_corner && piReady && intel.layout.positionType !== 'corner') return false;
    }
    if (villaFilters.isSingleRow) {
      if (!villa.is_single_row && piReady && intel.layout.layoutType !== 'single_row') return false;
    }
    if (villaFilters.isBackToBack) {
      if (piReady && intel.layout.layoutType !== 'back_to_back') return false;
    }
    if (villaFilters.isEndUnit) {
      if (villa.position_type !== 'end' && piReady && intel.layout.positionType !== 'end') return false;
    }
    if (villaFilters.backsPark) {
      if (!villa.backs_park && piReady && intel.layout.backFacing !== 'park') return false;
    }
    if (villaFilters.backsRoad) {
      if (!villa.backs_road && piReady && intel.layout.backFacing !== 'road') return false;
    }
    if (villaFilters.backsOpenSpace) {
      if (piReady && intel.layout.backFacing !== 'open_space') return false;
    }

    // Amenity match
    if (villaFilters.nearPool) {
      if (!villa.near_pool && piReady && !intel.amenities.some(a => a.type === 'pool' && a.distanceMeters <= 220)) return false;
    }
    if (villaFilters.nearEntrance) {
      if (!villa.near_entrance && piReady && !intel.amenities.some(a => (a.type === 'community_center' || a.name.toLowerCase().includes('gate') || a.name.toLowerCase().includes('entrance')) && a.distanceMeters <= 160)) return false;
    }
    if (villaFilters.nearSchool) {
      if (!villa.near_school && piReady && !intel.amenities.some(a => a.type === 'school' && a.distanceMeters <= 500)) return false;
    }

    // Vastu match
    if (villaFilters.vastuCompliant) {
      if (!villa.vastu_compliant && piReady && !intel.tags.some(t => t.label.includes('Vastu ✓') || t.label.includes('Vastu Compliant'))) return false;
    }

    // PI Amenity proximity search ("Villa near mall")
    if (villaFilters.nearAmenity && villaFilters.nearAmenity.length > 0) {
       if (!piReady) {
         // Don't filter out while PI is still computing amenity proximities
       } else {
         const amenitiesRequired = villaFilters.nearAmenity;
         const maxDist = villaFilters.maxDistance || 500;
         const hasAll = amenitiesRequired.every(reqType =>
           intel.amenities.some(a => a.type === reqType && a.distanceMeters <= maxDist)
         );
         if (!hasAll) return false;
       }
    }

    if (villaFilters.oddEven === 'odd') { const n = parseInt(villa.villa_number, 10); if (!isNaN(n) && n % 2 === 0) return false; }
    if (villaFilters.oddEven === 'even') { const n = parseInt(villa.villa_number, 10); if (!isNaN(n) && n % 2 !== 0) return false; }
    if (villaFilters.cluster && !(villa.cluster_name?.toLowerCase().includes(villaFilters.cluster.toLowerCase()))) return false;
    return true;
  }, [villaFilters, intelligenceMap]);

  // Filter GIS-matched villas through active filters before marking as "matched"
  const filteredGisMatchedVillas = useMemo(() => gisMatchedVillas.filter(applyVillaFilters), [gisMatchedVillas, applyVillaFilters]);
  const matchedVillaIds = useMemo(() => new Set(filteredGisMatchedVillas.map(v => v.id)), [filteredGisMatchedVillas]);
  const filteredVillas = useMemo(() => villas.filter(applyVillaFilters), [villas, applyVillaFilters]);

  const mergedVillas = useMemo(() => {
    const matchedSet = matchedVillaIds;
    // GIS-matched that pass filters come first, then DB results (deduped)
    const ordered = [
      ...filteredGisMatchedVillas,
      ...filteredVillas.filter(v => !matchedSet.has(v.id)),
    ];

    const seen = new Set<string>();
    return ordered.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [filteredVillas, filteredGisMatchedVillas, matchedVillaIds]);

  const villaIds = useMemo(() => mergedVillas.map(v => v.id), [mergedVillas]);
  const { data: listingCounts = {} } = useVillaListingCounts(villaIds);

  const isVillaMode = activeView === 'villas';

  // Plot logic
  const allSearchablePlots = useMemo(() => {
    if (!gisSearchPlot) return plots;
    const exists = plots.some(p => p.plot_number === gisSearchPlot.plot_number);
    return exists ? plots : [gisSearchPlot, ...plots];
  }, [plots, gisSearchPlot]);

  const filteredPlots = useMemo(() => allSearchablePlots.filter(plot => {
    const matchesSearch = plot.plot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plot.area_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plot.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || plot.status === statusFilter;
    const matchesZoning = zoningFilter === 'all' || plot.zoning === zoningFilter;
    return matchesSearch && matchesStatus && matchesZoning;
  }), [allSearchablePlots, searchQuery, statusFilter, zoningFilter]);

  const handleSelectPlot = useCallback((plotId: string) => {
    setSelectedPlotId(prev => {
      const newId = prev === plotId ? null : plotId;
      if (newId) {
        const plot = allSearchablePlots.find(p => p.id === newId);
        if (plot) setDetailPlot(plot);
      } else setDetailPlot(null);
      return newId;
    });
  }, [allSearchablePlots]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q.trim()) setGisSearchPlot(null);
  }, []);

  const handleSidebarSearchSubmit = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) { setGisSearchPlot(null); return; }
    const localMatch = plots.find(p => p.plot_number.toLowerCase() === query.toLowerCase() || p.id.toLowerCase() === query.toLowerCase());
    if (localMatch) { setGisSearchPlot(null); setSelectedPlotId(localMatch.id); setDetailPlot(localMatch); return; }
    if (!/^\d{4,}$/.test(query)) return;
    setIsGisSearching(true);
    try {
      const { gisService } = await import('@/services/DDAGISService');
      const remotePlot = await gisService.fetchPlotById(query);
      if (!remotePlot) return;
      const mapped = mapGisPlotToSidebarPlot(remotePlot);
      setGisSearchPlot(mapped); setSelectedPlotId(mapped.id); setDetailPlot(mapped);
    } finally { setIsGisSearching(false); }
  }, [plots]);

  const handleWizardHighlightPlots = useCallback((ids: string[]) => {
    if (ids.length === 1) { setSearchQuery(ids[0]); void handleSidebarSearchSubmit(ids[0]); return; }
    if (ids.length === 0) { setSearchQuery(''); setGisSearchPlot(null); }
  }, [handleSidebarSearchSubmit]);

  const handleWizardSelectPlot = useCallback((plot: PlotData) => {
    setWizardOpen(false); setSearchQuery(plot.id); void handleSidebarSearchSubmit(plot.id);
  }, [handleSidebarSearchSubmit]);

  const handleEdit = (plot: Plot) => { if (!plot.id.startsWith(GIS_PLOT_ID_PREFIX)) console.log('Edit:', plot); };
  const handleDelete = (plot: Plot) => { if (plot.id.startsWith(GIS_PLOT_ID_PREFIX)) return; setSelectedPlot(plot); setDeleteOpen(true); };
  const handleConfirmDelete = async () => { if (selectedPlot) { await deletePlot.mutateAsync(selectedPlot.id); setDeleteOpen(false); setSelectedPlot(null); } };
  const handleList = (plot: Plot) => { if (!plot.id.startsWith(GIS_PLOT_ID_PREFIX)) console.log('List:', plot); };

  // Villa logic
  const handleSelectVilla = useCallback((villaId: string) => {
    setSelectedVillaId(prev => prev === villaId ? null : villaId);
  }, []);

  const handleAISearch = useCallback((query: string) => {
    const q = query.toLowerCase();
    const raw = query.trim();
    
    // Parse using Property Intelligence NLP
    const piFilters = parseNaturalLanguageQuery(raw);
    
    // Default filters mapped from PI
    const newFilters: VillaSearchFilters = {};
    if (piFilters.layoutType === 'single_row') newFilters.isSingleRow = true;
    if (piFilters.layoutType === 'back_to_back') newFilters.isBackToBack = true;
    if (piFilters.position === 'corner') newFilters.isCorner = true;
    if (piFilters.position === 'end') newFilters.isEndUnit = true;
    if (piFilters.vastuCompliant) newFilters.vastuCompliant = true;
    if (piFilters.backFacing === 'road') newFilters.backsRoad = true;
    if (piFilters.backFacing === 'park') newFilters.backsPark = true;
    if (piFilters.backFacing === 'open_space') newFilters.backsOpenSpace = true;
    if (piFilters.nearAmenity) newFilters.nearAmenity = piFilters.nearAmenity;
    if (piFilters.maxDistance) newFilters.maxDistance = piFilters.maxDistance;
    // Vastu direction from NL parser (e.g. "east facing" → vastuDirection: 'E')
    if (piFilters.vastuDirection) {
      newFilters.vastuCompliant = true; // direction implies vastu filter
    }

    const communityPatterns = ['arabian ranches', 'meadows', 'springs', 'lakes', 'al barari', 'damac hills', 'dubai hills', 'palm jumeirah', 'jumeirah golf', 'victory heights', 'mudon', 'villanova'];
    for (const comm of communityPatterns) { if (q.includes(comm)) { newFilters.community = comm; break; } }
    
    const villaMatch = q.match(/(?:villa|near villa|close to villa)\s+(\d+)/i);
    if (villaMatch) newFilters.nearVilla = villaMatch[1];
    if (q.includes('odd')) newFilters.oddEven = 'odd';
    if (q.includes('even')) newFilters.oddEven = 'even';
    const brMatch = q.match(/(\d+)\s*(?:br|bed|bedroom)/i);
    if (brMatch) newFilters.bedrooms = parseInt(brMatch[1]);

    // Detect plot number — only set if no location/community found (they are mutually exclusive)
    const plotMatch = raw.match(/(?:plot\s*(?:number|no|#)?)\s*(\d{3,})/i);
    if (plotMatch && !newFilters.community) newFilters.plotNumber = plotMatch[1];

    // Detect Google Maps URL or raw coordinates
    const urlMatch = raw.match(/(https?:\/\/[^\s]+(?:google\.com\/maps|maps\.google|goo\.gl)[^\s]*)/i);
    if (urlMatch) {
      newFilters.googleLocation = urlMatch[1];
      // Location search — clear plot filter (incompatible with area search)
      delete newFilters.plotNumber;
    } else {
      const coordMatch = raw.match(/(-?\d+\.\d+)\s*[,\s]\s*(-?\d+\.\d+)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if ((lat > 20 && lat < 30 && lng > 50 && lng < 60) || (lng > 20 && lng < 30 && lat > 50 && lat < 60)) {
          newFilters.googleLocation = `${coordMatch[1]}, ${coordMatch[2]}`;
          delete newFilters.plotNumber;
        }
      }
    }

    setVillaFilters(newFilters);

    // Auto-trigger GIS search if community, plot number, or location detected
    const gisParams: { community?: string; plotNumber?: string; googleLocation?: string; radiusMeters?: number } = {};
    if (newFilters.community) gisParams.community = newFilters.community;
    if (newFilters.plotNumber) gisParams.plotNumber = newFilters.plotNumber;
    if (newFilters.googleLocation) gisParams.googleLocation = newFilters.googleLocation;
    gisParams.radiusMeters = villaSearchRadius;
    if (gisParams.community || gisParams.plotNumber || gisParams.googleLocation) {
      searchVillaGIS(gisParams);
    }
  }, [searchVillaGIS, villaSearchRadius]);

  const handleRadiusSearch = useCallback((lat: number, lng: number, radiusM: number) => {
    setVillaManualCenter({ lat, lng });
    setVillaSearchRadius(radiusM);
    // Radius search = area-based: clear any plot-specific or conflicting filters so results aren't blocked
    setVillaFilters(prev => ({
      community: prev.community, // keep community filter
      // intentionally drop: plotNumber, isSingleRow, isCorner, etc. — re-apply after PI computes
    }));
    searchVillaGIS({ googleLocation: `${lat}, ${lng}`, radiusMeters: radiusM });
  }, [searchVillaGIS]);

  const views: { id: LandOSView; icon: typeof Map; label: string }[] = [
    { id: 'map', icon: Satellite, label: 'GIS Map' },
    { id: 'villas', icon: Home, label: 'Villa Intel' },
  ];

  const renderMainContent = () => {
    return (
      <>
        <div className="absolute inset-0" style={{ visibility: activeView === 'map' ? 'visible' : 'hidden' }}>
          <LandOSMapView plots={filteredPlots} selectedPlotId={selectedPlotId} onSelectPlot={handleSelectPlot} />
          <MapOverlayHUD plots={allSearchablePlots} filteredCount={filteredPlots.length} selectedPlotId={selectedPlotId} />
        </div>
        <div className="absolute inset-0" style={{ visibility: activeView === 'villas' ? 'visible' : 'hidden' }}>
          <VillaMapView
            villas={mergedVillas}
            selectedVillaId={selectedVillaId}
            onSelectVilla={handleSelectVilla}
            onRadiusSearch={handleRadiusSearch}
            searchCenter={villaSearchCenter}
            searchRadius={villaSearchRadius}
            matchedVillaIds={matchedVillaIds}
            gisResults={gisResults}
            amenities={allAmenities}
          />
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-[hsl(220,25%,8%)] border-b border-[hsl(220,20%,16%)]">
          <div className="flex items-center h-11 px-3 gap-3">
            <div className="flex items-center gap-2 pr-3 border-r border-[hsl(220,20%,18%)]">
              <div className="h-6 w-6 rounded-md bg-white flex items-center justify-center">
                <Satellite className="h-3.5 w-3.5 text-[hsl(220,20%,8%)]" />
              </div>
              <div className="leading-none">
                <span className="text-[13px] font-bold text-white tracking-tight">Land OS</span>
                <span className="text-[9px] text-[hsl(220,10%,50%)] ml-1.5 uppercase tracking-widest">GIS</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 bg-[hsl(220,22%,12%)] rounded-lg p-0.5">
              {views.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveView(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
                    activeView === id
                      ? 'bg-white text-black shadow-sm font-semibold'
                      : 'text-[hsl(220,10%,50%)] hover:text-white'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="text-[10px] text-white font-medium">LIVE</span>
            </div>

            <div className="flex-1" />

            {/* Mock Community Switcher */}
            {isVillaMode && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-[hsl(220,10%,50%)]" />
                <select
                  value={selectedMockCommunityId}
                  onChange={e => handleMockCommunityChange(e.target.value)}
                  className="bg-[hsl(220,22%,12%)] border border-[hsl(220,20%,18%)] text-[hsl(220,10%,70%)] text-[10px] font-medium rounded-md px-2 py-1 h-7 cursor-pointer hover:border-[hsl(220,20%,35%)] transition-colors outline-none"
                  title="Load a mock community for GIS property intelligence testing"
                >
                  <option value="">— Mock Community —</option>
                  {Object.values(MOCK_COMMUNITIES).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isVillaMode && (
              <>
                <Button size="sm" variant="ghost"
                  className="gap-1.5 h-7 text-[11px] px-2 text-[hsl(220,10%,55%)] hover:text-white hover:bg-[hsl(220,22%,15%)]"
                  onClick={() => setWizardOpen(true)}>
                  <Target className="h-3 w-3" /> Wizard
                </Button>
                <Button size="sm" variant="ghost"
                  className="h-7 w-7 p-0 text-[hsl(220,10%,55%)] hover:text-white hover:bg-[hsl(220,22%,15%)]"
                  onClick={() => refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
                {activeView === 'map' && (
                  <CreatePlotDialog
                    trigger={
                      <Button size="sm" className="gap-1.5 h-7 text-[11px] px-3 bg-[hsl(82,84%,45%)] text-[hsl(220,20%,8%)] hover:bg-[hsl(82,84%,50%)] font-semibold">
                        <Plus className="h-3 w-3" /> Add Plot
                      </Button>
                    }
                  />
                )}
              </>
            )}
            {isVillaMode && (
              <Button size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-[hsl(220,10%,55%)] hover:text-white hover:bg-[hsl(220,22%,15%)]"
                onClick={() => refetchVillas()}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 relative min-h-0">
            {renderMainContent()}
          </div>
          <div className="w-[340px] shrink-0 min-h-0">
            {isVillaMode ? (
              <VillaRightPanel
                villas={mergedVillas}
                selectedVillaId={selectedVillaId}
                onSelectVilla={handleSelectVilla}
                listingCounts={listingCounts}
                isLoading={villasLoading}
                filters={villaFilters}
                onFiltersChange={setVillaFilters}
                onAISearch={handleAISearch}
                communities={communities}
                onGISSearch={searchVillaGIS}
                isGISSearching={isVillaGISSearching}
                gisResults={gisResults}
                onClearGIS={clearVillaGIS}
                searchCenter={villaSearchCenter}
                matchedVillaIds={matchedVillaIds}
                searchRadius={villaSearchRadius}
                onSearchRadiusChange={setVillaSearchRadius}
                onGoToPlotLocation={(lat, lng) => setVillaManualCenter({ lat, lng })}
                intelligenceMap={intelligenceMap}
              />
            ) : detailPlot ? (
              <PlotDetailPanel plot={detailPlot} onClose={() => { setDetailPlot(null); setSelectedPlotId(null); }} />
            ) : (
              <PlotCardSidebar
                plots={allSearchablePlots}
                filteredPlots={filteredPlots}
                selectedPlotId={selectedPlotId}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                zoningFilter={zoningFilter}
                onSearchChange={handleSearchChange}
                onSearchSubmit={handleSidebarSearchSubmit}
                onStatusFilterChange={setStatusFilter}
                onZoningFilterChange={setZoningFilter}
                onSelectPlot={handleSelectPlot}
                onEditPlot={handleEdit}
                onDeletePlot={handleDelete}
                onListPlot={handleList}
                isLoading={isLoading || isGisSearching}
              />
            )}
          </div>
        </div>
      </div>

      {isVillaMode && <VillaDetailPanel villaId={selectedVillaId} onClose={() => setSelectedVillaId(null)} />}

      <PlotOffersDialog plot={selectedPlot} open={offersOpen} onOpenChange={setOffersOpen} />
      <PlotInterestedDialog plot={selectedPlot} open={interestedOpen} onOpenChange={setInterestedOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plot?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete plot "{selectedPlot?.plot_number}"? This will also remove all offers and interested buyers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletePlot.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LandMatchingWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        plots={plots.map(p => ({ id: p.plot_number, area: p.plot_size ? Number(p.plot_size) / SQM_TO_SQFT : 0, gfa: p.gfa ? Number(p.gfa) / SQM_TO_SQFT : 0, zoning: p.zoning, status: p.status, location: p.area_name })) as any}
        onHighlightPlots={handleWizardHighlightPlots}
        onSelectPlot={handleWizardSelectPlot}
      />
    </MainLayout>
  );
}
