import React, { useCallback } from "react";

// File extension to icon mapping (simple unicode icons)
const fileIcons: Record<string, string> = {
  ts: "📄",
  tsx: "📄",
  js: "📄",
  jsx: "📄",
  json: "🗒️",
  md: "📝",
  test: "🧪",
  default: "📁",
};

function getFileIcon(file: string) {
  const ext = file.split(".").pop();
  if (!ext) return fileIcons.default;
  if (file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.endsWith(".test.js")) return fileIcons.test;
  return fileIcons[ext] || fileIcons.default;
}

function getIndentLevel(file: string) {
  // Indent based on path segments (excluding filename)
  return file.split("/").length - 1;
}

export interface FileListProps {
  files: string[];
  header?: string;
}

export const FileList: React.FC<FileListProps> = ({ files, header }) => {
  const handleCopy = useCallback((path: string) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(path);
    }
  }, []);

  if (!files || files.length === 0) return null;

  return (
    <div>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>
        {header || "Files Modified"} ({files.length})
      </div>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {files.map((file) => (
          <li
            key={file}
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              padding: "2px 0",
              marginLeft: getIndentLevel(file) * 16,
            }}
            title="Click to copy path"
            onClick={() => handleCopy(file)}
          >
            <span style={{ marginRight: 8 }}>{getFileIcon(file)}</span>
            <span>{file}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
