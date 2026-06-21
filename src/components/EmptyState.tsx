import { memo } from 'react';
import { type LucideIcon, Calendar, ListTodo, Inbox, Sparkles, Plus, CalendarDays } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  variant: 'no-tasks' | 'no-scheduled' | 'no-events' | 'all-caught-up' | 'calendar-empty';
  onAction?: () => void;
  className?: string;
}

const CONFIG: Record<EmptyStateProps['variant'], {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
}> = {
  'no-tasks': {
    icon: ListTodo,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'No tasks yet',
    description: 'Add something you want to get done. We\'ll find the right time for it.',
    actionLabel: 'Create a task',
    actionIcon: Plus,
  },
  'no-scheduled': {
    icon: Calendar,
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    title: 'Nothing scheduled yet',
    description: 'You have tasks waiting. Click "Schedule All" to place them on your calendar.',
    actionLabel: 'Schedule all',
    actionIcon: Sparkles,
  },
  'no-events': {
    icon: CalendarDays,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    title: 'Your calendar is clear',
    description: 'No meetings or tasks scheduled for this view. Enjoy the free time!',
  },
  'all-caught-up': {
    icon: Inbox,
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    title: 'All caught up',
    description: 'Every task has been scheduled. Add more or take a break.',
    actionLabel: 'Add a task',
    actionIcon: Plus,
  },
  'calendar-empty': {
    icon: CalendarDays,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'Your week is wide open',
    description: 'Click anywhere on the calendar to add a task, or use the quick-add bar.',
    actionLabel: 'Add your first task',
    actionIcon: Plus,
  },
};

export const EmptyState = memo(function EmptyState({ variant, onAction, className }: EmptyStateProps) {
  const config = CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in', className)}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', config.iconBg)}>
        <Icon className={cn('w-6 h-6', config.iconColor)} />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{config.title}</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed mb-5">
        {config.description}
      </p>
      {config.actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="h-9 gap-2 px-4 animate-scale-in"
        >
          {config.actionIcon && <config.actionIcon className="w-3.5 h-3.5" />}
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
});
