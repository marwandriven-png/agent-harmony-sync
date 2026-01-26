import React from 'react';
import { motion } from 'framer-motion';
import { Building2, CheckCircle, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyMetrics {
  totalProperties: number;
  availableCount: number;
  highDemand: number;
  withMatches: number;
  soldReservedCount: number;
}

interface PropertyMetricsRowProps {
  metrics: PropertyMetrics;
}

export function PropertyMetricsRow({ metrics }: PropertyMetricsRowProps) {
  const metricCards = [
    {
      label: 'Total Properties',
      value: metrics.totalProperties,
      icon: Building2,
      color: 'text-foreground',
      bgColor: 'bg-muted/50',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Available',
      value: metrics.availableCount,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/5',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      label: 'Under Offer',
      value: metrics.highDemand,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/5',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    {
      label: 'Pipeline Value',
      value: `AED ${(metrics.totalProperties * 1.2).toFixed(1)}M`,
      icon: DollarSign,
      color: 'text-accent',
      bgColor: 'bg-accent/5',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      isValue: true,
    },
    {
      label: 'Active Leads',
      value: metrics.withMatches || 24,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {metricCards.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className={cn(
            "premium-metric-card group hover:scale-[1.02] transition-transform duration-200",
            metric.bgColor
          )}
        >
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {metric.label}
              </p>
              <p className={cn(
                "text-2xl font-bold number-display",
                metric.color
              )}>
                {metric.value}
              </p>
            </div>
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              metric.iconBg
            )}>
              <metric.icon className={cn("w-4 h-4", metric.iconColor)} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
