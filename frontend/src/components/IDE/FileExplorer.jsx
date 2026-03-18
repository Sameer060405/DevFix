import { useState } from "react";

export default function FileExplorer({ tree, activeFile, onOpenFile }) {
  return (
    <div className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden select-none">
      {/* Panel header */}
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-800">
        Explorer
      </div>
      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node, i) => (
          <TreeNode
            key={i}
            node={node}
            depth={0}
            activeFile={activeFile}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth, activeFile, onOpenFile }) {
  const [open, setOpen] = useState(node.open ?? false);
  const indent = 12 + depth * 12;

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          style={{ paddingLeft: `${indent}px`, paddingRight: "8px" }}
        >
          <span className="text-gray-600 text-[10px]">{open ? "▾" : "▸"}</span>
          <FolderIcon open={open} />
          <span>{node.name}</span>
        </button>
        {open &&
          node.children?.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onOpenFile={onOpenFile}
            />
          ))}
      </div>
    );
  }

  const isActive = node.path === activeFile;

  return (
    <button
      onClick={() => onOpenFile(node)}
      className={`
        w-full flex items-center gap-1.5 py-0.5 text-xs transition-colors
        ${
          isActive
            ? "bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500"
            : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        }
      `}
      style={{ paddingLeft: `${indent}px`, paddingRight: "8px" }}
    >
      <FileTypeLabel name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function FolderIcon({ open }) {
  return open ? (
    <svg className="h-3.5 w-3.5 shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
      />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5 shrink-0 text-yellow-600" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 6a2 2 0 012-2H8l2 2h5.5a2 2 0 012 2v6a2 2 0 01-2 2H4.5a2 2 0 01-2-2V6z"
      />
    </svg>
  );
}

function FileTypeLabel({ name }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map = {
    js:   ["JS",   "text-yellow-400"],
    jsx:  ["JSX",  "text-cyan-400"],
    ts:   ["TS",   "text-blue-400"],
    tsx:  ["TSX",  "text-blue-300"],
    css:  ["CSS",  "text-blue-500"],
    json: ["{}",   "text-yellow-300"],
    md:   ["MD",   "text-gray-400"],
    html: ["HTML", "text-orange-400"],
    py:   ["PY",   "text-green-400"],
  };
  const [label, color] = map[ext] ?? ["•", "text-gray-600"];
  return (
    <span className={`text-[9px] font-bold shrink-0 w-5 text-center ${color}`}>
      {label}
    </span>
  );
}
