export const RICH_TEXT_MARKS = ["bold", "italic", "strike", "code"] as const;

export type RichTextMarkType = (typeof RICH_TEXT_MARKS)[number];

export type RichTextMark = {
  type: RichTextMarkType;
};

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: RichTextMark[];
};

export type RichTextDoc = {
  type: "doc";
  content?: RichTextNode[];
};

export const EMPTY_RICH_TEXT: RichTextDoc = {
  type: "doc",
  content: [],
};

export function emptyRichText(): RichTextDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "text",
]);

const ALLOWED_MARKS = new Set<string>(RICH_TEXT_MARKS);

const MAX_DEPTH = 20;
const MAX_TEXT_LENGTH = 100_000;
const MAX_JSON_LENGTH = 100_000;

export class RichTextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RichTextValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new RichTextValidationError(message);
}

function validateNode(
  value: unknown,
  depth: number,
  textLength: { value: number },
): RichTextNode {
  if (!isRecord(value)) {
    invalid("Description nodes must be objects.");
  }

  const type = value.type;

  if (typeof type !== "string" || !ALLOWED_NODES.has(type)) {
    invalid("The description contains an unsupported node.");
  }

  if (type === "text") {
    if (typeof value.text !== "string") {
      invalid("Text nodes must contain text.");
    }

    textLength.value += value.text.length;

    if (textLength.value > MAX_TEXT_LENGTH) {
      invalid("The description is too long.");
    }

    const marks = value.marks;

    if (marks !== undefined) {
      if (!Array.isArray(marks)) {
        invalid("Text marks must be an array.");
      }

      for (const mark of marks) {
        if (
          !isRecord(mark) ||
          typeof mark.type !== "string" ||
          !ALLOWED_MARKS.has(mark.type)
        ) {
          invalid("The description contains an unsupported text mark.");
        }
      }
    }

    return {
      type,
      text: value.text,
      ...(Array.isArray(marks) && marks.length > 0
        ? {
            marks: marks.map((mark) => ({
              type: (mark as RichTextMark).type,
            })),
          }
        : {}),
    };
  }

  if (type === "hardBreak" || type === "horizontalRule") {
    return { type };
  }

  if (depth >= MAX_DEPTH) {
    invalid("The description is nested too deeply.");
  }

  const content = value.content;

  if (content !== undefined && !Array.isArray(content)) {
    invalid("Node content must be an array.");
  }

  const node: RichTextNode = { type };

  if (type === "heading") {
    const level = isRecord(value.attrs) ? value.attrs.level : undefined;
    node.attrs = {
      level: level === 1 || level === 3 ? level : 2,
    };
  }

  if (Array.isArray(content) && content.length > 0) {
    node.content = content.map((child) =>
      validateNode(child, depth + 1, textLength),
    );
  }

  return node;
}

export function normalizeRichText(value: unknown): RichTextDoc {
  if (value === undefined || value === null) {
    return EMPTY_RICH_TEXT;
  }

  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid("The description could not be read.");
  }

  if (serialized.length > MAX_JSON_LENGTH) {
    invalid("The description is too large.");
  }

  if (!isRecord(value) || value.type !== "doc") {
    invalid("The description must be a document.");
  }

  const content = value.content;

  if (content !== undefined && !Array.isArray(content)) {
    invalid("The document content must be an array.");
  }

  const textLength = { value: 0 };
  const document: RichTextDoc = { type: "doc" };

  if (Array.isArray(content) && content.length > 0) {
    document.content = content.map((child) =>
      validateNode(child, 1, textLength),
    );
  }

  return document;
}

export function isRichTextDoc(value: unknown): value is RichTextDoc {
  try {
    normalizeRichText(value);
    return true;
  } catch {
    return false;
  }
}

export function richTextToPlainText(value: unknown): string {
  let document: RichTextDoc;

  try {
    document = normalizeRichText(value);
  } catch {
    return "";
  }

  const parts: string[] = [];

  function walk(node: RichTextNode) {
    if (node.type === "text") {
      parts.push(node.text ?? "");
      return;
    }

    for (const child of node.content ?? []) {
      walk(child);
    }

    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "listItem" ||
      node.type === "blockquote" ||
      node.type === "codeBlock" ||
      node.type === "bulletList" ||
      node.type === "orderedList"
    ) {
      parts.push("\n");
    }
  }

  walk({ type: "doc", content: document.content ?? [] });

  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
