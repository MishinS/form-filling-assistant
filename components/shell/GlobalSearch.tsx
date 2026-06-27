"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon, FileGlyph } from "@/components/primitives";
import type { SearchHit, SearchResults } from "@/lib/db/search";

const EMPTY: SearchResults = { fills: [], sources: [] };

export default function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch with in-flight cancellation.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setResults(res.ok ? ((await res.json()) as SearchResults) : EMPTY);
      } catch {
        /* aborted or network error — leave previous results, swallow */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (hit: SearchHit) => {
    router.push(`/fills/${hit.fillId}`);
    setOpen(false); setQuery(""); setResults(EMPTY);
  };

  const total = results.fills.length + results.sources.length;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="row gap-10 grow" style={{ maxWidth: 460, position: "relative" }}>
      <Icon name="search" size={16} className="dim" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); (e.currentTarget as HTMLInputElement).blur(); } }}
        placeholder={t("search")}
        aria-label={t("search")}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13.5 }}
      />
      {showDropdown && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 60,
            // frosted elevated panel: translucent surface-3 over a backdrop blur so the
            // dropdown reads as a floating layer and never blends into the work area behind it.
            background: "color-mix(in srgb, var(--surface-3) 86%, transparent)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid var(--line-2)", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(6,9,8,.28)", overflow: "hidden", maxHeight: 420, overflowY: "auto",
          }}
        >
          {total === 0 ? (
            <div className="muted" style={{ padding: "16px 18px", fontSize: 13 }}>
              {loading ? "…" : t("sources_none")}
            </div>
          ) : (
            <>
              <Group label={t("nav_fills")} hits={results.fills} onPick={go} />
              <Group label={t("nav_sources")} hits={results.sources} onPick={go} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, hits, onPick }: { label: string; hits: SearchHit[]; onPick: (h: SearchHit) => void }) {
  if (hits.length === 0) return null;
  return (
    <div>
      <div style={{ padding: "9px 16px 6px", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-3)" }}>
        {label}
      </div>
      {hits.map((h) => (
        <button
          key={`${h.kind}-${h.fillId}-${h.title}`}
          type="button"
          // preventDefault on mousedown keeps focus on the input so it doesn't blur before onClick fires
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(h)}
          className="row gap-12"
          style={{ width: "100%", textAlign: "left", padding: "9px 16px", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <FileGlyph type={h.ext} size={26} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</div>
            {h.subtitle && (
              <div className="dim" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.subtitle}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
