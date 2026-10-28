import { at, avatarUrl, b, buildBoard, code, i, link, ref, type Sample } from "./build";

// A made-up project: "Ledgerly", an expense-tracking app. Each note is a feature task.

type NoteKey =
  | "epic"
  | "sso"
  | "receipts"
  | "approvals"
  | "notify"
  | "reports"
  | "audit"
  | "ocrSpike"
  | "heicBug"
  | "ana"
  | "marcus"
  | "priya";
type FieldKey =
  | "status"
  | "assignee"
  | "points"
  | "due"
  | "labels"
  | "severity"
  | "timebox"
  | "target";
type SchemaKey = "task" | "bug" | "spike" | "epic";

const notes: Sample<NoteKey, FieldKey, SchemaKey>["notes"] = {
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

const sample: Sample<NoteKey, FieldKey, SchemaKey> = {
  fields: {
    status: {
      name: "Status",
      icon: "circle-dot",
      type: "select",
      options: [
        ["Backlog", "gray"],
        ["To do", "blue"],
        ["In progress", "yellow"],
        ["In review", "purple"],
        ["Done", "green"],
      ],
      required: true,
      defaultValue: ["To do"],
    },
    assignee: {
      name: "Assignee",
      icon: "user-round",
      type: "select",
      options: ["ana", "marcus", "priya"],
    },
    points: { name: "Story points", icon: "gauge", type: "number" },
    due: { name: "Due date", type: "date" },
    labels: {
      name: "Labels",
      icon: "tags",
      type: "select",
      multiple: true,
      options: [
        ["backend", "blue"],
        ["frontend", "pink"],
        ["ocr", "brown"],
        ["compliance", "purple"],
        ["safari", "orange"],
        ["uploads", "green"],
      ],
    },
    severity: {
      name: "Severity",
      icon: "triangle-alert",
      type: "select",
      options: [
        ["Low", "gray"],
        ["Medium", "yellow"],
        ["High", "orange"],
        ["Critical", "red"],
      ],
      required: true,
      defaultValue: ["Medium"],
    },
    timebox: {
      name: "Timebox (days)",
      icon: "timer",
      type: "number",
      required: true,
      defaultValue: [3],
    },
    target: { name: "Target date", type: "date" },
  },
  schemas: {
    task: {
      name: "Task",
      icon: "square-check-big",
      color: "sky",
      fields: ["status", "assignee", "points", "due", "labels"],
    },
    bug: {
      name: "Bug",
      icon: "bug",
      color: "red",
      fields: ["status", "severity", "assignee", "labels"],
    },
    spike: {
      name: "Spike",
      icon: "flask-conical",
      color: "teal",
      fields: ["status", "assignee", "timebox"],
    },
    epic: {
      name: "Epic",
      icon: "zap",
      color: "violet",
      fields: ["status", "assignee", "target"],
    },
  },
  notes,
  optionsX: 2300,
};

/** The Ledgerly sample: Task, Bug, Spike and Epic notes for a made-up expense-tracking app. */
export const createLedgerlyBoard = () => buildBoard(sample);
