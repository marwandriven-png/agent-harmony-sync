import { useCRMStore } from '@/store/crmStore';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp } from 'lucide-react';

export function AgentPerformance() {
  const { agents } = useCRMStore();

  const sortedAgents = [...agents].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Agent Performance</h3>
          <p className="text-sm text-muted-foreground">Monthly revenue by agent</p>
        </div>
        <Trophy className="w-5 h-5 text-warning" />
      </div>

      <div className="space-y-4">
        {sortedAgents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
              index === 0 && "bg-warning text-warning-foreground",
              index === 1 && "bg-muted text-muted-foreground",
              index === 2 && "bg-accent/20 text-accent",
              index > 2 && "bg-muted text-muted-foreground"
            )}>
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(agent.revenue)}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  {agent.leadsCount} leads
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {agent.closedDeals} deals
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-success">
            <TrendingUp className="w-4 h-4" />
            <span>Team performing above target</span>
          </div>
        </div>
      </div>
    </div>
  );
}
