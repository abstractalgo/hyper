export const FIELD_TYPES = [
  "text",
  "number",
  "icon",
  "image",
  "date",
  "datetime",
  "reference",
  "select",
  "multiselect",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  icon: "Icon",
  image: "Image (URL)",
  date: "Date",
  datetime: "Date & time",
  reference: "Reference",
  select: "Select",
  multiselect: "Multi-select",
};

/** Enum-like types: values are IDs of the field's own options. */
export const isSelectType = (type: FieldType) => type === "select" || type === "multiselect";

export const OPTION_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

/**
 * Pill classes per option color: Notion's select-tag colors (light theme), as literal strings so
 * Tailwind picks them up.
 */
export const OPTION_COLOR_CLASSES: Record<OptionColor, string> = {
  gray: "bg-[#E3E2E0] text-[#32302C]",
  brown: "bg-[#EEE0DA] text-[#442A1E]",
  orange: "bg-[#FADEC9] text-[#49290E]",
  yellow: "bg-[#FDECC8] text-[#402C1B]",
  green: "bg-[#DBEDDB] text-[#1C3829]",
  blue: "bg-[#D3E5EF] text-[#183347]",
  purple: "bg-[#E8DEEE] text-[#412454]",
  pink: "bg-[#F5E0E9] text-[#4C2337]",
  red: "bg-[#FFE2DD] text-[#5D1715]",
};

/** One choice of a select/multi-select field. Notes store its `id`, so renames propagate. */
export type SelectOption = { id: string; name: string; color: OptionColor };

/**
 * One value of a field. Numbers are numbers; everything else is a string:
 * text, a Lucide icon name, an image URL, `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, a note ID,
 * or a select option ID.
 */
export type FieldAtom = string | number;

/** A field's value on a note. Single-value fields hold at most one atom. */
export type FieldValue = FieldAtom[];

/** A workspace-level property definition, shared by every schema that includes it. */
export type FieldDef = {
  id: string;
  name: string;
  type: FieldType;
  /** Holds a list of values instead of one. Always false for `select`, true for `multiselect`. */
  multiple: boolean;
  /** Can't be left empty; new notes start with `defaultValue`. */
  required: boolean;
  /** Initial value for required fields (non-empty). Optional fields start empty. */
  defaultValue: FieldValue;
  /** For `reference` fields: only notes of this schema can be picked (null = any note). */
  referenceSchemaId: string | null;
  /** For `select`/`multiselect` fields: the choices, in display order. */
  options: SelectOption[];
  /** Built-in fields can't be deleted or retyped. */
  builtIn?: boolean;
};

export const SCHEMA_COLORS = [
  "gray",
  "sky",
  "red",
  "teal",
  "violet",
  "amber",
  "green",
  "pink",
] as const;
export type SchemaColor = (typeof SCHEMA_COLORS)[number];

/** Literal class names so Tailwind picks them up. */
export const SCHEMA_COLOR_CLASSES: Record<SchemaColor, string> = {
  gray: "text-gray-500",
  sky: "text-sky-600",
  red: "text-red-600",
  teal: "text-teal-600",
  violet: "text-violet-600",
  amber: "text-amber-600",
  green: "text-green-600",
  pink: "text-pink-600",
};

/** A type of note: a named, ordered collection of fields. */
export type Schema = {
  id: string;
  name: string;
  /** Lucide icon name (kebab-case, e.g. `square-check-big`). */
  icon: string;
  color: SchemaColor;
  fieldIds: string[];
  /** Built-in schemas can't be deleted. */
  builtIn?: boolean;
};

export const USER_SCHEMA_ID = "schema-user";
export const AVATAR_FIELD_ID = "field-avatar";

export const BUILT_IN_FIELDS: FieldDef[] = [
  {
    id: AVATAR_FIELD_ID,
    name: "Avatar",
    type: "image",
    multiple: false,
    required: false,
    defaultValue: [],
    referenceSchemaId: null,
    options: [],
    builtIn: true,
  },
];

export const BUILT_IN_SCHEMAS: Schema[] = [
  {
    id: USER_SCHEMA_ID,
    name: "User",
    icon: "user-round",
    color: "gray",
    fieldIds: [AVATAR_FIELD_ID],
    builtIn: true,
  },
];

/** The value a note gets for a field when the field is first applied to it. */
export const initialValue = (field: FieldDef): FieldValue =>
  field.required ? [...field.defaultValue] : [];

/** Brings an existing value in line with a field's (possibly changed) rules. */
export function conformValue(field: FieldDef, value: FieldValue | undefined): FieldValue {
  let next = value ?? [];
  // Values pointing at deleted options are dropped.
  if (isSelectType(field.type)) next = next.filter((id) => field.options.some((o) => o.id === id));
  if (!field.multiple) next = next.slice(0, 1);
  if (field.required && next.length === 0) next = [...field.defaultValue];
  return next;
}

/** Problems with a field definition, as user-facing messages (empty = valid). */
export function validateField(field: FieldDef): string[] {
  const errors: string[] = [];
  if (!field.name.trim()) errors.push("Name is required.");
  if (field.required && field.defaultValue.length === 0) {
    errors.push("Mandatory fields need a default value.");
  }
  if (!field.multiple && field.defaultValue.length > 1) {
    errors.push("A single-value field can only have one default.");
  }
  if (isSelectType(field.type)) {
    const names = field.options.map((o) => o.name.trim().toLowerCase());
    if (names.some((n) => !n)) errors.push("Options need a name.");
    if (new Set(names).size !== names.length) errors.push("Option names must be unique.");
  }
  return errors;
}

/** Parses user input into an atom of the given type, or null if it isn't valid. */
export function parseAtom(type: FieldType, input: string): FieldAtom | null {
  const s = input.trim();
  if (!s) return null;
  switch (type) {
    case "number": {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "image":
      return /^https?:\/\//i.test(s) ? s : null;
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    case "datetime":
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : null;
    default:
      return s;
  }
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Human-readable form of a date/datetime atom (stored as local `YYYY-MM-DD[THH:mm]`). */
export function formatDateAtom(type: "date" | "datetime", atom: FieldAtom): string {
  const s = String(atom);
  // Parse date-only values as local midnight, not UTC (which can shift the day).
  const date = new Date(type === "date" ? `${s}T00:00` : s);
  if (Number.isNaN(date.getTime())) return s;
  return (type === "date" ? dateFormat : dateTimeFormat).format(date);
}
