import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Eye,
} from 'lucide-react';

export default function PropertiesPage() {
  const { properties } = useCRMStore();

  const statusColors = {
    available: 'bg-pastel-green text-status-closed',
    under_offer: 'bg-pastel-orange text-status-negotiation',
    sold: 'bg-pastel-purple text-status-contacted',
    rented: 'bg-pastel-blue text-status-new',
  };

  return (
    <MainLayout>
      <PageHeader
        title="Properties"
        subtitle="Manage your property listings"
        actions={
          <Button className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Button>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property, index) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              {/* Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                <Building2 className="w-16 h-16 text-muted-foreground/30" />
                <Badge className={cn(
                  "absolute top-3 right-3",
                  statusColors[property.status]
                )}>
                  {property.status.replace('_', ' ')}
                </Badge>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {property.title}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{property.location}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xl font-bold text-foreground mb-4">
                  {formatCurrency(property.price, property.currency)}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    <span>{property.bedrooms} BR</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4" />
                    <span>{property.bathrooms}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Maximize className="w-4 h-4" />
                    <span>{property.size} {property.sizeUnit}</span>
                  </div>
                </div>

                {property.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {property.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {property.features.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{property.features.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">No properties yet</p>
            <p className="text-muted-foreground mb-4">Add your first property listing</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Property
            </Button>
          </div>
        )}
      </PageContent>
    </MainLayout>
  );
}
