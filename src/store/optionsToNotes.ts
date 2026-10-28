import type { FieldDef, OptionColor } from "../workspace/model.ts";
import type { Board, EditorNode } from "./canvas.ts";

/** What a saved field may still carry from before select options were notes. */
type SavedField = Omit<FieldDef, "type" | "optionIds"> & {
  type: string;
  optionIds?: string[];
  options?: { id: string; name: string; color: OptionColor }[];
  referenceSchemaId?: string | null;
};

const OPTION_WIDTH = 240;
const OPTION_STEP_Y = 100;
const COLUMN_GAP = 80;

/**
 * Converts a saved board to the current shape, where select options are notes:
 * - each select/multi-select option becomes a plain note with its name and color, laid out in one
 *   column per field to the right of the board, and values/defaults point at those notes;
 * - reference fields become select fields whose options are the notes of the type they referred to.
 * Fields already in the current shape are left as they are.
 */
export function optionsToNotes<T extends Board>(board: T): T {
  const right = Math.max(0, ...board.nodes.map((n) => n.position.x + (n.width ?? 360)));
  const top = Math.min(0, ...board.nodes.map((n) => n.position.y));
  const newNotes: EditorNode[] = [];
  const remap = new Map<string, Map<string, string>>(); // field ID → option ID → note ID
  let column = 0;

  const fields = (board.fields as SavedField[]).map(
    ({ options, referenceSchemaId, ...field }): FieldDef => {
      if (field.type === "reference") {
        const optionIds = board.nodes
          .filter((n) => referenceSchemaId && n.data.schemaId === referenceSchemaId)
          .toSorted((a, b) => a.data.title.localeCompare(b.data.title))
          .map((n) => n.id);
        return { ...field, type: "select", optionIds };
      }
      if ((field.type === "select" || field.type === "multiselect") && options) {
        const x = right + 200 + column++ * (OPTION_WIDTH + COLUMN_GAP);
        const ids = new Map<string, string>();
        options.forEach((option, i) => {
          const id = crypto.randomUUID();
          ids.set(option.id, id);
          newNotes.push({
            id,
            type: "editor",
            position: { x, y: top + i * OPTION_STEP_Y },
            width: OPTION_WIDTH,
            data: {
              title: option.name,
              schemaId: null,
              fields: {},
              color: option.color,
              content: null,
            },
          });
        });
        remap.set(field.id, ids);
        return {
          ...field,
          type: "select",
          multiple: field.multiple || field.type === "multiselect",
          optionIds: [...ids.values()],
          defaultValue: field.defaultValue.flatMap((v) => ids.get(String(v)) ?? []),
        };
      }
      return { ...field, type: field.type as FieldDef["type"], optionIds: field.optionIds ?? [] };
    },
  );

  const nodes = board.nodes.map((node) => {
    const touched = Object.keys(node.data.fields).filter((id) => remap.has(id));
    if (touched.length === 0) return node;
    const values = { ...node.data.fields };
    for (const id of touched) {
      const ids = remap.get(id)!;
      values[id] = values[id]!.flatMap((v) => ids.get(String(v)) ?? []);
    }
    return { ...node, data: { ...node.data, fields: values } };
  });

  return { ...board, fields, nodes: [...nodes, ...newNotes] };
}
