import { useState } from 'react';
import { Menu, CalendarDays, ListTodo, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from './ui/sheet';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from './ui/navigation-menu';
import { cn } from '../lib/utils';
import { GoogleConnect } from './GoogleConnect';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface HeaderProps {
  activeView: 'calendar' | 'tasks';
  onViewChange: (view: 'calendar' | 'tasks') => void;
  isAuthenticated: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onRefresh: () => Promise<void>;
  onScheduleAll?: () => void;
  unscheduledCount?: number;
}

const navItems = [
  { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
];

export function Header({
  activeView,
  onViewChange,
  isAuthenticated,
  isLoaded,
  isLoading,
  error,
  onConnect,
  onDisconnect,
  onRefresh,
  onScheduleAll,
  unscheduledCount = 0,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">Tempo Calendar</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <NavigationMenu>
              <NavigationMenuList>
                {navItems.map((item) => (
                  <NavigationMenuItem key={item.id}>
                    <NavigationMenuLink
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        activeView === item.id
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      onClick={() => onViewChange(item.id)}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>

            {isAuthenticated && unscheduledCount > 0 && (
              <Button
                size="sm"
                onClick={onScheduleAll}
                className="gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Schedule All
              </Button>
            )}

            <GoogleConnect
              isLoaded={isLoaded}
              isAuthenticated={isAuthenticated}
              isLoading={isLoading}
              error={error}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onRefresh={onRefresh}
            />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {!isAuthenticated && isLoaded && (
              <Button size="sm" onClick={onConnect} disabled={isLoading}>
                Connect
              </Button>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <VisuallyHidden>
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>Main navigation links</SheetDescription>
                </VisuallyHidden>
                <div className="flex flex-col gap-4 mt-8">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onViewChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                        activeView === item.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  ))}

                  {isAuthenticated && unscheduledCount > 0 && (
                    <Button
                      onClick={() => { onScheduleAll?.(); setMobileMenuOpen(false); }}
                      className="gap-2 mt-2"
                    >
                      <Zap className="w-4 h-4" />
                      Schedule All ({unscheduledCount})
                    </Button>
                  )}

                  <div className="border-t border-border pt-4 mt-2">
                    <GoogleConnect
                      isLoaded={isLoaded}
                      isAuthenticated={isAuthenticated}
                      isLoading={isLoading}
                      error={error}
                      onConnect={onConnect}
                      onDisconnect={onDisconnect}
                      onRefresh={onRefresh}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}