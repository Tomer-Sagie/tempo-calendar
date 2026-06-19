import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  /** Optional fallback UI to show instead of the default error screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches unexpected React errors and renders a friendly
 * fallback instead of a blank white screen. Wrapped around major sections
 * of the app so a failure in one area doesn't take down unrelated parts.
 *
 * Prompt 79: Add Graceful Error Boundaries
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log for debugging — in production this would go to a monitoring service
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Something went wrong</h2>
          <p className="text-xs text-muted-foreground max-w-[300px] leading-relaxed mb-4">
            This section encountered an unexpected error. You can try reloading it,
            or continue using the rest of the app.
          </p>
          <Button onClick={this.handleReset} size="sm" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </Button>
          {this.state.error && (
            <details className="mt-4 text-[11px] text-muted-foreground max-w-[400px]">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded-md text-left overflow-auto text-[10px] font-mono break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
