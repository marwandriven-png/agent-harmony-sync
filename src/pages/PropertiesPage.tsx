import React, { useState, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useProperties, useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import {
  Building2,
  Plus,
  Search,
  Edit3,
  Trash2,
  RefreshCw,
  Phone,
  X,
  ChevronRight,
  Clock,
  MessageSquare,
  Home,
  Paperclip,
  Calendar,
  Save,
} from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];

// Status options with CRM colors
const STATUS_OPTIONS = [
  { value: 'available', color: 'bg-success', label: 'Available', icon: '✓' },
  { value: 'under_offer', color: 'bg-warning', label: 'Under Offer', icon: '👁️' },
  { value: 'sold', color: 'bg-status-contacted', label: 'Sold', icon: '✓' },
  { value: 'rented', color: 'bg-primary', label: 'Rented', icon: '🏠' },
];

// Drag status icons
const STATUS_DRAG_ICONS = {
  'not-answering': { icon: '📵', label: 'Not Answering', colorClass: 'bg-warning text-warning-foreground' },
  'not-working': { icon: '❌', label: 'Not Working', colorClass: 'bg-destructive text-destructive-foreground' },
  'red-flag': { icon: '🚩', label: 'Red Flag', colorClass: 'bg-destructive text-destructive-foreground' },
  'new-listing': { icon: '🆕', label: 'New Listing', colorClass: 'bg-success text-success-foreground' },
  'busy': { icon: '⏰', label: 'Busy', colorClass: 'bg-accent text-accent-foreground' },
};

type DragStatusKey = keyof typeof STATUS_DRAG_ICONS;

interface ActivityLogEntry {
  id: number;
  propertyId: string;
  buildingName: string;
  action: string;
  oldValue: string;
  newValue: string;
  user: string;
  timestamp: string;
  source: string;
}

export default function PropertiesPage() {
  const { data: properties = [], isLoading, refetch } = useProperties();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<PropertyRow | null>(null);

  // Swipe & expand state
  const [swipedRow, setSwipedRow] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});

  // Drag state
  const [draggedStatus, setDraggedStatus] = useState<DragStatusKey | null>(null);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState<{ type: 'status' | 'note' | 'activity' | 'attach' | null; propertyId: string | null }>({
    type: null,
    propertyId: null,
  });
  const [noteText, setNoteText] = useState('');

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Touch refs
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // Log activity
  const logActivity = useCallback(
    (propertyId: string, action: string, oldValue: string, newValue: string) => {
      const property = properties.find((p) => p.id === propertyId);
      if (!property) return;

      const log: ActivityLogEntry = {
        id: Date.now(),
        propertyId,
        buildingName: property.building_name || property.title || 'Unknown',
        action,
        oldValue,
        newValue,
        user: 'Current User',
        timestamp: new Date().toISOString(),
        source: 'Slide Action',
      };
      setActivityLog((prev) => [log, ...prev]);
    },
    [properties]
  );

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent, propertyId: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, propertyId: string) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff > 0 && diff < 300) {
      setSwipeOffset({ [propertyId]: diff });
    }
  };

  const handleTouchEnd = (propertyId: string) => {
    const diff = swipeOffset[propertyId] || 0;
    if (diff > 100) {
      setSwipedRow(propertyId);
      setSwipeOffset({});
    } else {
      setSwipeOffset({});
    }
  };

  const handleRowClick = (propertyId: string) => {
    if (swipedRow) {
      setSwipedRow(null);
    } else {
      setExpandedRow(expandedRow === propertyId ? null : propertyId);
    }
  };

  // Drag handlers
  const handleStatusDragStart = (e: React.DragEvent, key: DragStatusKey) => {
    setDraggedStatus(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e: React.DragEvent, propertyId: string) => {
    e.preventDefault();
    setDragOverRow(propertyId);
  };

  const handleRowDrop = (e: React.DragEvent, propertyId: string) => {
    e.preventDefault();
    if (draggedStatus) {
      const statusInfo = STATUS_DRAG_ICONS[draggedStatus];
      const property = properties.find((p) => p.id === propertyId);
      if (property) {
        logActivity(propertyId, 'Status Changed', property.status, statusInfo.label);
        toast.success(`Status updated to "${statusInfo.label}"`);
      }
    }
    setDraggedStatus(null);
    setDragOverRow(null);
  };

  // Actions
  const handleStatusChange = async (propertyId: string, status: PropertyStatus) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property) {
      logActivity(propertyId, 'Status Changed', property.status, status);
    }
    await updateProperty.mutateAsync({ id: propertyId, status });
    setSwipedRow(null);
    setShowModal({ type: null, propertyId: null });
  };

  const handleAddNote = (propertyId: string) => {
    if (!noteText.trim()) return;
    logActivity(propertyId, 'Note Added', '', noteText);
    toast.success('Note added successfully');
    setNoteText('');
    setShowModal({ type: null, propertyId: null });
    setSwipedRow(null);
  };

  const handleConvertToListing = async (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property) {
      logActivity(propertyId, 'Converted to Listing', property.status, 'available');
      await updateProperty.mutateAsync({ id: propertyId, status: 'available' });
      toast.success('Converted to active listing');
    }
    setSwipedRow(null);
  };

  const handleAddActivity = (propertyId: string, activityType: string) => {
    logActivity(propertyId, 'Activity Added', '', activityType);
    toast.success(`${activityType} activity added`);
    setShowModal({ type: null, propertyId: null });
    setSwipedRow(null);
  };

  const handleDelete = async () => {
    if (propertyToDelete) {
      const property = properties.find((p) => p.id === propertyToDelete);
      if (property) {
        logActivity(propertyToDelete, 'Archived', property.status, 'Archived');
      }
      await deleteProperty.mutateAsync(propertyToDelete);
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
      setSwipedRow(null);
    }
  };

  const handleEditProperty = (property: PropertyRow) => {
    setPropertyToEdit(property);
    setEditDialogOpen(true);
  };

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        property.title?.toLowerCase().includes(searchLower) ||
        property.building_name?.toLowerCase().includes(searchLower) ||
        property.owner_name?.toLowerCase().includes(searchLower) ||
        property.location?.toLowerCase().includes(searchLower);

      const matchesType = filterType === 'all' || property.type === filterType;
      const matchesStatus = filterStatus === 'all' || property.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [properties, searchQuery, filterType, filterStatus]);

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
        subtitle={`${filteredProperties.length} active properties`}
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
        {/* Drag Status Icons */}
        <div className="bg-card rounded-xl p-4 shadow-card mb-4 border border-border">
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            🎯 Drag status icon to property row:
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(STATUS_DRAG_ICONS).map(([key, info]) => (
              <div
                key={key}
                draggable
                onDragStart={(e) => handleStatusDragStart(e, key as DragStatusKey)}
                className={cn(
                  info.colorClass,
                  'px-3 py-1.5 rounded-lg text-xs font-semibold cursor-move flex items-center gap-2',
                  'hover:scale-105 hover:shadow-md transition-all active:cursor-grabbing'
                )}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by building, owner..."
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

        {/* Properties Table */}
        <div className="bg-card rounded-xl shadow-card overflow-hidden border border-border">
          {/* Table Header */}
          <div className="bg-sidebar text-sidebar-foreground px-4 py-3 grid grid-cols-12 gap-4 text-xs font-semibold">
            <div className="col-span-2">Building Name</div>
            <div className="col-span-1">Size</div>
            <div className="col-span-2">Buyer/Seller</div>
            <div className="col-span-2">Owner Mobile</div>
            <div className="col-span-1">Country</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Matches</div>
            <div className="col-span-2">Actions</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border">
            {filteredProperties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No properties found. Add your first property or sync from Google Sheets.
              </div>
            ) : (
              filteredProperties.map((property) => (
                <div key={property.id}>
                  {/* Main Row */}
                  <div
                    className={cn(
                      'relative overflow-hidden transition-all',
                      dragOverRow === property.id && 'bg-primary/10 ring-2 ring-primary ring-inset'
                    )}
                    onDragOver={(e) => handleRowDragOver(e, property.id)}
                    onDrop={(e) => handleRowDrop(e, property.id)}
                    onDragLeave={() => setDragOverRow(null)}
                  >
                    {/* Swipe Action Buttons (Background) */}
                    {swipedRow === property.id && (
                      <div className="absolute inset-0 bg-muted flex items-center gap-2 px-4 z-0">
                        <button
                          onClick={() => setShowModal({ type: 'status', propertyId: property.id })}
                          className="bg-primary text-primary-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Change Status"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowModal({ type: 'note', propertyId: property.id })}
                          className="bg-secondary text-secondary-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Add Note"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleConvertToListing(property.id)}
                          className="bg-success text-success-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Convert to Listing"
                        >
                          <Home className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowModal({ type: 'attach', propertyId: property.id })}
                          className="bg-accent text-accent-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Attach Documents"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowModal({ type: 'activity', propertyId: property.id })}
                          className="bg-warning text-warning-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Add Activity"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setPropertyToDelete(property.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="bg-destructive text-destructive-foreground p-2 rounded-lg hover:opacity-90 transition"
                          title="Archive Property"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Row Content */}
                    <div
                      className={cn(
                        'relative z-10 bg-card px-4 py-3 grid grid-cols-12 gap-4 items-center cursor-pointer hover:bg-muted/50 transition-all',
                        swipedRow === property.id && 'translate-x-12'
                      )}
                      style={{
                        transform: swipeOffset[property.id]
                          ? `translateX(${swipeOffset[property.id]}px)`
                          : undefined,
                      }}
                      onTouchStart={(e) => handleTouchStart(e, property.id)}
                      onTouchMove={(e) => handleTouchMove(e, property.id)}
                      onTouchEnd={() => handleTouchEnd(property.id)}
                      onClick={() => handleRowClick(property.id)}
                    >
                      <div className="col-span-2 font-semibold text-foreground text-sm">
                        {property.building_name || property.title || 'Unknown Building'}
                      </div>
                      <div className="col-span-1 text-muted-foreground text-sm">
                        {property.size} {property.size_unit}
                      </div>
                      <div className="col-span-2 text-foreground text-sm">
                        {property.owner_name || '-'}
                      </div>
                      <div className="col-span-2 text-muted-foreground text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {property.owner_mobile || '-'}
                      </div>
                      <div className="col-span-1 text-muted-foreground text-sm">
                        {property.country || 'UAE'}
                      </div>
                      <div className="col-span-1">
                        <Badge
                          className={cn(
                            'text-xs font-medium',
                            property.status === 'available' && 'bg-success text-success-foreground',
                            property.status === 'under_offer' && 'bg-warning text-warning-foreground',
                            property.status === 'sold' && 'bg-status-contacted text-white',
                            property.status === 'rented' && 'bg-primary text-primary-foreground'
                          )}
                        >
                          {property.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <Badge variant="outline" className="font-mono bg-pastel-blue text-primary">
                          {property.matches || 0}
                        </Badge>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        {swipedRow === property.id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwipedRow(null);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwipedRow(property.id);
                            }}
                            className="text-primary hover:text-primary/80"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedRow === property.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-muted/30 px-6 py-4 border-t border-border"
                      >
                        {/* Primary row - ProcedureValue and CountryName */}
                        <div className="grid grid-cols-2 gap-6 mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <div>
                            <span className="font-bold text-primary text-xs uppercase tracking-wide">
                              Procedure Value:
                            </span>
                            <p className="text-foreground mt-1 text-lg font-semibold">
                              {formatCurrency(property.procedure_value || property.price, property.currency || 'AED')}
                            </p>
                          </div>
                          <div>
                            <span className="font-bold text-primary text-xs uppercase tracking-wide">
                              Country Name:
                            </span>
                            <p className="text-foreground mt-1 text-lg font-semibold">
                              {property.country || 'UAE'}
                            </p>
                          </div>
                        </div>

                        {/* Secondary details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Unit Number:
                            </span>
                            <p className="text-foreground mt-0.5">{property.unit_number || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Property Type:
                            </span>
                            <p className="text-foreground mt-0.5 capitalize">{property.type}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Party Type:
                            </span>
                            <p className="text-foreground mt-0.5">{property.party_type || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Master Project:
                            </span>
                            <p className="text-foreground mt-0.5">{property.master_project || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              ID Number:
                            </span>
                            <p className="text-foreground mt-0.5">{(property as any).id_number || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              UAE ID:
                            </span>
                            <p className="text-foreground mt-0.5">{(property as any).uae_id_number || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Passport Expiry:
                            </span>
                            <p className="text-foreground mt-0.5">{(property as any).passport_expiry_date || '-'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                              Birth Date:
                            </span>
                            <p className="text-foreground mt-0.5">{(property as any).birth_date || '-'}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Showing {filteredProperties.length} of {properties.length} properties • Swipe right or click arrow for quick actions
        </p>

        {/* Activity Log */}
        {activityLog.length > 0 && (
          <div className="mt-6 bg-card rounded-xl shadow-card p-4 border border-border">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-primary" />
              Recent Activity
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activityLog.slice(0, 10).map((log) => (
                <div key={log.id} className="bg-muted/50 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{log.buildingName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-medium text-primary">{log.action}</span>
                    {log.oldValue && ` from "${log.oldValue}"`}
                    {log.newValue && ` to "${log.newValue}"`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    by {log.user} via {log.source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageContent>

      {/* Status Modal */}
      {showModal.type === 'status' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-4 text-foreground">Change Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(showModal.propertyId!, status.value as PropertyStatus)}
                  className={cn(
                    status.color,
                    'text-white px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2'
                  )}
                >
                  <span>{status.icon}</span>
                  {status.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal({ type: null, propertyId: null })}
              className="mt-4 w-full bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showModal.type === 'note' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-4 text-foreground">Add Note</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full border border-border bg-background text-foreground rounded-lg p-3 h-32 focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter your note..."
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleAddNote(showModal.propertyId!)}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Note
              </button>
              <button
                onClick={() => setShowModal({ type: null, propertyId: null })}
                className="flex-1 bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showModal.type === 'activity' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-4 text-foreground">Add Activity</h3>
            <div className="grid grid-cols-2 gap-2">
              {['Call', 'Meeting', 'Viewing', 'Follow-up'].map((activity) => (
                <button
                  key={activity}
                  onClick={() => handleAddActivity(showModal.propertyId!, activity)}
                  className="bg-warning text-warning-foreground px-4 py-3 rounded-lg hover:opacity-90 transition font-medium"
                >
                  {activity}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal({ type: null, propertyId: null })}
              className="mt-4 w-full bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attach Modal */}
      {showModal.type === 'attach' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-4 text-foreground">Attach Documents</h3>
            <div className="space-y-2">
              {['Emirates ID', 'Passport', 'Title Deed', 'SPA', 'Other'].map((doc) => (
                <button
                  key={doc}
                  className="w-full bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-2"
                >
                  <Paperclip className="w-4 h-4" />
                  Upload {doc}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal({ type: null, propertyId: null })}
              className="mt-4 w-full bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
