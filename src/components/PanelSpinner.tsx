/**
 * Tiny spinner fallback for lazy-loaded dialogs/panels.
 * Used as a Suspense fallback throughout the app.
 */
export function PanelSpinner() {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}
