import { customIconRef, slugify, type CustomIcon, type FieldDef } from "../workspace/model";
import type { Board } from "./canvas";

/** The built-in Avatar field that custom icons replace. */
const AVATAR_FIELD_ID = "field-avatar";

/**
 * Converts a saved board to the current shape, where avatars are custom icons: each note's
 * Avatar URL becomes a workspace custom icon (named after the note, e.g. `ana-silva`) set as the
 * note's own icon, and the Avatar field is removed from fields, types and notes.
 * Boards already in the current shape are left as they are.
 */
export function avatarsToIcons<T extends Board>(board: T): T {
  const customIcons: CustomIcon[] = [...(board.customIcons ?? [])];
  const uniqueSlug = (base: string) => {
    const slug = base || "icon";
    let name = slug;
    for (let i = 2; customIcons.some((icon) => icon.name === name); i++) name = `${slug}-${i}`;
    return name;
  };

  const nodes = board.nodes.map((node) => {
    const { [AVATAR_FIELD_ID]: avatar, ...fields } = node.data.fields;
    if (!avatar) return node;
    const url = typeof avatar[0] === "string" ? avatar[0] : undefined;
    let icon = node.data.icon;
    if (url && !icon) {
      const custom = { id: crypto.randomUUID(), name: uniqueSlug(slugify(node.data.title)), url };
      customIcons.push(custom);
      icon = customIconRef(custom.id);
    }
    return { ...node, data: { ...node.data, fields, icon } };
  });

  return {
    ...board,
    nodes,
    customIcons,
    fields: board.fields.filter((f: FieldDef) => f.id !== AVATAR_FIELD_ID),
    schemas: board.schemas.map((s) =>
      s.fieldIds.includes(AVATAR_FIELD_ID)
        ? { ...s, fieldIds: s.fieldIds.filter((id) => id !== AVATAR_FIELD_ID) }
        : s,
    ),
  };
}
