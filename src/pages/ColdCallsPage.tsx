import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useColdCalls, useUpdateColdCall } from '@/hooks/useColdCalls';
import { useCreateProperty } from '@/hooks/useProperties';
import { CreateColdCallDialog } from '@/components/forms/CreateColdCallDialog';
import { ConvertColdCallDialog } from '@/components/forms/ConvertColdCallDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Search,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowRight,
  MoreHorizontal,
  Building2,
  Trash2,
  FileText,
} from 'lucide-react';
import { CallRecorder } from '@/components/calls/CallRecorder';
import type { Database } from '@/integrations/supabase/types';
import type { ColdCallWithProfile } from '@/hooks/useColdCalls';
import { useCallExportsStore, type CallExportedLead } from '@/store/callExportsStore';

type ColdCallStatus = Database['public']['Enums']['cold_call_status'];

const statusConfig: Record<ColdCallStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'text-status-new', bg: 'bg-pastel-blue', icon: Phone },
  called: { label: 'Called', color: 'text-status-viewing', bg: 'bg-pastel-orange', icon: Clock },
  interested: { label: 'Interested', color: 'text-status-closed', bg: 'bg-pastel-green', icon: CheckCircle },
  not_interested: { label: 'Not Interested', color: 'text-status-lost', bg: 'bg-pastel-red', icon: XCircle },
  converted: { label: 'Converted', color: 'text-status-contacted', bg: 'bg-pastel-purple', icon: UserPlus },
};

export default function ColdCallsPage() {
  const { data: coldCalls = [], isLoading } = useColdCalls();
  const updateColdCall = useUpdateColdCall();
  const createProperty = useCreateProperty();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const exportedLeads = useCallExportsStore((s) => s.exportedLeads);
  const removeExportedLeads = useCallExportsStore((s) => s.removeLeads);

  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'cold-calls' | 'exported'>(
    searchParams.get('view') === 'exported' ? 'exported' : 'cold-calls'
  );

  // Auto-switch to exported when new leads arrive
  useEffect(() => {
    if (exportedLeads.length > 0 && searchParams.get('view') === 'exported') {
      setActiveView('exported');
    }
  }, [exportedLeads.length, searchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ColdCallStatus | 'all'>('all');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedColdCall, setSelectedColdCall] = useState<ColdCallWithProfile | null>(null);

  const filteredCalls = useMemo(() => {
    return coldCalls.filter((call) => {
      const matchesSearch = 
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.phone.includes(searchQuery);
      
      const matchesStatus = filterStatus === 'all' || call.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [coldCalls, searchQuery, filterStatus]);

  const handleStatusChange = async (callId: string, status: ColdCallStatus) => {
    await updateColdCall.mutateAsync({
      id: callId,
      status,
      ...(status === 'called' ? { last_call_date: new Date().toISOString() } : {}),
    });
  };

  const handleConvertClick = (coldCall: ColdCallWithProfile) => {
    setSelectedColdCall(coldCall);
    setConvertDialogOpen(true);
  };

  const handleExportedToLead = async (lead: CallExportedLead) => {
    try {
      const { error } = await supabase.from('leads').insert({
        name: lead.name,
        email: lead.email || null,
        phone: lead.phone || 'N/A',
        source: 'other' as const,
        status: 'new' as const,
        priority: 'warm' as const,
        locations: lead.location ? [lead.location] : [],
        created_by: user?.id,
      });
      if (error) throw error;
      removeExportedLeads([lead.id]);
      toast.success(`${lead.name} converted to new lead`);
    } catch (err: any) {
      toast.error(`Failed to convert: ${err.message}`);
    }
  };

  const handleExportedToListing = async (lead: CallExportedLead) => {
    try {
      const property = await createProperty.mutateAsync({
        title: `Property from ${lead.name}`,
        type: 'apartment',
        price: 0,
        currency: 'AED',
        location: lead.location || 'TBD',
        bedrooms: 1,
        bathrooms: 1,
        size: 0,
        size_unit: 'sqft',
        description: `Listing sourced from exported lead: ${lead.name}`,
        features: [],
        images: [],
        status: 'available',
        section: 'database',
        database_status: 'interested',
        owner_name: lead.name,
        owner_mobile: lead.phone,
      });
      removeExportedLeads([lead.id]);
      // Navigate to properties page so user can convert to pocket/active
      if (property?.id) {
        navigate(`/properties?convert=${property.id}`);
      }
    } catch (err: any) {
      toast.error(`Failed to convert: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Cold Calls" subtitle="Manage and track your cold call prospects" />
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
        title="Cold Calls"
        subtitle="Manage and track your cold call prospects"
        actions={
          <CreateColdCallDialog
            trigger={
              <Button className="bg-gradient-primary hover:opacity-90">
                <Phone className="w-4 h-4 mr-2" />
                Add Prospect
              </Button>
            }
          />
        }
      />

      <PageContent>
        {/* Bottom Switcher */}
        <div className="flex items-center gap-0 bg-muted/40 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveView('cold-calls')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'cold-calls'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <Phone className="w-4 h-4" />
            Cold Calls ({coldCalls.length})
          </button>
          <button
            onClick={() => setActiveView('exported')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'exported'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <FileText className="w-4 h-4" />
            Exported Leads ({exportedLeads.length})
          </button>
        </div>

        {activeView === 'cold-calls' && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Status:</span>
                {(['all', 'new', 'called', 'interested', 'not_interested'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      filterStatus === status
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {status === 'all' ? 'All' : statusConfig[status].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cold Calls Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl shadow-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">Name</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Phone</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Status</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Location</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Budget</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Agent</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Last Call</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredCalls.map((call, index) => {
                        const StatusIcon = statusConfig[call.status].icon;
                        const agentName = call.profiles?.full_name || 'Unassigned';
                        
                        return (
                          <motion.tr
                            key={call.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  <span className="text-sm font-semibold text-foreground">
                                    {call.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{call.name}</p>
                                  {call.email && (
                                    <p className="text-xs text-muted-foreground">{call.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-foreground">{call.phone}</span>
                            </td>
                            <td className="py-4 px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="focus:outline-none">
                                    <Badge className={cn(
                                      "gap-1 cursor-pointer hover:opacity-80",
                                      statusConfig[call.status].bg,
                                      statusConfig[call.status].color
                                    )}>
                                      <StatusIcon className="w-3 h-3" />
                                      {statusConfig[call.status].label}
                                    </Badge>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {(['new', 'called', 'interested', 'not_interested'] as ColdCallStatus[]).map((status) => {
                                    const config = statusConfig[status];
                                    const Icon = config.icon;
                                    return (
                                      <DropdownMenuItem
                                        key={status}
                                        onClick={() => handleStatusChange(call.id, status)}
                                        disabled={call.status === 'converted' || updateColdCall.isPending}
                                      >
                                        <Icon className={cn("w-4 h-4 mr-2", config.color)} />
                                        {config.label}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {call.location || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm font-medium text-foreground">
                                {call.budget ? formatCurrency(call.budget) : '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {agentName}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {call.last_call_date ? formatDate(call.last_call_date) : 'Never'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-end gap-2">
                                {call.status !== 'converted' ? (
                                  <>
                                    <CallRecorder
                                      phoneNumber={call.phone}
                                      leadName={call.name}
                                      variant="icon"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatusChange(call.id, 'interested')}
                                      disabled={updateColdCall.isPending}
                                      title="Mark as Interested"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="bg-gradient-success hover:opacity-90"
                                        >
                                          <ArrowRight className="w-4 h-4 mr-1" />
                                          Convert
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleConvertClick(call)}>
                                          <UserPlus className="w-4 h-4 mr-2" />
                                          Convert to Lead
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleConvertClick(call)}>
                                          <Building2 className="w-4 h-4 mr-2" />
                                          Convert to Listing
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </>
                                ) : (
                                  <Badge variant="secondary">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Converted
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {filteredCalls.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No cold calls found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </motion.div>
          </>
        )}

        {activeView === 'exported' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl shadow-card overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Exported Leads from Review</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{exportedLeads.length} lead(s) exported for calling</p>
              </div>
              {exportedLeads.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => {
                    removeExportedLeads(exportedLeads.map((l) => l.id));
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Exported</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportedLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No exported leads</p>
                        <p className="text-sm">Export leads from the Review page to see them here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    exportedLeads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {lead.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{lead.phone}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.jobTitle}</TableCell>
                        <TableCell className="text-sm text-foreground">{lead.company}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(lead.exportedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleExportedToLead(lead)}
                              title="Convert to New Lead"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Lead</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleExportedToListing(lead)}
                              disabled={createProperty.isPending}
                              title="Convert to New Listing"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Listing</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => removeExportedLeads([lead.id])}
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </PageContent>

      {/* Convert Dialog */}
      <ConvertColdCallDialog
        coldCall={selectedColdCall}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
      />
    </MainLayout>
  );
}
