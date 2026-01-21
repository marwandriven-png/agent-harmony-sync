import { useCRMStore } from '@/store/crmStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const stages = [
  { id: 'new', label: 'New', color: 'bg-status-new' },
  { id: 'contacted', label: 'Contacted', color: 'bg-status-contacted' },
  { id: 'viewing', label: 'Viewing', color: 'bg-status-viewing' },
  { id: 'viewed', label: 'Viewed', color: 'bg-status-viewed' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-status-negotiation' },
  { id: 'closed', label: 'Closed', color: 'bg-status-closed' },
];

export function PipelineFunnel() {
  const { leads } = useCRMStore();
  const navigate = useNavigate();

  const stageCounts = stages.map(stage => ({
    ...stage,
    count: leads.filter(l => l.status === stage.id).length,
  }));

  const maxCount = Math.max(...stageCounts.map(s => s.count), 1);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pipeline Overview</h3>
          <p className="text-sm text-muted-foreground">Lead distribution by stage</p>
        </div>
        <button 
          onClick={() => navigate('/leads')}
          className="text-sm text-primary hover:underline"
        >
          View all leads →
        </button>
      </div>

      <div className="space-y-3">
        {stageCounts.map((stage, index) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group cursor-pointer"
            onClick={() => navigate('/leads')}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", stage.color)} />
                <span className="text-sm font-medium text-foreground">{stage.label}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{stage.count}</span>
            </div>
            <div className="h-8 bg-muted rounded-lg overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stage.count / maxCount) * 100}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className={cn(
                  "h-full rounded-lg transition-all group-hover:opacity-80",
                  stage.color
                )}
                style={{ minWidth: stage.count > 0 ? '24px' : '0' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Active Leads</span>
          <span className="font-semibold text-foreground">
            {leads.filter(l => l.status !== 'closed' && l.status !== 'lost').length}
          </span>
        </div>
      </div>
    </div>
  );
}
