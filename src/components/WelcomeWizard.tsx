import { useState, useCallback } from 'react';
import { Sparkles, Calendar, Wand2, ArrowRight, Check, Zap } from 'lucide-react';
import { Button } from './ui/button';

interface WelcomeWizardProps {
  onCreateFirstTask: (title: string, duration: number) => Promise<void>;
  onDismiss: () => void;
}

type WizardStep = 'welcome' | 'task' | 'success';

const SUGGESTED_TASKS = [
  { title: 'Review weekly goals', duration: 30 },
  { title: 'Answer pending emails', duration: 45 },
  { title: 'Prepare for tomorrow\'s meeting', duration: 20 },
  { title: 'Go for a walk', duration: 30 },
  { title: 'Read a chapter of a book', duration: 25 },
];

export function WelcomeWizard({ onCreateFirstTask, onDismiss }: WelcomeWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreateFirstTask(title.trim(), duration);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [title, duration, onCreateFirstTask]);

  const handleSuggested = useCallback(async (suggestion: typeof SUGGESTED_TASKS[0]) => {
    setTitle(suggestion.title);
    setDuration(suggestion.duration);
    setLoading(true);
    setError(null);
    try {
      await onCreateFirstTask(suggestion.title, suggestion.duration);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [onCreateFirstTask]);

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onDismiss} />
        <div className="relative w-full max-w-[420px] animate-scale-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Welcome to Tempo
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
              Tasks find their own time. Add something you need to do, and we'll place it where it fits on your calendar.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                { icon: Calendar, text: 'Your calendar shows meetings and scheduled tasks' },
                { icon: Wand2, text: 'Tempo automatically finds open time slots' },
                { icon: Zap, text: "Drag to reschedule — we'll handle conflicts" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-left px-3 py-2.5 rounded-lg bg-muted/40">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-2.5">
              <Button
                onClick={() => setStep('task')}
                className="h-11 w-full gap-2 text-sm font-semibold"
              >
                Create your first task
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button
                onClick={onDismiss}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Explore on my own
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'task') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <div className="relative w-full max-w-[420px] animate-scale-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Create your first task</h2>
                <p className="text-xs text-muted-foreground">Just a title and how long it takes</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What do you need to do?</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Review quarterly report"
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background placeholder:text-muted-foreground"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && title.trim()) handleCreate();
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">How long? ({duration} min)</label>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>5m</span>
                  <span>60m</span>
                  <span>120m</span>
                </div>
              </div>

              {/* Suggested tasks */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Or pick a suggestion</label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TASKS.map((s) => (
                    <button
                      key={s.title}
                      onClick={() => handleSuggested(s)}
                      disabled={loading}
                      className="px-2.5 py-1.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-accent hover:border-muted-foreground/30 transition-colors text-foreground"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="ghost"
                  onClick={() => setStep('welcome')}
                  className="flex-1 h-10"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!title.trim() || loading}
                  className="flex-1 h-10 gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      Schedule it
                      <Wand2 className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onDismiss} />
        <div className="relative w-full max-w-[360px] animate-scale-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4 animate-schedule-pulse">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">You're all set!</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              "{title}" has been placed on your calendar. You can drag it to reschedule anytime.
            </p>

            <div className="mt-5 space-y-2 text-left">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Q</kbd>
                <span>Quick add tasks from anywhere</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">S</kbd>
                <span>Schedule all unscheduled tasks</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">⌘K</kbd>
                <span>Command palette for everything</span>
              </div>
            </div>

            <Button
              onClick={onDismiss}
              className="mt-6 h-10 w-full gap-2"
            >
              Start using Tempo
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
