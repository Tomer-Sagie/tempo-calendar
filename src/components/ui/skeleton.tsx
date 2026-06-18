import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  /** Override the default animation style. */
  animate?: boolean;
}

/**
 * Skeleton — loading placeholder with a shimmer animation.
 *
 * Uses the `.skeleton` CSS class defined in `index.css` which applies a
 * shimmer gradient. Width/height/shape are controlled via `className`.
 */
export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        animate && 'skeleton',
        className,
      )}
      aria-hidden
    />
  );
}

/**
 * Pre-built skeleton rows for the task list / sidebar loading state.
 * Renders `count` rows that mimic the layout of a TaskRow.
 */
export function TaskRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-0" role="status" aria-label="Loading tasks">
      <span className="sr-only">Loading tasks…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50"
        >
          {/* Priority dot */}
          <Skeleton className="w-1.5 h-1.5 rounded-full shrink-0" />
          {/* Title + meta */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          {/* Duration badge */}
          <Skeleton className="h-4 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}


