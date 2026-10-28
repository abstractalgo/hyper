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
import { createNote, newId, OPTION_NOTE_WIDTH, type Board, type EditorNode } from "../store/canvas";
import {
  BUILT_IN_SCHEMAS,
  customIconRef,
  initialValue,
  slugify,
  USER_SCHEMA_ID,
  type CustomIcon,
  type FieldAtom,
  type FieldDef,
  type FieldType,
  type FieldValue,
  type IconRef,
  type NoteColor,
  type Schema,
  type SchemaColor,
} from "../workspace/model";

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
  type: FieldType;
  icon?: IconRef;
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
  color: SchemaColor;
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
};

/** Deterministic illustrated avatar for a name (external image service). */
export const avatarUrl = (name: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}`;

const OPTION_STEP_X = OPTION_NOTE_WIDTH + 80;
const OPTION_STEP_Y = 100;

const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as K[];
const idsFor = <K extends string>(keys: K[]) =>
  Object.fromEntries(keys.map((k) => [k, newId()])) as Record<K, string>;

/**
 * Builds a board from a sample: fields, schemas (plus the built-in User), option notes, and notes
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
    user: USER_SCHEMA_ID,
  };

  // Option notes (by name) per select field with its own options, one column per field.
  const optionNotes = new Map<F, Map<string, EditorNode>>();
  for (const key of fieldKeys) {
    const options = sample.fields[key].options;
    if (!options?.length || typeof options[0] !== "object") continue;
    const column = optionNotes.size;
    const notes = (options as [string, NoteColor][]).map(([title, color], row) =>
      createNote({
        title,
        color,
        width: OPTION_NOTE_WIDTH,
        position: { x: sample.optionsX + column * OPTION_STEP_X, y: -200 + row * OPTION_STEP_Y },
      }),
    );
    optionNotes.set(key, new Map(notes.map((n) => [n.data.title, n])));
  }
  // Sample data names select options (and refers to notes by key); notes store IDs.
  const resolve = (key: F, atom: FieldAtom | { ref: N }): FieldAtom =>
    typeof atom === "object"
      ? ids[atom.ref]
      : (optionNotes.get(key)?.get(String(atom))?.id ?? atom);

  const fields = fieldKeys.map((key): FieldDef => {
    const {
      options,
      defaultValue = [],
      multiple = false,
      required = false,
      ...def
    } = sample.fields[key];
    const optionIds = optionNotes.has(key)
      ? [...optionNotes.get(key)!.values()].map((n) => n.id)
      : ((options ?? []) as N[]).map((k) => ids[k]);
    // TypeScript can't relate `type` to the matching default and options; the samples are typed
    // loosely and checked by hand.
    return {
      id: fieldIds[key],
      ...def,
      multiple,
      required,
      defaultValue: defaultValue.map((atom) => resolve(key, atom)),
      ...(def.type === "select" && { optionIds }),
    } as FieldDef;
  });

  const schemas: Schema[] = [
    ...BUILT_IN_SCHEMAS,
    ...keysOf(sample.schemas).map((key) => {
      const { fields: keys, ...schema } = sample.schemas[key];
      return { id: schemaIds[key], ...schema, fieldIds: keys.map((k) => fieldIds[k]) };
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
      if (typeof part === "string") return $createTextNode(part);
      if ("mention" in part) return $createNoteMentionNode(ids[part.mention]);
      if ("link" in part) return $createLinkNode(part.url).append($createTextNode(part.link));
      if ("math" in part) return $createEquationNode(part.math, true);
      const node = $createTextNode(part.text);
      for (const f of part.format) node.toggleFormat(f);
      return node;
    });

  const $block = (block: Block<N>): LexicalNode => {
    if ("math" in block) return $createEquationNode(block.math, false);
    if ("p" in block) return $createParagraphNode().append(...$inline(block.p));
    if ("h" in block) return $createHeadingNode(block.h).append($createTextNode(block.text));
    if ("quote" in block) return $createQuoteNode().append(...$inline(block.quote));
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

    const schema = schemas.find((sc) => sc.id === schemaIds[note.schema])!;
    const values: Record<string, FieldValue> = {};
    for (const fieldKey of fieldKeys) {
      const fieldId = fieldIds[fieldKey];
      if (!schema.fieldIds.includes(fieldId)) continue;
      const given = note.fields?.[fieldKey];
      values[fieldId] = given
        ? given.map((atom) => resolve(fieldKey, atom))
        : initialValue(fields.find((f) => f.id === fieldId)!);
    }

    return createNote({
      title: note.title,
      schemaId: schema.id,
      fields: values,
      color: note.color,
      icon,
      position: { x: note.x, y: note.y },
      content,
      id: ids[key],
    });
  });

  const options = [...optionNotes.values()].flatMap((notes) => [...notes.values()]);
  return { nodes: [...nodes, ...options], fields, schemas, customIcons };
}
