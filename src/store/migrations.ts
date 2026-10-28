import type { FieldDef, OptionColor, SelectOption } from "../workspace/model.ts";
import type { Board } from "./canvas.ts";

/**
 * Text fields from the original sample board that became select fields in v3, with the sample's
 * options and colors. Values found on notes that aren't listed here become extra (gray) options.
 */
const TEXT_TO_SELECT: Record<
  string,
  { type: "select" | "multiselect"; options: [string, OptionColor][] }
> = {
  Status: {
    type: "select",
    options: [
      ["Backlog", "gray"],
      ["To do", "blue"],
      ["In progress", "yellow"],
      ["In review", "purple"],
      ["Done", "green"],
    ],
  },
  Severity: {
    type: "select",
    options: [
      ["Low", "gray"],
      ["Medium", "yellow"],
      ["High", "orange"],
      ["Critical", "red"],
    ],
  },
  Labels: {
    type: "multiselect",
    options: [
      ["backend", "blue"],
      ["frontend", "pink"],
      ["ocr", "brown"],
      ["compliance", "purple"],
      ["safari", "orange"],
      ["uploads", "green"],
    ],
  },
};

/** v2 → v3: turn the sample's Status/Severity/Labels text fields into (multi-)selects. */
export function textFieldsToSelects(board: Board): Board {
  const converted = new Map<string, FieldDef>();
  const fields = board.fields.map((field) => {
    const spec = TEXT_TO_SELECT[field.name];
    if (field.type !== "text" || !spec) return field;

    const options: SelectOption[] = spec.options.map(([name, color]) => ({
      id: crypto.randomUUID(),
      name,
      color,
    }));
    const optionFor = (atom: string | number) => {
      const name = String(atom).trim();
      let option = options.find((o) => o.name.toLowerCase() === name.toLowerCase());
      if (!option) {
        option = { id: crypto.randomUUID(), name, color: "gray" };
        options.push(option);
      }
      return option.id;
    };

    const next: FieldDef = {
      ...field,
      type: spec.type,
      multiple: spec.type === "multiselect",
      options,
      defaultValue: [],
    };
    next.defaultValue = field.defaultValue.map(optionFor);
    // Every value in use gets an option before notes are mapped below.
    for (const node of board.nodes) node.data.fields[field.id]?.forEach(optionFor);
    converted.set(field.id, next);
    return next;
  });

  if (converted.size === 0) return board;

  const nodes = board.nodes.map((node) => {
    let changed = false;
    const values = { ...node.data.fields };
    for (const [fieldId, field] of converted) {
      const value = values[fieldId];
      if (!value) continue;
      changed = true;
      const ids = value.map((atom) => {
        const name = String(atom).trim().toLowerCase();
        return field.options.find((o) => o.name.toLowerCase() === name)?.id;
      });
      values[fieldId] = ids.filter((id): id is string => id !== undefined);
    }
    return changed ? { ...node, data: { ...node.data, fields: values } } : node;
  });

  return { ...board, fields, nodes };
}
