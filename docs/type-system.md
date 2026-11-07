# Type system: design notes

Status: draft, from a brainstorm. Nothing here is built yet.

## Goal

Bring React-like composability to the user level. Users define types over the objects in their
workspace; custom components inserted into a note's rich text (table, kanban, canvas…) declare
typed inputs; users bind those inputs to types, and the components render (and edit) whatever
matches.

## Principles

1. **The workspace is the library.** One store of all objects. Most objects are never on a
   canvas; a canvas is just one way to show some of them.
2. **Structural typing, open shapes.** An object is a `T` if its fields satisfy `T`. Extra fields
   are always fine.
3. **A type is a query.** A type is a predicate over objects, so a filter _is_ a type, and a
   collection is just "every workspace object matching a type". Queries built from queries are
   types built from types.
4. **Components define the interface; types describe the data.** Type-system features are added
   when a component needs them (`keyof` for table columns, indexed access for kanban `groupBy`),
   not designed ahead of use.

## Objects

```ts
type ObjectId = string;

type WorkspaceObject = {
  id: ObjectId;
  /** Field id → value. Only fields that have a value are present. */
  fields: Record<FieldId, Value>;
  /**
   * The types this object was created as (like Tana's supertags). Used for authoring only: which
   * fields to show (empty ones included) and defaults for new objects. Never used for membership:
   * an object declared a Task that lost its status no longer matches `Task`, but still shows the
   * empty Status field.
   */
  declaredTypes: TypeId[];
};
```

What's a "note" today becomes an object with `title` and `body` (rich text) fields. Both are
optional to the note renderer.

## Fields

- **Shared by identity.** A shape refers to a field by its id, never its label. Users never see
  ids; labels may repeat (two unrelated "Status" fields), so pickers must tell same-label fields
  apart (e.g. by the types that use them).
- **A field has a default type**, which shapes may **narrow**: `assignee: Person` globally,
  `{ assignee: Admin }` in a shape. Literals are the narrowest case: `{ status: Open }`.
- **Multiplicity is part of the type**, as with arrays in TS: `Person` vs `Person[]`. Today's
  `multiple` flag on selects becomes `Option[]`.

## Type expressions

Stored as data (a tree), edited through a visual builder; a text syntax can come later on top.

```ts
type TypeExpr =
  | {
      kind: "primitive";
      name: "text" | "number" | "date" | "datetime" | "icon" | "image" | "richText";
    }
  | { kind: "literal"; value: Atom } // incl. a reference to a specific object
  | { kind: "array"; of: TypeExpr }
  | { kind: "shape"; fields: { field: FieldId; type?: TypeExpr; optional: boolean }[] }
  | { kind: "ref"; type: TypeId; args?: TypeExpr[] } // a named type, maybe generic
  | { kind: "param"; name: string } // e.g. $this
  | { kind: "union"; of: TypeExpr[] }
  | { kind: "intersection"; of: TypeExpr[] }
  | { kind: "exclude"; from: TypeExpr; type: TypeExpr }
  | { kind: "collection"; of: TypeExpr }; // a field whose value is computed: the matching objects
```

- **Required vs optional** (explicit per field). As a query, a required field means "has a
  value"; an optional one matches anything but tells components the field may exist.
- **Named types** (aliases) are workspace objects themselves, so they can be referenced, and shown
  on a canvas (definition, member count).
- **Today's schemas** become named shape types. **Today's selects** become fields whose type is a
  union of literals (a fixed option list) or any other type (options from a query).

### Context as type parameters

"Tasks assigned to this person" is the generic `TasksOf<P> = Task & { assignee: P }`. A component
inside an object instantiates it with `P = $this`. That's the "nearest provider" lookup, made
explicit: a chain of scopes (this object → the object it's embedded in → workspace).

### Computed fields (backlinks)

A field typed `collection` is evaluated per object, not stored. For example, Project's `tasks`:
`Collection<Task & { project: $this }>`.

### Core operations

- `matches(object, type, scope): boolean`
- `members(type, scope): ObjectId[]`, derived and never stored; recomputed when the store changes.
- `fieldsOf(type)` for `keyof`, column pickers, and properties UI.
- `isWritable(type)`: whether a new object can be made to satisfy it (shapes and literals: yes;
  unions, exclusions: no). Needed for "add row" in a filtered table and kanban drag.
- Cycle detection for types that refer to themselves.

### Not types (component props instead)

Sorting, limits, grouping, and view settings. Aggregates ("projects with more than 3 open tasks")
are a later extension.

## Canvas as a component

Positions belong to a canvas instance, not to objects:

```ts
type CanvasInstance = {
  input: TypeExpr; // which objects it shows
  layout: Record<ObjectId, { x: number; y: number; width: number }>;
  viewport: { x: number; y: number; zoom: number };
};
```

The same object can be on several canvases at different positions. Stress test: a canvas inside a
table cell inside a canvas.

## Components (built-in for now)

| Component | Props                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Table     | `rows: Collection<T>`, `columns: (keyof T)[]`, `sort`                            |
| Kanban    | `items: Collection<T>`, `groupBy: K` where `T[K]` is a single (non-array) select |
| Canvas    | `items: Collection<T>`, layout                                                   |

Embedded in rich text as Lexical decorator nodes; their bindings (type expressions, referencing
named types by id) are saved with the note's content.

## Storage

localStorage for now: most things live in memory at runtime. Revisit (IndexedDB) once the
library grows.

## First slice

1. Type expressions as data, plus `matches` / `members` / `fieldsOf`.
2. Schemas → named shape types; select options → a type. Objects get `declaredTypes`.
3. Split layout out of objects: the current board becomes one canvas instance (one conversion of
   the saved board, as always).
4. Table component in the editor: `rows`, `columns`.
5. Kanban, with writing back on drag (`isWritable`).
6. `$this` and generic named types; then a canvas inside a table cell.
