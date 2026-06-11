import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Lock, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CalendarEventType } from './TempoCalendar';

interface DraggableEventProps {
  event: CalendarEventType;
  isLocked?: boolean;
  onClick: (event: CalendarEventType) => void;
  /** Disable drag (e.g., for google events we don't own) */
  draggable?: boolean;
  /** Small variant for week view */
  small?: boolean;
  /** Absolute positioning within the parent grid */
  positionStyle?: React.CSSProperties;
}

/**
 * Wraps a positioned event block with @dnd-kit drag support.
 * Clicking opens the event; dragging moves it on the calendar grid.
 */
export function DraggableEvent({
  event,
  isLocked,
  onClick,
  draggable = true,
  small,
  positionStyle,
}: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !draggable || isLocked,
    data: { event },
  });

  const style: React.CSSProperties = {
    ...positionStyle,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 10,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClick(event);
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'absolute text-left px-1.5 py-1 rounded-md overflow-hidden transition-shadow duration-150',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'border-l-2 leading-tight group/event',
        !isDragging && 'hover:scale-[1.015]',
        small ? 'text-[10px]' : 'text-[11px]',
        event.variant === 'primary' && 'bg-primary/15 border-primary text-foreground',
        event.variant === 'secondary' && 'bg-event-task/40 border-event-task-border text-foreground',
        event.variant === 'warning' && 'bg-warning/15 border-warning text-foreground',
        event.variant === 'destructive' && 'bg-destructive/15 border-destructive text-foreground',
        event.variant === 'success' && 'bg-success/15 border-success text-foreground',
        event.variant === 'muted' && 'bg-muted border-muted-foreground/30 text-foreground',
        (!event.variant || event.variant === 'primary') && 'bg-primary/15 border-primary text-foreground',
        isDragging && 'cursor-grabbing shadow-xl ring-2 ring-primary/40',
        !isDragging && draggable && !isLocked && 'cursor-grab',
      )}
    >
      <div className="flex items-center gap-1">
        {isLocked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-60" />}
        <span className={cn('font-semibold truncate', small ? 'text-[10px]' : 'text-[12px]')}>
          {event.title}
        </span>
        {draggable && !isLocked && !small && (
          <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover/event:opacity-50 ml-auto" />
        )}
      </div>
      {!small && event.end.getTime() - event.start.getTime() > 30 * 60 * 1000 && (
        <div className="text-muted-foreground text-[10px] mt-0.5 num">
          {format(event.start, 'h:mma')} – {format(event.end, 'h:mma')}
        </div>
      )}
    </div>
  );
}
