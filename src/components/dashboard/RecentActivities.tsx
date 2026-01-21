import { useCRMStore } from '@/store/crmStore';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  FileText,
  ArrowRightLeft,
  Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ActivityType } from '@/types/crm';

const activityIcons: Record<ActivityType, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  WhatsApp: MessageSquare,
  Meeting: Calendar,
  Note: FileText,
  Task: FileText,
  'Status Change': ArrowRightLeft,
  'Property Sent': Send,
};

const activityColors: Record<ActivityType, string> = {
  Call: 'bg-pastel-blue text-status-new',
  Email: 'bg-pastel-purple text-status-contacted',
  WhatsApp: 'bg-pastel-green text-status-closed',
  Meeting: 'bg-pastel-orange text-status-viewing',
  Note: 'bg-muted text-muted-foreground',
  Task: 'bg-pastel-cyan text-status-viewed',
  'Status Change': 'bg-pastel-orange text-status-negotiation',
  'Property Sent': 'bg-pastel-blue text-primary',
};

export function RecentActivities() {
  const { activities, leads, agents } = useCRMStore();
  
  const recentActivities = activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Activities</h3>
          <p className="text-sm text-muted-foreground">Latest actions across all leads</p>
        </div>
      </div>

      <div className="space-y-4">
        {recentActivities.map((activity, index) => {
          const Icon = activityIcons[activity.type];
          const lead = leads.find(l => l.id === activity.leadId);
          const agent = agents.find(a => a.id === activity.createdBy);

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3 group"
            >
              <div className={cn(
                "p-2 rounded-lg flex-shrink-0",
                activityColors[activity.type]
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{lead?.name || 'Unknown Lead'}</span>
                  <span>•</span>
                  <span>{agent?.name || 'System'}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(activity.createdAt)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {recentActivities.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No recent activities</p>
        </div>
      )}
    </div>
  );
}
