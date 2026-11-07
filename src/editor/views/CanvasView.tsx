import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { $getNodeByKey, type NodeKey } from "lexical";
import { LayoutDashboardIcon } from "lucide-react";
import { useContext, useEffect } from "react";

import { AncestorsContext, useFlowClasses } from "../../components/canvasView";
import { NoteCanvas } from "../../components/NoteCanvas";
import { $isCanvasViewNode, type CanvasConfig } from "./CanvasViewNode";
import { useRowIds, ViewFrame } from "./ViewFrame";

/**
 * A canvas of the notes of a type, inside a note's text: the same notes as everywhere else (edit
 * one here and it changes on the main canvas too), placed where this canvas puts them.
 */
export function CanvasView({ nodeKey, config }: { nodeKey: NodeKey; config: CanvasConfig }) {
  const [editor] = useLexicalComposerContext();
  // A note never shows inside itself: not the note this canvas is in, nor any containing it.
  const ancestors = useContext(AncestorsContext);
  const noteIds = useRowIds(config.typeId).filter((id) => !ancestors.includes(id));
  // The class names of the canvas this note is on (this canvas has its own).
  const outer = useFlowClasses();

  const update = (edit: (config: CanvasConfig) => CanvasConfig) =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCanvasViewNode(node)) {
        node.setConfig(edit(node.getConfig()));
      }
    });

  return (
    <ViewFrame
      Icon={LayoutDashboardIcon}
      label="Canvas"
      typeId={config.typeId}
      setTypeId={(typeId) => update((c) => ({ ...c, typeId }))}
      count={noteIds.length}
    >
      {/* Dragging and wheeling in here pan and zoom this canvas, not the one the note is on. */}
      <div className={`${outer.noPan} ${outer.noWheel} h-96`}>
        <ReactFlowProvider>
          <NoteCanvas
            nested
            noteIds={noteIds}
            layout={config.layout}
            onPlace={(placements) =>
              update((c) => ({ ...c, layout: { ...c.layout, ...placements } }))
            }
          >
            <Background variant={BackgroundVariant.Dots} gap={16} />
            <FitToNotes noteIds={noteIds} />
          </NoteCanvas>
        </ReactFlowProvider>
      </div>
    </ViewFrame>
  );
}

/**
 * Zooms the canvas to show all its notes whenever which notes it shows changes, once they're
 * measured (a canvas starts empty, until its type is picked).
 */
function FitToNotes({ noteIds }: { noteIds: string[] }) {
  const { fitView } = useReactFlow();
  const measured = useNodesInitialized();
  const shown = noteIds.join(",");
  useEffect(() => {
    if (measured && shown) {
      void fitView({ maxZoom: 1, padding: 0.05 });
    }
  }, [shown, measured, fitView]);
  return null;
}
