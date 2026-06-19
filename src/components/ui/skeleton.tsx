import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  /** Override the default animation style. */
  animate?: boolean;
  /** Inline styles (used for stagger animation-delay). */
  style?: React.CSSProperties;
}

/**
 * Skeleton — loading placeholder with a shimmer animation.
 *
 * Uses the `.skeleton` CSS class defined in `index.css` which applies a
 * shimmer gradient. Width/height/shape are controlled via `className`.
 */
export function Skeleton({ className, animate = true, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        animate && 'skeleton',
        className,
      )}
      style={style}
      aria-hidden
    />
  );
}

/**
 * Pre-built skeleton rows for the task list / sidebar loading state.
 * Renders `count` rows that mimic the layout of a TaskRow with staggered
 * animation delays for a polished loading feel.
 */
export function TaskRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-0" role="status" aria-label="Loading tasks">
      <span className="sr-only">Loading tasks…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Priority dot */}
          <Skeleton className="w-1.5 h-1.5 rounded-full shrink-0" style={{ animationDelay: `${i * 60}ms` }} />
          {/* Title + meta */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" style={{ animationDelay: `${i * 60 + 30}ms` }} />
            <Skeleton className="h-2.5 w-1/3" style={{ animationDelay: `${i * 60 + 60}ms` }} />
          </div>
          {/* Duration badge */}
          <Skeleton className="h-4 w-10 rounded" style={{ animationDelay: `${i * 60 + 90}ms` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the BentoSidebar — mimics QuickAdd + unscheduled task rows.
 * Lighter than TaskRowSkeleton (no meta line, no badge).
 */
export function SidebarSkeleton() {
  return (
    <div className="space-y-0" role="status" aria-label="Loading sidebar">
      <span className="sr-only">Loading…</span>
      {/* QuickAdd skeleton */}
      <div className="px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Skeleton className="w-4 h-4 rounded shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      </div>
      {/* Task row skeletons */}
      <div className="px-3 py-1.5 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5">
            <Skeleton className="w-1.5 h-1.5 rounded-full shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
            <Skeleton className="h-3.5 flex-1" style={{ animationDelay: `${i * 80 + 40}ms` }} />
            <Skeleton className="h-3 w-8 rounded" style={{ animationDelay: `${i * 80 + 80}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}


