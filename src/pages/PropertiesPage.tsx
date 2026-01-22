import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useProperties, useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  FileText,
  TrendingUp,
  Home,
  RefreshCw,
  Phone,
  User,
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
  const { data: properties = [], isLoading, refetch } = useProperties();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  
  const [activeTab, setActiveTab] = useState('property-data');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [newListingDialogOpen, setNewListingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<Database['public']['Tables']['properties']['Row'] | null>(null);

  const handleEditProperty = (property: Database['public']['Tables']['properties']['Row']) => {
    setPropertyToEdit(property);
    setEditDialogOpen(true);
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        property.title?.toLowerCase().includes(searchLower) ||
        property.location?.toLowerCase().includes(searchLower) ||
        property.building_name?.toLowerCase().includes(searchLower) ||
        property.master_project?.toLowerCase().includes(searchLower) ||
        property.regis?.toLowerCase().includes(searchLower) ||
        property.owner_name?.toLowerCase().includes(searchLower);
      
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
      // Soft delete - change status to archived/sold
      await updateProperty.mutateAsync({ id: propertyToDelete, status: 'sold' });
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
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync
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
                    Create a new property listing synced with Google Sheets. 
                    All fields match the sheet columns for bidirectional sync.
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
            </div>
          </TabsContent>

          {/* Property Data Tab - Table View */}
          <TabsContent value="property-data">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Regis, building, owner..."
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

            {/* Property Table - Matches Google Sheets columns */}
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Regis</TableHead>
                      <TableHead className="font-semibold">ProcedureValue</TableHead>
                      <TableHead className="font-semibold">Master Project</TableHead>
                      <TableHead className="font-semibold">BuildingNameEn</TableHead>
                      <TableHead className="font-semibold">Size</TableHead>
                      <TableHead className="font-semibold">UnitNumber</TableHead>
                      <TableHead className="font-semibold">PropertyTypeEn</TableHead>
                      <TableHead className="font-semibold">ProcedurePartyTypeNameEn</TableHead>
                      <TableHead className="font-semibold">NameEn</TableHead>
                      <TableHead className="font-semibold">Mobile</TableHead>
                      <TableHead className="font-semibold">ProcedureNameEn</TableHead>
                      <TableHead className="font-semibold">CountryNameEn</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Matches</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">
                          No properties found. Add your first property or sync from Google Sheets.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProperties.map((property) => (
                        <TableRow key={property.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-xs">
                            {property.regis || '-'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(property.procedure_value || property.price, property.currency || 'AED')}
                          </TableCell>
                          <TableCell>{property.master_project || '-'}</TableCell>
                          <TableCell className="font-medium">
                            {property.building_name || property.title}
                          </TableCell>
                          <TableCell>
                            {property.size} {property.size_unit}
                          </TableCell>
                          <TableCell>{property.unit_number || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {property.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{property.party_type || '-'}</TableCell>
                          <TableCell>
                            {property.owner_name && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate max-w-[100px]">{property.owner_name}</span>
                              </div>
                            )}
                            {!property.owner_name && '-'}
                          </TableCell>
                          <TableCell>
                            {property.owner_mobile && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs">{property.owner_mobile}</span>
                              </div>
                            )}
                            {!property.owner_mobile && '-'}
                          </TableCell>
                          <TableCell>{property.procedure_name || '-'}</TableCell>
                          <TableCell>{property.country || 'UAE'}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", statusColors[property.status])}>
                              {property.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {property.matches || 0}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditProperty(property)}>
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
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              Showing {filteredProperties.length} of {properties.length} properties • 
              Columns match Google Sheets for bidirectional sync
            </p>
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Edit Property Dialog */}
      {propertyToEdit && (
        <EditPropertyDialog
          property={propertyToEdit}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setPropertyToEdit(null);
          }}
        />
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Property</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the property (soft delete). The record will remain in Google Sheets 
              with Status changed to "Archived". This action can be undone by changing the status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
