import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, children }: PageHeaderProps) {
  return (
    <header className={cn("px-6 py-6 bg-card border-b border-border sticky top-0 z-10", className)}>
      <div className="flex items-center justify-between">
        {children ? children : (
          <div>
            {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
            {subtitle && (
              <p className="text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContent({ children, className, noPadding }: PageContentProps) {
  return (
    <div className={cn(
      "animate-fade-in",
      !noPadding && "p-6",
      className
    )}>
      {children}
    </div>
  );
}
