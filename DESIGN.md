# Nodely design

## Product direction

Nodely is designed around one feeling: type first, organize immediately with the keyboard, and never lose the shape of the note. It is an outliner rather than a dashboard. The interface therefore gives most of its visual weight to the editor and keeps navigation compact.

The visual language is intentionally tiny, quiet, and soft:

- Warm white canvas with pale lavender surfaces.
- Purple for active state and primary actions.
- Muted rose only for destructive actions and warnings.
- Small borders, restrained shadows, and moderate corner radii.
- System-first typography for fast loading and familiar reading.
- No decorative emoji or noisy status decoration.
- The Nodely horizontal wordmark is used in the sidebar and link previews; the square mark is reserved for compact browser and app surfaces.

## Layout

### Desktop

The sidebar is a fixed-width navigation rail. It contains:

- Nodely identity.
- Group list with active state and delete action.
- Notes belonging to the active group.
- Compact shortcut hints.

The main area contains a top bar, search field, and spacious editor. The editor width is capped so long lines remain comfortable to read.

### Mobile

The sidebar becomes a left drawer. The editor remains the primary surface and the top bar exposes the drawer toggle. Controls use generous hit areas and avoid horizontal overflow. The layout is mobile-first without changing the underlying keyboard model.

## Editor interaction

The editor is a continuous writing surface:

- A note title sits above the tree without card framing.
- Each node is a quiet row with an auto-growing multi-line textarea, bullet, optional collapse control, child count, and tiny `Add node` and `Delete` actions.
- Indentation is communicated through spacing, a subtle connector line, and one inline structure marker per node: an arrow for parents and a bullet for leaves. The six-dot drag handle sits immediately to the right of that marker and appears only on hover or focus.
- Focused and hovered rows receive a soft lavender background. Inline node actions occupy zero height while idle, then appear softly below the textarea only while the row is hovered or contains focus, keeping inactive rows compact and evenly spaced.
- When a textarea loses focus, the editor clears its active-node state so clicking outside does not leave a stale active field.
- The active input keeps its DOM identity while typing so cursor and selection behavior feel native.

Keyboard behavior is the primary interaction model:

| Shortcut | Behavior |
| --- | --- |
| Enter | Add sibling below and focus it |
| Tab | Indent under the previous valid sibling |
| Shift + Tab | Outdent one level |
| Arrow Up / Down | Move through visible nodes |
| Arrow Left | Collapse or move to parent |
| Arrow Right | Expand or move to first child |
| Shift + Enter | Add a line break inside the current idea |
| Backspace on empty node | Remove the empty node safely |
| Undo / Redo buttons | Restore or reapply workspace snapshots |

## Destructive actions

Browser-native dialogs are not used for normal deletion. The in-app confirmation modal:

- Clearly names the target.
- Explains whether notes, ideas, or children are affected.
- Explains child promotion when deleting a node with descendants.
- Offers a calm cancel action and a visually distinct permanent-delete action.
- Closes through Cancel, Escape, or clicking the backdrop.

Backspace on an empty node remains immediate because it is part of the high-frequency keyboard editing flow and does not silently destroy non-empty content.

## Search and empty states

Search is intentionally lightweight and runs against in-memory groups, note titles, and node text. Results show the note title and matching node context, allowing the user to jump back into the note quickly.

Empty states are instructional but sparse. They always suggest the next useful action, such as creating a note or changing the search query, without turning the editor into a setup screen. An empty note keeps the title and editor context visible, then offers a focused `Add first idea` action with a short keyboard hint instead of leaving a blank area.

## Status and feedback

Autosave is represented by a small status control:

- `Saved` uses a quiet green dot.
- `Saving` uses a warm neutral dot.
- `Retry save` uses the destructive rose accent and can be clicked to retry.
- The sidebar footer is a functional `Keyboard guide` button, not a decorative shortcut label. It opens a compact modal listing only shortcuts currently supported by the editor.
- The sidebar footer includes a quiet creator credit linking to Falachul Akhadihima Ibrahaical's website.

Undo and redo controls remain in the top bar and are disabled when no history is available. Keyboard shortcuts for undo/redo are not wired yet; the buttons are the current reliable path. Context actions supplement, but do not replace, keyboard interaction.

## Accessibility and responsive behavior

- Buttons and inputs have visible focus rings.
- Destructive modal content uses `role="alertdialog"` and `aria-modal`.
- Icon-only controls have labels or titles.
- Text remains readable at narrow widths.
- Color is paired with labels, shape, or position rather than being the only status signal.
- Long node text wraps naturally; after the compact growth limit, the textarea scrolls internally to keep the editor usable.
- The inline Delete action opens the same confirmation modal as the context menu and explains child promotion before changing hierarchy.
- Dragging is initiated only from the six-dot handle, keeping the text area safe for selection and editing. The dragged subtree remains intact when reordered.
- Brand assets live in `public/brand` so the same logo treatment is preserved across the app, browser tab, PWA install, and shared links.

## Current scope

The current design intentionally excludes accounts, collaboration, cloud sync, and complex formatting. Local drag-and-drop is included as a secondary reorder interaction, while the core workflow remains “type, indent, outdent”. Accounts and synchronization would add interaction and state complexity and should be introduced only with a deliberate data-conflict model.
