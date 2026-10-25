"use client";

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  StrikethroughIcon,
  Undo2Icon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { RichTextDoc } from "@/lib/rich-text";

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Description",
  className,
}: {
  value: RichTextDoc;
  onChange: (value: RichTextDoc) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap",
        "aria-label": ariaLabel,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON() as RichTextDoc);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor
        ? {
            bold: currentEditor.isActive("bold"),
            italic: currentEditor.isActive("italic"),
            strike: currentEditor.isActive("strike"),
            code: currentEditor.isActive("code"),
            heading2: currentEditor.isActive("heading", { level: 2 }),
            bulletList: currentEditor.isActive("bulletList"),
            orderedList: currentEditor.isActive("orderedList"),
            canUndo: currentEditor.can().undo(),
            canRedo: currentEditor.can().redo(),
          }
        : null,
  });

  const isDisabled = !editor || disabled;

  function toolbarButton(
    label: string,
    icon: ReactNode,
    action: () => void,
    active = false,
    buttonDisabled = false,
  ) {
    return (
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon-sm"
        onPress={action}
        isDisabled={isDisabled || buttonDisabled}
        aria-label={label}
        aria-pressed={active}
      >
        {icon}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        {toolbarButton(
          "Bold",
          <BoldIcon />,
          () => editor?.chain().focus().toggleBold().run(),
          state?.bold,
        )}
        {toolbarButton(
          "Italic",
          <ItalicIcon />,
          () => editor?.chain().focus().toggleItalic().run(),
          state?.italic,
        )}
        {toolbarButton(
          "Strikethrough",
          <StrikethroughIcon />,
          () => editor?.chain().focus().toggleStrike().run(),
          state?.strike,
        )}
        {toolbarButton(
          "Inline code",
          <CodeIcon />,
          () => editor?.chain().focus().toggleCode().run(),
          state?.code,
        )}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        {toolbarButton(
          "Heading",
          <Heading2Icon />,
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          state?.heading2,
        )}
        {toolbarButton(
          "Bullet list",
          <ListIcon />,
          () => editor?.chain().focus().toggleBulletList().run(),
          state?.bulletList,
        )}
        {toolbarButton(
          "Numbered list",
          <ListOrderedIcon />,
          () => editor?.chain().focus().toggleOrderedList().run(),
          state?.orderedList,
        )}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        {toolbarButton(
          "Undo",
          <Undo2Icon />,
          () => editor?.chain().focus().undo().run(),
          false,
          !state?.canUndo,
        )}
        {toolbarButton(
          "Redo",
          <Redo2Icon />,
          () => editor?.chain().focus().redo().run(),
          false,
          !state?.canRedo,
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
