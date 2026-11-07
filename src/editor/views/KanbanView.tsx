import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Menu } from "@base-ui/react/menu";
import { Columns3Icon, SquareKanbanIcon } from "lucide-react";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useState, type DragEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { useGoToNote } from "../../components/useGoToNote";
import { useCanvasStore, useNoteData } from "../../store/canvas";
import { FieldIcon, NoteIcon } from "../../workspace/icons";
import { members, valueKind } from "../../workspace/typeSystem";
import { NotePill } from "../../workspace/ui/SelectEditor";
import { $isKanbanViewNode, type KanbanConfig } from "./KanbanViewNode";
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

const NO_IDS: string[] = [];
/** What a dragged card carries: its note's ID. */
const CARD_TYPE = "application/x-hyper-note";
/** The column of notes without a value. */
const NONE = "";

/** Fields a kanban can group by: ones holding a single note (Status, Assignee…). */
const isGroupable = (field: RowField) => {
  const kind = valueKind(field.type);
  return kind.kind === "note" && !kind.many;
};

/**
 * A kanban of the notes of a type: a column per value of a field holding a single note (its
 * options, then any other note the cards have, and one for no value), each note a card in its
 * column. Dragging a card to another column sets the field.
 */
export function KanbanView({ nodeKey, config }: { nodeKey: NodeKey; config: KanbanConfig }) {
  const [editor] = useLexicalComposerContext();
  const rowIds = useRowIds(config.typeId);
  const groupable = useRowFields(rowIds).filter(isGroupable);
  const field = groupable.find((f) => f.key === config.groupBy) ?? groupable[0];

  // The columns: the field's options (or notes of its type), then other values the cards have.
  const laneIds = useCanvasStore(
    useShallow((s) => {
      if (!field) {
        return NO_IDS;
      }
      const kind = valueKind(field.type);
      const listed =
        kind.kind !== "note"
          ? []
          : kind.within
            ? members(kind.within, { nodes: s.notes, types: s.types }).map((n) => n.id)
            : kind.options;
      const present = s.notes
        .filter((n) => rowIds.includes(n.id))
        .flatMap((n) => (n.data.fields[field.key] ?? []).map(String));
      return [...new Set([...listed, ...present])].filter((id) => s.notes.some((n) => n.id === id));
    }),
  );
  // Which column each card is in, in the same order as `rowIds`.
  const cardLanes = useCanvasStore(
    useShallow((s) =>
      rowIds.map((id) => {
        const value = field
          ? s.notes.find((n) => n.id === id)?.data.fields[field.key]?.[0]
          : undefined;
        return value === undefined ? NONE : String(value);
      }),
    ),
  );
  const setNoteField = useCanvasStore((s) => s.setNoteField);

  const update = (next: Partial<KanbanConfig>) =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isKanbanViewNode(node)) {
        node.setConfig({ ...node.getConfig(), ...next });
      }
    });

  const cardsIn = (laneId: string) => rowIds.filter((_, i) => cardLanes[i] === laneId);
  // Notes without a value get a column if they may have none, or if some have none anyway.
  const lanes =
    field && (field.optional || cardsIn(NONE).length > 0) ? [NONE, ...laneIds] : laneIds;

  // "View": how the kanban shows its cards (for now, which field groups them).
  const viewMenu = groupable.length > 0 && (
    <ViewMenu>
      <ViewSubmenu Icon={Columns3Icon} label="Grouping" current={field?.decl.label}>
        {groupable.map((f) => (
          <Menu.Item
            key={f.key}
            onClick={() => update({ groupBy: f.key })}
            className={menuItemClass}
          >
            <Checked on={f.key === field?.key} />
            <FieldIcon entry={f} className="size-3.5" />
            {f.decl.label}
          </Menu.Item>
        ))}
      </ViewSubmenu>
    </ViewMenu>
  );

  return (
    <ViewFrame
      Icon={SquareKanbanIcon}
      label="Kanban"
      typeId={config.typeId}
      setTypeId={(typeId) => update({ typeId, groupBy: null })}
      count={rowIds.length}
      tools={viewMenu}
    >
      {field ? (
        <div className="flex items-start gap-2 overflow-x-auto p-2">
          {lanes.map((laneId) => (
            <Lane
              key={laneId}
              laneId={laneId}
              field={field}
              noteIds={cardsIn(laneId)}
              // A required field can't be emptied by dropping a card on "No value".
              onDrop={
                laneId === NONE && !field.optional
                  ? undefined
                  : (noteId) => setNoteField(noteId, field.key, laneId === NONE ? [] : [laneId])
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-2 py-1.5 text-xs text-gray-500">
          These notes have no field to group by: one holding a single note, like a Status.
        </p>
      )}
    </ViewFrame>
  );
}

/** A column: its value (or "No …") and count, then its cards; cards can be dropped on it. */
function Lane({
  laneId,
  field,
  noteIds,
  onDrop,
}: {
  laneId: string;
  field: RowField;
  noteIds: string[];
  /** Unset: cards can't be dropped here. */
  onDrop?: (noteId: string) => void;
}) {
  const [over, setOver] = useState(false);
  // The drop is the kanban's own: Lexical and the canvas don't see it.
  const accepts = (e: DragEvent) =>
    onDrop !== undefined && e.dataTransfer.types.includes(CARD_TYPE);
  return (
    // A drop target for dragged cards; the cards themselves are the interactive part.
    <div
      onDragOver={(e) => {
        if (accepts(e)) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOver(false);
        }
      }}
      onDrop={(e) => {
        setOver(false);
        if (accepts(e)) {
          e.preventDefault();
          e.stopPropagation();
          onDrop!(e.dataTransfer.getData(CARD_TYPE));
        }
      }}
      className={`flex w-44 shrink-0 flex-col gap-1 rounded-md p-1.5 transition-colors ${over ? "bg-blue-50 ring-1 ring-blue-300" : "bg-gray-50"}`}
    >
      <header className="flex items-center gap-1.5 px-0.5 text-xs">
        {laneId === NONE ? (
          <span className="text-gray-500">No {field.decl.label}</span>
        ) : (
          <NotePill noteId={laneId} />
        )}
        <span className="text-gray-400">{noteIds.length}</span>
      </header>
      {noteIds.map((id) => (
        <Card key={id} noteId={id} />
      ))}
    </div>
  );
}

/** A note as a card: its icon and title. Drag it to another column; click it to go to the note. */
function Card({ noteId }: { noteId: string }) {
  const title = useNoteData(noteId, "title");
  const goToNote = useGoToNote();
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(CARD_TYPE, noteId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => goToNote(noteId)}
      title="Drag to another column, or click to go to the note"
      className="flex cursor-grab items-start gap-1.5 rounded border border-gray-200 bg-white px-2 py-1.5 text-left text-xs text-gray-800 shadow-xs hover:border-gray-300 active:cursor-grabbing"
    >
      <NoteIcon noteId={noteId} className="mt-px size-3.5" />
      <span className="min-w-0 break-words">{title}</span>
    </button>
  );
}
