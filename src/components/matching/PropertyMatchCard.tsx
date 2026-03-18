import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Star, 
  Edit3, 
  ExternalLink, 
  X, 
  Bed, 
  Home, 
  MapPin,
  Loader2,
  Download,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { PropertyMatch, ExternalListingData } from '@/hooks/usePropertyMatches';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

interface PropertyMatchCardProps {
  match: PropertyMatch;
  onMarkSent: () => Promise<void>;
  onToggleFlag: () => Promise<void>;
  onAddNote: (note: string) => Promise<void>;
  onDismiss: () => Promise<void>;
  onConvert?: () => Promise<void>;
}

export function PropertyMatchCard({
  match,
  onMarkSent,
  onToggleFlag,
  onAddNote,
  onDismiss,
  onConvert,
}: PropertyMatchCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isExternal = match.match_type === 'external';
  const property = match.property;
  const externalData = match.external_data as ExternalListingData | null;

  // Get display data from either internal property or external data
  const displayData = isExternal && externalData ? {
    title: externalData.title,
    price: externalData.price,
    bedrooms: externalData.bedrooms,
    size: externalData.size_sqft,
    location: externalData.location,
    building_name: externalData.building_name,
    type: externalData.property_type,
    image: externalData.thumbnail_url,
    source: externalData.source,
    agent_name: externalData.agent_name,
    listing_url: externalData.listing_url,
  } : property ? {
    title: `${property.bedrooms} BR in ${property.building_name || property.location}`,
    price: Number(property.price),
    bedrooms: property.bedrooms,
    size: Number(property.size),
    location: property.location,
    building_name: property.building_name,
    type: property.type,
    image: property.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400',
    source: 'internal',
    agent_name: property.owner_name,
    listing_url: null,
  } : null;

  if (!displayData) return null;

  async function handleAction(action: string, handler: () => Promise<void>) {
    setActionLoading(action);
    try {
      await handler();
    } finally {
      setActionLoading(null);
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-emerald-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getStatusBadge = () => {
    switch (match.status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Sent</Badge>;
      case 'viewed':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Viewed</Badge>;
      case 'interested':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Interested</Badge>;
      case 'dismissed':
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Dismissed</Badge>;
      case 'converted':
        return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Converted</Badge>;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card rounded-xl overflow-hidden shadow-card border border-border transition-all hover:shadow-lg",
        match.status === 'dismissed' && "opacity-60"
      )}
    >
      {/* Image Header */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={displayData.image}
          alt={displayData.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Score Badge */}
        <div className={cn(
          "absolute top-3 left-3 px-3 py-1.5 rounded-full text-white font-bold text-sm shadow-lg",
          getScoreColor(match.match_score)
        )}>
          {match.match_score}% Match
        </div>

        {/* Source Badge */}
        {isExternal && (
          <Badge className="absolute top-3 right-3 bg-orange-500 text-white border-0 capitalize">
            {displayData.source}
          </Badge>
        )}

        {/* Flagged Star */}
        {match.is_flagged && (
          <div className="absolute top-3 right-3">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title & Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground line-clamp-2">
            {displayData.title}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">Price:</span>
            <span className="text-primary font-semibold">
              {formatCurrency(displayData.price, 'AED')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bed className="w-4 h-4" />
            <span>{displayData.bedrooms} BR</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Maximize2 className="w-4 h-4" />
            <span>{displayData.size} sqft</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{displayData.location}</span>
          </div>
        </div>

        {/* Match Reasons */}
        {match.match_reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {match.match_reasons.map((reason, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {match.notes && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> {match.notes}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant={match.status === 'sent' ? 'default' : 'outline'}
            onClick={() => handleAction('sent', onMarkSent)}
            disabled={!!actionLoading || match.status === 'sent'}
            className={cn(
              match.status === 'sent' && "bg-green-600 hover:bg-green-700"
            )}
          >
            {actionLoading === 'sent' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span className="ml-1.5">Sent</span>
          </Button>

          <Button
            size="sm"
            variant={match.is_flagged ? 'default' : 'outline'}
            onClick={() => handleAction('flag', onToggleFlag)}
            disabled={!!actionLoading}
            className={cn(
              match.is_flagged && "bg-yellow-500 hover:bg-yellow-600"
            )}
          >
            {actionLoading === 'flag' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className="w-4 h-4" />
            )}
            <span className="ml-1.5">Star</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const note = prompt('Add a note about this property:');
              if (note) handleAction('note', () => onAddNote(note));
            }}
            disabled={!!actionLoading}
          >
            {actionLoading === 'note' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Edit3 className="w-4 h-4" />
            )}
            <span className="ml-1.5">Note</span>
          </Button>

          {isExternal && displayData.listing_url && (
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <a href={displayData.listing_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                <span className="ml-1.5">View</span>
              </a>
            </Button>
          )}

          {isExternal && onConvert && match.status !== 'converted' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('convert', onConvert)}
              disabled={!!actionLoading}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {actionLoading === 'convert' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="ml-1.5">Import</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction('dismiss', onDismiss)}
            disabled={!!actionLoading || match.status === 'dismissed'}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {actionLoading === 'dismiss' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            <span className="ml-1.5">Dismiss</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
