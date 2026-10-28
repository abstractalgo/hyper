import { useShallow } from "zustand/react/shallow";

import { useCanvasStore } from "../store/canvas.ts";
import type { FieldDef } from "../workspace/model.ts";
import { FieldValueEditor } from "../workspace/ui/FieldValueEditor.tsx";
import { PopupContainerContext, useViewportPortal } from "../workspace/ui/popups.tsx";

/** The note's schema fields as an editable label/value list, between title bar and text. */
export function NoteProperties({ noteId }: { noteId: string }) {
  const fields = useCanvasStore(
    useShallow((s) => {
      const note = s.nodes.find((n) => n.id === noteId);
      const schema = s.schemas.find((sc) => sc.id === note?.data.schemaId);
      return (schema?.fieldIds ?? [])
        .map((id) => s.fields.find((f) => f.id === id))
        .filter((f): f is FieldDef => f !== undefined);
    }),
  );
  const values = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.fields);
  const setNoteField = useCanvasStore((s) => s.setNoteField);
  const viewportPortal = useViewportPortal();

  if (fields.length === 0) return null;

  return (
    <PopupContainerContext.Provider value={viewportPortal}>
      {/* nodrag: using inputs shouldn't drag the note; local scroll: see useScrollWithoutPanning */}
      <dl
        data-local-scroll
        className="nodrag grid shrink-0 grid-cols-[minmax(4rem,auto)_1fr] items-center gap-x-2 gap-y-0.5 border-b border-gray-100 px-3 py-1.5"
      >
        {fields.map((field) => (
          <div key={field.id} className="contents">
            <dt className="truncate text-[11px] text-gray-500" title={field.name}>
              {field.name}
            </dt>
            <dd className="min-w-0">
              <FieldValueEditor
                field={field}
                value={values?.[field.id] ?? []}
                onChange={(value) => setNoteField(noteId, field.id, value)}
                noteId={noteId}
              />
            </dd>
          </div>
        ))}
      </dl>
    </PopupContainerContext.Provider>
  );
}
