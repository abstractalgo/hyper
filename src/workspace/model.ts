/** A note's ID. */
export type NoteId = string;

/**
 * An icon reference: a Lucide name (e.g. `square-check-big`) or a workspace custom icon
 * (`custom:<id>`).
 */
export type IconRef = string;

/** What one value of each field type is. Everything per-type below is keyed by this. */
export type FieldAtomByType = {
  text: string;
  number: number;
  icon: IconRef;
  image: string;
  /** Local `YYYY-MM-DD`. */
  date: string;
  /** Local `YYYY-MM-DDTHH:mm`. */
  datetime: string;
  /** Selects pick notes. */
  select: NoteId;
};
export type FieldType = keyof FieldAtomByType;

/** One value of any field. */
export type FieldAtom = FieldAtomByType[FieldType];
/** A field's value on a note. Single-value fields hold at most one atom. */
export type FieldValue = FieldAtom[];

type FieldTypeSpec<T extends FieldType> = {
  label: string;
  /** Lucide icon of the type; also the icon of fields that don't set their own. */
  icon: IconRef;
  /** The native input used to type a value, or null when values are picked (icons, notes). */
  input: "text" | "number" | "url" | "date" | "datetime-local" | null;
  /** Parses typed input into a value, or null if it isn't valid. */
  parse: (input: string) => FieldAtomByType[T] | null;
  /** Whether a stored value is of this type (values are saved untyped, per note). */
  is: (atom: FieldAtom) => atom is FieldAtomByType[T];
};

const isString = (atom: FieldAtom): atom is string => typeof atom === "string";

const matching =
  (pattern: RegExp) =>
  (s: string): string | null =>
    pattern.test(s) ? s : null;

/** Everything that differs per field type, in one place (and in this order in menus). */
export const FIELD_TYPE_SPECS: { [T in FieldType]: FieldTypeSpec<T> } = {
  text: { label: "Text", icon: "type", input: "text", parse: (s) => s, is: isString },
  number: {
    label: "Number",
    icon: "hash",
    input: "number",
    parse: (s) => (Number.isFinite(Number(s)) ? Number(s) : null),
    is: (atom): atom is number => typeof atom === "number",
  },
  icon: { label: "Icon", icon: "smile", input: null, parse: (s) => s, is: isString },
  image: {
    label: "Image (URL)",
    icon: "image",
    input: "url",
    parse: matching(/^https?:\/\//i),
    is: isString,
  },
  date: {
    label: "Date",
    icon: "calendar",
    input: "date",
    parse: matching(/^\d{4}-\d{2}-\d{2}$/),
    is: isString,
  },
  datetime: {
    label: "Date & time",
    icon: "calendar-clock",
    input: "datetime-local",
    parse: matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    is: isString,
  },
  select: { label: "Select", icon: "list", input: null, parse: (s) => s, is: isString },
};

/** A stored value read as the given field type's values (anything else is dropped). */
export function atomsOf<T extends FieldType>(type: T, value: FieldValue): FieldAtomByType[T][] {
  const spec: FieldTypeSpec<T> = FIELD_TYPE_SPECS[type];
  return value.filter(spec.is);
}

export const FIELD_TYPES = Object.keys(FIELD_TYPE_SPECS) as FieldType[];

/** A field's icon: its own, or else its type's. */
export const fieldIcon = (field: Pick<FieldDef, "icon" | "type">) =>
  field.icon || FIELD_TYPE_SPECS[field.type].icon;

/**
 * Note colors (title bar, mentions, select pills): Notion's select-tag colors (light theme), as
 * literal strings so Tailwind picks them up. The palette is this record's keys.
 */
export const NOTE_COLOR_CLASSES = {
  gray: "bg-[#E3E2E0] text-[#32302C]",
  brown: "bg-[#EEE0DA] text-[#442A1E]",
  orange: "bg-[#FADEC9] text-[#49290E]",
  yellow: "bg-[#FDECC8] text-[#402C1B]",
  green: "bg-[#DBEDDB] text-[#1C3829]",
  blue: "bg-[#D3E5EF] text-[#183347]",
  purple: "bg-[#E8DEEE] text-[#412454]",
  pink: "bg-[#F5E0E9] text-[#4C2337]",
  red: "bg-[#FFE2DD] text-[#5D1715]",
} as const;
export type NoteColor = keyof typeof NOTE_COLOR_CLASSES;
export const NOTE_COLORS = Object.keys(NOTE_COLOR_CLASSES) as NoteColor[];

type FieldBase = {
  id: string;
  name: string;
  /** Holds a list of values instead of one (for selects: multi-select instead of single-select). */
  multiple: boolean;
  /** Can't be left empty; new notes start with `defaultValue`. */
  required: boolean;
  /** Unset means the type's icon (see `fieldIcon`). */
  icon?: IconRef;
};

/** Fields of one type: their default holds that type's values; selects also list their options. */
type FieldDefOf<T extends FieldType> = FieldBase & {
  type: T;
  /** Initial value for required fields (non-empty). Optional fields start empty. */
  defaultValue: FieldAtomByType[T][];
} & (T extends "select"
    ? {
        /**
         * The notes offered as options, in picker order. Any other note can still be picked by
         * searching; notes created from the picker are added here.
         */
        optionIds: NoteId[];
      }
    : unknown);

/** A workspace-level property definition, shared by every schema that includes it. */
export type FieldDef = { [T in FieldType]: FieldDefOf<T> }[FieldType];
export type SelectFieldDef = FieldDefOf<"select">;

/** The same field as another type (its default no longer applies, so it's cleared). */
export function withFieldType(field: FieldDef, type: FieldType): FieldDef {
  const { id, name, multiple, required, icon } = field;
  const base = { id, name, multiple, required, icon, defaultValue: [] };
  return type === "select"
    ? { ...base, type, optionIds: field.type === "select" ? field.optionIds : [] }
    : ({ ...base, type } as FieldDef);
}

/** Type icon colors, as literal class names so Tailwind picks them up; the palette is the keys. */
export const SCHEMA_COLOR_CLASSES = {
  gray: "text-gray-500",
  sky: "text-sky-600",
  red: "text-red-600",
  teal: "text-teal-600",
  violet: "text-violet-600",
  amber: "text-amber-600",
  green: "text-green-600",
  pink: "text-pink-600",
} as const;
export type SchemaColor = keyof typeof SCHEMA_COLOR_CLASSES;
export const SCHEMA_COLORS = Object.keys(SCHEMA_COLOR_CLASSES) as SchemaColor[];

/** A type of note: a named, ordered collection of fields. */
export type Schema = {
  id: string;
  name: string;
  icon: IconRef;
  color: SchemaColor;
  fieldIds: string[];
  /** Built-in schemas can't be deleted. */
  builtIn?: boolean;
};

export const USER_SCHEMA_ID = "schema-user";

export const BUILT_IN_SCHEMAS: Schema[] = [
  {
    id: USER_SCHEMA_ID,
    name: "User",
    icon: "user-round",
    color: "gray",
    fieldIds: [],
    builtIn: true,
  },
];

/** A workspace icon from an image URL, usable anywhere a Lucide icon is (e.g. a user's avatar). */
export type CustomIcon = {
  id: string;
  /** Slug shown in pickers and used to search, e.g. `ana-silva`. */
  name: string;
  url: string;
};

/**
 * Icons are referenced by string everywhere (types, fields, notes, Icon field values): a Lucide
 * name, or `custom:<id>` for a custom icon, so renaming a custom icon's slug breaks nothing.
 */
const CUSTOM_ICON_PREFIX = "custom:";
export const customIconRef = (id: string): IconRef => `${CUSTOM_ICON_PREFIX}${id}`;
export const customIconId = (ref: IconRef) =>
  ref.startsWith(CUSTOM_ICON_PREFIX) ? ref.slice(CUSTOM_ICON_PREFIX.length) : null;

/** Lowercase words separated by dashes, e.g. "Ana Silva" → `ana-silva`. */
export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Problems with a custom icon, as user-facing messages (empty = valid). */
export function validateCustomIcon(icon: CustomIcon, all: CustomIcon[]): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon.name)) {
    errors.push("The name must be a slug: lowercase letters, digits and dashes (e.g. ana-silva).");
  } else if (all.some((other) => other.id !== icon.id && other.name === icon.name)) {
    errors.push("Another icon already has this name.");
  }
  if (!/^https?:\/\//i.test(icon.url.trim()))
    errors.push("The URL must start with http:// or https://.");
  return errors;
}

/** The value a note gets for a field when the field is first applied to it. */
export const initialValue = (field: FieldDef): FieldValue =>
  field.required ? [...field.defaultValue] : [];

/** Brings an existing value in line with a field's (possibly changed) rules. */
export function conformValue(field: FieldDef, value: FieldValue | undefined): FieldValue {
  let next = value ?? [];
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
  return errors;
}

/** Parses user input into a value of the given type, or null if it isn't valid. */
export function parseAtom(type: FieldType, input: string): FieldAtom | null {
  const s = input.trim();
  return s ? FIELD_TYPE_SPECS[type].parse(s) : null;
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
