import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Search,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowRight,
  Flame,
  Thermometer,
  Snowflake,
} from 'lucide-react';
import { ColdCallStatus } from '@/types/crm';

const statusConfig: Record<ColdCallStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'text-status-new', bg: 'bg-pastel-blue', icon: Phone },
  called: { label: 'Called', color: 'text-status-viewing', bg: 'bg-pastel-orange', icon: Clock },
  interested: { label: 'Interested', color: 'text-status-closed', bg: 'bg-pastel-green', icon: CheckCircle },
  not_interested: { label: 'Not Interested', color: 'text-status-lost', bg: 'bg-pastel-red', icon: XCircle },
  converted: { label: 'Converted', color: 'text-status-contacted', bg: 'bg-pastel-purple', icon: UserPlus },
};

export default function ColdCallsPage() {
  const { coldCalls, convertColdCallToLead, updateColdCallStatus, agents } = useCRMStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ColdCallStatus | 'all'>('all');

  const filteredCalls = useMemo(() => {
    return coldCalls.filter((call) => {
      const matchesSearch = 
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.phone.includes(searchQuery);
      
      const matchesStatus = filterStatus === 'all' || call.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [coldCalls, searchQuery, filterStatus]);

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || 'Unassigned';
  };

  const handleConvert = (callId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    convertColdCallToLead(callId);
  };

  const handleStatusChange = (callId: string, status: ColdCallStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    updateColdCallStatus(callId, status);
  };

  return (
    <MainLayout>
      <PageHeader
        title="Cold Calls"
        subtitle="Manage and track your cold call prospects"
        actions={
          <Button className="bg-gradient-primary hover:opacity-90">
            <Phone className="w-4 h-4 mr-2" />
            Add Prospect
          </Button>
        }
      />

      <PageContent>
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

        {/* Table */}
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
                    
                    return (
                      <motion.tr
                        key={call.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
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
                          <Badge className={cn(
                            "gap-1",
                            statusConfig[call.status].bg,
                            statusConfig[call.status].color
                          )}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig[call.status].label}
                          </Badge>
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
                            {getAgentName(call.assignedAgent)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-muted-foreground">
                            {call.lastCallDate ? formatDate(call.lastCallDate) : 'Never'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleStatusChange(call.id, 'called', e)}
                              disabled={call.status === 'converted'}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleStatusChange(call.id, 'interested', e)}
                              disabled={call.status === 'converted'}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            {call.status !== 'converted' && (
                              <Button
                                size="sm"
                                onClick={(e) => handleConvert(call.id, e)}
                                className="bg-gradient-success hover:opacity-90"
                              >
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Convert
                              </Button>
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
      </PageContent>
    </MainLayout>
  );
}
