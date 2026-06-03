"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { tokenize, tokenClass, normalizeLang } from "@/lib/tokenize";

const LABELS: Record<string, string> = {
  memql: "memql", python: "python", go: "go", proto: "protobuf",
  yaml: "yaml", bash: "shell", sh: "shell", sql: "sql", json: "json",
  ts: "typescript", typescript: "typescript", make: "make", ini: "ini",
  dockerfile: "dockerfile", text: "text", plain: "text",
};

/**
 * Fenced code block for docs — tokenized highlight (shared tokenizer),
 * a thin filename/lang bar, and a copy button. Page-themed (flips in
 * light mode) like the landing-page code surfaces.
 */
function CodeBlockImpl({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const normalized = normalizeLang(lang);
  const label = LABELS[normalized] ?? normalized;

  const lines = useMemo(() => {
    const src = code.replace(/\n+$/, "");
    return src.split("\n").map((line) => tokenize(line, normalized));
  }, [code, normalized]);

  const onCopy = useCallback(() => {
    navigator.clipboard?.writeText(code.replace(/\n+$/, "")).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }, [code]);

  return (
    <figure className="group relative my-6 overflow-hidden rounded-lg border border-border bg-bg-elev">
      <div className="flex items-center gap-2 border-b border-border bg-bg-panel px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="ml-auto inline-flex items-center gap-1.5 rounded font-mono text-[11px] tracking-wide text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true" className={copied ? "text-accent" : "text-dim"}>
            {copied ? "✓" : "⧉"}
          </span>
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-[1.7]">
        <code className="block">
          {lines.map((tokens, i) => (
            <div key={i}>
              {tokens.length === 0 ? (
                " "
              ) : (
                tokens.map((t, j) => (
                  <span key={j} className={tokenClass(t.kind)}>
                    {t.text}
                  </span>
                ))
              )}
            </div>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export default memo(CodeBlockImpl);
