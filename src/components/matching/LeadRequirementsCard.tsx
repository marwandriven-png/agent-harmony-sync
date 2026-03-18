import { motion } from 'framer-motion';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Bed, 
  Home, 
  DollarSign,
  Clock,
  Flame,
  Thermometer,
  Snowflake,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type LeadRow = Database['public']['Tables']['leads']['Row'];
type LeadPriority = Database['public']['Enums']['lead_priority'];

interface LeadRequirementsCardProps {
  lead: LeadRow & { profiles?: { full_name: string } | null };
}

const priorityConfig: Record<LeadPriority, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  hot: { icon: Flame, color: 'text-red-600', bg: 'bg-red-100', label: 'Hot' },
  warm: { icon: Thermometer, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Warm' },
  cold: { icon: Snowflake, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Cold' },
};

const urgencyConfig: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Low Urgency' },
  normal: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Normal' },
  urgent: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Urgent' },
  critical: { color: 'text-red-600', bg: 'bg-red-100', label: 'Critical' },
};

export function LeadRequirementsCard({ lead }: LeadRequirementsCardProps) {
  const PriorityIcon = priorityConfig[lead.priority].icon;
  const urgency = (lead as { urgency_level?: string }).urgency_level || 'normal';
  const urgencyStyle = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl shadow-card border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn(priorityConfig[lead.priority].bg, priorityConfig[lead.priority].color, "border-0")}>
                <PriorityIcon className="w-3.5 h-3.5 mr-1" />
                {priorityConfig[lead.priority].label}
              </Badge>
              <Badge className={cn(urgencyStyle.bg, urgencyStyle.color, "border-0")}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {urgencyStyle.label}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {lead.lead_type || 'Buyer'}
              </Badge>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            Added {new Date(lead.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span className="font-medium text-foreground">{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span className="font-medium text-foreground">{lead.email}</span>
            </div>
          )}
          {lead.locations && lead.locations.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="font-medium text-foreground">{lead.locations.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Requirements */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Requirements
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Budget</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(lead.budget_min || 0, lead.budget_currency || 'AED')}
              {' - '}
              {formatCurrency(lead.budget_max || 0, lead.budget_currency || 'AED')}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Bedrooms</p>
            <div className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">{lead.bedrooms || 'Any'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {(lead.property_types || []).map((type) => (
                <Badge key={type} variant="secondary" className="capitalize">
                  {type}
                </Badge>
              ))}
              {(!lead.property_types || lead.property_types.length === 0) && (
                <span className="text-muted-foreground">Any</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Locations</p>
            <div className="flex flex-wrap gap-1.5">
              {(lead.locations || []).map((loc) => (
                <Badge key={loc} variant="secondary">
                  {loc}
                </Badge>
              ))}
              {(!lead.locations || lead.locations.length === 0) && (
                <span className="text-muted-foreground">Any</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
