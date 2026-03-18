import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Globe, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PropertySection = 'pocket_listing' | 'active_listing' | 'database';

interface PropertySectionTabsProps {
  activeSection: PropertySection;
  onSectionChange: (section: PropertySection) => void;
  counts: {
    pocket_listing: number;
    active_listing: number;
    database: number;
  };
}

const sections = [
  { id: 'pocket_listing' as const, label: 'Pocket Listings', icon: Briefcase, description: 'Off-market properties' },
  { id: 'active_listing' as const, label: 'Active Listings', icon: Globe, description: 'Published listings' },
  { id: 'database' as const, label: 'Database', icon: Database, description: 'Sourcing & qualification' },
];

export function PropertySectionTabs({ activeSection, onSectionChange, counts }: PropertySectionTabsProps) {
  return (
    <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        const count = counts[section.id];

        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-200",
              "text-sm font-medium",
              isActive
                ? "text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeSection"
                className="absolute inset-0 bg-foreground rounded-lg shadow-card"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{section.label}</span>
              <span className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full",
                isActive
                  ? "bg-background text-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {count}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
