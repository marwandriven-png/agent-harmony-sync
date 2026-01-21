import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useProperties, useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  FileText,
  TrendingUp,
  Home,
} from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

const statusColors: Record<PropertyStatus, string> = {
  available: 'bg-pastel-green text-status-closed',
  under_offer: 'bg-pastel-orange text-status-negotiation',
  sold: 'bg-pastel-purple text-status-contacted',
  rented: 'bg-pastel-blue text-status-new',
};

export default function PropertiesPage() {
  const { data: properties = [], isLoading } = useProperties();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  
  const [activeTab, setActiveTab] = useState('property-data');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [newListingDialogOpen, setNewListingDialogOpen] = useState(false);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch = 
        property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || property.type === filterType;
      const matchesStatus = filterStatus === 'all' || property.status === filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [properties, searchQuery, filterType, filterStatus]);

  const handleStatusChange = async (propertyId: string, status: PropertyStatus) => {
    await updateProperty.mutateAsync({ id: propertyId, status });
  };

  const handleDelete = async () => {
    if (propertyToDelete) {
      await deleteProperty.mutateAsync(propertyToDelete);
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
    }
  };

  const metrics = useMemo(() => ({
    total: properties.length,
    available: properties.filter(p => p.status === 'available').length,
    underOffer: properties.filter(p => p.status === 'under_offer').length,
    soldRented: properties.filter(p => p.status === 'sold' || p.status === 'rented').length,
  }), [properties]);

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Properties" subtitle="Manage your property listings" />
        <PageContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-80 w-full" />)}
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Properties"
        subtitle="Manage your property listings and inventory"
        actions={
          <CreatePropertyDialog
            trigger={
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Add Property
              </Button>
            }
          />
        }
      />

      <PageContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="new-listing" className="gap-2">
              <Plus className="w-4 h-4" />
              New Listing
            </TabsTrigger>
            <TabsTrigger value="property-data" className="gap-2">
              <FileText className="w-4 h-4" />
              Property Data
            </TabsTrigger>
          </TabsList>

          {/* New Listing Tab */}
          <TabsContent value="new-listing">
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-blue">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Listings</p>
                      <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-green">
                      <Home className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-2xl font-bold text-foreground">{metrics.available}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-orange">
                      <TrendingUp className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Under Offer</p>
                      <p className="text-2xl font-bold text-foreground">{metrics.underOffer}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-purple">
                      <Eye className="w-6 h-6 text-status-contacted" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sold/Rented</p>
                      <p className="text-2xl font-bold text-foreground">{metrics.soldRented}</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* New Listing Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-xl p-8 shadow-card"
              >
                <div className="text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-pastel-blue rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Add New Property Listing
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Create a new property listing to add to your inventory. 
                    New listings will automatically appear in reports and can be matched with leads.
                  </p>
                  <CreatePropertyDialog
                    open={newListingDialogOpen}
                    onOpenChange={setNewListingDialogOpen}
                    trigger={
                      <Button size="lg" className="bg-gradient-primary hover:opacity-90">
                        <Plus className="w-5 h-5 mr-2" />
                        Create New Listing
                      </Button>
                    }
                  />
                </div>
              </motion.div>

              {/* Recent Listings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-card rounded-xl p-6 shadow-card"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Listings</h3>
                <div className="space-y-3">
                  {properties.slice(0, 5).map((property) => (
                    <div
                      key={property.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{property.title}</p>
                          <p className="text-sm text-muted-foreground">{property.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {formatCurrency(property.price, property.currency || 'AED')}
                        </p>
                        <Badge className={cn("text-xs", statusColors[property.status])}>
                          {property.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {properties.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No listings yet. Create your first property listing above.
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </TabsContent>

          {/* Property Data Tab */}
          <TabsContent value="property-data">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Constants.public.Enums.property_type.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Constants.public.Enums.property_status.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Property Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property, index) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all group"
                >
                  {/* Image Placeholder */}
                  <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                    <Building2 className="w-16 h-16 text-muted-foreground/30" />
                    <Badge className={cn("absolute top-3 left-3", statusColors[property.status])}>
                      {property.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="secondary" className="absolute top-3 right-3 capitalize">
                      {property.type}
                    </Badge>
                    
                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Property
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-muted-foreground">
                          Change Status:
                        </DropdownMenuItem>
                        {Constants.public.Enums.property_status.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusChange(property.id, status)}
                            disabled={property.status === status}
                          >
                            <span className="capitalize ml-4">{status.replace('_', ' ')}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setPropertyToDelete(property.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      {formatCurrency(property.price, property.currency || 'AED')}
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
                        <span>{property.size} {property.size_unit}</span>
                      </div>
                    </div>

                    {property.features && property.features.length > 0 && (
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

            {filteredProperties.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-foreground">No properties found</p>
                <p className="text-muted-foreground mb-4">
                  {properties.length === 0
                    ? 'Add your first property listing'
                    : 'Try adjusting your search or filters'}
                </p>
                {properties.length === 0 && (
                  <CreatePropertyDialog
                    trigger={
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Property
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this property? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
