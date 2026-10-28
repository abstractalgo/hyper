import { StickyNoteIcon } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

import { useCanvasStore } from "../store/canvas.ts";
import {
  AVATAR_FIELD_ID,
  FIELD_TYPE_ICONS,
  fieldIcon,
  SCHEMA_COLOR_CLASSES,
  USER_SCHEMA_ID,
  type FieldDef,
  type FieldType,
} from "./model.ts";

export const ICON_NAMES: readonly IconName[] = iconNames;
const KNOWN_ICONS = new Set<string>(iconNames);

type IconProps = { className?: string };

/** Renders a Lucide icon by its kebab-case name (loaded on demand); unknown names show nothing. */
export function LucideByName({
  name,
  className,
  label,
}: IconProps & { name: string; label?: string }) {
  if (!KNOWN_ICONS.has(name)) return null;
  return (
    <DynamicIcon
      name={name as IconName}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    />
  );
}

/** A field's icon (its own, or its type's), in muted gray. */
export function FieldIcon({
  field,
  className = "",
}: IconProps & { field: Pick<FieldDef, "icon" | "type" | "name"> }) {
  return (
    <LucideByName
      name={fieldIcon(field)}
      label={field.name}
      className={`shrink-0 text-gray-500 ${className}`}
    />
  );
}

/** A type's icon (Text, Number, …), in muted gray. */
export function FieldTypeIcon({ type, className = "" }: IconProps & { type: FieldType }) {
  return (
    <LucideByName name={FIELD_TYPE_ICONS[type]} className={`shrink-0 text-gray-500 ${className}`} />
  );
}

/** A schema's icon in its color; plain notes (no schema) get a sticky-note icon. */
export function SchemaIcon({ schemaId, className = "" }: IconProps & { schemaId: string | null }) {
  const schema = useCanvasStore((s) => s.schemas.find((sc) => sc.id === schemaId));
  if (!schema) {
    return <StickyNoteIcon aria-label="Note" className={`shrink-0 text-gray-400 ${className}`} />;
  }
  return (
    <LucideByName
      name={schema.icon}
      label={schema.name}
      className={`shrink-0 ${SCHEMA_COLOR_CLASSES[schema.color]} ${className}`}
    />
  );
}

/** How a note is represented next to its title: a user's avatar if set, else its schema icon. */
export function NoteIcon({
  noteId,
  className = "",
  showPlain = true,
}: IconProps & {
  noteId: string;
  /** Whether plain notes (no type) get the fallback sticky-note icon, or nothing. */
  showPlain?: boolean;
}) {
  const schemaId = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === noteId)?.data.schemaId ?? null,
  );
  const avatar = useCanvasStore((s) => {
    const note = s.nodes.find((n) => n.id === noteId);
    return note?.data.schemaId === USER_SCHEMA_ID
      ? note.data.fields[AVATAR_FIELD_ID]?.[0]
      : undefined;
  });
  if (typeof avatar === "string") {
    return (
      <img src={avatar} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  if (schemaId === null && !showPlain) return null;
  return <SchemaIcon schemaId={schemaId} className={className} />;
}
