# SmartBoard architecture

How the code is organised today, and where each of the 35 planned features
plugs in. Read this before starting a phase; update it when an extension point
changes.

## Principles

1. **Ownership decides where state lives.** Every piece of state is shared
   document, local session, ephemeral presence, or a separate realtime domain
   (classroom, chat, calls, quizzes, …). Never mix them in one structure.
2. **Every document change is an operation.** Undo, sync, autosave, history,
   replay, notifications and analytics all consume the same `BoardOperation`
   stream. Nothing writes the document behind its back.
3. **The domain model is framework-free.** `features/whiteboard/model/` has no
   React, Konva, Zustand or browser imports, so a server or worker can run it.
4. **One permission entry point** (`can()`). Client checks are UX; the server
   enforces the same policy once boards are shared.
5. **Build the phase, not the platform.** Modules are created when their phase
   starts. Extension points exist only where a later feature would otherwise
   force a rewrite.

## State ownership

| Class | Examples | Lives in | Synced | Persisted | Undoable |
|---|---|---|---|---|---|
| **Document** | title, pages, elements | `useBoardStore` → `state.doc` | yes (operations) | yes | yes, per user |
| **Local session** | active page, tool, style, selection, viewport, undo stacks | `useBoardStore` (outside `doc`) | no | prefs only | no |
| **Local UI** | panel, toasts, activity, announcements | `useBoardStore` | no | no | no |
| **Permissions** | role, classroom policy | `usePermissionStore` | from server | server | no |
| **Presence** *(Phase 2)* | cursors, names, laser, selections, follow-presenter | `collaboration/` | ephemeral | never | no |
| **Classroom** *(Phase 3)* | roster, attendance, hands, timer, presentation, groups | `classroom/`, `presentation/` | yes | server | no |
| **Communication** *(Phase 5)* | messages, pins, calls, notifications | `chat/`, `calls/`, `notifications/` | yes | chat: server | no |
| **Learning** *(Phase 6)* | polls, quizzes, private areas, breakouts | `polls/`, `quizzes/`, `classroom/` | yes | server | no |

Presence never enters the document: it changes 60 times a second and must not
be saved, undone, replayed or counted as an edit.

## Document model

`features/whiteboard/types`, `features/whiteboard/model/document.ts`

```
BoardDocument { schemaVersion: 2, id, title, pages: BoardPage[], assets: Record<id, BoardAsset> }
BoardPage     { id, name, background: PageBackground, elements: BoardElement[] }   // back-to-front
BoardElement  = freehand | line | rectangle | ellipse | text | sticky | image | qr | clock | timer
                common: id, x, y, rotation, locked?
```

- **Infinite canvas:** world coordinates are unbounded floats, and the
  per-page local viewport maps them to the screen. There are no page bounds.
- **Scale is never stored.** Transforms are baked into geometry.
- **Elements are addressed by id, never by array index.**
- **`parseDocument`** validates untrusted input field by field, drops unknown
  properties and enforces size limits. Every load path must use it: restore,
  version history, templates, imports, AI output, sync snapshots, offline
  queues.
- **Schema changes:** bump `BOARD_SCHEMA_VERSION` and add a `migrate()` step.
  Planned additions: `image` element (asset reference), `page.background`
  (PDF page), `element.hidden` and `element.name` (layers panel),
  `element.version` (sync).

**One document per board, many boards per session.** Private student areas
(#18) and breakout boards (#34) are separate `BoardDocument`s. The store edits
one board at a time; switching boards loads another document. Teacher review
renders other boards read-only from their documents (`ElementsList` is pure
given elements), so no second editor store is needed.

## Operations

`features/whiteboard/model/operations.ts`

```
board.update · page.insert · page.update · page.delete · page.order
element.put (insert or replace, placed after a neighbour id) · element.delete · element.order
```

```
store action ─► commit() ─► permission gate ─► state.doc ─► undo entry (local, per user)
                                                   │
                       operations feed: { ops, origin, actorId, at, document }
                                                   │
   ┌──────────────┬──────────────┬─────────────────┼──────────────┬──────────────┐
  sync          autosave      version history     replay      notifications    analytics
 (send local)  (debounced)    (snapshots)       (op log)      (events)       (contributions)

remote ops ─► applyRemoteOperations(ops, { actorId }) ─► feed (origin "remote", not re-sent)
```

- Operations are **derived** by diffing immutable states, so no change can skip
  the feed.
- `applyOperation` is **idempotent and tolerant**: an unknown anchor lands on
  top, missing ids are no-ops, and the last page is never deleted. This is what
  makes replay, offline queues (#30) and reconnects safe.
- **Undo is per user and operation-based.** Undo reverts only what this user
  changed; remote operations never enter local history.
- **Every batch carries `actorId` and `at`.** Replay (#28) re-applies batches
  in time order to an empty document; analytics (#35) aggregates them by actor
  and operation type. Neither needs to touch the store.

## Permissions and locking

`features/permissions/`: `policy.ts` (pure `can(context, action)`) and `store.ts`.

- **Roles:** `teacher`, `student`. **Policy:** `boardLocked`,
  `studentsCanDraw`, `allowedStudentTools`.
- **Object locking (#19):** `element.locked` protects an element from **everyone**
  (move, edit, restyle, delete), the teacher included, so a locked worksheet
  cannot be changed by accident. The teacher's override is `element.lock`:
  only teachers may lock or unlock.
  - Bulk actions skip locked elements rather than failing: the eraser, clear,
    delete and style changes act on the rest.
  - Box select and select-all ignore locked elements; a direct click still
    selects one.
  - Paint order is not protected, so a locked background can be sent to the back.
  - Duplicating a locked element produces an unlocked copy.
- **Enforcement:** `commit()` checks `board.edit` and, per touched element,
  `element.edit` against the element *before* the change. A change that only
  flips `locked` needs `element.lock` instead.
- **UI:** disallowed tools are `aria-disabled` with a reason. Locked selections
  show a dashed outline, a lock badge (an unlock button for teachers) and a
  panel notice.
- **Phase 2/3:** the server sends the context through `setContext` and runs the
  same `can()` on every incoming operation. Planned actions: classroom
  management (mute, remove, groups), chat pins and quiz control.

## Tools

`features/whiteboard/tools/`: one `ToolHandler` per tool, wired in `registry.ts`.

```ts
interface ToolHandler { start(input, ctx): ToolGesture | null }
interface ToolGesture { move?(input); end?(input); cancel?() }
```

`useCanvasInteractions` owns only cross-tool input (pointers, capture, pinch,
wheel, focus).

**Adding a tool:** a `ToolId`, an entry in `TOOLS` (label, shortcut), an icon
in `Toolbar.tsx` and a handler in the registry. Permission gating and the
shortcut then work automatically.

Planned tools:

- laser pointer (#9, presence-only);
- image placement (#5);
- a smart pen, as a post-processing step in `penTool.end` (smart shapes #10,
  handwriting recognition #25).

## Inserted content, backgrounds and widgets

| Module | Owns | Key decisions |
|---|---|---|
| `whiteboard/insert/` | image import, drag & drop, paste, QR, smart placement | Type checked by magic bytes, never by MIME or extension. Images are downscaled (2560px for objects, 3840px for backgrounds) and re-encoded as raster. SVG is rasterised via `<img>` (no scripts, no external fetches), and markup is never stored. Inserts are serialised, and repeated inserts cascade instead of stacking. |
| `whiteboard/background/` | per-page `PageBackground`, presets, pattern renderers | Drawn on a non-listening Konva layer, so it can never be selected. One renderer serves live view and export (the visible area is derived from the canvas transform). Background images are anchored to `PAGE_FRAME` in world space so annotations stay aligned. New patterns = a `BackgroundPattern` member plus a renderer in the registry. |
| `whiteboard/widgets/` | clock, timer/stopwatch, ticker, runtime store, chime | Live widgets render in their own layer and update Konva text imperatively from one shared ticker, so ticking never re-renders React or redraws content (verified: 0 content redraws per clock tick). Timer **configuration** is in the document (undoable); **runtime** (running, paused, laps) is local and never saved. |

Further decisions:

- **Assets:** image pixels live once in `BoardDocument.assets` and are referenced by id. Moving an image sends a tiny `element.put`, never the pixels. Assets are append-only during a session, so undo and redo always have them; garbage collection belongs to persistence (Phase 7).
- **Eraser scope:** the eraser skips inserted objects (images, QR codes, widgets), so pen marks over a worksheet image can be erased without deleting it. Inserted objects are removed with Delete.
- **Aspect ratio:** images, QR codes and widgets resize from corner handles only and keep their ratio.
- **Phase 2/3 notes:**
  - Shared timers must move their runtime into classroom state, with the server clock as the source of truth and teacher-only control.
  - Asset `src` becomes a storage URL in `files/`, which needs a matching update to `parseDocument`'s allow-list.

## Canvas rendering

Konva layers, from the bottom up:

1. **Background:** not listening.
2. **Content:** static elements, memoised per element.
3. **Live widgets:** clocks and timers.
4. **Draft:** in-progress drawing, selection box.
5. **Selection:** the transformer, which finds nodes across layers.

HTML overlays above the stage: the text editor, lock badges, timer controls, drop feedback and the empty-state hint.

Planned layer: presence (remote cursors, selections, laser) above draft.

Viewport culling for very large boards goes in `ElementsList`.

Export today renders the live stage for the active page. Multi-page PDF export
(#27) needs an offscreen renderer that draws a `BoardPage` without mounting it,
which is the same need as read-only board previews.

## Internationalisation and RTL (#31)

- **Already direction-ready:** the workspace chrome uses logical CSS (`ps/pe`,
  `start/end`, `border-s/e`, `text-start`), so setting `dir="rtl"` on `<html>`
  mirrors the shell. The text editor uses `dir="auto"`, so Arabic and English
  each flow correctly.
- **Never mirrored:** canvas content, world coordinates, lock badges and the
  text overlay position. A drawing must look the same to every participant.
- **When the i18n phase starts:**
  - move UI strings into message catalogues (e.g. `next-intl`; there are no
    translated strings yet);
  - make physical popover and tooltip sides (`side="right"` on the vertical
    toolbar) direction-aware;
  - render Konva text with the correct base direction;
  - choose an Arabic-capable UI font.

## Accessibility (#32)

Accessibility is a standing requirement, not a phase. Current baseline:

- native controls with labels;
- a roving-focus toolbar;
- visible focus;
- a live region for announcements;
- `prefers-reduced-motion`;
- rem-based type that scales with browser settings.

Every new module must keep it. Specific obligations:

- realtime events (#29) go through the live region;
- canvas content needs a text alternative, which board search (#21) and the
  layers panel (#20) can provide as a navigable object list.

## Folder structure

```
app/board/page.tsx            route (server component)
components/board/             workspace shell
components/ui/                generic primitives (IconButton, Tooltip, Popover)
features/
  whiteboard/
    model/                    framework-free: document schema, operations
    store/                    board store, operations feed
    tools/                    tool registry and handlers
    components/               Konva canvas, element renderers, overlays
    hooks/  utils/
  permissions/                policy + store
lib/                          cross-feature helpers
docs/                         this file
```

**Planned modules** (create when the phase starts, not before):

| Module | Phase | Owns |
|---|---|---|
| `collaboration/` | 2 | sync provider, presence store, cursor layer, offline queue (7) |
| `classroom/` | 3, 6 | roster, attendance, hands, timer, management, groups, private areas, breakouts |
| `presentation/` | 3 | presenting state, follow-presenter, slides/frames |
| `files/` | 4 | uploads, asset storage, PDF rasterisation, image import, OCR input (8) |
| `templates/` | 4 | template definitions (pure page builders) |
| `search/` · layers UI | 4 | pure queries over `doc`; layers panel in `components/board` |
| `chat/` · `calls/` · `notifications/` | 5 | messages and pins; SFU session; notification store and centre |
| `polls/` · `quizzes/` | 6 | live polls; quizzes with private answers |
| `history/` | 7 | autosave, versions, replay, conflict handling |
| `ai/` | 8 | client for server-side AI endpoints; result → operations |
| `analytics/` | 9 | feed consumers, `track()` events, reports |

**Dependency rule:** a module may import `whiteboard/model`, `whiteboard/store`
(public actions and the feed) and `permissions`. It must not import another
planned module's internals; coordinate through stores, the operations feed or
the notifications bus.

## Feature map

| # | Feature | Plugs into | Phase |
|---|---|---|---|
| 1 | Realtime collaboration | Sync provider on the feed + `applyRemoteOperations`; presence layer | 2 |
| 2 | Teacher/student permissions | `usePermissionStore` from server; server-side `can()` | 2–3 |
| 3 | Audio & video | `calls/` (SFU), independent of the document | 5 |
| 4 | Chat | `chat/` store; attachments via `files/`; pins gated by `can()` | 5 |
| 5 | PDF & image import | `files/` + `image` element + `page.background` (schema v2) | 4 |
| 6 | Auto save | `history/` subscribes to the feed (debounced); load via `parseDocument` | 7 |
| 7 | Version history | Snapshots; restore = `applyRemoteOperations(diffDocuments(cur, snap))` so local undo stays valid | 7 |
| 8 | Templates | `templates/` returns page seeds, inserted by page actions | 4 |
| 9 | Laser pointer | Presence-only tool | 2 |
| 10 | Smart shapes | Pure recogniser in `penTool.end` | 4 |
| 11 | Infinite canvas | Unbounded today; add culling + "back to content" | 4 |
| 12 | Minimap | `getContentBounds` + viewport; writes `setViewport` | 4 |
| 13 | Presentation mode | `presentation/`; followers mirror presenter viewport via presence | 3 |
| 14 | Timer & stopwatch | `classroom/`, server clock | 3 |
| 15 | Polls | `polls/`, one vote per user server-side | 6 |
| 16 | Quiz | `quizzes/`, answers private until revealed; never in `doc` | 6 |
| 17 | Raise hand | `classroom/` ordered queue | 3 |
| 18 | Private student area | One `BoardDocument` per student; teacher previews read-only; "share" copies pages into the class board | 6 |
| 19 | Object locking | **Done (Phase 1)**: `element.locked` + `element.lock` override | 1 |
| 20 | Layers panel | `components/board` list over `page.elements`; reorder via `element.order`; `hidden`/`name` fields | 4 |
| 21 | Board search | Pure text query over all pages; result → switch page + zoom to bounds | 4 |
| 22 | Keyboard shortcuts | **Done (Phase 1)**: `useKeyboardShortcuts`, dialog | 1 |
| 23 | AI assistant | `ai/` → server endpoint; output validated, applied as one undoable commit | 8 |
| 24 | OCR | Server or worker on `files/` assets → text elements | 8 |
| 25 | Handwriting recognition | Freehand points → recogniser → replace strokes with text (one commit) | 8 |
| 26 | Diagram generator | AI returns a validated graph; a pure layout step produces elements | 8 |
| 27 | Export session | Offscreen page renderer → PDF/images; timeline from the replay log | 7 |
| 28 | Replay | Persisted feed batches (`actorId`, `at`) replayed into an empty doc | 7 |
| 29 | Notifications | `notifications/` bus fed by classroom/chat/permissions events; live region | 5 |
| 30 | Offline mode | Queue local batches; resend on reconnect (idempotent ops); per-element versions for conflicts | 7 |
| 31 | Multi-language & RTL | Logical CSS done; message catalogues later | cross-cutting |
| 32 | Accessibility | Standing requirement | cross-cutting |
| 33 | Classroom management | `classroom/` + new permission actions; server-enforced | 3 |
| 34 | Breakout boards | Group `BoardDocument`s + assignment in `classroom/`; teacher previews | 6 |
| 35 | Analytics | `analytics/` consumes feed batches + explicit `track()` events | 9 |

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Whiteboard core: tools, shapes, text, sticky notes, selection, undo/redo, zoom/pan, pages, export, **object locking**, **keyboard shortcuts** | ✅ done, including the foundation: document boundary, operations feed, per-user undo, permission gate, tool registry, schema validation |
| 2 | Realtime collaboration: sync, cursors, presence, participant state, realtime permissions | next |
| 3 | Classroom controls: roles, board permissions, raise hand, presentation, timer, management | |
| 4 | Files & content: PDF/image import, templates, search, layers, minimap | |
| 5 | Communication: chat, audio/video, notifications, pinned messages | |
| 6 | Learning tools: quizzes, polls, private areas, breakouts | |
| 7 | Persistence & history: autosave, versions, replay, offline, conflicts | |
| 8 | AI: assistant, OCR, handwriting, diagram generator | |
| 9 | Analytics & reporting | |

**Dependency to plan for:** realtime (Phase 2) needs a server that holds each
board's authoritative document, and new participants need its current state.
Durable autosave and history can wait for Phase 7. The Phase 2 server should
still keep documents in a store that Phase 7 can make durable, and persist the
operation log, so replay (#28) has data from day one. Otherwise sessions held
between Phase 2 and Phase 7 cannot be replayed.

## Open decisions

- **Sync engine (Phase 2).** Recommendation: a server-authoritative operation
  relay with element-level last-writer-wins plus `element.version`. Permissions
  (#2, #19, #33) need the server to reject individual operations, which is
  awkward with a CRDT where clients write into a shared document. Operations
  are already element-granular and idempotent.
- **Concurrent ordering (Phase 2).** Consider fractional index keys per element
  so concurrent reorders merge rather than overwrite.
- **AI provider and data policy (Phase 8).**
  - Calls go server-side only, so keys never reach the browser.
  - Rate limits apply per user.
  - Every result is validated with `parseDocument`-style checks before it
    becomes operations.
  - Students may be minors, so decide data retention and consent before any
    board content leaves the platform.
- **Analytics privacy (Phase 9).** Aggregate by default, document retention,
  and give teachers only what supports teaching.
- **Calls (Phase 5).** Use an SFU (e.g. LiveKit) beyond about 4 participants,
  plus a TURN server.

## Invariants for contributors

- Change the document only through store actions (local) or
  `applyRemoteOperations` (remote). Never `setState({ doc })` from a component.
- Keep `model/` free of React, Konva, Zustand and browser APIs.
- New element fields: optional or migrated, and validated in `parseDocument`.
- Ephemeral data goes to presence, never `doc`.
- Gate new mutations with `can()`; reflect them in the UI with `useCan()`.
- Respect locks: bulk features (search-and-replace, AI cleanup, layer actions)
  skip `locked` elements rather than failing.
- New canvas behaviour is a tool handler, not a branch in `useCanvasInteractions`.
- Use logical CSS properties in the shell; never mirror canvas content.
- Every new control is keyboard-reachable, labelled and visible on focus.
