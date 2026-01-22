import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  TrendingUp,
  Home,
  RefreshCw,
  Phone,
  User,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

// Import new components
import { StatusDragIcons, STATUS_DRAG_ICONS, DragStatusKey } from '@/components/properties/StatusDragIcons';
import { PropertyActivityLog, ActivityLogEntry } from '@/components/properties/PropertyActivityLog';
import { PropertyExpandedDetails } from '@/components/properties/PropertyExpandedDetails';
import {
  StatusModal,
  NoteModal,
  ActivityModal,
  AttachModal,
} from '@/components/properties/PropertyModals';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];

const statusColors: Record<PropertyStatus, string> = {
  available: 'bg-pastel-green text-success',
  under_offer: 'bg-pastel-orange text-warning',
  sold: 'bg-pastel-purple text-status-contacted',
  rented: 'bg-pastel-blue text-primary',
};

export default function PropertiesPage() {
  const { data: properties = [], isLoading, refetch } = useProperties();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  // UI State
  const [activeTab, setActiveTab] = useState('property-data');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [newListingDialogOpen, setNewListingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<PropertyRow | null>(null);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Drag and drop state
  const [draggedStatus, setDraggedStatus] = useState<DragStatusKey | null>(null);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

  // Modal state
  const [modalState, setModalState] = useState<{
    type: 'status' | 'note' | 'activity' | 'attach' | null;
    propertyId: string | null;
  }>({ type: null, propertyId: null });

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Toggle row expansion
  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Log activity
  const logActivity = useCallback(
    (propertyId: string, action: string, oldValue: string, newValue: string) => {
      const property = properties.find((p) => p.id === propertyId);
      if (!property) return;

      const log: ActivityLogEntry = {
        id: Date.now(),
        propertyId,
        buildingName: property.building_name || property.title,
        action,
        oldValue,
        newValue,
        user: 'Current User',
        timestamp: new Date().toISOString(),
        source: 'CRM',
      };
      setActivityLog((prev) => [log, ...prev]);
    },
    [properties]
  );

  // Handle drag status
  const handleStatusDragStart = (key: DragStatusKey) => {
    setDraggedStatus(key);
  };

  const handleRowDragOver = (e: React.DragEvent, propertyId: string) => {
    e.preventDefault();
    setDragOverRow(propertyId);
  };

  const handleRowDrop = async (e: React.DragEvent, propertyId: string) => {
    e.preventDefault();
    if (draggedStatus) {
      const statusInfo = STATUS_DRAG_ICONS[draggedStatus];
      const property = properties.find((p) => p.id === propertyId);
      if (property) {
        logActivity(propertyId, 'Quick Status Update', property.status, statusInfo.label);
        toast.success(`Status updated to "${statusInfo.label}"`);
        // Note: This is a UI-only quick status, actual DB status is enum-constrained
      }
    }
    setDraggedStatus(null);
    setDragOverRow(null);
  };

  // Handle edit
  const handleEditProperty = (property: PropertyRow) => {
    setPropertyToEdit(property);
    setEditDialogOpen(true);
  };

  // Handle status change
  const handleStatusChange = async (propertyId: string, status: PropertyStatus) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property) {
      logActivity(propertyId, 'Status Changed', property.status, status);
    }
    await updateProperty.mutateAsync({ id: propertyId, status });
  };

  // Handle note
  const handleAddNote = (note: string) => {
    if (modalState.propertyId) {
      logActivity(modalState.propertyId, 'Note Added', '', note);
      toast.success('Note added successfully');
    }
  };

  // Handle activity
  const handleAddActivity = (activityType: string) => {
    if (modalState.propertyId) {
      logActivity(modalState.propertyId, 'Activity Added', '', activityType);
      toast.success(`${activityType} activity added`);
    }
  };

  // Handle convert to listing
  const handleConvertToListing = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property) {
      logActivity(propertyId, 'Converted to Active Listing', property.status, 'available');
      handleStatusChange(propertyId, 'available');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (propertyToDelete) {
      const property = properties.find((p) => p.id === propertyToDelete);
      if (property) {
        logActivity(propertyToDelete, 'Archived', property.status, 'Archived');
      }
      await deleteProperty.mutateAsync(propertyToDelete);
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
    }
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

  const metrics = useMemo(
    () => ({
      total: properties.length,
      available: properties.filter((p) => p.status === 'available').length,
      underOffer: properties.filter((p) => p.status === 'under_offer').length,
      soldRented: properties.filter((p) => p.status === 'sold' || p.status === 'rented').length,
    }),
    [properties]
  );

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Properties" subtitle="Manage your property listings" />
        <PageContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
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
                      <Building2 className="w-6 h-6 text-status-contacted" />
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
                    Create a new property listing synced with Google Sheets. All fields match the
                    sheet columns for bidirectional sync.
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
            {/* Drag Status Icons */}
            <StatusDragIcons onDragStart={handleStatusDragStart} />

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

            {/* Property Table */}
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="font-semibold">BuildingName</TableHead>
                      <TableHead className="font-semibold">ProcedureValue</TableHead>
                      <TableHead className="font-semibold">Size</TableHead>
                      <TableHead className="font-semibold">UnitNumber</TableHead>
                      <TableHead className="font-semibold">PropertyType</TableHead>
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Mobile</TableHead>
                      <TableHead className="font-semibold">CountryName</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Matches</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="text-center py-12 text-muted-foreground"
                        >
                          No properties found. Add your first property or sync from Google Sheets.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProperties.map((property) => (
                        <AnimatePresence key={property.id}>
                          <TableRow
                            onDragOver={(e) => handleRowDragOver(e, property.id)}
                            onDrop={(e) => handleRowDrop(e, property.id)}
                            onDragLeave={() => setDragOverRow(null)}
                            className={cn(
                              'hover:bg-muted/50 cursor-pointer transition-all',
                              dragOverRow === property.id &&
                                'bg-primary/10 ring-2 ring-primary ring-inset'
                            )}
                          >
                            {/* Expand toggle */}
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(property.id)}
                              >
                                {expandedRows.has(property.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                            {/* BuildingName */}
                            <TableCell className="font-medium">
                              {property.building_name || property.title}
                            </TableCell>
                            {/* ProcedureValue */}
                            <TableCell className="font-medium">
                              {formatCurrency(
                                property.procedure_value || property.price,
                                property.currency || 'AED'
                              )}
                            </TableCell>
                            {/* Size */}
                            <TableCell>
                              {property.size} {property.size_unit}
                            </TableCell>
                            {/* UnitNumber */}
                            <TableCell>{property.unit_number || '-'}</TableCell>
                            {/* PropertyType */}
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {property.type}
                              </Badge>
                            </TableCell>
                            {/* Name (Owner) */}
                            <TableCell>
                              {property.owner_name ? (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                  <span className="truncate max-w-[100px]">
                                    {property.owner_name}
                                  </span>
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            {/* Mobile */}
                            <TableCell>
                              {property.owner_mobile ? (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs">{property.owner_mobile}</span>
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            {/* CountryName */}
                            <TableCell>{property.country || 'UAE'}</TableCell>
                            {/* Status */}
                            <TableCell>
                              <Select
                                value={property.status}
                                onValueChange={(value) =>
                                  handleStatusChange(property.id, value as PropertyStatus)
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    'w-[120px] h-8 text-xs',
                                    statusColors[property.status]
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Constants.public.Enums.property_status.map((status) => (
                                    <SelectItem key={status} value={status} className="capitalize">
                                      {status.replace('_', ' ')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            {/* Matches */}
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {property.matches || 0}%
                              </Badge>
                            </TableCell>
                            {/* Actions */}
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => handleEditProperty(property)}
                                  title="Edit Property"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setPropertyToDelete(property.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  title="Archive Property"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Details */}
                          {expandedRows.has(property.id) && (
                            <TableRow>
                              <TableCell colSpan={12} className="p-0">
                                <PropertyExpandedDetails property={property} />
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              Showing {filteredProperties.length} of {properties.length} properties • Columns match
              Google Sheets for bidirectional sync
            </p>

            {/* Activity Log */}
            <PropertyActivityLog logs={activityLog} />
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Modals */}
      <StatusModal
        open={modalState.type === 'status'}
        onOpenChange={(open) => !open && setModalState({ type: null, propertyId: null })}
        onSelect={(status) => {
          if (modalState.propertyId) {
            handleStatusChange(modalState.propertyId, status);
          }
        }}
      />

      <NoteModal
        open={modalState.type === 'note'}
        onOpenChange={(open) => !open && setModalState({ type: null, propertyId: null })}
        onSave={handleAddNote}
      />

      <ActivityModal
        open={modalState.type === 'activity'}
        onOpenChange={(open) => !open && setModalState({ type: null, propertyId: null })}
        onSelect={handleAddActivity}
      />

      <AttachModal
        open={modalState.type === 'attach'}
        onOpenChange={(open) => !open && setModalState({ type: null, propertyId: null })}
      />

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
