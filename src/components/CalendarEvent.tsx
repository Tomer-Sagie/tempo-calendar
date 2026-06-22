import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Lock, GripVertical, Repeat, Clock, CheckCircle2, SkipForward, Pencil, Hash, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CalendarEventType } from './TempoCalendar';

interface DraggableEventProps {
  event: CalendarEventType;
  isLocked?: boolean;
  onClick: (event: CalendarEventType) => void;
  onComplete?: (event: CalendarEventType) => void;
  onSkip?: (event: CalendarEventType) => void;
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
/** Fallback color for task events that don't have an explicit color. */
const DEFAULT_TASK_COLOR = '#6366f1';

// Priority color mapping for the indicator dot
const PRIORITY_COLORS: Record<string, string> = {
  ASAP: '#DC2626',
  HIGH: '#EA580C',
  NORMAL: '#2563EB',
  LOW: '#9CA3AF',
};

const PRIORITY_LABELS: Record<string, string> = {
  ASAP: 'ASAP',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

export function DraggableEvent({
  event,
  isLocked,
  onClick,
  onComplete,
  onSkip,
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
  const isSkipped = event.data?.is_skipped;
  const isGoogle = event.data?.source === 'google';
  const isRecurring = event.data?.is_recurring;
  const isBusyBlock = event.data?.is_busy_block;
  const isMissed = event.data?.is_missed;
  const isSplitChunk = event.data?.is_split_chunk;
  const splitPosition = event.data?.split_position;
  const taskColor = event.data?.color;
  const priority = event.data?.priority;
  const dueDate = event.data?.due_date;
  const tags = event.data?.tags;

  // For task events, use the task's assigned color as the left border accent.
  // Always apply a color so task events are never plain gray.
  const effectiveColor = taskColor && !isGoogle ? taskColor : (isGoogle ? '' : DEFAULT_TASK_COLOR);
  const colorBorder = effectiveColor ? { borderLeftColor: effectiveColor } : {};
  const colorBg = effectiveColor ? { backgroundColor: `${effectiveColor}18` } : {};

  // Priority indicator
  const priorityColor = priority ? PRIORITY_COLORS[priority] || PRIORITY_COLORS.NORMAL : null;

  // Reclaim-style: dashed border for flexible (non-locked) tasks, solid for fixed/locked
  const isFlexible = !isLocked && !isBusyBlock && !isGoogle;
  const style: React.CSSProperties = {
    ...positionStyle,
    ...colorBorder,
    ...(isGoogle ? {} : colorBg),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : isCompleted || isSkipped ? 0.55 : 1,
    zIndex: isDragging ? 50 : isGoogle ? 5 : 10,
    ...(isFlexible ? { borderStyle: 'dashed', borderWidth: '2px' } : {}),
    ...(isLocked || isBusyBlock ? { borderStyle: 'solid' } : {}),
  };

  // Show quick actions for task events that aren't completed, skipped, or google
  const showQuickActions = !isGoogle && !isCompleted && !isSkipped && (onComplete || onSkip);

  // Google event popover state — minimal Reclaim-style
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const eventRef = useRef<HTMLDivElement | null>(null);

  // Task event tooltip on hover (shows extra info)
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimer.current) { clearTimeout(tooltipTimer.current); tooltipTimer.current = null; }
  }, []);

  useEffect(() => () => clearTooltipTimer(), [clearTooltipTimer]);

  // Task click: brief pressed state before dialog opens
  const [taskPressed, setTaskPressed] = useState(false);
  const taskPressedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (taskPressedTimer.current) clearTimeout(taskPressedTimer.current); }, []);

  // Stable refs for scroll handlers so removeEventListener works correctly
  const scrollClosePopoverRef = useRef<() => void>(() => setShowPopover(false));

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          eventRef.current && !eventRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPopover(false); };
    const scrollClose = scrollClosePopoverRef.current;
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    window.addEventListener('scroll', scrollClose, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
      window.removeEventListener('scroll', scrollClose);
    };
  }, [showPopover]);

  // Tooltip mouse enter/leave with 400ms delay to avoid flickering
  const handleTooltipEnter = useCallback(() => {
    clearTooltipTimer();
    tooltipTimer.current = setTimeout(() => {
      if (eventRef.current && !isGoogle) {
        const rect = eventRef.current.getBoundingClientRect();
        const tooltipWidth = 224; // w-56
        const left = rect.right + 8 + tooltipWidth > window.innerWidth
          ? rect.left - tooltipWidth - 8
          : rect.right + 8;
        const top = Math.max(8, Math.min(rect.top, window.innerHeight - 320));
        setTooltipPos({ left, top });
        setShowTooltip(true);
      }
    }, 400);
  }, [isGoogle, clearTooltipTimer]);

  const handleTooltipLeave = useCallback(() => {
    clearTooltipTimer();
    const timer = setTimeout(() => setShowTooltip(false), 200);
    tooltipTimer.current = timer;
  }, [clearTooltipTimer]);

  const togglePopover = () => {
    if (!showPopover && eventRef.current) {
      const rect = eventRef.current.getBoundingClientRect();
      const popoverWidth = 240; // w-60
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
        if (!isDragging) {
          // Brief pressed state then open dialog
          setTaskPressed(true);
          if (taskPressedTimer.current) clearTimeout(taskPressedTimer.current);
          taskPressedTimer.current = setTimeout(() => setTaskPressed(false), 150);
          onClick(event);
        }
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleTooltipEnter}
      onMouseLeave={handleTooltipLeave}
      data-event-id={event.id}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} ${format(event.start, 'h:mma')} - ${format(event.end, 'h:mma')}`}
      title={event.title}
      className={cn(
        'absolute text-left px-2 py-1 rounded-[6px] overflow-hidden transition-shadow duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'border-l-[3px] leading-snug group/event',
        !isDragging && !isGoogle && 'hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.05)]',
        !isDragging && isGoogle && 'hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.05)]',
        small ? 'text-[11px]' : 'text-[12px]',
        isCompleted && 'line-through decoration-foreground/30',
        // Google events: subtle, muted, read-only look
        isGoogle && 'bg-event-external/70 border-event-external-border text-foreground/85 cursor-default',
        // Missed tasks: destructive tint
        isMissed && !isGoogle && 'bg-event-overdue/40 border-event-overdue-border text-foreground',
        // Locked tasks: solid green border, subtle fill
        isLocked && !isGoogle && 'bg-event-locked/40 border-event-locked-border text-foreground',
        // Busy blocks: solid primary border, stronger fill
        isBusyBlock && !taskColor && 'bg-primary/18 border-primary font-semibold',
        // Task variants (when no task color override): subtle, light
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && event.variant === 'secondary' && 'bg-event-task/30 border-event-task-border text-foreground',
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && event.variant === 'warning' && 'bg-warning/10 border-warning text-foreground',
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && event.variant === 'destructive' && 'bg-destructive/10 border-destructive text-foreground',
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && event.variant === 'success' && 'bg-success/10 border-success text-foreground',
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && event.variant === 'muted' && 'bg-muted/50 border-muted-foreground/20 text-foreground',
        !isGoogle && !isMissed && !isLocked && !isBusyBlock && !taskColor && (!event.variant || event.variant === 'primary') && 'bg-primary/10 border-primary text-foreground',
        isDragging && 'cursor-grabbing shadow-lg ring-1 ring-primary/30',
        !isDragging && draggable && !isLocked && 'cursor-grab',
        // Split task connectors: dashed bracket on left/right edges
        isSplitChunk && splitPosition !== 'last' && splitPosition !== 'only' && 'split-connector-right',
        isSplitChunk && splitPosition !== 'first' && splitPosition !== 'only' && 'split-connector-left',
        // Reclaim-style: dashed border for flexible tasks
        isFlexible && 'border-dashed',
        // Brief pressed state on click before dialog opens
        taskPressed && 'brightness-90',
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        {isLocked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-60" />}
        {isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-60" />}
        {/* Priority indicator dot */}
        {priorityColor && !isGoogle && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: priorityColor }}
            title={priority ? PRIORITY_LABELS[priority] || priority : undefined}
          />
        )}
        <span className={cn(
          'truncate flex-1 min-w-0',
          small ? 'text-[11px]' : 'text-[13px]',
          isGoogle ? 'font-medium' : 'font-semibold',
          isCompleted && 'line-through',
        )}>
          {event.title}
        </span>
        {/* Quick action buttons — appear on hover, replace grip */}
        {showQuickActions && !small && (
          <div
            className="flex items-center gap-0.5 ml-auto shrink-0 opacity-0 group-hover/event:opacity-100 transition-opacity duration-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {onComplete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onComplete(event); }}
                className="p-0.5 rounded-sm hover:bg-black/10 transition-colors"
                title="Complete task"
                aria-label="Complete task"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-foreground/70 hover:text-success" />
              </button>
            )}
            {onSkip && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSkip(event); }}
                className="p-0.5 rounded-sm hover:bg-black/10 transition-colors"
                title="Skip occurrence"
                aria-label="Skip task"
              >
                <SkipForward className="w-3.5 h-3.5 text-foreground/70 hover:text-warning" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick(event); }}
              className="p-0.5 rounded-sm hover:bg-black/10 transition-colors"
              title="Edit task"
              aria-label="Edit task"
            >
              <Pencil className="w-3 h-3 text-foreground/70" />
            </button>
          </div>
        )}
        {draggable && !isLocked && !small && !showQuickActions && (
          <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover/event:opacity-50 ml-auto" />
        )}
      </div>
      {!small && event.end.getTime() - event.start.getTime() > 20 * 60 * 1000 && (
        <div className={cn('flex items-center gap-1 text-muted-foreground text-[11px] mt-0.5', isCompleted && 'line-through')}>
          <Clock className="w-2.5 h-2.5 shrink-0" />
          <span className="tabular-nums">{format(event.start, 'h:mma')}</span>
          <span className="tabular-nums">{format(event.end, 'h:mma')}</span>
        </div>
      )}

      {/* Google event popover — minimal Reclaim-style, portal to escape overflow */}
      {isGoogle && showPopover && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] w-60 rounded-lg bg-popover border border-border/50 shadow-md p-3 animate-scale-in pointer-events-auto"
          style={{ left: popoverPos.left, top: popoverPos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-event-external-border mt-1.5 shrink-0" />
            <h4 className="text-[13px] font-semibold text-foreground leading-snug">{event.title}</h4>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="tabular-nums">
              {event.allDay
                ? format(event.start, 'MMM d')
                : `${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`
              }
            </span>
          </div>
          {event.data?.description && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              {event.data.description}
            </p>
          )}
        </div>,
        document.body,
      )}

      {/* Task event tooltip — shows extra info on hover (portal) */}
      {showTooltip && !isGoogle && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[100] w-56 rounded-lg bg-popover border border-border/50 shadow-lg p-3 animate-scale-in pointer-events-auto"
          style={{ left: tooltipPos.left, top: tooltipPos.top }}
          onMouseEnter={() => { clearTooltipTimer(); }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <h4 className="text-[13px] font-semibold text-foreground leading-snug">{event.title}</h4>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="tabular-nums">
              {event.allDay
                ? format(event.start, 'MMM d')
                : `${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`
              }
            </span>
          </div>
          {priority && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: priorityColor || undefined }}
              />
              <span className="text-[11px] font-medium" style={{ color: priorityColor || undefined }}>
                {PRIORITY_LABELS[priority] || priority}
              </span>
            </div>
          )}
          {dueDate && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="w-3 h-3 shrink-0" />
              <span>{(() => { try { return format(new Date(dueDate + (dueDate.includes('T') ? '' : 'T00:00:00')), 'MMM d, yyyy'); } catch { return dueDate; } })()}</span>
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )}
          {event.data?.description && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
              {event.data.description}
            </p>
          )}
        </div>,
        document.body,
      )}

      {/* Resize handles — always visible on task events, not hover-only */}
      {draggable && !isLocked && onResizeStart && (
        <>
          {/* Top handle */}
          <div
            className="absolute top-0 left-3 right-3 h-2.5 cursor-ns-resize z-30 opacity-0 group-hover/event:opacity-60 hover:!opacity-100 transition-opacity"
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
            className="absolute bottom-0 left-3 right-3 h-2.5 cursor-ns-resize z-30 opacity-0 group-hover/event:opacity-60 hover:!opacity-100 transition-opacity"
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
