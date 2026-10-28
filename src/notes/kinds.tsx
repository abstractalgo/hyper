import {
  BugIcon,
  FlaskConicalIcon,
  SquareCheckBigIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import type { NoteKind } from "../store/canvas.ts";

type KindInfo = { label: string; Icon: LucideIcon; color: string };

export const NOTE_KINDS: Record<NoteKind, KindInfo> = {
  task: { label: "Task", Icon: SquareCheckBigIcon, color: "text-sky-600" },
  bug: { label: "Bug", Icon: BugIcon, color: "text-red-600" },
  spike: { label: "Spike", Icon: FlaskConicalIcon, color: "text-teal-600" },
  epic: { label: "Epic", Icon: ZapIcon, color: "text-violet-600" },
};

export const NOTE_KIND_ORDER: NoteKind[] = ["task", "bug", "spike", "epic"];

type NoteKindIconProps = { kind: NoteKind; className?: string };

export function NoteKindIcon({ kind, className = "" }: NoteKindIconProps) {
  const { label, Icon, color } = NOTE_KINDS[kind];
  return <Icon aria-label={label} className={`shrink-0 ${color} ${className}`} />;
}
