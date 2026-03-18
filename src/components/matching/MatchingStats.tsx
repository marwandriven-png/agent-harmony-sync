import { motion } from 'framer-motion';
import { Home, ExternalLink, Send, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyMatch } from '@/hooks/usePropertyMatches';

interface MatchingStatsProps {
  matches: PropertyMatch[];
}

export function MatchingStats({ matches }: MatchingStatsProps) {
  const internalCount = matches.filter(m => m.match_type === 'internal').length;
  const externalCount = matches.filter(m => m.match_type === 'external').length;
  const sentCount = matches.filter(m => m.status === 'sent').length;
  const flaggedCount = matches.filter(m => m.is_flagged).length;

  const stats = [
    {
      label: 'Total Matches',
      value: matches.length,
      icon: Home,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: 'Internal',
      value: internalCount,
      icon: Home,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      label: 'External',
      value: externalCount,
      icon: ExternalLink,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
    {
      label: 'Sent to Client',
      value: sentCount,
      icon: Send,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      label: 'Starred',
      value: flaggedCount,
      icon: Star,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-card rounded-xl p-4 shadow-card border border-border"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stat.value}
              </p>
            </div>
            <div className={cn("p-2.5 rounded-xl", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
