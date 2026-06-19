import { Keyboard, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useId } from 'react';
import { modKey } from '../lib/utils';

interface KeyboardHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: Array<{ heading: string; shortcuts: Array<[string, string]> }> = [
  {
    heading: 'General',
    shortcuts: [
      ['Open command palette', `${modKey}+K`],
      ['Quick add task', 'Q'],
      ['Keyboard shortcuts', '?'],
    ],
  },
  {
    heading: 'Calendar',
    shortcuts: [
      ['Day view', 'D'],
      ['Week view', 'W'],
      ['Month view', 'M'],
      ['Jump to today', 'T'],
    ],
  },
  {
    heading: 'Tasks',
    shortcuts: [
      ['Schedule all inbox', 'S'],
      ['Start focus mode', 'F8'],
    ],
  },
  {
    heading: 'Navigation',
    shortcuts: [
      ['Dismiss / close', 'Esc'],
    ],
  },
];

export function KeyboardHelpDialog({ open, onClose }: KeyboardHelpDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" data-state={open ? 'open' : 'closed'} />
        <Dialog.Content
          className="dialog-content p-0 w-[min(calc(100vw-2rem),440px)]"
          aria-labelledby={titleId}
          aria-describedby={descId}
          data-state={open ? 'open' : 'closed'}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-muted-foreground" />
              <Dialog.Title id={titleId} className="text-sm font-semibold text-foreground">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </Dialog.Close>
          </div>

          <Dialog.Description id={descId} className="sr-only">
            A list of all keyboard shortcuts available in Tempo Calendar.
          </Dialog.Description>

          {/* Content */}
          <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto tempo-scrollbar">
            {SECTIONS.map((section) => (
              <div key={section.heading}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {section.heading}
                </h3>
                <div className="space-y-1.5">
                  {section.shortcuts.map(([label, key]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-1 text-xs text-foreground"
                    >
                      <span>{label}</span>
                      <kbd className="inline-flex items-center h-5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-border bg-muted/20 space-y-1">
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold">Pro tip:</span> Type tasks naturally — <span className="font-mono text-foreground">Buy milk tomorrow !high #errands ~30m</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold">Click</span> any empty time slot on the calendar to create a task at that time.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
