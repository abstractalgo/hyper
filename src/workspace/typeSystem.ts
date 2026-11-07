import type { FieldAtom, FieldValue, IconRef, InputType, TypeColor } from "./model";

/**
 * The type system (see docs/type-system.md): named types are the only kind of definition. A type
 * with a shape declares fields (its entries); types share fields by composition (Pick, &); a type
 * "for notes" says so explicitly with a `type` entry. A collection is every note of a type.
 */

/** A field's hidden identity. Users see the label its declaring entry gives it. */
export type KeyId = string;
export type TypeId = string;

/** Fields every note can have, declared by the built-in Note type: its types, and its icon. */
export const TYPE_KEY: KeyId = "type";
export const ICON_KEY: KeyId = "icon";
export const NOTE_TYPE_ID: TypeId = "type-note";

/** Built-in value types. `note` is any note; `type` is any named type. */
type PrimitiveName = "text" | "number" | "date" | "datetime" | "image" | "icon" | "note" | "type";

export type TypeExpr =
  | { kind: "primitive"; name: PrimitiveName }
  /** One text or number value. */
  | { kind: "literal"; value: string | number }
  /** One specific note or named type. */
  | { kind: "object"; id: string }
  /** A list of values, each of type `of`. */
  | { kind: "array"; of: TypeExpr }
  /** Notes whose fields fit these entries. Open: other fields are fine. */
  | { kind: "shape"; entries: Entry[] }
  /** A named type. */
  | { kind: "ref"; typeId: TypeId }
  /** The entries of `from` with (pick) or without (omit) these keys. */
  | { kind: "pick" | "omit"; from: TypeExpr; keys: KeyId[] }
  /** `all`: an intersection (A & B); `any`: a union (A | B); `none`: fits none of them. */
  | { kind: "group"; mode: GroupMode; of: TypeExpr[] }
  /** Anything (a required entry of this type: "has a value"). */
  | { kind: "unknown" }
  /** Nothing (an optional entry of this type: "is empty"). */
  | { kind: "never" };

export type GroupMode = "all" | "any" | "none";

/** One field of a shape. */
export type Entry = {
  key: KeyId;
  /** Required entries need a value (an empty list counts as none). */
  optional: boolean;
  type: TypeExpr;
  /**
   * Set where the field is declared: exactly one entry per key in the workspace. Other entries
   * with the key (e.g. in a filter) only constrain it, and show the declaration's label and icon.
   */
  decl?: {
    label: string;
    icon?: IconRef;
    /** What new notes get, for required fields. */
    default?: FieldValue;
  };
};

export type NamedType = {
  id: TypeId;
  name: string;
  icon: IconRef;
  color: TypeColor;
  expr: TypeExpr;
  /** Built-in types can't be deleted. */
  builtIn?: boolean;
};

/** The built-in Note type: declares the fields every note can have. */
const NOTE_TYPE: NamedType = {
  id: NOTE_TYPE_ID,
  name: "Note",
  icon: "sticky-note",
  color: "gray",
  builtIn: true,
  expr: {
    kind: "shape",
    entries: [
      {
        key: TYPE_KEY,
        optional: true,
        type: { kind: "array", of: { kind: "primitive", name: "type" } },
        decl: { label: "Type", icon: "shapes" },
      },
      {
        key: ICON_KEY,
        optional: true,
        type: { kind: "primitive", name: "icon" },
        decl: { label: "Icon", icon: "smile" },
      },
    ],
  },
};

/** The condition that makes a type one notes can be of: their `type` includes it. */
export const isSelf = (typeId: TypeId): Entry => ({
  key: TYPE_KEY,
  optional: false,
  type: { kind: "object", id: typeId },
});

/** The built-in User type (people, e.g. assignees); its ID is the one the User schema had. */
export const USER_TYPE_ID: TypeId = "schema-user";
const USER_TYPE: NamedType = {
  id: USER_TYPE_ID,
  name: "User",
  icon: "user-round",
  color: "gray",
  builtIn: true,
  expr: { kind: "shape", entries: [isSelf(USER_TYPE_ID)] },
};

export const BUILT_IN_TYPES: readonly NamedType[] = [NOTE_TYPE, USER_TYPE];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** What types are about: anything with field values (today, notes). */
type Obj = { id: string; data: { fields: Record<KeyId, FieldValue> } };

type Scope<T extends Obj> = { nodes: readonly T[]; types: readonly NamedType[] };

/**
 * Tests over `scope`. Named types' members are worked out once per evaluator; a type that
 * (indirectly) refers to itself matches nothing while it's being worked out.
 */
function evaluator<T extends Obj>({ nodes, types }: Scope<T>) {
  const notes = new Map(nodes.map((n) => [n.id, n]));
  const named = new Map(types.map((t) => [t.id, t]));
  const memberIds = new Map<TypeId, ReadonlySet<string>>();
  const pending = new Set<TypeId>();

  const membersOf = (typeId: TypeId): ReadonlySet<string> => {
    const known = memberIds.get(typeId);
    if (known) {
      return known;
    }
    const type = named.get(typeId);
    if (!type || pending.has(typeId)) {
      return new Set();
    }
    pending.add(typeId);
    const ids = new Set(nodes.filter((n) => isA(type.expr, n)).map((n) => n.id));
    pending.delete(typeId);
    memberIds.set(typeId, ids);
    return ids;
  };

  /** Whether a note is of `type`. */
  const isA = (type: TypeExpr, note: T): boolean => {
    switch (type.kind) {
      case "shape":
        return type.entries.every((e) => fits(note.data.fields[e.key] ?? [], e));
      case "ref":
        return membersOf(type.typeId).has(note.id);
      case "pick":
      case "omit":
        return isA({ kind: "shape", entries: entriesOf(type, types) }, note);
      case "group":
        return combine(type, (t) => isA(t, note));
      case "object":
        return note.id === type.id;
      case "primitive":
        return type.name === "note";
      case "unknown":
        return true;
      case "literal":
      case "array":
      case "never":
        return false;
    }
  };

  const fits = (values: FieldValue, entry: Entry) =>
    values.length === 0 ? entry.optional : valueFits(values, entry.type);

  /**
   * Whether a field's values are of `type`. A list fits an array type if every value fits its
   * element type, and any other type if one of its values does ("labels includes backend").
   */
  const valueFits = (values: FieldValue, type: TypeExpr): boolean => {
    if (type.kind === "array") {
      return values.every((v) => atomFits(v, type.of));
    }
    if (type.kind === "group") {
      return combine(type, (t) => valueFits(values, t));
    }
    return values.some((v) => atomFits(v, type));
  };

  const atomFits = (atom: FieldAtom, type: TypeExpr): boolean => {
    switch (type.kind) {
      case "primitive":
        return primitiveFits(atom, type.name);
      case "literal":
        return atom === type.value;
      case "object":
        return atom === type.id;
      case "ref": {
        // Notes are checked against the type's members (worked out once); other values directly.
        const note = typeof atom === "string" ? notes.get(atom) : undefined;
        if (note) {
          return membersOf(type.typeId).has(note.id);
        }
        const target = named.get(type.typeId);
        if (!target || pending.has(type.typeId)) {
          return false;
        }
        pending.add(type.typeId);
        const ok = atomFits(atom, target.expr);
        pending.delete(type.typeId);
        return ok;
      }
      case "shape":
      case "pick":
      case "omit": {
        const note = typeof atom === "string" ? notes.get(atom) : undefined;
        return note !== undefined && isA(type, note);
      }
      case "group":
        return combine(type, (t) => atomFits(atom, t));
      case "unknown":
        return true;
      case "array":
      case "never":
        return false;
    }
  };

  const primitiveFits = (atom: FieldAtom, name: PrimitiveName): boolean => {
    if (name === "number") {
      return typeof atom === "number";
    }
    if (typeof atom !== "string") {
      return false;
    }
    switch (name) {
      case "date":
        return DATE.test(atom);
      case "datetime":
        return DATETIME.test(atom);
      case "image":
        return /^https?:\/\//i.test(atom);
      case "note":
        return notes.has(atom);
      case "type":
        return named.has(atom);
      case "text":
      case "icon":
        return true;
    }
  };

  return isA;
}

const combine = (
  group: Extract<TypeExpr, { kind: "group" }>,
  test: (type: TypeExpr) => boolean,
): boolean => {
  if (group.mode === "all") {
    return group.of.every(test);
  }
  return group.mode === "any" ? group.of.some(test) : !group.of.some(test);
};

/** The notes of `type`, in board order. */
export function members<T extends Obj>(type: TypeExpr, scope: Scope<T>): T[] {
  const isA = evaluator(scope);
  return scope.nodes.filter((n) => isA(type, n));
}

/**
 * The fields notes of `type` have, in order: a shape's entries, through named types, picks and
 * omits. An intersection has the fields of all its parts (the first entry for a key wins); a
 * union only those every part has, as in TypeScript.
 */
function entriesOf(
  type: TypeExpr,
  types: readonly NamedType[],
  seen: ReadonlySet<TypeId> = new Set(),
): Entry[] {
  switch (type.kind) {
    case "shape":
      return type.entries;
    case "ref": {
      const target = types.find((t) => t.id === type.typeId);
      return target && !seen.has(target.id)
        ? entriesOf(target.expr, types, new Set([...seen, target.id]))
        : [];
    }
    case "pick":
    case "omit": {
      const keep = type.kind === "pick";
      return entriesOf(type.from, types, seen).filter((e) => type.keys.includes(e.key) === keep);
    }
    case "group": {
      if (type.mode === "none") {
        return [];
      }
      const parts = type.of.map((t) => entriesOf(t, types, seen));
      if (type.mode === "all") {
        const all = parts.flat();
        return all.filter((e, i) => all.findIndex((other) => other.key === e.key) === i);
      }
      const [first = [], ...rest] = parts;
      return first.filter((e) => rest.every((part) => part.some((other) => other.key === e.key)));
    }
    default:
      return [];
  }
}

/** Where each field is declared: its label, icon and declared type, by key. */
export function declarations(types: readonly NamedType[]): Map<KeyId, Entry & { typeId: TypeId }> {
  const found = new Map<KeyId, Entry & { typeId: TypeId }>();
  const visit = (type: TypeExpr, typeId: TypeId) => {
    switch (type.kind) {
      case "shape":
        for (const entry of type.entries) {
          if (entry.decl && !found.has(entry.key)) {
            found.set(entry.key, { ...entry, typeId });
          }
          visit(entry.type, typeId);
        }
        break;
      case "array":
        visit(type.of, typeId);
        break;
      case "pick":
      case "omit":
        visit(type.from, typeId);
        break;
      case "group":
        for (const t of type.of) {
          visit(t, typeId);
        }
        break;
      default:
        break;
    }
  };
  for (const t of types) {
    visit(t.expr, t.id);
  }
  return found;
}

/** Whether notes can be of `type`: it says so, with a required `{ type: Self }` entry. */
export function isForNotes(type: NamedType, types: readonly NamedType[]): boolean {
  return entriesOf(type.expr, types).some(
    (e) => e.key === TYPE_KEY && !e.optional && e.type.kind === "object" && e.type.id === type.id,
  );
}

/** The fields of a note of these types, in order (each once). */
export const entriesOfTypes = (typeIds: readonly TypeId[], types: readonly NamedType[]) =>
  entriesOf(
    { kind: "group", mode: "all", of: typeIds.map((typeId) => ({ kind: "ref", typeId })) },
    types,
  );

/** A field of a type for notes: declared there, or picked from the type that declares it. */
export type NotesField = { entry: Entry } | { from: TypeId; key: KeyId };

/**
 * Fields in order, as parts of an intersection: runs of fields declared here become shapes
 * (the first one starting with `first`), runs picked from one other type become picks.
 */
export function fieldParts(fields: readonly NotesField[], first: Entry[] = []): TypeExpr[] {
  const parts: TypeExpr[] = first.length > 0 ? [{ kind: "shape", entries: [...first] }] : [];
  for (const field of fields) {
    const last = parts.at(-1);
    if ("entry" in field) {
      if (last?.kind === "shape") {
        last.entries.push(field.entry);
      } else {
        parts.push({ kind: "shape", entries: [field.entry] });
      }
    } else if (
      last?.kind === "pick" &&
      last.from.kind === "ref" &&
      last.from.typeId === field.from
    ) {
      last.keys.push(field.key);
    } else {
      parts.push({ kind: "pick", from: { kind: "ref", typeId: field.from }, keys: [field.key] });
    }
  }
  return parts;
}

/** An intersection of `parts` (just the part, if there's one). */
export const allOf = (parts: TypeExpr[]): TypeExpr =>
  parts.length === 1 ? parts[0]! : { kind: "group", mode: "all", of: parts };

/** A type for notes, `{ type: Self, …fields }`, its fields in order (see fieldParts). */
export const typeForNotes = (typeId: TypeId, fields: readonly NotesField[]): TypeExpr =>
  allOf(fieldParts(fields, [isSelf(typeId)]));

/** Whether `type` refers to named type `typeId`, directly or through other named types. */
export function dependsOn(type: TypeExpr, typeId: TypeId, types: readonly NamedType[]): boolean {
  const seen = new Set<TypeId>();
  const queue = [type];
  while (queue.length > 0) {
    const next = queue.pop()!;
    switch (next.kind) {
      case "ref":
        if (next.typeId === typeId) {
          return true;
        }
        if (!seen.has(next.typeId)) {
          seen.add(next.typeId);
          const target = types.find((t) => t.id === next.typeId);
          if (target) {
            queue.push(target.expr);
          }
        }
        break;
      case "shape":
        queue.push(...next.entries.map((e) => e.type));
        break;
      case "group":
        queue.push(...next.of);
        break;
      case "array":
        queue.push(next.of);
        break;
      case "pick":
      case "omit":
        queue.push(next.from);
        break;
      default:
        break;
    }
  }
  return false;
}

/** How a field's values are edited: one value or a list, and what each value is. */
export type ValueKind = { many: boolean } & (
  | { kind: "input"; input: InputType }
  /** Notes: these listed options (then any other note), or only notes of `within`. */
  | { kind: "note"; options: string[]; within: TypeExpr | null }
  | { kind: "type" }
);

export function valueKind(type: TypeExpr): ValueKind {
  const one = { many: false };
  switch (type.kind) {
    case "array":
      return { ...valueKind(type.of), many: true };
    case "primitive":
      if (type.name === "note") {
        return { ...one, kind: "note", options: [], within: null };
      }
      return type.name === "type"
        ? { ...one, kind: "type" }
        : { ...one, kind: "input", input: type.name };
    case "object":
      return { ...one, kind: "note", options: [type.id], within: null };
    case "group":
      if (type.mode === "any" && type.of.every((t) => t.kind === "object")) {
        return { ...one, kind: "note", options: objectIds(type), within: null };
      }
      return { ...one, kind: "note", options: [], within: type };
    case "ref":
    case "shape":
    case "pick":
    case "omit":
      return { ...one, kind: "note", options: [], within: type };
    default:
      return { ...one, kind: "input", input: "text" };
  }
}

/** The notes (or types) a type lists by ID: its options. */
const objectIds = (type: TypeExpr): string[] =>
  type.kind === "object"
    ? [type.id]
    : type.kind === "group" && type.mode === "any"
      ? type.of.flatMap(objectIds)
      : [];

/**
 * `type` with `id` added to its listed options (a list type's element type): a union of notes
 * grows, a single note becomes a union. Other types are returned as they are.
 */
export function withOption(type: TypeExpr, id: string): TypeExpr {
  if (type.kind === "array") {
    return { ...type, of: withOption(type.of, id) };
  }
  if (type.kind === "object") {
    return { kind: "group", mode: "any", of: [type, { kind: "object", id }] };
  }
  if (type.kind === "group" && type.mode === "any" && type.of.every((t) => t.kind === "object")) {
    return { ...type, of: [...type.of, { kind: "object", id }] };
  }
  return type;
}

/** `type` without the listed options (and defaults) that are among `ids`, e.g. deleted notes. */
export function withoutObjects(type: TypeExpr, ids: ReadonlySet<string>): TypeExpr {
  switch (type.kind) {
    case "group":
      return {
        ...type,
        of: type.of
          .filter((t) => !(t.kind === "object" && ids.has(t.id)))
          .map((t) => withoutObjects(t, ids)),
      };
    case "array":
      return { ...type, of: withoutObjects(type.of, ids) };
    case "pick":
    case "omit":
      return { ...type, from: withoutObjects(type.from, ids) };
    case "shape":
      return {
        ...type,
        entries: type.entries.map((e) => ({
          ...e,
          type: withoutObjects(e.type, ids),
          ...(e.decl?.default && {
            decl: { ...e.decl, default: e.decl.default.filter((v) => !ids.has(String(v))) },
          }),
        })),
      };
    default:
      return type;
  }
}

/** Calls `edit` on every entry that declares a field, anywhere in `type`; returns the new type. */
export function mapDeclarations(type: TypeExpr, edit: (entry: Entry) => Entry): TypeExpr {
  switch (type.kind) {
    case "shape":
      return {
        ...type,
        entries: type.entries.map((e) => ({
          ...(e.decl ? edit(e) : e),
          type: mapDeclarations(e.type, edit),
        })),
      };
    case "group":
      return { ...type, of: type.of.map((t) => mapDeclarations(t, edit)) };
    case "array":
      return { ...type, of: mapDeclarations(type.of, edit) };
    case "pick":
    case "omit":
      return { ...type, from: mapDeclarations(type.from, edit) };
    default:
      return type;
  }
}
