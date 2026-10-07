"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Columns3,
  Info,
  LayoutGrid,
  Sparkles,
  X,
} from "lucide-react";
import type { Catalog, CatalogModel } from "@/lib/catalog/types";
import { maxModels } from "@/lib/engine";
import { formatDate, messages } from "@/lib/i18n";
import { keys, readSelection } from "@/lib/storage";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { ProviderLogo } from "./provider-logo";
type CatalogContext = {
  catalog: Catalog;
  byId: Map<string, CatalogModel>;
  ids: string[];
};
const CatalogCtx = createContext<CatalogContext | null>(null);
export function useCatalog() {
  const value = useContext(CatalogCtx);
  if (!value) throw new Error("useCatalog fora do Shell");
  return value;
}
const SelectionCtx = createContext<{
  selected: string[];
  setSelected: (ids: string[]) => void;
  toggle: (id: string) => void;
  notice: string;
  ready: boolean;
}>({
  selected: [],
  setSelected: () => {},
  toggle: () => {},
  notice: "",
  ready: false,
});
export const useSelection = () => useContext(SelectionCtx);
export function Shell({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: ReactNode;
}) {
  const path = usePathname();
  const value = useMemo(
    () => ({
      catalog,
      byId: new Map(catalog.models.map((m) => [m.id, m])),
      ids: catalog.models.map((m) => m.id),
    }),
    [catalog],
  );
  const [selected, update] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      update(readSelection(value.ids));
    } catch {
      setNotice("Não foi possível restaurar a seleção neste navegador.");
    }
    setReady(true);
  }, [value.ids]);
  function setSelected(ids: string[]) {
    if (ids.length > maxModels) {
      setNotice(
        `Limite de ${maxModels} modelos. Remova um para adicionar outro.`,
      );
      return;
    }
    update(ids);
    setNotice("");
    try {
      localStorage.setItem(keys.selection, JSON.stringify(ids));
    } catch {
      setNotice(
        "Armazenamento local indisponível. A seleção vale só nesta sessão.",
      );
    }
  }
  function toggle(id: string) {
    setSelected(
      selected.includes(id)
        ? selected.filter((v) => v !== id)
        : [...selected, id],
    );
  }
  const compareUrl = `/compare?models=${selected.join(",")}`;
  const nav = [
    ["/", messages.navigation.catalog, LayoutGrid],
    ["/compare", messages.navigation.compare, Columns3],
    ["/scenarios", messages.navigation.scenarios, Bookmark],
    ["/methodology", messages.navigation.methodology, BookOpen],
    ["/pro", messages.navigation.pro, Sparkles],
  ] as const;
  const sourceNote = (
    <Link
      href="/methodology"
      className="demo-note"
      title={
        catalog.live ? undefined : "Fontes indisponíveis; usando cópia local"
      }
    >
      <Info size={14} />
      <span>
        {messages.sources}
        <br />
        {catalog.live ? "Atualizado" : "Cópia de"}{" "}
        {formatDate(catalog.generatedAt)}
      </span>
    </Link>
  );
  return (
    <CatalogCtx.Provider value={value}>
      <SelectionCtx.Provider
        value={{ selected, setSelected, toggle, notice, ready }}
      >
        <div className="app">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <Logo />
              <span>ModelMatch</span>
            </Link>
            <nav aria-label="Navegação principal">
              {nav.map(([url, label, Icon]) => (
                <Link
                  key={url}
                  aria-current={path === url ? "page" : undefined}
                  href={
                    url === "/compare" && selected.length ? compareUrl : url
                  }
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span className="nav-label">{label}</span>
                  {url === "/compare" && selected.length > 0 && (
                    <span className="count">{selected.length}</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="sidebar-foot">
              <ThemeToggle />
              {sourceNote}
            </div>
          </aside>
          <main>
            <div className="mobile-top mobile-only">
              <Link href="/" className="brand" aria-label="ModelMatch">
                <Logo size={24} />
              </Link>
              {sourceNote}
            </div>
            {children}
          </main>
        </div>
        {notice && (
          <div className="toast" role="status">
            <Info size={16} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Fechar mensagem"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {selected.length > 0 && path === "/" && (
          <aside className="selection-bar" aria-label="Modelos selecionados">
            <span className="avatar-stack">
              {selected.map((id) => {
                const m = value.byId.get(id);
                return m ? (
                  <ProviderLogo
                    key={id}
                    provider={m.provider}
                    name={m.providerName}
                    size={32}
                  />
                ) : null;
              })}
            </span>
            <span className="selection-text">
              <strong>
                {selected.length} de {maxModels}
                <span className="hide-sm"> selecionados</span>
              </strong>
              <small>
                {selected.map((id) => value.byId.get(id)?.name).join(", ")}
              </small>
            </span>
            <button className="button ghost" onClick={() => setSelected([])}>
              Limpar
            </button>
            <Link
              aria-disabled={selected.length < 2}
              onClick={(e) => {
                if (selected.length < 2) e.preventDefault();
              }}
              className={`button primary ${selected.length < 2 ? "disabled" : ""}`}
              href={compareUrl}
              title={selected.length < 2 ? "Selecione pelo menos 2" : undefined}
            >
              Comparar <ArrowRight size={16} />
            </Link>
          </aside>
        )}
      </SelectionCtx.Provider>
    </CatalogCtx.Provider>
  );
}
