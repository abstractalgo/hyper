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
import {
  createNote,
  newId,
  newNoteId,
  OPTION_NOTE_WIDTH,
  type Board,
  type EditorNode,
} from "../store/canvas.ts";
import {
  BUILT_IN_SCHEMAS,
  initialValue,
  customIconRef,
  slugify,
  USER_SCHEMA_ID,
  type CustomIcon,
  type FieldAtom,
  type FieldDef,
  type FieldValue,
  type OptionColor,
  type Schema,
} from "../workspace/model.ts";

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
  "ana",
  "marcus",
  "priya",
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

const FIELD_KEYS = [
  "status",
  "assignee",
  "points",
  "due",
  "labels",
  "severity",
  "timebox",
  "target",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const SCHEMA_KEYS = ["task", "bug", "spike", "epic"] as const;
type SchemaKey = (typeof SCHEMA_KEYS)[number] | "user";

/** Field values by field; `{ ref }` points at another sample note. */
type SampleFields = Partial<Record<FieldKey, (FieldAtom | { ref: NoteKey })[]>>;
const ref = (note: NoteKey) => ({ ref: note });

type SampleNote = {
  /** Image URL for a user's avatar, added as a custom icon. */
  avatar?: string;
  title: string;
  schema: SchemaKey;
  color?: OptionColor;
  fields?: SampleFields;
  x: number;
  y: number;
  blocks: Block[];
};

// A made-up project: "Ledgerly", an expense-tracking app. Each note is a feature task.
/** Deterministic illustrated avatar for a name (external image service). */
const avatarUrl = (name: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}`;

const SAMPLE: Record<NoteKey, SampleNote> = {
  epic: {
    title: "Expense submission (EXP-1)",
    schema: "epic",
    color: "purple",
    fields: { status: ["In progress"], assignee: [ref("ana")], target: ["2027-03-31"] },
    x: 0,
    y: 140,
    blocks: [
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
    title: "SSO login (EXP-2)",
    schema: "task",
    fields: { status: ["Done"], assignee: [ref("marcus")], points: [3], labels: ["backend"] },
    x: 560,
    y: -160,
    blocks: [
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
    title: "Receipt upload & OCR (EXP-3)",
    schema: "task",
    fields: {
      status: ["In review"],
      assignee: [ref("priya")],
      points: [8],
      due: ["2026-11-14"],
      labels: ["frontend", "ocr"],
    },
    x: 560,
    y: 300,
    blocks: [
      { p: [b("Blocked by:"), " ", at("sso")] },
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
    title: "Manager approval flow (EXP-4)",
    schema: "task",
    fields: { status: ["To do"], assignee: [ref("ana")], points: [5], due: ["2026-11-28"] },
    x: 1120,
    y: 40,
    blocks: [
      {
        p: [b("Blocked by:"), " ", at("sso"), ", ", at("receipts")],
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
    title: "Email & Slack notifications (EXP-5)",
    schema: "task",
    fields: { status: ["To do"], points: [3], labels: ["backend"] },
    x: 1680,
    y: -200,
    blocks: [
      { p: [b("Blocked by:"), " ", at("approvals")] },
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
    title: "Spend reports (EXP-6)",
    schema: "task",
    fields: { status: ["Backlog"], points: [5] },
    x: 1680,
    y: 300,
    blocks: [
      { p: [b("Blocked by:"), " ", at("approvals")] },
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
    title: "Audit log (EXP-7)",
    schema: "task",
    fields: { status: ["To do"], assignee: [ref("marcus")], labels: ["compliance"] },
    x: 1120,
    y: 620,
    blocks: [
      { p: [b("Needed by:"), " ", at("approvals")] },
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
    title: "Evaluate OCR vendors (EXP-8)",
    schema: "spike",
    fields: { status: ["In progress"], assignee: [ref("priya")], timebox: [3] },
    x: 0,
    y: 720,
    blocks: [
      { p: [b("Feeds into:"), " ", at("receipts")] },
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
    title: "HEIC uploads fail on Safari (EXP-9)",
    schema: "bug",
    color: "red",
    fields: {
      status: ["To do"],
      severity: ["High"],
      assignee: [ref("priya")],
      labels: ["safari", "uploads"],
    },
    x: 1680,
    y: 760,
    blocks: [
      { p: [b("Found in:"), " ", at("receipts")] },
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
  ana: {
    title: "Ana Silva",
    schema: "user",
    avatar: avatarUrl("Ana Silva"),
    x: 0,
    y: 1220,
    blocks: [{ p: ["Engineering manager, Expenses team."] }],
  },
  marcus: {
    title: "Marcus Lee",
    schema: "user",
    avatar: avatarUrl("Marcus Lee"),
    x: 560,
    y: 1220,
    blocks: [{ p: ["Platform engineer. Owns auth and the audit pipeline."] }],
  },
  priya: {
    title: "Priya Nair",
    schema: "user",
    avatar: avatarUrl("Priya Nair"),
    x: 1120,
    y: 1220,
    blocks: [{ p: ["Frontend engineer. Receipts and uploads."] }],
  },
};

type FieldIds = Record<FieldKey, string>;

/** Select options with fresh IDs (per board, so defaults and values can point at them). */
/** Option notes per select field: plain notes with a color, in one column each, right of the board. */
const OPTION_SPECS: Record<"status" | "severity" | "labels", [name: string, color: OptionColor][]> =
  {
    status: [
      ["Backlog", "gray"],
      ["To do", "blue"],
      ["In progress", "yellow"],
      ["In review", "purple"],
      ["Done", "green"],
    ],
    severity: [
      ["Low", "gray"],
      ["Medium", "yellow"],
      ["High", "orange"],
      ["Critical", "red"],
    ],
    labels: [
      ["backend", "blue"],
      ["frontend", "pink"],
      ["ocr", "brown"],
      ["compliance", "purple"],
      ["safari", "orange"],
      ["uploads", "green"],
    ],
  };
const OPTION_COLUMNS_X = 2300;
const OPTION_STEP_Y = 100;

type OptionNotes = Record<keyof typeof OPTION_SPECS, Map<string, EditorNode>>;

function sampleOptionNotes(): OptionNotes {
  const columns = Object.entries(OPTION_SPECS).map(([key, specs], column) => [
    key,
    new Map(
      specs.map(([name, color], row) => [
        name,
        createNote({
          title: name,
          color,
          width: OPTION_NOTE_WIDTH,
          position: {
            x: OPTION_COLUMNS_X + column * (OPTION_NOTE_WIDTH + 80),
            y: -200 + row * OPTION_STEP_Y,
          },
        }),
      ]),
    ),
  ]);
  return Object.fromEntries(columns) as OptionNotes;
}

const idsOf = (notes: Map<string, EditorNode>) => [...notes.values()].map((n) => n.id);

function sampleFields(f: FieldIds, options: OptionNotes, userIds: string[]): FieldDef[] {
  const field = (
    key: FieldKey,
    def: Pick<FieldDef, "name" | "type"> & Partial<FieldDef>,
  ): FieldDef => ({
    id: f[key],
    multiple: false,
    required: false,
    defaultValue: [],
    optionIds: [],
    ...def,
  });
  return [
    field("status", {
      name: "Status",
      icon: "circle-dot",
      type: "select",
      optionIds: idsOf(options.status),
      required: true,
      defaultValue: [options.status.get("To do")!.id],
    }),
    field("assignee", { name: "Assignee", icon: "user-round", type: "select", optionIds: userIds }),
    field("points", { name: "Story points", icon: "gauge", type: "number" }),
    field("due", { name: "Due date", type: "date" }),
    field("labels", {
      name: "Labels",
      icon: "tags",
      type: "select",
      multiple: true,
      optionIds: idsOf(options.labels),
    }),
    field("severity", {
      name: "Severity",
      icon: "triangle-alert",
      type: "select",
      optionIds: idsOf(options.severity),
      required: true,
      defaultValue: [options.severity.get("Medium")!.id],
    }),
    field("timebox", {
      name: "Timebox (days)",
      icon: "timer",
      type: "number",
      required: true,
      defaultValue: [3],
    }),
    field("target", { name: "Target date", type: "date" }),
  ];
}

function sampleSchemas(f: FieldIds, s: Record<SchemaKey, string>): Schema[] {
  return [
    ...BUILT_IN_SCHEMAS,
    {
      id: s.task,
      name: "Task",
      icon: "square-check-big",
      color: "sky",
      fieldIds: [f.status, f.assignee, f.points, f.due, f.labels],
    },
    {
      id: s.bug,
      name: "Bug",
      icon: "bug",
      color: "red",
      fieldIds: [f.status, f.severity, f.assignee, f.labels],
    },
    {
      id: s.spike,
      name: "Spike",
      icon: "flask-conical",
      color: "teal",
      fieldIds: [f.status, f.assignee, f.timebox],
    },
    {
      id: s.epic,
      name: "Epic",
      icon: "zap",
      color: "violet",
      fieldIds: [f.status, f.assignee, f.target],
    },
  ];
}

/**
 * Builds the sample board: fields, schemas (Task, Bug, Spike, Epic plus the built-in User), and
 * notes with real Lexical editor states, mentions and references wired by ID.
 */
export function createSampleBoard(): Board {
  const ids = Object.fromEntries(NOTE_KEYS.map((k) => [k, newNoteId()])) as Ids;
  const fieldIds = Object.fromEntries(FIELD_KEYS.map((k) => [k, newId()])) as FieldIds;
  const schemaIds = {
    ...Object.fromEntries(SCHEMA_KEYS.map((k) => [k, newId()])),
    user: USER_SCHEMA_ID,
  } as Record<SchemaKey, string>;
  const options = sampleOptionNotes();
  const userIds = NOTE_KEYS.filter((k) => SAMPLE[k].schema === "user").map((k) => ids[k]);
  const fields = sampleFields(fieldIds, options, userIds);
  const schemas = sampleSchemas(fieldIds, schemaIds);
  // Option notes by title, per field, to resolve the option names used in the sample data.
  const optionsByField = new Map<string, Map<string, EditorNode>>([
    [fieldIds.status, options.status],
    [fieldIds.severity, options.severity],
    [fieldIds.labels, options.labels],
  ]);

  const editor = createHeadlessEditor({
    namespace: "sample",
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  // Users' avatars are workspace custom icons, set as their notes' icons.
  const customIcons: CustomIcon[] = [];

  const nodes = NOTE_KEYS.map((key) => {
    const note = SAMPLE[key];
    let icon: string | null = null;
    if (note.avatar) {
      const custom = { id: newId(), name: slugify(note.title), url: note.avatar };
      customIcons.push(custom);
      icon = customIconRef(custom.id);
    }
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append(...note.blocks.map((block) => $block(block, ids)));
      },
      { discrete: true },
    );
    const content = JSON.stringify(editor.getEditorState().toJSON());

    const schema = schemas.find((sc) => sc.id === schemaIds[note.schema])!;
    const values: Record<string, FieldValue> = {};
    for (const fieldId of schema.fieldIds) {
      const field = fields.find((fd) => fd.id === fieldId)!;
      const fieldKey = (Object.keys(fieldIds) as FieldKey[]).find((k) => fieldIds[k] === fieldId)!;
      const given = note.fields?.[fieldKey];
      values[fieldId] = given
        ? given.map((atom) =>
            typeof atom === "object"
              ? ids[atom.ref]
              : // Sample data names select options; notes store their IDs.
                (optionsByField.get(fieldId)?.get(String(atom))?.id ?? atom),
          )
        : initialValue(field);
    }

    return createNote({
      title: note.title,
      schemaId: schema.id,
      fields: values,
      color: note.color,
      icon,
      position: { x: note.x, y: note.y },
      content,
      id: ids[key],
    });
  });

  const optionNotes = Object.values(options).flatMap((notes) => [...notes.values()]);
  return { nodes: [...nodes, ...optionNotes], fields, schemas, customIcons };
}
