"use client";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/primitives";

export default function ThemeToggle() {
  const { resolved, setMode } = useTheme();
  const { t } = useI18n();
  const isDark = resolved === "dark";
  return (
    <button onClick={() => setMode(isDark ? "light" : "dark")} aria-label={t("theme_toggle")} title={t("set_theme")}
      className="muted" style={{ width: 38, height: 38, borderRadius: 99, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}>
      <Icon name={isDark ? "sun" : "moon"} size={16} />
    </button>
  );
}
