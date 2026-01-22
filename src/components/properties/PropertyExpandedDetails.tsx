import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatters';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

interface PropertyExpandedDetailsProps {
  property: PropertyRow;
}

export function PropertyExpandedDetails({ property }: PropertyExpandedDetailsProps) {
  // Primary details shown first (ProcedureValue and CountryName)
  const primaryDetails = [
    { 
      label: 'Procedure Value', 
      value: formatCurrency(property.procedure_value || property.price, property.currency || 'AED'),
      highlight: true 
    },
    { 
      label: 'Country Name', 
      value: property.country || 'UAE',
      highlight: true 
    },
  ];

  // Secondary details
  const secondaryDetails = [
    { label: 'Property Type', value: property.type },
    { label: 'Party Type', value: property.party_type || '-' },
    { label: 'Master Project', value: property.master_project || '-' },
    { label: 'ID Number', value: (property as any).id_number || '-' },
    { label: 'UAE ID', value: (property as any).uae_id_number || '-' },
    { label: 'Unified Number', value: (property as any).unified_number || '-' },
    { label: 'Passport Expiry', value: (property as any).passport_expiry_date || '-' },
    { label: 'Birth Date', value: (property as any).birth_date || '-' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-muted/30 px-6 py-4 border-t border-border"
    >
      {/* Primary row - ProcedureValue and CountryName */}
      <div className="grid grid-cols-2 gap-6 mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
        {primaryDetails.map((item) => (
          <div key={item.label}>
            <span className="font-bold text-primary text-xs uppercase tracking-wide">
              {item.label}:
            </span>
            <p className="text-foreground mt-1 text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {secondaryDetails.map((item) => (
          <div key={item.label}>
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              {item.label}:
            </span>
            <p className="text-foreground mt-0.5 capitalize">{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
