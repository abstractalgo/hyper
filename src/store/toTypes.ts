import type { EditorNode } from "./canvas";
import type { CustomIcon, FieldAtom, FieldValue, IconRef, TypeColor } from "../workspace/model";
import {
  BUILT_IN_TYPES,
  ICON_KEY,
  TYPE_KEY,
  typeForNotes,
  type Entry,
  type GroupMode,
  type NamedType,
  type NotesField,
  type TypeExpr,
} from "../workspace/typeSystem";

/** A note as saved before types: a React Flow node, with its schema and icon. */
export type SavedNode = Omit<EditorNode, "data"> & {
  data: EditorNode["data"] & { schemaId?: string | null; icon?: IconRef | null };
};

/** A board as saved with fields, schemas and collections (what this converts from). */
export type SavedBoard = {
  nodes: SavedNode[];
  fields: {
    id: string;
    name: string;
    type: "text" | "number" | "icon" | "image" | "date" | "datetime" | "select";
    required: boolean;
    icon?: IconRef;
    defaultValue: FieldValue;
    optionIds?: string[];
    optionsCollectionId?: string;
    multiple?: boolean;
  }[];
  schemas: {
    id: string;
    name: string;
    icon: IconRef;
    color: TypeColor;
    fieldIds: string[];
    builtIn?: boolean;
  }[];
  collections?: { id: string; name: string; type: Filter }[];
  customIcons: CustomIcon[];
};

type Filter =
  | { kind: "schema"; schemaId: string }
  | { kind: "field"; fieldId: string; is: FilterCondition }
  | { kind: "collection"; collectionId: string }
  | { kind: "group"; mode: GroupMode; of: Filter[] };

type FilterCondition =
  | { kind: "empty" }
  | { kind: "present" }
  | { kind: "oneOf"; values: FieldAtom[] }
  | { kind: "inCollection"; collectionId: string };

type SavedField = SavedBoard["fields"][number];

/** Whether a saved board still has fields and schemas (types replaced them). */
export const isSavedBoard = (board: object): board is SavedBoard => "schemas" in board;

/**
 * Converts a board from fields, schemas and collections to named types (see typeSystem.ts):
 *
 * - each schema becomes a type for notes: `{ type: Self, …its fields }`;
 * - a field is declared by the first schema that has it; schemas after it Pick it from there;
 * - fields no schema has are declared by an "Unsorted fields" type, so none are lost;
 * - a select's values become its options' union (or its collection), as a list for multi-selects;
 * - each collection becomes a type, its "is a" conditions becoming conditions on `type`;
 * - notes' schema and icon move into their `type` and `icon` fields.
 */
export function toTypes({ nodes, fields, schemas, collections = [], customIcons }: SavedBoard) {
  const owners = new Map<string, string>();
  for (const schema of schemas) {
    for (const id of schema.fieldIds) {
      if (!owners.has(id)) {
        owners.set(id, schema.id);
      }
    }
  }
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const builtIn = new Set(BUILT_IN_TYPES.map((t) => t.id));

  const schemaType = ({ id, name, icon, color, fieldIds }: SavedBoard["schemas"][number]) => {
    const parts = fieldIds.flatMap((fieldId): NotesField[] => {
      const field = fieldById.get(fieldId);
      if (!field) {
        return [];
      }
      const owner = owners.get(fieldId)!;
      return owner === id ? [{ entry: declare(field) }] : [{ from: owner, key: fieldId }];
    });
    return { id, name, icon, color, expr: typeForNotes(id, parts) } satisfies NamedType;
  };

  const unsorted = fields.filter((f) => !owners.has(f.id));
  const types: NamedType[] = [
    // Built-in types keep their IDs, and get any fields they were given.
    ...BUILT_IN_TYPES.map((t) => {
      const schema = schemas.find((sc) => sc.id === t.id);
      return schema?.fieldIds.length ? { ...schemaType(schema), builtIn: true } : t;
    }),
    ...schemas.filter((sc) => !builtIn.has(sc.id)).map(schemaType),
    ...(unsorted.length > 0
      ? [
          {
            id: "type-unsorted",
            name: "Unsorted fields",
            icon: "folder-open",
            color: "gray" as const,
            expr: { kind: "shape" as const, entries: unsorted.map(declare) },
          },
        ]
      : []),
    ...collections.map((c): NamedType => ({
      id: c.id,
      name: c.name,
      icon: "list-filter",
      color: "gray",
      expr: fromFilter(c.type, fieldById),
    })),
  ];

  return {
    nodes: nodes.map((n): SavedNode => {
      const { schemaId, icon, ...data } = n.data;
      return {
        ...n,
        data: {
          ...data,
          fields: {
            ...data.fields,
            ...(schemaId && { [TYPE_KEY]: [schemaId] }),
            ...(icon && { [ICON_KEY]: [icon] }),
          },
        },
      };
    }),
    types,
    customIcons,
  };
}

/** The entry that declares a field. */
const declare = (field: SavedField): Entry => ({
  key: field.id,
  optional: !field.required,
  type: valueType(field),
  decl: {
    label: field.name,
    ...(field.icon && { icon: field.icon }),
    ...(field.required && { default: field.defaultValue }),
  },
});

/** A field's values as a type: a select's options (or its collection), listed for multi-selects. */
function valueType(field: SavedField): TypeExpr {
  if (field.type !== "select") {
    return { kind: "primitive", name: field.type };
  }
  const optionIds = field.optionIds ?? [];
  const option: TypeExpr = field.optionsCollectionId
    ? { kind: "ref", typeId: field.optionsCollectionId }
    : optionIds.length > 0
      ? { kind: "group", mode: "any", of: optionIds.map((id) => ({ kind: "object", id })) }
      : { kind: "primitive", name: "note" };
  return field.multiple ? { kind: "array", of: option } : option;
}

/** A shape with one entry: a condition on one field. */
const one = (key: string, optional: boolean, type: TypeExpr): TypeExpr => ({
  kind: "shape",
  entries: [{ key, optional, type }],
});

/** A collection's conditions as a type: each field condition is a one-entry shape. */
function fromFilter(filter: Filter, fields: ReadonlyMap<string, SavedField>): TypeExpr {
  switch (filter.kind) {
    case "schema":
      return one(TYPE_KEY, false, { kind: "object", id: filter.schemaId });
    case "collection":
      return { kind: "ref", typeId: filter.collectionId };
    case "group":
      return { kind: "group", mode: filter.mode, of: filter.of.map((t) => fromFilter(t, fields)) };
    case "field": {
      const { is, fieldId } = filter;
      switch (is.kind) {
        case "empty":
          return one(fieldId, true, { kind: "never" });
        case "present":
          return one(fieldId, false, { kind: "unknown" });
        case "inCollection":
          return one(fieldId, false, { kind: "ref", typeId: is.collectionId });
        case "oneOf": {
          const isNote = fields.get(fieldId)?.type === "select";
          const values = is.values.map((v): TypeExpr =>
            isNote ? { kind: "object", id: String(v) } : { kind: "literal", value: v },
          );
          return one(
            fieldId,
            false,
            values.length === 1 ? values[0]! : { kind: "group", mode: "any", of: values },
          );
        }
      }
    }
  }
}
