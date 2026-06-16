import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

/**
 * TaskFilters — list-filter chip row for the TaskList sidebar.
 *
 * Renders an "All" chip, one chip per task list (with the list's color
 * dot), and a "No list" chip for tasks without a list assignment. Active
 * chip uses the primary background; inactive chips use the muted
 * background with hover-to-accent transition.
 *
 * Includes inline list management:
 *   - "+" button to create a new list
 *   - Double-click a chip to rename it inline
 *   - Right-click (or long-press) a chip for rename/delete context menu
 */
interface TaskFiltersProps {
  /** Currently-active list filter, or null for "All". `__none__` = "No list". */
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
  /** All task lists (filtered to those with at least 1 active task inside the orchestrator). */
  taskLists: { id: string; name: string; color: string }[];
  /** Map of list_id (or `__none__`) → count of active tasks. */
  listCounts: Map<string, number>;
  /** Total count of active tasks (used in the "All" chip label). */
  totalActiveCount: number;
  /** Create a new task list. Returns the created list. */
  onCreateList?: (name: string, color: string) => Promise<void>;
  /** Rename a task list. */
  onUpdateList?: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  /** Delete a task list. */
  onDeleteList?: (id: string) => Promise<void>;
}

const NO_LIST_KEY = '__none__';

const LIST_COLORS = [
  '#2563EB', '#0D9488', '#059669', '#7C3AED', '#DB2777',
  '#B45309', '#DC2626', '#D97706', '#EA580C', '#4F46E5',
];

export function TaskFilters({
  activeListId,
  setActiveListId,
  taskLists,
  listCounts,
  totalActiveCount,
  onCreateList,
  onUpdateList,
  onDeleteList,
}: TaskFiltersProps) {
  const noListCount = listCounts.get(NO_LIST_KEY) || 0;

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    listId: string;
    listName: string;
    top: number;
    left: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // New list creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const newListInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus new list input when it appears
  useEffect(() => {
    if (isCreating && newListInputRef.current) {
      newListInputRef.current.focus();
    }
  }, [isCreating]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handle = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as HTMLElement)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [contextMenu]);

  // Guard against double-submission (Enter + blur race condition)
  const submittingRef = useRef(false);

  const handleRenameSubmit = async (listId: string) => {
    if (submittingRef.current) return;
    const trimmed = renameValue.trim();
    if (trimmed && onUpdateList) {
      submittingRef.current = true;
      try { await onUpdateList(listId, { name: trimmed }); }
      finally { submittingRef.current = false; }
    }
    setRenamingId(null);
  };

  const handleCreateSubmit = async () => {
    if (submittingRef.current) return;
    const trimmed = newListName.trim();
    if (trimmed && onCreateList) {
      submittingRef.current = true;
      try {
        const randomColor = LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)];
        await onCreateList(trimmed, randomColor);
      } finally {
        submittingRef.current = false;
      }
    }
    setIsCreating(false);
    setNewListName('');
  };

  const handleContextMenu = (e: React.MouseEvent, listId: string, listName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ listId, listName, top: e.clientY, left: e.clientX });
  };

  const startRename = (listId: string, currentName: string) => {
    setRenamingId(listId);
    setRenameValue(currentName);
    setContextMenu(null);
  };

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto tempo-scrollbar">
      <button
        onClick={() => setActiveListId(null)}
        className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
          activeListId === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-accent'
        }`}
      >
        All {activeListId === null && totalActiveCount}
      </button>
      {taskLists.map((list) => {
        const count = listCounts.get(list.id) || 0;
        if (count === 0 && activeListId !== list.id) return null;

        const isRenaming = renamingId === list.id;

        return (
          <div key={list.id} className="relative shrink-0">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(list.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(list.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="px-2 py-1 text-xs font-medium rounded-md border border-primary bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-24"
              />
            ) : (
              <button
                onClick={() => setActiveListId(list.id)}
                onDoubleClick={() => onUpdateList && startRename(list.id, list.name)}
                onContextMenu={(e) => onUpdateList && handleContextMenu(e, list.id, list.name)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  activeListId === list.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: list.color }} />
                {list.name} {count}
              </button>
            )}
          </div>
        );
      })}
      {noListCount > 0 && (
        <button
          onClick={() => setActiveListId(NO_LIST_KEY)}
          className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            activeListId === NO_LIST_KEY
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          No list {noListCount}
        </button>
      )}

      {/* New list creation */}
      {isCreating ? (
        <input
          ref={newListInputRef}
          type="text"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onBlur={() => { if (!newListName.trim()) { setIsCreating(false); } else { handleCreateSubmit(); } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateSubmit();
            if (e.key === 'Escape') { setIsCreating(false); setNewListName(''); }
          }}
          placeholder="List name"
          className="shrink-0 px-2 py-1 text-xs font-medium rounded-md border border-primary bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-24"
        />
      ) : onCreateList ? (
        <button
          onClick={() => setIsCreating(true)}
          className="shrink-0 px-1.5 py-1 text-xs font-medium rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="New list"
          aria-label="Create new list"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      ) : null}

      {/* Context menu (portal-style fixed positioning) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed w-40 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-slide-down"
          style={{ top: contextMenu.top, left: contextMenu.left }}
        >
          <button
            onClick={() => startRename(contextMenu.listId, contextMenu.listName)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Rename
          </button>
          {onDeleteList && (
            <>
              <div className="border-t border-border my-0.5" />
              <button
                onClick={async () => {
                  await onDeleteList(contextMenu.listId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
