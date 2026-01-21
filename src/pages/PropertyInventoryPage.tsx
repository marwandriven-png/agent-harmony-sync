import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useProperties, usePropertyMetrics, PropertyWithProfile } from '@/hooks/useProperties';
import { useDataSources, useSyncFromSheet } from '@/hooks/useDataSources';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  MapPin,
  Bed,
  Maximize,
  Eye,
  Send,
  Search,
  RefreshCw,
  Filter,
  CheckCircle,
  TrendingUp,
  Bell,
  XCircle,
  AlertCircle,
  Settings,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

const statusConfig: Record<PropertyStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: 'text-success', bg: 'bg-pastel-green' },
  under_offer: { label: 'Under Offer', color: 'text-warning', bg: 'bg-pastel-orange' },
  sold: { label: 'Sold', color: 'text-muted-foreground', bg: 'bg-muted' },
  rented: { label: 'Rented', color: 'text-primary', bg: 'bg-pastel-blue' },
};

const tabs = ['All Properties', 'High Demand', 'Exclusive', 'New Listings'] as const;

export default function PropertyInventoryPage() {
  const navigate = useNavigate();
  const { data: properties = [], isLoading } = useProperties();
  const { data: dataSources = [] } = useDataSources('properties');
  const syncFromSheet = useSyncFromSheet();
  const metrics = usePropertyMetrics();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('All Properties');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  // Find a valid properties data source
  const propertiesSource = dataSources.find(
    (s) => Object.keys(s.column_mappings || {}).length > 0
  );

  const handleSyncFromSheet = async () => {
    if (!propertiesSource) {
      setShowSetupDialog(true);
      return;
    }

    await syncFromSheet.mutateAsync(propertiesSource.id);
  };

  const locations = useMemo(() => {
    const locs = [...new Set(properties.map((p) => p.location))];
    return locs.sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch =
        property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation = locationFilter === 'all' || property.location === locationFilter;
      const matchesType = typeFilter === 'all' || property.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || property.status === statusFilter;

      return matchesSearch && matchesLocation && matchesType && matchesStatus;
    });
  }, [properties, searchQuery, locationFilter, typeFilter, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedProperties((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const metricCards = [
    {
      label: 'Total Properties',
      value: metrics.totalProperties,
      icon: Building2,
      color: 'text-primary',
      bg: 'bg-pastel-blue',
    },
    {
      label: 'Available',
      value: metrics.availableCount,
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-pastel-green',
    },
    {
      label: 'High Demand',
      value: metrics.highDemand,
      icon: TrendingUp,
      color: 'text-warning',
      bg: 'bg-pastel-orange',
    },
    {
      label: 'With Matches',
      value: metrics.withMatches,
      icon: Bell,
      color: 'text-primary',
      bg: 'bg-pastel-purple',
    },
    {
      label: 'Sold/Reserved',
      value: metrics.soldReservedCount,
      icon: XCircle,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Property Inventory"
        subtitle={`Manage ${metrics.totalProperties} properties with AI-powered matching`}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleSyncFromSheet}
              disabled={syncFromSheet.isPending}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncFromSheet.isPending && "animate-spin")} />
              {syncFromSheet.isPending ? 'Syncing...' : 'Sync from Sheet'}
            </Button>
            <CreatePropertyDialog
              trigger={
                <Button className="bg-gradient-primary hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Property
                </Button>
              }
            />
          </div>
        }
      />

      <PageContent>
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {metricCards.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-xl p-4 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className={cn('text-2xl font-bold mt-1', metric.color)}>
                      {metric.value}
                    </p>
                  </div>
                  <div className={cn('p-3 rounded-xl', metric.bg)}>
                    <metric.icon className={cn('w-5 h-5', metric.color)} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-4"
          >
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="townhouse">Townhouse</SelectItem>
                <SelectItem value="penthouse">Penthouse</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="land">Land</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="under_offer">Under Offer</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="rented">Rented</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </motion.div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors relative',
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Properties Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl shadow-card overflow-hidden"
          >
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-4 px-4 w-10">
                        <Checkbox />
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Property
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Location
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Details
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Price
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Matches
                      </th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.map((property, index) => (
                      <motion.tr
                        key={property.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <Checkbox
                            checked={selectedProperties.includes(property.id)}
                            onCheckedChange={() => toggleSelect(property.id)}
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{property.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {property.type}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {property.location}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Bed className="w-3 h-3" />
                              {property.bedrooms}BR
                            </span>
                            <span className="flex items-center gap-1">
                              <Maximize className="w-3 h-3" />
                              {property.size} {property.size_unit}
                            </span>
                            <span className="capitalize">{property.type}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(property.price, property.currency || 'AED')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            className={cn(
                              statusConfig[property.status].bg,
                              statusConfig[property.status].color
                            )}
                          >
                            {statusConfig[property.status].label}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-accent font-medium">0 leads</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && filteredProperties.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No properties found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </motion.div>
        </div>
      </PageContent>

      {/* Setup Required Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Data Source Not Configured
            </DialogTitle>
            <DialogDescription>
              No Google Sheet is connected for properties, or the column mappings are missing. 
              Please go to the Setup Wizard to connect your properties data source.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">To sync properties from Google Sheets:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to Setup Wizard → Data Sources</li>
              <li>Select "Properties" as the target table</li>
              <li>Paste your Google Sheet URL (must be publicly shared)</li>
              <li>Map the sheet columns to property fields</li>
              <li>Save and sync</li>
            </ol>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => navigate('/setup')}>
              <Settings className="w-4 h-4 mr-2" />
              Open Setup Wizard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
