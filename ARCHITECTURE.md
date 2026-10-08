# Nodely architecture

## Overview

Nodely is a client-only, offline-first single-page outliner built with SolidJS, TypeScript, Vite, Dexie, and IndexedDB. There is no API or server dependency for the core workflow. The application is organized around one workspace model:

```text
Workspace
├── Groups[]
└── Notes[]
    └── Nodes[]
```

The current implementation intentionally keeps orchestration in `src/App.tsx` and isolates persistence, types, and tree traversal in `src/lib`. This keeps the code approachable for junior developers while leaving clear seams for future extraction.

## Runtime modules

- `src/App.tsx`
  - Owns Solid signals for groups, notes, active selections, search, drawer state, save state, modal state, and undo/redo.
  - Coordinates user actions and keyboard behavior.
  - Renders the sidebar, editor, search results, context menu, and delete modal.
- `src/lib/types.ts`
  - Defines `Group`, `Note`, `Node`, and `Workspace`.
- `src/lib/db.ts`
  - Creates the Dexie database.
  - Seeds a first workspace when the database is empty.
  - Persists complete workspace snapshots transactionally.
- `src/lib/hierarchy.ts`
  - Provides `children`, visible-tree flattening, and sibling lookup helpers.
  - Uses a parent index in `flattenVisible` so expanded-tree traversal does not repeatedly filter the full node list.
  - Uses an ancestor guard during flattening so malformed circular data cannot recurse forever; normal editing paths still only create valid parent references.
- `vite.config.ts`
  - Configures SolidJS and `vite-plugin-pwa`.
  - Generates the service worker and web manifest for offline shell caching.
- `public/brand/`
  - Stores the horizontal `nodely-logo.png` used in the sidebar and social/share metadata.
  - Stores the square `nodely-icon-square.png` used for the browser tab, Apple touch icon, and PWA icon.

## Persisted data model

Nodes use adjacency-list storage rather than nested child arrays:

```ts
type Node = {
  id: string
  text: string
  parentId: string | null
  collapsed?: boolean
}
```

`parentId: null` means a root node. Sibling order is the order in the note's `nodes` array. This representation makes indent, outdent, collapse, and subtree-safe edits simple to express and keeps IDs stable for DOM rendering.

Dexie stores two tables:

- `groups`: `id`, `createdAt`
- `notes`: `id`, `groupId`, `updatedAt`

The complete node list is stored inside its note record. This is appropriate for the current local-first product size and avoids introducing a third table before it is needed.

## Editing and hierarchy rules

- Enter inserts a new sibling immediately after the active node and focuses it.
- Shift+Enter inserts a line break inside the active node.
- Each node uses an auto-growing textarea, so long ideas wrap naturally without horizontal overflow.
- Small `Add node` and `Delete` actions below each node provide mouse alternatives. Add calls the same sibling insertion path as Enter; Delete routes through the same confirmation modal as the context menu.
- Tab changes the active node's parent to the previous valid sibling.
- Shift+Tab changes the active node's parent to its current parent's parent.
- Tab does nothing when there is no valid previous sibling.
- Left collapses an expanded node or moves focus to its parent.
- Right expands a collapsed node or moves focus to the first child.
- Arrow Up and Down navigate the flattened visible list.
- Deleting a node promotes its direct children to the deleted node's parent instead of silently losing the subtree.
- Collapse only changes presentation through `collapsed`; it does not remove data.
- Each visible node renders exactly one structure marker: a collapse arrow when it has children, or a bullet when it is a leaf.
- The visual order is hierarchy guide line, marker, six-dot drag handle, then text. The drag handle is the only draggable surface so text editing remains uninterrupted.
- Dragging moves the selected node together with its complete descendant subtree. Drops onto the dragged node or any descendant are rejected; valid drops place the subtree before the target and adopt the target's parent.
- A note may contain zero nodes. In that state the editor renders an explicit first-idea empty state; `Add first idea` creates a root node and focuses it, preventing a dead-end after the last node is deleted.

The current UI does not include a server synchronization layer. Drag-and-drop is implemented locally through the same node mutation boundary, while collaboration and cloud sync remain outside the current scope.

## Rendering and typing performance

Visible nodes are rendered with a keyed Solid `<For>` using stable node IDs. Text updates preserve the textarea DOM identity, so focus, cursor position, selection, and native key-repeat behavior remain intact while typing. Textareas resize from their `scrollHeight` on focus and input, with a practical maximum height; very long content can continue in the textarea's own scroll area instead of expanding the whole page.

Text edits update the in-memory signal immediately. Autosave is debounced by 500 ms and serialized through a promise queue. This prevents overlapping writes from finishing out of order. Each save writes a snapshot using one read-write IndexedDB transaction and removes records no longer present in memory, preventing deleted data from returning after reload.

Autosave is gated behind database hydration. The initial reactive effect cannot write an empty in-memory workspace while IndexedDB is still loading, and the manual retry control also remains inert until hydration has completed.

Node action visibility is CSS-driven through row hover and `:focus-within`; it is not coupled to the selected-node signal. The action container has zero height, hidden visibility, and disabled pointer events while idle, then expands below the textarea only when needed. Textarea blur clears the selected-node signal, while keyboard navigation still restores it when focus moves programmatically. This prevents inactive rows from reserving extra vertical space.

The sidebar's keyboard guide is a real modal state (`shortcutModal`), dismissible by close button, backdrop, or Escape. Its content intentionally lists only implemented shortcuts so the UI does not advertise unavailable behavior.

Undo/redo stores bounded workspace snapshots. Consecutive characters typed into the same node are coalesced into one history entry after a short idle period, while structural operations still create their own entries.

## Failure handling

- Initial database load is wrapped in `try/catch`; failures are logged and surfaced through the save status.
- Autosave failures are logged and shown as `Retry save`; editing remains available.
- The retry control invokes the same serialized save path.
- Destructive actions require the application confirmation modal, except the intentionally safe empty-node Backspace workflow.

## Build and deployment

```bash
npm install
npm run dev
npm run build
npm run preview
```

Cloudflare Pages should use:

- Build command: `npm run build`
- Output directory: `dist`

No backend or environment variables are required for the current version.

## Brand asset conventions

Brand assets are served from `public/brand` so their URLs remain stable in Vite development, production builds, and Cloudflare Pages. The horizontal logo is used where the wordmark has room; the square icon is used where a compact app identity is required. Open Graph and Twitter metadata reference the horizontal logo for link previews.

## Verification and maintenance checklist

Before shipping a change to the editor, verify:

1. Textarea focus and native key-repeat remain stable while typing.
2. Enter, Tab, Shift+Tab, arrow navigation, delete, undo, and redo preserve valid parent references.
3. Collapsed descendants remain in persisted data and reappear after expanding.
4. Autosave remains hydration-gated and serialized; save failures remain visible through the status control.
5. Dragging a node keeps its complete subtree and rejects self/descendant targets.
6. `npm run build` passes before deployment.

## Future extraction points

If the application grows, the next low-risk refactors are:

1. Move workspace mutations into a `useWorkspace`-style module.
2. Extract `Sidebar`, `Editor`, `NodeRow`, and `DeleteModal` components.
3. Add pure hierarchy validation before persistence.
4. Move search indexing to a memoized index or worker for very large workspaces.
5. Split note nodes into an IndexedDB table if notes become too large for snapshot writes.
