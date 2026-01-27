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
    },
    { 
      label: 'Country Name', 
      value: property.country || 'UAE',
    },
  ];

  // Secondary details in a grid
  const secondaryDetails = [
    { label: 'Unit Number', value: property.unit_number || '-' },
    { label: 'Property Type', value: property.type },
    { label: 'Party Type', value: property.party_type || '-' },
    { label: 'Master Project', value: property.master_project || '-' },
    { label: 'ID Number', value: property.id_number || '-' },
    { label: 'UAE ID', value: property.uae_id_number || '-' },
    { label: 'Passport Expiry', value: property.passport_expiry_date || '-' },
    { label: 'Birth Date', value: property.birth_date || '-' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-muted/20 px-6 py-5 border-t border-border"
    >
      {/* Primary row - ProcedureValue and CountryName in highlight box */}
      <div className="grid grid-cols-2 gap-6 mb-5 p-4 bg-primary/5 rounded-xl border border-primary/20">
        {primaryDetails.map((item) => (
          <div key={item.label}>
            <span className="font-bold text-primary text-xs uppercase tracking-wider">
              {item.label}:
            </span>
            <p className="text-foreground mt-1.5 text-xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary details grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 text-sm">
        {secondaryDetails.map((item) => (
          <div key={item.label}>
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              {item.label}:
            </span>
            <p className="text-foreground mt-1 capitalize">{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
