import Editor from "@monaco-editor/react";
import { useRef, useEffect } from "react";

const LANG_MAP = {
  javascript: "javascript", js: "javascript", jsx: "javascript",
  typescript: "typescript", ts: "typescript", tsx: "typescript",
  css: "css", json: "json", markdown: "markdown", md: "markdown",
  html: "html", python: "python", py: "python",
  rust: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
  shell: "shell", bash: "shell", yaml: "yaml", toml: "ini",
};

/* ─── CSS injection ──────────────────────────────────────────── */
// Runs once per page load; styles Monaco decoration CSS classes.

function ensureStyles() {
  const id = "devfix-decoration-styles";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .devfix-line-error   { background:rgba(239,68,68,.10)  !important; border-left:2px solid rgba(239,68,68,.55); }
    .devfix-line-warning { background:rgba(245,158,11,.10) !important; border-left:2px solid rgba(245,158,11,.55); }
    .devfix-line-info    { background:rgba(59,130,246,.10) !important; border-left:2px solid rgba(59,130,246,.55); }

    .devfix-glyph-error   { border-radius:50%; background:#ef4444; box-shadow:0 0 5px rgba(239,68,68,.7);  margin:5px 2px; width:8px !important; height:8px !important; }
    .devfix-glyph-warning { border-radius:50%; background:#f59e0b; box-shadow:0 0 5px rgba(245,158,11,.7); margin:5px 2px; width:8px !important; height:8px !important; }
    .devfix-glyph-info    { border-radius:50%; background:#3b82f6; box-shadow:0 0 5px rgba(59,130,246,.7);  margin:5px 2px; width:8px !important; height:8px !important; }
  `;
  document.head.appendChild(s);
}

/* ─── Pure helpers (no component state needed) ───────────────── */

function severityClass(confidence) {
  return confidence >= 80 ? "error" : confidence >= 50 ? "warning" : "info";
}

function overviewColor(confidence) {
  return confidence >= 80 ? "#ef4444" : confidence >= 50 ? "#f59e0b" : "#3b82f6";
}

/**
 * Builds the rich markdown tooltip shown on hover over a decorated line.
 * Monaco renders this as a hover widget — supports headings, bold, lists.
 */
function hoverMessage(fix) {
  const steps = (fix.steps ?? [])
    .slice(0, 2)
    .map((s) => `- ${s}`)
    .join("\n");

  return {
    isTrusted: true,
    value: [
      `**DevFix** · ${fix.confidence}% confidence`,
      "",
      `### ${fix.title}`,
      steps,
      "",
      `> 💡 Press \`Ctrl+.\` or click the lightbulb to apply this fix`,
    ].join("\n"),
  };
}

/**
 * Converts fix objects → Monaco decoration descriptors.
 * Each affected line gets: coloured background, glyph margin dot, hover tooltip,
 * and an overview-ruler tick.
 */
function buildDecorations(fixes, monaco) {
  const list = [];
  fixes.forEach((fix) => {
    if (!fix.affectedLines?.length) return;
    const cls   = severityClass(fix.confidence);
    const color = overviewColor(fix.confidence);
    fix.affectedLines.forEach((line) => {
      list.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine:          true,
          className:            `devfix-line-${cls}`,
          glyphMarginClassName: `devfix-glyph-${cls}`,
          hoverMessage:         hoverMessage(fix),
          overviewRuler: {
            color,
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      });
    });
  });
  return list;
}

/**
 * Converts fix objects → Monaco IMarkerData[] for squiggly underlines.
 * These also populate the built-in Problems panel in Monaco's status bar.
 */
function buildMarkers(fixes, monaco) {
  return fixes.flatMap((fix) =>
    (fix.affectedLines ?? []).map((line) => ({
      startLineNumber: line,
      endLineNumber:   line,
      startColumn:     1,
      endColumn:       Number.MAX_SAFE_INTEGER,
      message:         fix.title,
      severity:
        fix.confidence >= 80 ? monaco.MarkerSeverity.Error
        : fix.confidence >= 50 ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
    }))
  );
}

/* ─── Component ──────────────────────────────────────────────── */

/**
 * fixes: Array<{
 *   title: string,
 *   confidence: number,          // 0–100
 *   affectedLines: number[],     // 1-based
 *   steps: string[],
 *   improvedCode: string,
 * }>
 */
export default function CodeEditorPanel({ language, value, onChange, fixes = [], onEditorMount, wordWrap = false, minimap = true }) {
  const editorRef      = useRef(null);
  const monacoRef      = useRef(null);
  const decorationsRef = useRef(null);  // IDecorationsCollection — cleared on each update
  const actionsRef     = useRef(null);  // IDisposable from registerCodeActionProvider
  const fixesRef       = useRef(fixes); // keeps latest fixes readable inside closures

  // Sync wordWrap / minimap dynamically without remounting
  useEffect(() => { editorRef.current?.updateOptions({ wordWrap: wordWrap ? "on" : "off" }); }, [wordWrap]);
  useEffect(() => { editorRef.current?.updateOptions({ minimap: { enabled: minimap } }); }, [minimap]);

  const monacoLang = LANG_MAP[language] ?? "javascript";

  // Keep fixesRef in sync without triggering other effects
  useEffect(() => { fixesRef.current = fixes; }, [fixes]);

  // ── Main diagnostic sync effect ─────────────────────────────────────────
  // Runs whenever fixes change; also fires after the editor mounts (via handleMount).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return; // editor not mounted yet — handleMount will apply them

    applyDiagnostics(editor, monaco, fixes);

    return () => {
      decorationsRef.current?.clear();
      actionsRef.current?.dispose();
    };
  }, [fixes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core apply function (shared by effect + handleMount) ─────────────────
  function applyDiagnostics(editor, monaco, currentFixes) {
    decorationsRef.current?.clear();
    actionsRef.current?.dispose();

    const model = editor.getModel();
    if (!model) return;

    // Clear everything when no fixes
    if (!currentFixes.length) {
      monaco.editor.setModelMarkers(model, "devfix", []);
      return;
    }

    // 1 — Squiggly underlines (model markers)
    monaco.editor.setModelMarkers(model, "devfix", buildMarkers(currentFixes, monaco));

    // 2 — Line highlights + glyph dots + hover tooltips (decorations)
    decorationsRef.current = editor.createDecorationsCollection(
      buildDecorations(currentFixes, monaco)
    );

    // 3 — Lightbulb + "Apply fix" action (code action provider)
    const lang    = model.getLanguageId() ?? "javascript";
    const maxConf = Math.max(...currentFixes.map((f) => f.confidence));

    actionsRef.current = monaco.languages.registerCodeActionProvider(lang, {
      provideCodeActions(providerModel, range) {
        // Scope to this editor's model only — avoids interfering with other open editors
        if (providerModel !== editorRef.current?.getModel()) {
          return { actions: [], dispose() {} };
        }

        // Find fixes whose affected lines intersect the cursor / selection range
        const relevant = currentFixes.filter((fix) =>
          (fix.affectedLines ?? []).some(
            (l) => l >= range.startLineNumber && l <= range.endLineNumber
          )
        );
        if (!relevant.length) return { actions: [], dispose() {} };

        return {
          actions: relevant.map((fix) => ({
            title:       `DevFix: ${fix.title}  (${fix.confidence}% confidence)`,
            kind:        "quickfix",
            isPreferred: fix.confidence === maxConf,
            // Workspace edit: replaces the entire document with the improved code
            edit: {
              edits: [{
                resource:  providerModel.uri,
                versionId: providerModel.getVersionId(),
                textEdit: {
                  range: providerModel.getFullModelRange(),
                  text:  fix.improvedCode,
                },
              }],
            },
          })),
          dispose() {},
        };
      },
    });
  }

  // ── Mount handler ─────────────────────────────────────────────────────────
  function handleMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    ensureStyles();
    onEditorMount?.(editor);

    if (fixesRef.current.length > 0) {
      applyDiagnostics(editor, monaco, fixesRef.current);
    }
  }

  return (
    <Editor
      height="100%"
      language={monacoLang}
      value={value}
      onChange={(val) => onChange(val ?? "")}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 13,
        fontFamily: "JetBrains Mono, Fira Code, Consolas, 'Courier New', monospace",
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        tabSize: 2,
        wordWrap: "off",
        padding: { top: 12, bottom: 12 },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        formatOnPaste: true,
        suggestOnTriggerCharacters: true,
        automaticLayout: true,
        glyphMargin: true,          // required for glyph margin dots
        lightbulb: { enabled: true }, // required for code-action lightbulb
        overviewRulerLanes: 3,      // room for our overview ruler ticks
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  );
}
