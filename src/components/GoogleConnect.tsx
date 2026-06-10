import { useState } from 'react';
import { Calendar, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface GoogleConnectProps {
  isLoaded: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onRefresh: () => Promise<void>;
}

export function GoogleConnect({
  isLoaded, isAuthenticated, isLoading,
  onConnect, onDisconnect, onRefresh,
}: GoogleConnectProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh events"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDisconnectConfirm(!showDisconnectConfirm)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </Button>
          {showDisconnectConfirm && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-popover rounded-md shadow-lg border border-border z-50">
              <div className="p-4">
                <p className="text-foreground mb-3">Disconnect Google Calendar?</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { onDisconnect(); setShowDisconnectConfirm(false); }}
                    className="flex-1"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={onConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Calendar className="w-4 h-4" />
      )}
      {isLoading ? 'Connecting...' : 'Connect Google Calendar'}
    </Button>
  );
}