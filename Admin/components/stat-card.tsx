import React from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'purple';
}

export function StatCard({
  title,
  value,
  description,
  icon,
  color = 'blue',
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-primary/12 text-primary',
    green: 'bg-secondary/16 text-secondary',
    red: 'bg-error-container text-error',
    purple: 'bg-tertiary/16 text-tertiary',
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-[0_10px_30px_rgba(71,102,75,0.10)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {icon && (
          <div className={clsx('p-3 rounded-xl border border-border/60', colorClasses[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
