import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  className,
  minHeight = "120px",
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    // Cmd/Ctrl + Enter to save
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("space-y-2", className)}>
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className="min-h-[200px] font-mono text-sm"
          style={{ minHeight }}
        />
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Esc</kbd> to cancel,{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-xs">⌘</kbd>+
          <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Enter</kbd> to save, or click outside
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "markdown-content cursor-pointer rounded-md px-3 py-2 hover:bg-muted/50 transition-colors",
        !value && "text-muted-foreground italic",
        className
      )}
      style={{ minHeight }}
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Headings
            h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 first:mt-0">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
            // Paragraphs
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
            // Lists
            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            // Code blocks
            pre: ({ children }) => (
              <pre className="bg-muted/50 rounded-md p-3 overflow-x-auto text-sm mb-3 font-mono">
                {children}
              </pre>
            ),
            code: ({ children, className: codeClassName }) => {
              const isInline = !codeClassName;
              return isInline ? (
                <code className="bg-muted/50 rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>
              ) : (
                <code className={codeClassName}>{children}</code>
              );
            },
            // Blockquote
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-3">
                {children}
              </blockquote>
            ),
            // Tables
            table: ({ children }) => (
              <div className="overflow-x-auto mb-3">
                <table className="min-w-full border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-border px-3 py-2 bg-muted text-left font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-border px-3 py-2">{children}</td>
            ),
            // Horizontal rule
            hr: () => <hr className="my-4 border-border" />,
            // Checkboxes in task lists
            input: ({ type, checked, ...props }) => {
              if (type === "checkbox") {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mr-2 h-4 w-4 rounded border-gray-300"
                    {...props}
                  />
                );
              }
              return <input type={type} {...props} />;
            },
            // Links
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </a>
            ),
            // Strong/bold
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            // Emphasis/italic
            em: ({ children }) => <em className="italic">{children}</em>,
          }}
        >
          {value}
        </ReactMarkdown>
      ) : (
        <span>{placeholder}</span>
      )}
    </div>
  );
}
