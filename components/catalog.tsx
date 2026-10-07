"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Building2, Search, SearchX } from "lucide-react";
import { searchModels, type SortKey } from "@/lib/catalog/search";
import { maxModels } from "@/lib/engine";
import { formatContext, formatMonth, formatPrice } from "@/lib/i18n";
import { useCatalog, useSelection } from "./shell";
import { ProviderLogo } from "./provider-logo";
const pageSize = 40;
export default function Catalog() {
  const { catalog } = useCatalog();
  const { selected, toggle } = useSelection();
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [sort, setSort] = useState<SortKey>("intelligence");
  const [limit, setLimit] = useState(pageSize);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setLimit(pageSize), [search, provider, sort]);
  const providers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of catalog.models) seen.set(m.provider, m.providerName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalog]);
  const range = useMemo(() => {
    const values = catalog.models
      .map((m) => m.intelligence?.value)
      .filter((v): v is number => v !== undefined);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [catalog]);
  const filtered = searchModels(catalog.models, search, { provider, sort });
  return (
    <>
      <div className="block-head">
        <h2 id="catalog-title">Todos os modelos</h2>
        <p>
          {catalog.models.length} modelos das principais APIs. Selecione de 2 a{" "}
          {maxModels} para comparar.
        </p>
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            ref={searchRef}
            aria-label="Buscar modelos ou empresas"
            placeholder="Buscar modelo ou empresa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>/</kbd>
        </label>
        <div className="toolbar-end">
          <label className="pill-select">
            <Building2 size={15} />
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              aria-label="Empresa"
            >
              <option value="">Todas as empresas</option>
              {providers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="pill-select">
            <ArrowUpDown size={15} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Ordenação"
            >
              <option value="intelligence">Mais inteligentes</option>
              <option value="price">Mais baratos</option>
              <option value="recent">Mais recentes</option>
            </select>
          </label>
        </div>
      </div>
      <div className="surface table-scroll">
        <table className="data-table catalog-table">
          <thead>
            <tr>
              <th className="check-cell">
                <span className="sr-only">Seleção</span>
              </th>
              <th>Modelo</th>
              <th>Inteligência</th>
              <th className="num">Entrada</th>
              <th className="num">Saída</th>
              <th className="num">Contexto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((m) => {
              const checked = selected.includes(m.id);
              const safeId = m.id.replace(/[^a-z0-9-]/gi, "-");
              return (
                <tr className={checked ? "is-selected" : ""} key={m.id}>
                  <td className="check-cell">
                    <input
                      id={`select-${safeId}`}
                      type="checkbox"
                      aria-label={`Selecionar ${m.name}`}
                      checked={checked}
                      onChange={() => toggle(m.id)}
                    />
                  </td>
                  <td>
                    <label htmlFor={`select-${safeId}`} className="model-cell">
                      <ProviderLogo
                        provider={m.provider}
                        name={m.providerName}
                        size={36}
                      />
                      <span className="model-name">
                        {m.name}
                        <small>
                          {m.providerName} · {formatMonth(m.releaseDate)}
                          {m.openWeights && (
                            <span className="tag">Pesos abertos</span>
                          )}
                        </small>
                      </span>
                    </label>
                  </td>
                  <td>
                    {m.intelligence ? (
                      <span className="meter">
                        <span className="meter-value">
                          {Math.round(m.intelligence.value)}
                        </span>
                        <span className="meter-track">
                          <span
                            style={{
                              width: `${Math.max(4, ((m.intelligence.value - range.min) / (range.max - range.min)) * 100)}%`,
                            }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="na" title="Sem avaliação no Epoch AI">
                        —
                      </span>
                    )}
                  </td>
                  <td className="num">{formatPrice(m.price.input)}</td>
                  <td className="num">{formatPrice(m.price.output)}</td>
                  <td className="num">{formatContext(m.context)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty compact">
            <SearchX size={28} strokeWidth={1.5} />
            <p>Nenhum modelo encontrado.</p>
            <button
              className="button"
              onClick={() => {
                setSearch("");
                setProvider("");
              }}
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>
      {filtered.length > limit && (
        <div className="more">
          <button className="button" onClick={() => setLimit(limit + pageSize)}>
            Mostrar mais ({filtered.length - limit})
          </button>
        </div>
      )}
      <p className="footnote">
        Inteligência: Epoch Capabilities Index (ECI). Preços oficiais de API em
        USD por 1M tokens. — indica modelo ainda sem avaliação.
      </p>
    </>
  );
}
