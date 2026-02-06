import { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import mammoth from "mammoth";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileUp,
  AlertTriangle,
  Undo,
  Redo,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
  testId,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

export function RichEditor({ content, onChange, editable = true }: RichEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" },
      }),
      Placeholder.configure({ placeholder: "Начните вводить текст…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      Underline,
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html");
        if (html && html.includes("urn:schemas-microsoft-com:office")) {
          event.preventDefault();
          const cleaned = cleanWordHtml(html);
          editor?.commands.insertContent(cleaned);
          return true;
        }
        return false;
      },
    },
  });

  const cleanWordHtml = useCallback((html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("style, script, meta, link, xml").forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (["span", "div", "font", "o:p"].includes(tag)) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }
      const keepAttrs = ["href", "src", "alt", "colspan", "rowspan"];
      for (const attr of Array.from(el.attributes)) {
        if (!keepAttrs.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  }, []);

  const handleDocxImport = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement((image: any) =>
            image.read("base64").then((data: string) => ({
              src: `data:${image.contentType};base64,${data}`,
            }))
          ),
        }
      );
      if (result.value) {
        editor?.commands.setContent(result.value);
        onChange(result.value);
        toast({ title: "Импорт завершён", description: `Импортирован файл ${file.name}` });
        if (result.messages.length > 0) {
          console.warn("Mammoth warnings:", result.messages);
        }
      }
    } catch (err) {
      toast({ title: "Ошибка импорта", description: "Не удалось обработать файл.", variant: "destructive" });
      console.error("DOCX import error:", err);
    }
  }, [editor, onChange, toast]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        editor?.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt("Введите URL:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertCallout = useCallback(() => {
    editor
      ?.chain()
      .focus()
      .insertContent(
        `<blockquote><p><strong>⚠ Важно:</strong> </p></blockquote>`
      )
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border bg-background" data-testid="rich-editor">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5" data-testid="editor-toolbar">
          <ToolbarButton testId="tb-undo" title="Отменить" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-redo" title="Повторить" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-bold" title="Жирный" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-italic" title="Курсив" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-underline" title="Подчёркнутый" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-strike" title="Зачёркнутый" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-highlight" title="Выделение" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-h1" title="Заголовок 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-h2" title="Заголовок 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-h3" title="Заголовок 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-ul" title="Маркированный список" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-ol" title="Нумерованный список" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-tasklist" title="Чек-лист" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <ListChecks className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-blockquote" title="Цитата" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-code" title="Код" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-hr" title="Горизонтальная линия" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-table" title="Вставить таблицу" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          {editor.isActive("table") && (
            <>
              <ToolbarButton testId="tb-add-col" title="Добавить столбец" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Plus className="h-3 w-3" />
              </ToolbarButton>
              <ToolbarButton testId="tb-del-col" title="Удалить столбец" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Trash2 className="h-3 w-3" />
              </ToolbarButton>
              <ToolbarButton testId="tb-add-row" title="Добавить строку" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <Plus className="h-3 w-3" />
              </ToolbarButton>
              <ToolbarButton testId="tb-del-row" title="Удалить строку" onClick={() => editor.chain().focus().deleteRow().run()}>
                <Trash2 className="h-3 w-3" />
              </ToolbarButton>
            </>
          )}

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-image" title="Вставить изображение" onClick={() => imageInputRef.current?.click()}>
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-link" title="Вставить ссылку" active={editor.isActive("link")} onClick={addLink}>
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-callout" title="Блок «Важно»" onClick={insertCallout}>
            <AlertTriangle className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <ToolbarButton testId="tb-align-left" title="По левому краю" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-align-center" title="По центру" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton testId="tb-align-right" title="По правому краю" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Button
            data-testid="tb-import-docx"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-3.5 w-3.5" />
            Импорт .docx
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleDocxImport(file);
          e.target.value = "";
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <EditorContent editor={editor} />
    </div>
  );
}
