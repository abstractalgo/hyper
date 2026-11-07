import { Menu } from "@base-ui/react/menu";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Columns3Icon, Table2Icon } from "lucide-react";
import { $getNodeByKey, type NodeKey } from "lexical";

import { useGoToNote } from "../../components/useGoToNote";
import { useCanvasStore, useNoteData } from "../../store/canvas";
import { FieldIcon, NoteIcon } from "../../workspace/icons";
import type { FieldValue } from "../../workspace/model";
import type { KeyId } from "../../workspace/typeSystem";
import { FieldValueEditor } from "../../workspace/ui/FieldValueEditor";
import { $isTableViewNode, type TableConfig } from "./TableViewNode";
import {
  Checked,
  menuItemClass,
  useRowFields,
  useRowIds,
  ViewFrame,
  ViewMenu,
  ViewSubmenu,
  type RowField,
} from "./ViewFrame";

const NO_VALUES: Record<KeyId, FieldValue> = {};

/** A table of the notes of a type: a row per note, its title then its fields, editable in place. */
export function TableView({ nodeKey, config }: { nodeKey: NodeKey; config: TableConfig }) {
  const [editor] = useLexicalComposerContext();
  const rowIds = useRowIds(config.typeId);
  const available = useRowFields(rowIds);
  const columns = config.columns
    ? config.columns.flatMap((key) => available.filter((c) => c.key === key))
    : available;

  const update = (next: Partial<TableConfig>) =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTableViewNode(node)) {
        node.setConfig({ ...node.getConfig(), ...next });
      }
    });
  const toggleColumn = (key: KeyId) => {
    const shown = columns.map((c) => c.key);
    update({
      columns: shown.includes(key)
        ? shown.filter((k) => k !== key)
        : available.map((c) => c.key).filter((k) => k === key || shown.includes(k)),
    });
  };

  // "View": how the table shows its notes (for now, which fields are columns).
  const viewMenu = available.length > 0 && (
    <ViewMenu>
      <ViewSubmenu
        Icon={Columns3Icon}
        label="Columns"
        current={`${columns.length} of ${available.length}`}
      >
        {available.map((column) => (
          <Menu.Item
            key={column.key}
            onClick={() => toggleColumn(column.key)}
            closeOnClick={false}
            className={menuItemClass}
          >
            <Checked on={columns.includes(column)} />
            <FieldIcon entry={column} className="size-3.5" />
            {column.decl.label}
          </Menu.Item>
        ))}
      </ViewSubmenu>
    </ViewMenu>
  );

  return (
    <ViewFrame
      Icon={Table2Icon}
      label="Table"
      typeId={config.typeId}
      setTypeId={(typeId) => update({ typeId, columns: null })}
      count={rowIds.length}
      tools={viewMenu}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-2 py-1 font-medium">Title</th>
              {columns.map((column) => (
                <th key={column.key} className="px-2 py-1 font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <FieldIcon entry={column} className="size-3.5" />
                    {column.decl.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowIds.map((id) => (
              <TableRow key={id} noteId={id} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    </ViewFrame>
  );
}

/** One note: its title (going to the note on click), then its values, editable in place. */
function TableRow({ noteId, columns }: { noteId: string; columns: RowField[] }) {
  const title = useNoteData(noteId, "title");
  const values = useNoteData(noteId, "fields") ?? NO_VALUES;
  const setNoteField = useCanvasStore((s) => s.setNoteField);
  const goToNote = useGoToNote();
  return (
    <tr className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60">
      <td className="max-w-48 px-2 py-0.5">
        <button
          type="button"
          onClick={() => goToNote(noteId)}
          title="Go to note"
          className="flex max-w-full items-center gap-1.5 rounded py-0.5 text-left font-medium text-gray-800 hover:underline"
        >
          <NoteIcon noteId={noteId} className="size-3.5" />
          <span className="truncate">{title}</span>
        </button>
      </td>
      {columns.map((column) => (
        <td key={column.key} className="min-w-24 px-2 py-0.5 align-middle">
          <FieldValueEditor
            entry={column}
            value={values[column.key] ?? []}
            onChange={(value) => setNoteField(noteId, column.key, value)}
            noteId={noteId}
          />
        </td>
      ))}
    </tr>
  );
}
