import { at, avatarUrl, b, buildBoard, i, link, ref, type Sample } from "./build";

// A made-up PhD project on summarizing long documents: the question, hypotheses that answer it,
// experiments that test them, the papers they build on, and the thesis chapter that writes it up.

type NoteKey =
  | "question"
  | "h1"
  | "h2"
  | "exp1"
  | "exp2"
  | "transformer"
  | "longformer"
  | "bigbird"
  | "summac"
  | "methods"
  | "elena"
  | "tomas"
  | "mei";
type FieldKey = "reading" | "year" | "venue" | "status" | "evidence" | "owner" | "deadline";
type SchemaKey = "question" | "hypothesis" | "experiment" | "paper" | "draft";

const sample: Sample<NoteKey, FieldKey, SchemaKey> = {
  fields: {
    reading: {
      name: "Reading",
      icon: "book-marked",
      type: "select",
      options: [
        ["To read", "gray"],
        ["Reading", "yellow"],
        ["Read", "green"],
      ],
      required: true,
      defaultValue: ["To read"],
    },
    year: { name: "Year", icon: "calendar", type: "number" },
    venue: { name: "Venue", icon: "landmark", type: "text" },
    status: {
      name: "Status",
      icon: "circle-dot",
      type: "select",
      options: [
        ["Planned", "gray"],
        ["Running", "blue"],
        ["Blocked", "red"],
        ["Done", "green"],
      ],
      required: true,
      defaultValue: ["Planned"],
    },
    evidence: {
      name: "Evidence",
      icon: "scale",
      type: "select",
      options: [
        ["Open", "gray"],
        ["Supported", "green"],
        ["Mixed", "orange"],
        ["Refuted", "red"],
      ],
      required: true,
      defaultValue: ["Open"],
    },
    owner: {
      name: "Owner",
      icon: "user-round",
      type: "select",
      options: ["elena", "tomas", "mei"],
    },
    deadline: { name: "Deadline", icon: "calendar-clock", type: "date" },
  },
  schemas: {
    question: { name: "Question", icon: "circle-help", color: "amber", fields: [] },
    hypothesis: { name: "Hypothesis", icon: "lightbulb", color: "violet", fields: ["evidence"] },
    experiment: {
      name: "Experiment",
      icon: "flask-conical",
      color: "teal",
      fields: ["status", "owner"],
    },
    paper: { name: "Paper", icon: "book-open", color: "sky", fields: ["reading", "year", "venue"] },
    draft: {
      name: "Draft",
      icon: "pen-line",
      color: "pink",
      fields: ["status", "owner", "deadline"],
    },
  },
  notes: {
    question: {
      title: "RQ: Can sparse attention summarize long documents faithfully?",
      schema: "question",
      color: "yellow",
      x: 0,
      y: -100,
      blocks: [
        {
          p: [
            "Dense attention is quadratic in input length, so most summarizers truncate papers to their first few thousand tokens. Do sparse-attention models that read the ",
            i("whole"),
            " paper write better summaries, and do they stay faithful to it?",
          ],
        },
        { h: "h3", text: "Answered by" },
        { bullets: [[at("h1")], [at("h2")]] },
        { p: ["Written up in ", at("methods"), "."] },
      ],
    },
    h1: {
      title: "H1: Sparse attention matches dense attention on ROUGE",
      schema: "hypothesis",
      fields: { evidence: ["Supported"] },
      x: 560,
      y: -260,
      blocks: [
        {
          p: [
            "Local windows plus a few global tokens (",
            at("longformer"),
            ", ",
            at("bigbird"),
            ") should score within 1 ROUGE-L point of a dense model, at a fraction of the memory.",
          ],
        },
        { p: ["Tested by ", at("exp1"), "."] },
      ],
    },
    h2: {
      title: "H2: Faithfulness drops past 16k input tokens",
      schema: "hypothesis",
      fields: { evidence: ["Open"] },
      x: 560,
      y: 260,
      blocks: [
        {
          p: [
            "ROUGE rewards overlap, not truth. With very long inputs, models may blend claims from distant sections. Measure consistency with ",
            at("summac"),
            " as input length grows.",
          ],
        },
        { p: ["Tested by ", at("exp2"), "."] },
      ],
    },
    exp1: {
      title: "Exp 1: ROUGE on arXiv papers",
      schema: "experiment",
      fields: { status: ["Done"], owner: [ref("tomas")] },
      x: 1120,
      y: -300,
      blocks: [
        {
          p: [
            "Fine-tune ",
            at("longformer"),
            " and ",
            at("bigbird"),
            " on the arXiv summarization dataset; compare with a dense baseline truncated to 4k tokens.",
          ],
        },
        {
          checks: [
            [true, ["Preprocess arXiv split (215k papers)"]],
            [true, ["Train both models, 3 seeds each"]],
            [true, ["Report ROUGE-1/2/L with bootstrap CIs"]],
          ],
        },
        { quote: [b("Result:"), " Longformer is 0.6 ROUGE-L below dense at 8× the context."] },
      ],
    },
    exp2: {
      title: "Exp 2: Faithfulness vs. input length",
      schema: "experiment",
      fields: { status: ["Running"], owner: [ref("mei")] },
      x: 1120,
      y: 280,
      blocks: [
        {
          p: [
            "Bucket test papers by length (4k, 8k, 16k, 32k tokens) and score each summary with ",
            at("summac"),
            ".",
          ],
        },
        {
          checks: [
            [true, ["Length buckets, 200 papers each"]],
            [false, ["SummaC scores per bucket"]],
            [false, ["Human check of 50 summaries"]],
          ],
        },
      ],
    },
    transformer: {
      title: "Attention Is All You Need",
      schema: "paper",
      fields: { reading: ["Read"], year: [2017], venue: ["NeurIPS"] },
      x: 1680,
      y: -460,
      blocks: [
        {
          p: [
            "Vaswani et al. The Transformer: self-attention over every pair of tokens, which is what makes long inputs expensive. ",
            link("arXiv:1706.03762", "https://arxiv.org/abs/1706.03762"),
          ],
        },
      ],
    },
    longformer: {
      title: "Longformer: The Long-Document Transformer",
      schema: "paper",
      fields: { reading: ["Read"], year: [2020], venue: ["arXiv"] },
      x: 1680,
      y: -140,
      blocks: [
        {
          p: [
            "Beltagy, Peters & Cohan. Sliding-window attention plus task-specific global tokens; linear in sequence length. Builds on ",
            at("transformer"),
            ". ",
            link("arXiv:2004.05150", "https://arxiv.org/abs/2004.05150"),
          ],
        },
      ],
    },
    bigbird: {
      title: "Big Bird: Transformers for Longer Sequences",
      schema: "paper",
      fields: { reading: ["Reading"], year: [2020], venue: ["NeurIPS"] },
      x: 1680,
      y: 180,
      blocks: [
        {
          p: [
            "Zaheer et al. Window, global and random attention; proves it is still a universal approximator. Compare with ",
            at("longformer"),
            ". ",
            link("arXiv:2007.14062", "https://arxiv.org/abs/2007.14062"),
          ],
        },
      ],
    },
    summac: {
      title: "SummaC: NLI-based inconsistency detection",
      schema: "paper",
      fields: { reading: ["To read"], year: [2022], venue: ["TACL"] },
      x: 1680,
      y: 500,
      blocks: [
        {
          p: [
            "Laban et al. Splits document and summary into sentences and scores consistency with an NLI model. Our faithfulness metric. ",
            link("arXiv:2111.09525", "https://arxiv.org/abs/2111.09525"),
          ],
        },
      ],
    },
    methods: {
      title: "Thesis chapter 3: Methods",
      schema: "draft",
      fields: { status: ["Running"], owner: [ref("tomas")], deadline: ["2026-12-15"] },
      x: 0,
      y: 480,
      blocks: [
        { p: ["Draft for ", at("elena"), " to review before the committee meeting."] },
        {
          numbered: [
            ["Problem setup (", at("question"), ")"],
            ["Models: ", at("longformer"), ", ", at("bigbird"), ", dense baseline"],
            ["Evaluation: ROUGE (", at("exp1"), ") and faithfulness (", at("exp2"), ")"],
          ],
        },
      ],
    },
    elena: {
      title: "Dr. Elena Park",
      schema: "user",
      avatar: avatarUrl("Elena Park"),
      x: 0,
      y: 1040,
      blocks: [{ p: ["Advisor. Meets Tuesdays."] }],
    },
    tomas: {
      title: "Tomás Ruiz",
      schema: "user",
      avatar: avatarUrl("Tomás Ruiz"),
      x: 560,
      y: 1040,
      blocks: [{ p: ["PhD student, third year. Thesis author."] }],
    },
    mei: {
      title: "Mei Chen",
      schema: "user",
      avatar: avatarUrl("Mei Chen"),
      x: 1120,
      y: 1040,
      blocks: [{ p: ["Collaborator from the NLP lab. Runs the faithfulness evaluation."] }],
    },
  },
  optionsX: 2300,
};

/** The research sample: a thesis question, hypotheses, experiments, papers and a draft chapter. */
export const createResearchBoard = () => buildBoard(sample);
