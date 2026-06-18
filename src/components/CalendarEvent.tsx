import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Lock, GripVertical, Repeat, ExternalLink, Clock } from 'lucide-react';
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
  /** Start resizing from top or bottom edge */
  onResizeStart?: (direction: 'top' | 'bottom', clientY: number) => void;
}

/**
 * Wraps a positioned event block with @dnd-kit drag support.
 * Clicking opens the event; dragging moves it on the calendar grid.
 *
 * Visual hierarchy:
 *   - Locked tasks: strong border + lock icon
 *   - Busy blocks: stronger background + bold title
 *   - Recurring tasks: repeat icon + warning border
 *   - Google events: muted + subtle dot indicator
 *   - Completed tasks: strikethrough + reduced opacity
 *   - Missed tasks: destructive border + reduced opacity
 */
export function DraggableEvent({
  event,
  isLocked,
  onClick,
  draggable = true,
  small,
  positionStyle,
  onResizeStart,
}: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !draggable || isLocked,
    data: { event },
  });

  // Track whether a drag just occurred to prevent the click event that
  // fires immediately after a drag ends from opening the task dialog.
  const dragJustFinished = useRef(false);
  const dragTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    return () => {
      dragJustFinished.current = true;
      if (dragTimer.current) window.clearTimeout(dragTimer.current);
      dragTimer.current = window.setTimeout(() => {
        dragJustFinished.current = false;
      }, 120);
    };
  }, [isDragging]);

  const isCompleted = event.data?.is_completed;
  const isGoogle = event.data?.source === 'google';
  const isRecurring = event.data?.is_recurring;
  const isBusyBlock = event.data?.is_busy_block;
  const isMissed = event.data?.is_missed;
  const isSplitChunk = event.data?.is_split_chunk;
  const splitPosition = event.data?.split_position;
  const taskColor = event.data?.color;

  // For task events, use the task's assigned color as the left border accent
  const colorBorder = taskColor && !isGoogle ? { borderLeftColor: taskColor } : {};
  const colorBg = taskColor && !isGoogle ? { backgroundColor: `${taskColor}18` } : {};

  const style: React.CSSProperties = {
    ...positionStyle,
    ...colorBorder,
    ...(isGoogle ? {} : colorBg),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : isCompleted ? 0.55 : 1,
    zIndex: isDragging ? 50 : isGoogle ? 5 : 10,
  };

  // Google event popover state
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const eventRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          eventRef.current && !eventRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  const togglePopover = () => {
    if (!showPopover && eventRef.current) {
      const rect = eventRef.current.getBoundingClientRect();
      const popoverWidth = 256; // w-64
      const left = rect.right + 8 + popoverWidth > window.innerWidth
        ? rect.left - popoverWidth - 8
        : rect.right + 8;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 300));
      setPopoverPos({ left, top });
    }
    setShowPopover((v) => !v);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isGoogle) { togglePopover(); return; }
      onClick(event);
    }
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        eventRef.current = el;
      }}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (dragJustFinished.current) {
          dragJustFinished.current = false;
          return;
        }
        if (isGoogle) {
          togglePopover();
          return;
        }
        if (!isDragging) onClick(event);
      }}
      onKeyDown={handleKeyDown}
      data-event-id={event.id}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} ${format(event.start, 'h:mma')} - ${format(event.end, 'h:mma')}`}
      className={cn(
        'absolute text-left px-1.5 py-1 rounded-md overflow-hidden transition-shadow duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'border-l-[2.5px] leading-tight group/event',
        !isDragging && !isGoogle && 'hover:shadow-md hover:scale-[1.015]',
        !isDragging && isGoogle && 'hover:shadow-sm',
        small ? 'text-[10px]' : 'text-[11px]',
        isCompleted && 'line-through decoration-foreground/30',
        // Google events: distinctive read-only look
        isGoogle && 'bg-event-external/60 border-event-external-border text-foreground/80 cursor-default',
        // Missed tasks: warm red tint with alert feel
        isMissed && !isGoogle && 'bg-event-overdue/50 border-event-overdue-border text-foreground',
        // Locked tasks: green tint with lock feel
        isLocked && !isGoogle && 'bg-event-locked/40 border-event-locked-border text-foreground',
        // Task variants (when no task color override)
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'primary' && 'bg-primary/12 border-primary text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'secondary' && 'bg-event-task/35 border-event-task-border text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'warning' && 'bg-warning/12 border-warning text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'destructive' && 'bg-destructive/12 border-destructive text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'success' && 'bg-success/12 border-success text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && event.variant === 'muted' && 'bg-muted/60 border-muted-foreground/20 text-foreground',
        !isGoogle && !isMissed && !isLocked && !taskColor && (!event.variant || event.variant === 'primary') && 'bg-primary/12 border-primary text-foreground',
        isDragging && 'cursor-grabbing shadow-xl ring-2 ring-primary/40',
        !isDragging && draggable && !isLocked && 'cursor-grab',
        isBusyBlock && !taskColor && 'bg-primary/20 border-primary font-semibold',
        // Split task connectors: dashed bracket on left/right edges
        isSplitChunk && splitPosition !== 'last' && splitPosition !== 'only' && 'split-connector-right',
        isSplitChunk && splitPosition !== 'first' && splitPosition !== 'only' && 'split-connector-left',
      )}
    >
      <div className="flex items-center gap-1">
        {isLocked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-60" />}
        {isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-60" />}
        {isGoogle && <ExternalLink className="w-2 h-2 shrink-0 opacity-40" />}
        <span className={cn(
          'truncate',
          small ? 'text-[10px]' : 'text-[12px]',
          isGoogle ? 'font-medium' : 'font-semibold',
          isCompleted && 'line-through',
        )}>
          {event.title}
        </span>
        {draggable && !isLocked && !small && (
          <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover/event:opacity-50 ml-auto" />
        )}
      </div>
      {!small && event.end.getTime() - event.start.getTime() > 30 * 60 * 1000 && (
        <div className={cn('text-muted-foreground text-[10px] mt-0.5 num', isCompleted && 'line-through')}>
          {format(event.start, 'h:mma')} - {format(event.end, 'h:mma')}
        </div>
      )}

      {/* Google event popover — rendered via portal to escape overflow-hidden */}
      {isGoogle && showPopover && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] w-64 rounded-xl bg-popover border border-border shadow-xl p-3.5 animate-scale-in pointer-events-auto"
          style={{ left: popoverPos.left, top: popoverPos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground leading-tight">{event.title}</h4>
            <span className="w-1.5 h-1.5 rounded-full bg-event-external-border mt-1.5 shrink-0" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="num">{format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}</span>
          </div>
          {event.data?.description && (
            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {event.data.description}
            </p>
          )}
          <div className="mt-2.5 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">Google Calendar</span>
          </div>
        </div>,
        document.body,
      )}

      {/* Resize handles — always visible on task events, not hover-only */}
      {draggable && !isLocked && onResizeStart && (
        <>
          {/* Top handle */}
          <div
            className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize z-30 opacity-40 hover:opacity-80 transition-opacity"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart('top', e.clientY);
            }}
            title="Drag to resize top"
          >
            <div className="h-full bg-foreground/30 rounded-full" />
          </div>
          {/* Bottom handle */}
          <div
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-30 opacity-40 hover:opacity-80 transition-opacity"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart('bottom', e.clientY);
            }}
            title="Drag to resize bottom"
          >
            <div className="h-full bg-foreground/30 rounded-full" />
          </div>
        </>
      )}
    </div>
  );
}
