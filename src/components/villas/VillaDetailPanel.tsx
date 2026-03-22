import { X, MapPin, User, Compass, Eye, ExternalLink, Phone, Mail, Building, TreePine, CornerDownRight, Zap, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVillaWithDetails, type CommunityVilla } from '@/hooks/useVillas';
import { propertyIntelligence, classifyVastu, vastuRatingColor, vastuRatingHex, AMENITY_CONFIG, type SmartTag, type DetectedAmenity } from '@/services/PropertyIntelligenceService';
import { VILLA_CLASSES } from '@/services/property-intelligence/classify-class';
import { useMemo } from 'react';

interface VillaDetailPanelProps {
  villaId: string | null;
  onClose: () => void;
  nearbyAmenities?: DetectedAmenity[];
}

export function VillaDetailPanel({ villaId, onClose, nearbyAmenities }: VillaDetailPanelProps) {
  const { data: villa, isLoading } = useVillaWithDetails(villaId || undefined);

  const smartTags = useMemo(() => {
    if (!villa) return [];
    return propertyIntelligence.generateSmartTags(villa, nearbyAmenities);
  }, [villa, nearbyAmenities]);

  const vastuAnalysis = useMemo(() => {
    if (!villa) return null;
    return classifyVastu(villa.facing_direction);
  }, [villa]);

  // Group amenities by type, show closest per type
  const groupedAmenities = useMemo(() => {
    if (!nearbyAmenities || nearbyAmenities.length === 0) return [];
    const byType = new Map<string, DetectedAmenity>();
    for (const a of nearbyAmenities) {
      const existing = byType.get(a.type);
      if (!existing || a.distanceMeters < existing.distanceMeters) {
        byType.set(a.type, a);
      }
    }
    return Array.from(byType.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [nearbyAmenities]);

  if (!villaId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] z-[1200] bg-[hsl(220,25%,7%)] border-l border-[hsl(220,20%,14%)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-[hsl(220,20%,14%)] flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-white">
            {isLoading ? 'Loading...' : `Villa ${villa?.villa_number || ''}`}
          </h2>
          <span className="text-[11px] text-[hsl(220,10%,50%)]">Property Intelligence Record</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[hsl(220,22%,15%)] text-[hsl(220,10%,50%)] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading || !villa ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-[hsl(220,10%,35%)] text-sm">Loading villa details...</div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">

            {/* Layout Analysis Grid — matching HTML reference */}
            <Section title="Layout Analysis" icon={CornerDownRight}>
              <div className="grid grid-cols-2 gap-2">
                <LayoutAttrBox
                  icon={villa.is_single_row ? '🏡' : '🏘️'}
                  label="LAYOUT TYPE"
                  value={villa.is_single_row ? 'Single Row' : 'Back-to-Back'}
                  valueColor={villa.is_single_row ? 'text-emerald-400' : 'text-red-400'}
                />
                <LayoutAttrBox
                  icon={villa.is_corner ? '📐' : '⬜'}
                  label="POSITION"
                  value={villa.is_corner ? 'Corner' : villa.position_type || 'Mid Block'}
                  valueColor={villa.is_corner ? 'text-amber-400' : 'text-[hsl(220,10%,55%)]'}
                />
                <LayoutAttrBox
                  icon={villa.backs_road ? '🛣️' : villa.backs_park ? '🌳' : '❓'}
                  label="BACK FACING"
                  value={villa.backs_road ? 'Road' : villa.backs_park ? 'Park' : 'Unknown'}
                  valueColor={villa.backs_road ? 'text-yellow-300' : villa.backs_park ? 'text-teal-400' : 'text-[hsl(220,10%,40%)]'}
                />
                <LayoutAttrBox
                  icon="🧭"
                  label="ENTRANCE DIR"
                  value={vastuAnalysis?.entranceDirection !== 'Unknown' ? vastuAnalysis?.entranceDirection || '—' : '—'}
                  valueColor={vastuAnalysis?.compliant ? 'text-pink-400' : 'text-[hsl(220,10%,55%)]'}
                />
              </div>
            </Section>

            {/* Smart Tags — Auto-generated */}
            {smartTags.length > 0 && (
              <Section title={`Auto Smart Tags (${smartTags.length})`} icon={Zap}>
                <div className="flex flex-wrap gap-1.5">
                  {smartTags.map((tag, i) => {
                    const col = getTagColor(tag.label);
                    return (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-1 rounded-md font-bold font-mono border inline-flex items-center gap-1"
                        style={{
                          background: `${col}20`,
                          color: col,
                          borderColor: `${col}35`,
                        }}
                      >
                        {tag.label}
                      </span>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Identity */}
            <Section title="Identity">
              <InfoRow label="Villa Number" value={villa.villa_number} />
              <InfoRow label="Plot Number" value={villa.plot_number || '—'} />
              <InfoRow label="Community" value={villa.community_name} />
              {villa.sub_community && <InfoRow label="Sub-Community" value={villa.sub_community} />}
              {villa.cluster_name && <InfoRow label="Cluster" value={villa.cluster_name} />}
            </Section>

            {/* Amenity Proximity — with distances */}
            {groupedAmenities.length > 0 && (
              <Section title="Amenity Proximity" icon={Navigation}>
                <div className="space-y-1.5">
                  {groupedAmenities.map((amenity, i) => {
                    const config = AMENITY_CONFIG[amenity.type];
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{config.emoji}</span>
                          <div>
                            <span className="text-[11px] text-white font-medium">{config.label}</span>
                            <span className="text-[9px] text-[hsl(220,10%,45%)] block truncate max-w-[160px]">{amenity.name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn('text-[11px] font-bold', 
                            amenity.proximity === 'very_close' ? 'text-emerald-400' :
                            amenity.proximity === 'near' ? 'text-cyan-400' :
                            amenity.proximity === 'walkable' ? 'text-amber-400' : 'text-gray-500'
                          )}>
                            {amenity.distanceMeters}m
                          </span>
                          <span className={cn('text-[8px] block uppercase tracking-wider font-semibold',
                            amenity.proximity === 'very_close' ? 'text-emerald-400/70' :
                            amenity.proximity === 'near' ? 'text-cyan-400/70' :
                            amenity.proximity === 'walkable' ? 'text-amber-400/70' : 'text-gray-600'
                          )}>
                            {amenity.proximity === 'very_close' ? 'Very Close' :
                             amenity.proximity === 'near' ? 'Near' :
                             amenity.proximity === 'walkable' ? 'Walkable' : 'Not Nearby'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Vastu — Enhanced with SVG Compass */}
            <Section title="Vastu Orientation" icon={Compass}>
              <div className="flex items-center gap-3.5 p-3 rounded-lg bg-[hsl(220,25%,7%)] border border-[hsl(220,20%,14%)]">
                {/* SVG Compass */}
                <div className="w-[70px] h-[70px] flex-shrink-0">
                  <svg viewBox="0 0 70 70" className="w-full h-full">
                    <circle cx="35" cy="35" r="32" fill="rgba(13,15,20,0.9)" stroke={vastuAnalysis ? vastuRatingHex(vastuAnalysis.rating) : '#555'} strokeWidth="1.5"/>
                    <text x="35" y="12" textAnchor="middle" fill="#FF5555" fontSize="9" fontWeight="700" fontFamily="monospace">N</text>
                    <text x="35" y="63" textAnchor="middle" fill="#555" fontSize="8" fontFamily="monospace">S</text>
                    <text x="60" y="38" textAnchor="middle" fill="#555" fontSize="8" fontFamily="monospace">E</text>
                    <text x="10" y="38" textAnchor="middle" fill="#555" fontSize="8" fontFamily="monospace">W</text>
                    {vastuAnalysis && vastuAnalysis.entranceDirection !== 'Unknown' && (() => {
                      const dirAngles: Record<string, number> = { North: 0, Northeast: 45, East: 90, Southeast: 135, South: 180, Southwest: 225, West: 270, Northwest: 315 };
                      const angle = (dirAngles[vastuAnalysis.entranceDirection] ?? 0) * Math.PI / 180;
                      const col = vastuRatingHex(vastuAnalysis.rating);
                      return (
                        <>
                          <line x1="35" y1="35" x2={35 + Math.sin(angle) * 22} y2={35 - Math.cos(angle) * 22} stroke={col} strokeWidth="2.5" strokeLinecap="round"/>
                          <circle cx="35" cy="35" r="3" fill={col}/>
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <div>
                  <div className={cn('text-[16px] font-extrabold', vastuAnalysis ? vastuRatingColor(vastuAnalysis.rating) : 'text-gray-500')}>
                    {vastuAnalysis?.entranceDirection !== 'Unknown' ? `${vastuAnalysis?.entranceDirection} Facing` : 'Unknown'}
                  </div>
                  <div className="text-[12px] text-[hsl(220,10%,55%)] mt-0.5">
                    {vastuAnalysis?.rating?.replace('_', ' ') ?? '—'}
                  </div>
                  <div className={cn('text-[11px] font-mono mt-1.5', vastuAnalysis?.compliant || villa.vastu_compliant ? 'text-pink-400' : 'text-[hsl(220,10%,35%)]')}>
                    {vastuAnalysis?.compliant || villa.vastu_compliant ? '✅ Vastu Compliant' : '⬜ Not Compliant'}
                  </div>
                </div>
              </div>
            </Section>

            {/* Property Details */}
            <Section title="Property Details" icon={Building}>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label="Plot Size" value={villa.plot_size_sqft ? `${villa.plot_size_sqft.toLocaleString()} sqft` : '—'} />
                <MetricBox label="Built-up Area" value={villa.built_up_area_sqft ? `${villa.built_up_area_sqft.toLocaleString()} sqft` : '—'} />
                <MetricBox label="Bedrooms" value={villa.bedrooms?.toString() || '—'} />
                <MetricBox label="Floors" value={villa.floors?.toString() || '—'} />
                <MetricBox label="Year Built" value={villa.year_built?.toString() || '—'} />
                <MetricBox label="Land Usage" value={villa.land_usage || 'Villa'} />
              </div>
            </Section>

            {/* Owner Information */}
            <Section title="Owner Information" icon={User}>
              {villa.owner ? (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-emerald-400" />
                    <span className="text-[12px] font-semibold text-emerald-400">{villa.owner.owner_name}</span>
                  </div>
                  {villa.owner.phone && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Phone className="h-3 w-3 text-[hsl(220,10%,40%)]" />
                      <span className="text-[11px] text-[hsl(220,10%,60%)]">{villa.owner.phone}</span>
                    </div>
                  )}
                  {villa.owner.email && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Mail className="h-3 w-3 text-[hsl(220,10%,40%)]" />
                      <span className="text-[11px] text-[hsl(220,10%,60%)]">{villa.owner.email}</span>
                    </div>
                  )}
                  {villa.owner.ownership_type && (
                    <InfoRow label="Type" value={villa.owner.ownership_type} />
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)] text-center">
                  <User className="h-5 w-5 text-[hsl(220,10%,25%)] mx-auto mb-1" />
                  <p className="text-[11px] text-[hsl(220,10%,40%)]">No owner data available</p>
                </div>
              )}
            </Section>

            {/* Bayut Listings */}
            <Section title="Bayut Listing Status" icon={Eye}>
              {villa.listings && villa.listings.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      Listed ({villa.listings.length} listing{villa.listings.length > 1 ? 's' : ''})
                    </Badge>
                  </div>
                  {villa.listings.map(listing => (
                    <div key={listing.id} className="p-2.5 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[hsl(220,10%,50%)] capitalize">{listing.listing_type}</span>
                        {listing.listing_price && (
                          <span className="text-[11px] font-bold text-emerald-400">
                            AED {listing.listing_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {listing.listing_agent && (
                        <span className="text-[10px] text-[hsl(220,10%,45%)]">Agent: {listing.listing_agent}</span>
                      )}
                      {listing.listing_url && (
                        <a href={listing.listing_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[hsl(82,84%,55%)] hover:underline mt-1">
                          <ExternalLink className="h-2.5 w-2.5" /> View on Bayut
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)] text-center">
                  <Eye className="h-5 w-5 text-[hsl(220,10%,25%)] mx-auto mb-1" />
                  <p className="text-[11px] text-[hsl(220,10%,40%)]">Not currently listed on Bayut</p>
                </div>
              )}
            </Section>

            {/* GIS Coordinates */}
            {villa.latitude && villa.longitude && (
              <Section title="GIS Coordinates" icon={MapPin}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Latitude" value={villa.latitude.toFixed(6)} />
                  <MetricBox label="Longitude" value={villa.longitude.toFixed(6)} />
                </div>
              </Section>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof MapPin; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-[hsl(82,84%,55%)]" />}
        <span className="text-[11px] font-semibold text-[hsl(220,10%,60%)] uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-[hsl(220,10%,45%)]">{label}</span>
      <span className="text-[11px] text-white font-medium">{value}</span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-[hsl(220,22%,11%)] border border-[hsl(220,20%,16%)]">
      <span className="text-[8px] text-[hsl(220,10%,40%)] uppercase tracking-wider block">{label}</span>
      <span className="text-[11px] text-white font-medium">{value}</span>
    </div>
  );
}

function PositionBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={cn(
      'text-[9px] px-2 py-0.5 rounded-full font-medium',
      active
        ? 'bg-[hsl(82,84%,45%,0.1)] text-[hsl(82,84%,55%)] border border-[hsl(82,84%,45%,0.2)]'
        : 'bg-[hsl(220,22%,11%)] text-[hsl(220,10%,35%)] border border-[hsl(220,20%,16%)]'
    )}>
      {active ? '✓' : '✗'} {label}
    </span>
  );
}

function LayoutAttrBox({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[hsl(220,25%,7%)] border border-[hsl(220,20%,14%)]">
      <div className="text-[17px] mb-1">{icon}</div>
      <div className="text-[9px] text-[hsl(220,10%,40%)] font-mono uppercase tracking-wider">{label}</div>
      <div className={cn('text-[13px] font-bold mt-0.5', valueColor)}>{value}</div>
    </div>
  );
}

const TAG_COLOR_MAP: Record<string, string> = {
  'Single Row': '#2ECC71',
  'Back-to-Back': '#FF5555',
  'Corner': '#FFB347',
  'End Unit': '#BD93F9',
  [VILLA_CLASSES.backs_park.label]: '#26E8C8',
  [VILLA_CLASSES.backs_road.label]: '#F1FA8C',
  [VILLA_CLASSES.open_view.label]: '#4F8EF7',
  [VILLA_CLASSES.vastu.label]: '#FF79C6',
  'Community Edge': '#555',
};

function getTagColor(label: string): string {
  for (const [key, color] of Object.entries(TAG_COLOR_MAP)) {
    if (label.includes(key)) return color;
  }
  if (label.includes('Facing')) return '#FF79C6';
  if (label.includes('(') && label.includes('m)')) return '#26E8C8'; // amenity distance tags
  return '#4F8EF7';
}
