import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'green' | 'red' | 'blue' | 'default';
}

export function KpiCard({ title, value, subtitle, variant = 'default' }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 space-y-1',
        variant === 'green' && 'kpi-glow-green',
        variant === 'red' && 'kpi-glow-red',
        variant === 'blue' && 'kpi-glow-blue',
      )}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{title}</p>
      <p className="text-2xl font-mono font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
