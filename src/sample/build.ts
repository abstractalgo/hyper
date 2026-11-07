import { createHeadlessEditor } from "@lexical/headless";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalNode,
  type TextFormatType,
} from "lexical";

import { $createEquationNode } from "../editor/equations/EquationNode";
import { $createNoteMentionNode } from "../editor/mentions/NoteMentionNode";
import { EDITOR_NODES } from "../editor/nodes";
import {
  createNote,
  newId,
  NOTE_WIDTH,
  OPTION_NOTE_WIDTH,
  type Board,
  type Layout,
  type Note,
} from "../store/canvas";
import {
  customIconRef,
  slugify,
  type CustomIcon,
  type FieldAtom,
  type FieldValue,
  type IconRef,
  type InputType,
  type NoteColor,
  type TypeColor,
} from "../workspace/model";
import {
  BUILT_IN_TYPES,
  declarations,
  ICON_KEY,
  isSelf,
  TYPE_KEY,
  typeForNotes,
  USER_TYPE_ID,
  valueKind,
  type Entry,
  type NamedType,
  type TypeExpr,
} from "../workspace/typeSystem";

/**
 * Inline content: plain text, formatted text, a link, an inline (KaTeX) equation, or a mention of
 * another sample note `N`.
 */
export type Inline<N extends string> =
  | string
  | { text: string; format: TextFormatType[] }
  | { link: string; url: string }
  | { math: string }
  | { mention: N };

export const b = (text: string): Inline<never> => ({ text, format: ["bold"] });
export const i = (text: string): Inline<never> => ({ text, format: ["italic"] });
export const code = (text: string): Inline<never> => ({ text, format: ["code"] });
export const at = <N extends string>(mention: N): Inline<N> => ({ mention });
export const link = (text: string, url: string): Inline<never> => ({ link: text, url });
/** An inline equation, as a tagged template so TeX needs no escaping: m`a \in G`. */
export const m = (tex: TemplateStringsArray, ...values: unknown[]): Inline<never> => ({
  math: String.raw(tex, ...values),
});
/** A displayed (block) equation: eq`|G| = [G:H]\,|H|`. */
export const eq = (tex: TemplateStringsArray, ...values: unknown[]): Block<never> => ({
  math: String.raw(tex, ...values),
});

type Block<N extends string> =
  | { p: Inline<N>[] }
  | { h: HeadingTagType; text: string }
  | { quote: Inline<N>[] }
  | { bullets: Inline<N>[][] }
  | { numbered: Inline<N>[][] }
  | { checks: [checked: boolean, Inline<N>[]][] }
  | { math: string };

/** A sample field: like a field definition, but select options are given by name. */
type SampleField<N extends string> = {
  name: string;
  type: InputType | "select";
  icon?: IconRef;
  /** Selects only: multi-select. */
  multiple?: boolean;
  required?: boolean;
  /** Required fields' default: option names for selects, else values. */
  defaultValue?: FieldAtom[];
  /** For selects: new colored option notes (in a column right of the board), or sample notes. */
  options?: [name: string, color: NoteColor][] | N[];
};

type SampleSchema<F extends string> = {
  name: string;
  icon: IconRef;
  color: TypeColor;
  fields: F[];
};

/** Field values by field: option names, `{ ref }` to another sample note, or plain values. */
export const ref = <N extends string>(note: N) => ({ ref: note });

type SampleNote<N extends string, F extends string, S extends string> = {
  title: string;
  /** A sample schema, or the built-in User schema. */
  schema: S | "user";
  /** Image URL, added as a workspace custom icon and set as the note's icon (e.g. an avatar). */
  avatar?: string;
  color?: NoteColor;
  fields?: Partial<Record<F, (FieldAtom | { ref: N })[]>>;
  x: number;
  y: number;
  blocks: Block<N>[];
};

export type Sample<N extends string, F extends string, S extends string> = {
  fields: Record<F, SampleField<N>>;
  schemas: Record<S, SampleSchema<F>>;
  notes: Record<N, SampleNote<N, F, S>>;
  /** Where the columns of option notes start. */
  optionsX: number;
  /** Named collections; later ones can use earlier ones (by name). */
  collections?: SampleCollection<N, F, S>[];
};

/** How a sample collection names what it matches, by sample keys. */
type SampleRefs<N extends string, F extends string, S extends string> = {
  /** Notes of a sample schema (or the built-in User). */
  schema: (key: S | "user") => TypeExpr;
  /** Notes whose field is one of `values`: option names, sample note keys, or plain values. */
  is: (key: F, ...values: (FieldAtom | N)[]) => TypeExpr;
  /** Members of an earlier collection of the sample. */
  collection: (name: string) => TypeExpr;
};

type SampleCollection<N extends string, F extends string, S extends string> = {
  name: string;
  type: (refs: SampleRefs<N, F, S>) => TypeExpr;
};

export const all = (...of: TypeExpr[]): TypeExpr => ({ kind: "group", mode: "all", of });
export const any = (...of: TypeExpr[]): TypeExpr => ({ kind: "group", mode: "any", of });
export const none = (...of: TypeExpr[]): TypeExpr => ({ kind: "group", mode: "none", of });

class Unresolved extends Error {}

/** The first of `items` that matches; throws `Unresolved` if none does. */
const find = <T>(items: readonly T[], match: (item: T) => boolean): T => {
  const item = items.find(match);
  if (item === undefined) {
    throw new Unresolved();
  }
  return item;
};

/**
 * A sample's collections on `board`, finding what they refer to by name: a board built from the
 * sample, or one saved before it had collections. Collections referring to anything that's no
 * longer there are left out.
 */
export function sampleCollections<N extends string, F extends string, S extends string>(
  sample: Sample<N, F, S>,
  board: Board,
): NamedType[] {
  const isNoteKey = (value: unknown): value is N =>
    typeof value === "string" && value in sample.notes;
  const declared = [...declarations(board.types).values()];
  const collections: NamedType[] = [];
  const refs: SampleRefs<N, F, S> = {
    schema: (key) => {
      const name = key === "user" ? "User" : sample.schemas[key].name;
      const type = find(board.types, (t) => t.name === name);
      return { kind: "shape", entries: [isSelf(type.id)] };
    },
    is: (key, ...values) => {
      const field = find(declared, (e) => e.decl?.label === sample.fields[key].name);
      const kind = valueKind(field.type);
      const resolve = (value: FieldAtom | N): TypeExpr => {
        if (kind.kind !== "note") {
          return { kind: "literal", value };
        }
        const title = isNoteKey(value) ? sample.notes[value].title : String(value);
        const titled = (n: Note) => n.data.title === title;
        const note = find(
          board.notes,
          (n) => titled(n) && (!kind.options.length || kind.options.includes(n.id)),
        );
        return { kind: "object", id: note.id };
      };
      const options = values.map(resolve);
      return {
        kind: "shape",
        entries: [
          {
            key: field.key,
            optional: false,
            type: options.length === 1 ? options[0]! : { kind: "group", mode: "any", of: options },
          },
        ],
      };
    },
    collection: (name) => ({
      kind: "ref",
      typeId: find(collections, (c) => c.name === name).id,
    }),
  };
  for (const { name, type } of sample.collections ?? []) {
    try {
      collections.push({ id: newId(), name, icon: "list-filter", color: "gray", expr: type(refs) });
    } catch (error) {
      if (!(error instanceof Unresolved)) {
        throw error;
      }
    }
  }
  return collections;
}

/** Deterministic illustrated avatar for a name (external image service). */
export const avatarUrl = (name: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}`;

const OPTION_STEP_X = OPTION_NOTE_WIDTH + 80;
const OPTION_STEP_Y = 100;

const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as K[];
const idsFor = <K extends string>(keys: K[]) =>
  Object.fromEntries(keys.map((k) => [k, newId()])) as Record<K, string>;

/**
 * Builds a board from a sample: its schemas as types (plus the built-in ones) declaring its fields,
 * option notes, and notes
 * with real Lexical editor states, mentions and references wired by ID.
 */
export function buildBoard<N extends string, F extends string, S extends string>(
  sample: Sample<N, F, S>,
): Board {
  const noteKeys = keysOf(sample.notes);
  const fieldKeys = keysOf(sample.fields);
  const ids = idsFor(noteKeys);
  const fieldIds = idsFor(fieldKeys);
  const schemaIds: Record<S | "user", string> = {
    ...idsFor(keysOf(sample.schemas)),
    user: USER_TYPE_ID,
  };

  // Option notes (by name) per select field with its own options, one column per field.
  const optionNotes = new Map<F, Map<string, Note>>();
  // Where notes are on the main canvas.
  const layout: Layout = {};
  for (const key of fieldKeys) {
    const options = sample.fields[key].options;
    if (!options?.length || typeof options[0] !== "object") {
      continue;
    }
    const column = optionNotes.size;
    const notes = (options as [string, NoteColor][]).map(([title, color], row) => {
      const note = createNote({ title, color });
      layout[note.id] = {
        x: sample.optionsX + column * OPTION_STEP_X,
        y: -200 + row * OPTION_STEP_Y,
        width: OPTION_NOTE_WIDTH,
      };
      return note;
    });
    optionNotes.set(key, new Map(notes.map((n) => [n.data.title, n])));
  }
  // Sample data names select options (and refers to notes by key); notes store IDs.
  const resolve = (key: F, atom: FieldAtom | { ref: N }): FieldAtom =>
    typeof atom === "object"
      ? ids[atom.ref]
      : (optionNotes.get(key)?.get(String(atom))?.id ?? atom);

  // A field's values: a select's options (as a list for multi-selects), or plain values.
  const valueType = (key: F): TypeExpr => {
    const { type, options = [], multiple = false } = sample.fields[key];
    if (type !== "select") {
      return { kind: "primitive", name: type };
    }
    const optionIds = optionNotes.has(key)
      ? [...optionNotes.get(key)!.values()].map((n) => n.id)
      : (options as N[]).map((k) => ids[k]);
    const option: TypeExpr = {
      kind: "group",
      mode: "any",
      of: optionIds.map((id) => ({ kind: "object", id })),
    };
    return multiple ? { kind: "array", of: option } : option;
  };
  const declare = (key: F): Entry => {
    const { name, icon, required = false, defaultValue = [] } = sample.fields[key];
    return {
      key: fieldIds[key],
      optional: !required,
      type: valueType(key),
      decl: {
        label: name,
        ...(icon && { icon }),
        ...(required && { default: defaultValue.map((atom) => resolve(key, atom)) }),
      },
    };
  };

  // Each field is declared by the first schema that has it; schemas after it pick it from there.
  const schemaKeys = keysOf(sample.schemas);
  const owners = new Map<F, S>();
  for (const key of schemaKeys) {
    for (const field of sample.schemas[key].fields) {
      if (!owners.has(field)) {
        owners.set(field, key);
      }
    }
  }
  const types: NamedType[] = [
    ...BUILT_IN_TYPES,
    ...schemaKeys.map((key): NamedType => {
      const { fields: keys, ...schema } = sample.schemas[key];
      const id = schemaIds[key];
      const fields = keys.map((field) =>
        owners.get(field) === key
          ? { entry: declare(field) }
          : { from: schemaIds[owners.get(field)!], key: fieldIds[field] },
      );
      return { id, ...schema, expr: typeForNotes(id, fields) };
    }),
  ];
  const editor = createHeadlessEditor({
    namespace: "sample",
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  const $inline = (parts: Inline<N>[]): LexicalNode[] =>
    parts.map((part) => {
      if (typeof part === "string") {
        return $createTextNode(part);
      }
      if ("mention" in part) {
        return $createNoteMentionNode(ids[part.mention]);
      }
      if ("link" in part) {
        return $createLinkNode(part.url).append($createTextNode(part.link));
      }
      if ("math" in part) {
        return $createEquationNode(part.math, true);
      }
      const node = $createTextNode(part.text);
      for (const f of part.format) {
        node.toggleFormat(f);
      }
      return node;
    });

  const $block = (block: Block<N>): LexicalNode => {
    if ("math" in block) {
      return $createEquationNode(block.math, false);
    }
    if ("p" in block) {
      return $createParagraphNode().append(...$inline(block.p));
    }
    if ("h" in block) {
      return $createHeadingNode(block.h).append($createTextNode(block.text));
    }
    if ("quote" in block) {
      return $createQuoteNode().append(...$inline(block.quote));
    }
    if ("checks" in block) {
      return $createListNode("check").append(
        ...block.checks.map(([checked, parts]) =>
          $createListItemNode(checked).append(...$inline(parts)),
        ),
      );
    }
    const [type, items] =
      "bullets" in block
        ? (["bullet", block.bullets] as const)
        : (["number", block.numbered] as const);
    return $createListNode(type).append(
      ...items.map((parts) => $createListItemNode().append(...$inline(parts))),
    );
  };

  // Avatars are workspace custom icons, set as their notes' icons.
  const customIcons: CustomIcon[] = [];

  const nodes = noteKeys.map((key) => {
    const note = sample.notes[key];
    let icon: string | null = null;
    if (note.avatar) {
      const custom = { id: newId(), name: slugify(note.title), url: note.avatar };
      customIcons.push(custom);
      icon = customIconRef(custom.id);
    }
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append(...note.blocks.map($block));
      },
      { discrete: true },
    );
    const content = JSON.stringify(editor.getEditorState().toJSON());

    // Its type and icon, then its fields' values: given, or the defaults of required fields.
    const values: Record<string, FieldValue> = {
      [TYPE_KEY]: [schemaIds[note.schema]],
      ...(icon && { [ICON_KEY]: [icon] }),
    };
    const keys = note.schema === "user" ? [] : sample.schemas[note.schema].fields;
    for (const fieldKey of keys) {
      const given = note.fields?.[fieldKey];
      const { required = false, defaultValue = [] } = sample.fields[fieldKey];
      if (given || required) {
        values[fieldIds[fieldKey]] = (given ?? defaultValue).map((atom) => resolve(fieldKey, atom));
      }
    }

    layout[ids[key]] = { x: note.x, y: note.y, width: NOTE_WIDTH };
    return createNote({
      title: note.title,
      fields: values,
      color: note.color,
      content,
      id: ids[key],
    });
  });

  const options = [...optionNotes.values()].flatMap((notes) => [...notes.values()]);
  const board = { notes: [...nodes, ...options], layout, types, customIcons };
  return { ...board, types: [...types, ...sampleCollections(sample, board)] };
}
