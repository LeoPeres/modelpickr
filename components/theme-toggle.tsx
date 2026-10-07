"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { messages } from "@/lib/i18n";

const storageKey = "modelmatch:theme";
type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (next: Theme) => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    const restore = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch {
        // System preference remains usable when storage is blocked.
      }
      apply(
        saved === "dark" || saved === "light"
          ? saved
          : media.matches
            ? "dark"
            : "light",
      );
    };
    restore();
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };
    media.addEventListener("change", restore);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", restore);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The theme still changes for this session without persistence.
    }
  }

  return (
    <div className="segmented theme-toggle" role="group" aria-label="Tema">
      {(
        [
          ["light", Sun, "Claro", messages.theme.light],
          ["dark", Moon, "Escuro", messages.theme.dark],
        ] as const
      ).map(([value, Icon, label, title]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={title}
          title={title}
          onClick={() => choose(value)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
