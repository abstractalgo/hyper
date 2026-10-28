import { createHeadlessEditor } from "@lexical/headless";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ElementNode,
  type LexicalNode,
  type TextFormatType,
} from "lexical";

import { $createNoteMentionNode } from "../editor/mentions/NoteMentionNode.tsx";
import { EDITOR_NODES } from "../editor/nodes.ts";
import { createNote, newNoteId, type EditorNode, type NoteKind } from "../store/canvas.ts";

const NOTE_KEYS = [
  "epic",
  "sso",
  "receipts",
  "approvals",
  "notify",
  "reports",
  "audit",
  "ocrSpike",
  "heicBug",
] as const;
type NoteKey = (typeof NOTE_KEYS)[number];

/** Inline content: plain text, formatted text, a link, or a mention of another sample note. */
type Inline =
  | string
  | { text: string; format: TextFormatType[] }
  | { link: string; url: string }
  | { mention: NoteKey };

const b = (text: string): Inline => ({ text, format: ["bold"] });
const i = (text: string): Inline => ({ text, format: ["italic"] });
const code = (text: string): Inline => ({ text, format: ["code"] });
const at = (mention: NoteKey): Inline => ({ mention });
const link = (text: string, url: string): Inline => ({ link: text, url });

type Ids = Record<NoteKey, string>;

function $inline(parts: Inline[], ids: Ids): LexicalNode[] {
  return parts.map((part) => {
    if (typeof part === "string") return $createTextNode(part);
    if ("mention" in part) return $createNoteMentionNode(ids[part.mention]);
    if ("link" in part) return $createLinkNode(part.url).append($createTextNode(part.link));
    const node = $createTextNode(part.text);
    for (const f of part.format) node.toggleFormat(f);
    return node;
  });
}

type Block =
  | { p: Inline[] }
  | { h: HeadingTagType; text: string }
  | { quote: Inline[] }
  | { bullets: Inline[][] }
  | { numbered: Inline[][] }
  | { checks: [checked: boolean, Inline[]][] };

function $block(block: Block, ids: Ids): ElementNode {
  if ("p" in block) return $createParagraphNode().append(...$inline(block.p, ids));
  if ("h" in block) return $createHeadingNode(block.h).append($createTextNode(block.text));
  if ("quote" in block) return $createQuoteNode().append(...$inline(block.quote, ids));
  if ("checks" in block) {
    return $createListNode("check").append(
      ...block.checks.map(([checked, parts]) =>
        $createListItemNode(checked).append(...$inline(parts, ids)),
      ),
    );
  }
  const [type, items] =
    "bullets" in block
      ? (["bullet", block.bullets] as const)
      : (["number", block.numbered] as const);
  return $createListNode(type).append(
    ...items.map((parts) => $createListItemNode().append(...$inline(parts, ids))),
  );
}

type SampleNote = { title: string; kind: NoteKind; x: number; y: number; blocks: Block[] };

// A made-up project: "Ledgerly", an expense-tracking app. Each note is a feature task.
const SAMPLE: Record<NoteKey, SampleNote> = {
  epic: {
    title: "EXP-1 · Expense submission",
    kind: "epic",
    x: 0,
    y: 140,
    blocks: [
      { p: [b("Status:"), " In progress · ", b("Target:"), " Q1 beta"] },
      {
        p: [
          "Employees can photograph a receipt, submit it as an expense, and get reimbursed once their manager approves it.",
        ],
      },
      { h: "h3", text: "Scope" },
      {
        bullets: [
          [at("sso")],
          [at("receipts")],
          [at("approvals")],
          [at("notify")],
          [at("reports")],
        ],
      },
      { quote: ["Out of scope: multi-currency and corporate cards (next epic)."] },
    ],
  },
  sso: {
    title: "EXP-2 · SSO login",
    kind: "task",
    x: 560,
    y: -160,
    blocks: [
      { p: [b("Status:"), " Done · ", b("Owner:"), " Platform team"] },
      {
        p: [
          "Sign in with Google Workspace and Okta via ",
          link("OpenID Connect", "https://openid.net/connect/"),
          ". Map IdP groups to roles: ",
          code("employee"),
          ", ",
          code("manager"),
          ", ",
          code("finance"),
          ".",
        ],
      },
      {
        checks: [
          [true, ["OIDC login + session cookies"]],
          [true, ["Role mapping from IdP groups"]],
          [true, ["Just-in-time user provisioning"]],
        ],
      },
      { p: ["Unblocks ", at("receipts"), " and ", at("approvals"), "."] },
    ],
  },
  receipts: {
    title: "EXP-3 · Receipt upload & OCR",
    kind: "task",
    x: 560,
    y: 300,
    blocks: [
      { p: [b("Status:"), " In review · ", b("Blocked by:"), " ", at("sso")] },
      {
        p: [
          "Upload a photo or PDF; extract ",
          i("merchant"),
          ", ",
          i("date"),
          " and ",
          i("total"),
          " to prefill the expense form.",
        ],
      },
      { h: "h3", text: "Acceptance criteria" },
      {
        checks: [
          [true, ["Accept JPEG, PNG, HEIC, PDF up to 10 MB"]],
          [true, ["Store originals in object storage, keyed by expense ID"]],
          [false, ["OCR confidence < 80% ⇒ field left blank, not guessed"]],
          [false, ["Duplicate receipt warning (same merchant, date, total)"]],
        ],
      },
      { p: ["Receipt thumbnails are reused in ", at("reports"), "."] },
      { p: [b("Known issue:"), " ", at("heicBug")] },
    ],
  },
  approvals: {
    title: "EXP-4 · Manager approval flow",
    kind: "task",
    x: 1120,
    y: 40,
    blocks: [
      {
        p: [b("Status:"), " To do · ", b("Blocked by:"), " ", at("sso"), ", ", at("receipts")],
      },
      { p: ["State machine for an expense:"] },
      {
        numbered: [
          [code("draft"), " → ", code("submitted"), " by the employee"],
          [
            code("submitted"),
            " → ",
            code("approved"),
            " | ",
            code("rejected"),
            " by their manager",
          ],
          [code("approved"), " → ", code("reimbursed"), " by finance"],
        ],
      },
      {
        checks: [
          [false, ["Approve / reject with a required reason on reject"]],
          [false, ["Auto-escalate to skip-level after 5 business days"]],
          [false, ["Every transition is written to ", at("audit")]],
        ],
      },
      { p: ["Unblocks ", at("notify"), " and ", at("reports"), "."] },
    ],
  },
  notify: {
    title: "EXP-5 · Email & Slack notifications",
    kind: "task",
    x: 1680,
    y: -200,
    blocks: [
      { p: [b("Status:"), " To do · ", b("Blocked by:"), " ", at("approvals")] },
      {
        bullets: [
          ["Manager: “New expense to review” with approve/reject buttons"],
          ["Employee: approved, rejected (with reason), reimbursed"],
          ["Weekly digest for anything pending > 3 days"],
        ],
      },
      {
        checks: [
          [false, ["Per-user channel preferences (email, Slack, both)"]],
          [
            false,
            [link("Slack Block Kit", "https://api.slack.com/block-kit"), " message templates"],
          ],
        ],
      },
    ],
  },
  reports: {
    title: "EXP-6 · Spend reports",
    kind: "task",
    x: 1680,
    y: 300,
    blocks: [
      { p: [b("Status:"), " Backlog · ", b("Blocked by:"), " ", at("approvals")] },
      {
        p: [
          "Finance needs monthly spend by team and category, with links back to each receipt from ",
          at("receipts"),
          ".",
        ],
      },
      {
        checks: [
          [false, ["Filter by date range, team, category, status"]],
          [false, ["CSV export"]],
          [false, ["Only ", code("finance"), " role can see other teams (see ", at("sso"), ")"]],
        ],
      },
    ],
  },
  audit: {
    title: "EXP-7 · Audit log",
    kind: "task",
    x: 1120,
    y: 620,
    blocks: [
      { p: [b("Status:"), " To do · ", b("Needed by:"), " ", at("approvals")] },
      {
        p: [
          "Append-only record of who did what to which expense, for SOX compliance. Read access limited to ",
          code("finance"),
          ".",
        ],
      },
      {
        checks: [
          [false, ["Log actor, action, before/after, timestamp"]],
          [false, ["Retain for 7 years"]],
          [false, ["Surface the history on the expense detail page"]],
        ],
      },
    ],
  },
  ocrSpike: {
    title: "EXP-8 · Evaluate OCR vendors",
    kind: "spike",
    x: 0,
    y: 720,
    blocks: [
      { p: [b("Timebox:"), " 3 days · ", b("Feeds into:"), " ", at("receipts")] },
      {
        p: [
          "Which OCR service gives the best merchant/date/total accuracy on our receipt sample set, at what cost per page?",
        ],
      },
      {
        checks: [
          [true, ["Collect 200 real receipts (anonymized)"]],
          [false, ["Benchmark AWS Textract, Google Document AI, Mindee"]],
          [false, ["Write up recommendation + cost estimate"]],
        ],
      },
    ],
  },
  heicBug: {
    title: "EXP-9 · HEIC uploads fail on Safari",
    kind: "bug",
    x: 1680,
    y: 760,
    blocks: [
      { p: [b("Severity:"), " High · ", b("Found in:"), " ", at("receipts")] },
      { h: "h3", text: "Steps to reproduce" },
      {
        numbered: [
          ["Open the expense form in Safari 18 on iOS"],
          ["Attach a photo straight from the camera roll (HEIC)"],
          ["Upload spins forever; console shows ", code("413 Payload Too Large")],
        ],
      },
      {
        p: [
          i("Expected:"),
          " the image is converted to JPEG client-side and uploaded. Blocks the beta of ",
          at("epic"),
          ".",
        ],
      },
    ],
  },
};

/** Builds the sample board: real Lexical editor states, with mentions wired by note ID. */
export function createSampleNotes(): EditorNode[] {
  const ids = Object.fromEntries(NOTE_KEYS.map((k) => [k, newNoteId()])) as Ids;
  const editor = createHeadlessEditor({
    namespace: "sample",
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  return NOTE_KEYS.map((key) => {
    const note = SAMPLE[key];
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append(...note.blocks.map((block) => $block(block, ids)));
      },
      { discrete: true },
    );
    const content = JSON.stringify(editor.getEditorState().toJSON());
    return createNote({
      title: note.title,
      kind: note.kind,
      position: { x: note.x, y: note.y },
      content,
      id: ids[key],
    });
  });
}
