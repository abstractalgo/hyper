import { StickyNoteIcon } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

import { useCanvasStore, useNoteData } from "../store/canvas";
import {
  customIconId,
  FIELD_TYPE_SPECS,
  fieldIcon,
  SCHEMA_COLOR_CLASSES,
  type FieldDef,
  type FieldType,
} from "./model";

export const ICON_NAMES: readonly IconName[] = iconNames;
const KNOWN_ICONS = new Set<string>(iconNames);

type IconProps = { className?: string };

/**
 * Renders an icon reference: a Lucide name (loaded on demand) or a workspace custom icon
 * (`custom:<id>`, shown as its image). Unknown or deleted icons show nothing.
 */
export function IconByName({
  name,
  className = "",
  label,
}: IconProps & { name: string; label?: string }) {
  const customId = customIconId(name);
  const custom = useCanvasStore((s) =>
    customId ? s.customIcons.find((i) => i.id === customId) : undefined,
  );
  if (customId) {
    if (!custom) return null;
    return (
      <img
        src={custom.url}
        alt={label ?? custom.name}
        title={custom.name}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
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

/**
 * A field's icon (its own, or its type's), in muted gray. Decorative: it always sits next to the
 * field's name, so it isn't announced separately.
 */
export function FieldIcon({
  field,
  className = "",
}: IconProps & { field: Pick<FieldDef, "icon" | "type"> }) {
  return <IconByName name={fieldIcon(field)} className={`shrink-0 text-gray-500 ${className}`} />;
}

/** A type's icon (Text, Number, …), in muted gray. */
export function FieldTypeIcon({ type, className = "" }: IconProps & { type: FieldType }) {
  return (
    <IconByName
      name={FIELD_TYPE_SPECS[type].icon}
      className={`shrink-0 text-gray-500 ${className}`}
    />
  );
}

/** A schema's icon in its color; plain notes (no schema) get a sticky-note icon. */
export function SchemaIcon({ schemaId, className = "" }: IconProps & { schemaId: string | null }) {
  const schema = useCanvasStore((s) => s.schemas.find((sc) => sc.id === schemaId));
  if (!schema) {
    return <StickyNoteIcon aria-label="Note" className={`shrink-0 text-gray-400 ${className}`} />;
  }
  return (
    <IconByName
      name={schema.icon}
      label={schema.name}
      className={`shrink-0 ${SCHEMA_COLOR_CLASSES[schema.color]} ${className}`}
    />
  );
}

/** How a note is represented next to its title: its own icon if set, else its type's icon. */
export function NoteIcon({
  noteId,
  className = "",
  showPlain = true,
}: IconProps & {
  noteId: string;
  /** Whether plain notes (no type, no icon of their own) get the sticky-note icon, or nothing. */
  showPlain?: boolean;
}) {
  const schemaId = useNoteData(noteId, "schemaId") ?? null;
  const icon = useNoteData(noteId, "icon");
  if (icon) return <IconByName name={icon} className={`shrink-0 ${className}`} />;
  if (schemaId === null && !showPlain) return null;
  return <SchemaIcon schemaId={schemaId} className={className} />;
}
