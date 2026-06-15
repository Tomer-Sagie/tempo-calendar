import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  onOpenPalette?: () => void;
  onQuickAdd?: () => void;
  onNavigateDay?: () => void;
  onNavigateWeek?: () => void;
  onNavigateMonth?: () => void;
  onToday?: () => void;
  onScheduleAll?: () => void;
  onOpenFocus?: () => void;
  onShowHelp?: () => void;
}

/**
 * Registers global keyboard shortcuts for the app workspace.
 *
 * Single-letter shortcuts are suppressed when:
 *   - An <input>, <textarea>, or contentEditable is focused
 *   - A dialog (data-state="open") is present in the DOM
 *   - Focus Mode is active (detected by overlay at z-100)
 *
 * Modifier shortcuts (Cmd+K) always fire.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  /* eslint-disable react-hooks/refs, react-hooks/immutability -- intentional ref mutation for stable callback in event listener */
  const handlersRef = useRef(handlers);
  if (handlers !== handlersRef.current) handlersRef.current = handlers;
  /* eslint-enable react-hooks/refs, react-hooks/immutability */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // Modifier shortcuts always work
      const isMod = e.metaKey || e.ctrlKey;

      // ── Cmd/Ctrl + K → Command palette ────────────────────────
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlersRef.current.onOpenPalette?.();
        return;
      }

      // From here, skip if typing in an input
      if (isInput) return;

      // Skip if a blocking overlay is open. We check for:
      //   - Radix Dialog/AlertDialog overlays
      //   - App-level dialog/panel overlays (SettingsPanel, CommandPalette)
      //   - Focus Mode full-screen overlay
      // Dropdown menus and tooltips do NOT block shortcuts.
      const hasBlockingOverlay = document.querySelector(
        '[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .dialog-overlay[data-state="open"], .panel-overlay[data-state="open"], .fixed.inset-0.z-\\[100\\]'
      );
      if (hasBlockingOverlay) return;

      // ── Q → Quick add ─────────────────────────────────────────
      if (e.key === 'q' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onQuickAdd?.();
        return;
      }

      // ── D / W / M → Navigate views ────────────────────────────
      if (e.key === 'd' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onNavigateDay?.();
        return;
      }
      if (e.key === 'w' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onNavigateWeek?.();
        return;
      }
      if (e.key === 'm' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onNavigateMonth?.();
        return;
      }

      // ── T → Jump to today ─────────────────────────────────────
      if (e.key === 't' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onToday?.();
        return;
      }

      // ── S → Schedule all ──────────────────────────────────────
      if (e.key === 's' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onScheduleAll?.();
        return;
      }

      // ── F8 → Focus mode ───────────────────────────────────────
      if (e.key === 'F8' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onOpenFocus?.();
        return;
      }

      // ── ? → Show keyboard shortcuts help ──────────────────────
      if (e.key === '?' && !isMod) {
        e.preventDefault();
        handlersRef.current.onShowHelp?.();
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // Empty deps — reads from ref
}
