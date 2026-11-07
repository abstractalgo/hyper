/** A note's ID. */
export type NoteId = string;

/**
 * An icon reference: a Lucide name (e.g. `square-check-big`) or a workspace custom icon
 * (`custom:<id>`).
 */
export type IconRef = string;

/** One value of a field: text, a number, or an ID (of a note, a type or an icon). */
export type FieldAtom = string | number;
/** A field's value on a note: a list of atoms (empty = no value; one, unless it's a list type). */
export type FieldValue = FieldAtom[];

/** Value types typed or picked in an editor of their own (notes and types are picked as pills). */
export type InputType = "text" | "number" | "icon" | "image" | "date" | "datetime";

type InputSpec = {
  label: string;
  /** Lucide icon of the type; also the icon of fields that don't set their own. */
  icon: IconRef;
  /** The native input used to type a value, or null when values are picked (icons). */
  input: "text" | "url" | "date" | "datetime-local" | null;
  /** Characters typing can't enter, dropped as they're typed (or pasted). */
  disallowed?: RegExp;
  /** Parses typed input into a value, or null if it isn't valid. */
  parse: (input: string) => FieldAtom | null;
};

const matching =
  (pattern: RegExp) =>
  (s: string): string | null =>
    pattern.test(s) ? s : null;

/** Everything that differs per input type, in one place (and in this order in menus). */
export const INPUT_SPECS: Record<InputType, InputSpec> = {
  text: { label: "Text", icon: "type", input: "text", parse: (s) => s },
  number: {
    label: "Number",
    icon: "hash",
    // Plain text rather than a number input: no spinner, and it sizes to its content like the rest.
    input: "text",
    disallowed: /[^\d.-]/g,
    parse: (s) => (Number.isFinite(Number(s)) ? Number(s) : null),
  },
  date: { label: "Date", icon: "calendar", input: "date", parse: matching(/^\d{4}-\d{2}-\d{2}$/) },
  datetime: {
    label: "Date & time",
    icon: "calendar-clock",
    input: "datetime-local",
    parse: matching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  },
  image: { label: "Image (URL)", icon: "image", input: "url", parse: matching(/^https?:\/\//i) },
  icon: { label: "Icon", icon: "smile", input: null, parse: (s) => s },
};

export const INPUT_TYPES = Object.keys(INPUT_SPECS) as InputType[];

/** Parses user input into a value of the given type, or null if it isn't valid. */
export function parseAtom(type: InputType, input: string): FieldAtom | null {
  const s = input.trim();
  return s ? INPUT_SPECS[type].parse(s) : null;
}

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

/** Type icon colors, as literal class names so Tailwind picks them up; the palette is the keys. */
export const TYPE_COLOR_CLASSES = {
  gray: "text-gray-500",
  sky: "text-sky-600",
  red: "text-red-600",
  teal: "text-teal-600",
  violet: "text-violet-600",
  amber: "text-amber-600",
  green: "text-green-600",
  pink: "text-pink-600",
} as const;
export type TypeColor = keyof typeof TYPE_COLOR_CLASSES;
export const TYPE_COLORS = Object.keys(TYPE_COLOR_CLASSES) as TypeColor[];

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
  if (!/^https?:\/\//i.test(icon.url.trim())) {
    errors.push("The URL must start with http:// or https://.");
  }
  return errors;
}

// Dates read "MMM dd, YYYY" (e.g. "Mar 05, 2027") whatever the browser's locale.
const DATE_PARTS = { month: "short", day: "2-digit", year: "numeric" } as const;
const dateFormat = new Intl.DateTimeFormat("en-US", DATE_PARTS);
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  ...DATE_PARTS,
  hour: "numeric",
  minute: "2-digit",
});

/** Human-readable form of a date/datetime atom (stored as local `YYYY-MM-DD[THH:mm]`). */
export function formatDateAtom(type: "date" | "datetime", atom: FieldAtom): string {
  const s = String(atom);
  // Parse date-only values as local midnight, not UTC (which can shift the day).
  const date = new Date(type === "date" ? `${s}T00:00` : s);
  if (Number.isNaN(date.getTime())) {
    return s;
  }
  return (type === "date" ? dateFormat : dateTimeFormat).format(date);
}
