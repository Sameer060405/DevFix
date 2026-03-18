import { useState, useEffect, useRef } from "react";

/* ─── Menu definitions ───────────────────────────────────────── */

export const MENUS = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "file.new",        label: "New File",       shortcut: "Ctrl+N" },
      { id: "file.newFolder",  label: "New Folder",     shortcut: "" },
      { type: "separator" },
      { id: "file.open",       label: "Open File…",     shortcut: "Ctrl+O" },
      { id: "file.openFolder", label: "Open Folder…",   shortcut: "Ctrl+⇧O" },
      { type: "separator" },
      { id: "file.save",       label: "Save",           shortcut: "Ctrl+S" },
      { id: "file.saveAll",    label: "Save All",       shortcut: "Ctrl+⇧S" },
      { type: "separator" },
      { id: "file.close",      label: "Close File",     shortcut: "Ctrl+W" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "edit.undo",      label: "Undo",        shortcut: "Ctrl+Z" },
      { id: "edit.redo",      label: "Redo",        shortcut: "Ctrl+Y" },
      { type: "separator" },
      { id: "edit.cut",       label: "Cut",         shortcut: "Ctrl+X" },
      { id: "edit.copy",      label: "Copy",        shortcut: "Ctrl+C" },
      { id: "edit.paste",     label: "Paste",       shortcut: "Ctrl+V" },
      { type: "separator" },
      { id: "edit.selectAll", label: "Select All",  shortcut: "Ctrl+A" },
      { id: "edit.find",      label: "Find",        shortcut: "Ctrl+F" },
      { id: "edit.replace",   label: "Replace",     shortcut: "Ctrl+H" },
    ],
  },
  {
    id: "selection",
    label: "Selection",
    items: [
      { id: "sel.selectAll",        label: "Select All",              shortcut: "Ctrl+A" },
      { id: "sel.selectLine",       label: "Select Current Line",     shortcut: "Ctrl+L" },
      { id: "sel.addCursorAbove",   label: "Add Cursor Above",        shortcut: "Ctrl+Alt+↑" },
      { id: "sel.addCursorBelow",   label: "Add Cursor Below",        shortcut: "Ctrl+Alt+↓" },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "view.explorer", label: "Explorer",      shortcut: "Ctrl+B",  toggle: true, key: "sidebarOpen" },
      { id: "view.output",   label: "Output Panel",  shortcut: "Ctrl+J",  toggle: true, key: "bottomOpen" },
      { id: "view.ai",       label: "AI Assistant",  shortcut: "",        toggle: true, key: "showAiPanel" },
      { type: "separator" },
      { id: "view.wordWrap", label: "Word Wrap",     shortcut: "Alt+Z",   toggle: true, key: "wordWrap" },
      { id: "view.minimap",  label: "Minimap",       shortcut: "",        toggle: true, key: "minimap" },
    ],
  },
  {
    id: "go",
    label: "Go",
    items: [
      { id: "go.file",           label: "Go to File…",         shortcut: "Ctrl+P" },
      { id: "go.line",           label: "Go to Line/Column…",  shortcut: "Ctrl+G" },
      { type: "separator" },
      { id: "go.nextProblem",    label: "Next Problem",        shortcut: "F8" },
      { id: "go.prevProblem",    label: "Previous Problem",    shortcut: "⇧F8" },
    ],
  },
  {
    id: "run",
    label: "Run",
    items: [
      { id: "run.analyze",    label: "Analyze Current File",  shortcut: "Ctrl+⇧A" },
      { id: "run.showOutput", label: "Show Output Panel",     shortcut: "" },
      { type: "separator" },
      { id: "run.clear",      label: "Clear Analysis",        shortcut: "" },
    ],
  },
];

/* ─── MenuBar component ──────────────────────────────────────── */

/**
 * Props:
 *   onAction(id)        — called when a menu item is clicked
 *   viewState           — { sidebarOpen, bottomOpen, showAiPanel, wordWrap, minimap }
 *                          used to show ✓ on active toggle items
 */
export default function MenuBar({ onAction, viewState = {} }) {
  const [openMenu, setOpenMenu] = useState(null); // menu id that is open
  const barRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function handleItemClick(item) {
    if (item.type === "separator") return;
    setOpenMenu(null);
    onAction(item.id);
  }

  function toggleMenu(id) {
    setOpenMenu((prev) => (prev === id ? null : id));
  }

  return (
    <div
      ref={barRef}
      className="shrink-0 flex items-stretch h-7 bg-gray-900 border-b border-gray-800 select-none z-50"
      style={{ fontSize: "12px" }}
    >
      {MENUS.map((menu) => (
        <div key={menu.id} className="relative">
          {/* Menu trigger */}
          <button
            onClick={() => toggleMenu(menu.id)}
            onMouseEnter={() => openMenu && openMenu !== menu.id && setOpenMenu(menu.id)}
            className={`h-full px-3 text-[12px] transition-colors ${
              openMenu === menu.id
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            }`}
          >
            {menu.label}
          </button>

          {/* Dropdown */}
          {openMenu === menu.id && (
            <MenuDropdown
              items={menu.items}
              viewState={viewState}
              onItemClick={handleItemClick}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Dropdown ───────────────────────────────────────────────── */

function MenuDropdown({ items, viewState, onItemClick }) {
  return (
    <div
      className="absolute top-full left-0 mt-px min-w-[220px] py-1 rounded-sm shadow-2xl z-50"
      style={{
        background: "#252526",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      }}
    >
      {items.map((item, i) => {
        if (item.type === "separator") {
          return (
            <div
              key={i}
              className="my-1 mx-2"
              style={{ height: "1px", background: "rgba(255,255,255,0.08)" }}
            />
          );
        }

        const isChecked = item.toggle && item.key && viewState[item.key];

        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className="
              w-full flex items-center justify-between gap-4 px-4 py-1 text-[12px]
              text-gray-300 hover:bg-indigo-600 hover:text-white
              transition-colors text-left
            "
          >
            <span className="flex items-center gap-2">
              <span className="w-3 shrink-0 text-[10px] text-emerald-400">
                {isChecked ? "✓" : ""}
              </span>
              {item.label}
            </span>
            {item.shortcut && (
              <span className="text-[10px] text-gray-600 shrink-0 font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
