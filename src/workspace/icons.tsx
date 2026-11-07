import { StickyNoteIcon } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

import { useCanvasStore, useNoteField } from "../store/canvas";
import { customIconId, INPUT_SPECS, TYPE_COLOR_CLASSES, type IconRef } from "./model";
import { ICON_KEY, TYPE_KEY, valueKind, type Entry } from "./typeSystem";

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
    if (!custom) {
      return null;
    }
    return (
      <img
        src={custom.url}
        alt={label ?? custom.name}
        title={custom.name}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  if (!KNOWN_ICONS.has(name)) {
    return null;
  }
  return (
    <DynamicIcon
      name={name as IconName}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    />
  );
}

/** A field's icon: its declaration's own, or else one for what its values are. */
function fieldIconRef(entry: Entry): IconRef {
  if (entry.decl?.icon) {
    return entry.decl.icon;
  }
  const kind = valueKind(entry.type);
  if (kind.kind === "input") {
    return INPUT_SPECS[kind.input].icon;
  }
  return kind.kind === "type" ? "shapes" : "list";
}

/**
 * A field's icon, in muted gray. Decorative: it always sits next to the field's name, so it isn't
 * announced separately.
 */
export function FieldIcon({ entry, className = "" }: IconProps & { entry: Entry }) {
  return (
    <IconByName name={fieldIconRef(entry)} className={`shrink-0 text-gray-500 ${className}`} />
  );
}

/** A named type's icon in its color; no type (plain notes) gets a sticky-note icon. */
export function TypeIcon({ typeId, className = "" }: IconProps & { typeId: string | null }) {
  const type = useCanvasStore((s) => s.types.find((t) => t.id === typeId));
  if (!type) {
    return <StickyNoteIcon aria-label="Note" className={`shrink-0 text-gray-400 ${className}`} />;
  }
  return (
    <IconByName
      name={type.icon}
      label={type.name}
      className={`shrink-0 ${TYPE_COLOR_CLASSES[type.color]} ${className}`}
    />
  );
}

/** How a note is represented next to its title: its own icon if set, else its first type's. */
export function NoteIcon({
  noteId,
  className = "",
  showPlain = true,
}: IconProps & {
  noteId: string;
  /** Whether plain notes (no type, no icon of their own) get the sticky-note icon, or nothing. */
  showPlain?: boolean;
}) {
  const typeId = useNoteField(noteId, TYPE_KEY)?.[0];
  const icon = useNoteField(noteId, ICON_KEY)?.[0];
  if (icon !== undefined) {
    return <IconByName name={String(icon)} className={`shrink-0 ${className}`} />;
  }
  if (typeId === undefined && !showPlain) {
    return null;
  }
  return <TypeIcon typeId={typeId === undefined ? null : String(typeId)} className={className} />;
}
