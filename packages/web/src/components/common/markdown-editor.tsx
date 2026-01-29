import { useState, useRef, useEffect } from "react";
import { MarkdownRenderer } from "@/components/common/markdown-renderer";
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
        "cursor-pointer rounded-md px-3 py-2 hover:bg-muted/50 transition-colors",
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
        <MarkdownRenderer content={value} />
      ) : (
        <span>{placeholder}</span>
      )}
    </div>
  );
}
