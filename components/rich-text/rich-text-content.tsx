import { Fragment, type ReactNode } from "react";
import type { RichTextDoc, RichTextNode } from "@/lib/rich-text";

function renderChildren(
  nodes: RichTextNode[] | undefined,
  keyPrefix: string,
): ReactNode {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return nodes.map((node, index) =>
    renderNode(node, `${keyPrefix}-${index}`)
  );
}

function renderText(node: RichTextNode, key: string): ReactNode {
  let content: ReactNode = node.text ?? "";

  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        content = <strong>{content}</strong>;
        break;
      case "italic":
        content = <em>{content}</em>;
        break;
      case "strike":
        content = <s>{content}</s>;
        break;
      case "code":
        content = (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {content}
          </code>
        );
        break;
    }
  }

  return <Fragment key={key}>{content}</Fragment>;
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} className="my-4 border-border" />;
    case "paragraph":
      return (
        <p key={key} className="my-1">
          {renderChildren(node.content, key)}
        </p>
      );
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      const Heading = level === 3 ? "h3" : "h2";

      return (
        <Heading
          key={key}
          className={
            level === 3
              ? "mt-3 text-base font-semibold"
              : "mt-3 text-lg font-semibold"
          }
        >
          {renderChildren(node.content, key)}
        </Heading>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="my-2 list-disc space-y-1 pl-5">
          {renderChildren(node.content, key)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="my-2 list-decimal space-y-1 pl-5">
          {renderChildren(node.content, key)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderChildren(node.content, key)}</li>;
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-2 border-l-2 border-border pl-3 text-muted-foreground"
        >
          {renderChildren(node.content, key)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="my-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"
        >
          <code>{renderChildren(node.content, key)}</code>
        </pre>
      );
    default:
      return <Fragment key={key}>{renderChildren(node.content, key)}</Fragment>;
  }
}

export function RichTextContent({
  document,
  className,
}: {
  document: RichTextDoc;
  className?: string;
}) {
  if (!document.content || document.content.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "text-sm leading-relaxed"}>
      {renderChildren(document.content, "rich-text")}
    </div>
  );
}
