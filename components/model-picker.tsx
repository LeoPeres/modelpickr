"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Brain, Check, Eye, Search, Unlock, X } from "lucide-react";
import { searchModels, type SortKey } from "@/lib/catalog/search";
import { formatContext, formatMonth, formatPrice } from "@/lib/i18n";
import { useCatalog } from "./shell";
import { ProviderLogo } from "./provider-logo";

export type PickerMode = { kind: "add" } | { kind: "replace"; id: string };

export function ModelPicker({
  mode,
  selected,
  onSelect,
  onClose,
}: {
  mode: PickerMode;
  selected: string[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { catalog } = useCatalog();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [sort, setSort] = useState<SortKey>("intelligence");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const providers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of catalog.models) seen.set(m.provider, m.providerName);
    return [...seen];
  }, [catalog]);
  const results = useMemo(
    () => searchModels(catalog.models, query, { provider, sort }),
    [catalog, query, provider, sort],
  );
  const current = mode.kind === "replace" ? mode.id : null;
  const blocked = (id: string) => id !== current && selected.includes(id);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);
  useEffect(() => setActive(0), [query, provider, sort]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(id: string) {
    if (blocked(id)) return;
    onSelect(id);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active].id);
    }
  }
  const title = mode.kind === "add" ? "Adicionar modelo" : "Trocar modelo";
  return (
    <div
      className="picker-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="picker"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        <div className="picker-search">
          <Search size={20} />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              results[active] ? `${listId}-${active}` : undefined
            }
            aria-label="Buscar modelo"
            placeholder={
              mode.kind === "add"
                ? "Buscar modelo, empresa ou ID…"
                : "Trocar por qual modelo?"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="picker-filters">
          <div className="chips" role="group" aria-label="Empresa">
            <button
              type="button"
              className="chip"
              aria-pressed={provider === ""}
              onClick={() => setProvider("")}
            >
              Todas
            </button>
            {providers.map(([id, name]) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={provider === id}
                onClick={() => setProvider(provider === id ? "" : id)}
              >
                <ProviderLogo provider={id} name={name} size={18} />
                {name}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Ordenar por">
            {(
              [
                ["intelligence", "Inteligência"],
                ["price", "Preço"],
                ["recent", "Recentes"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="picker-list" role="listbox" id={listId} ref={listRef}>
          {results.map((m, i) => {
            const isCurrent = m.id === current;
            const isBlocked = blocked(m.id);
            return (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                aria-disabled={isBlocked}
                className={`picker-option ${i === active ? "is-active" : ""}`}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(m.id)}
              >
                <ProviderLogo provider={m.provider} name={m.providerName} />
                <span className="option-main">
                  <span className="option-name">
                    {m.name}
                    {m.reasoning && (
                      <span className="feature" title="Raciocínio">
                        <Brain size={13} />
                      </span>
                    )}
                    {m.inputModalities.includes("image") && (
                      <span className="feature" title="Entende imagens">
                        <Eye size={13} />
                      </span>
                    )}
                    {m.openWeights && (
                      <span className="feature" title="Pesos abertos">
                        <Unlock size={13} />
                      </span>
                    )}
                  </span>
                  <span className="option-meta">
                    {m.providerName} · {formatMonth(m.releaseDate)} ·{" "}
                    {formatContext(m.context)} contexto
                  </span>
                </span>
                <span className="option-stats">
                  <span className="option-eci">
                    {m.intelligence ? Math.round(m.intelligence.value) : "—"}
                    <small>ECI</small>
                  </span>
                  <span className="option-price">
                    {formatPrice(m.price.input)} / {formatPrice(m.price.output)}
                  </span>
                </span>
                <span className="option-state">
                  {isCurrent ? (
                    <span className="tag">Atual</span>
                  ) : isBlocked ? (
                    <Check size={16} aria-label="Já na comparação" />
                  ) : null}
                </span>
              </li>
            );
          })}
          {!results.length && (
            <li className="picker-empty">Nenhum modelo encontrado.</li>
          )}
        </ul>
        <div className="picker-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar <kbd>Enter</kbd> escolher <kbd>Esc</kbd> fechar
          </span>
          <span>
            {results.length} modelos · preço por 1M tokens (entrada / saída)
          </span>
        </div>
      </div>
    </div>
  );
}
