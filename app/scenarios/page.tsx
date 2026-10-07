"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Info,
  Repeat,
  SquarePen,
  Target,
  Trash2,
} from "lucide-react";
import { readScenarios, keys } from "@/lib/storage";
import { type Scenario } from "@/lib/engine";
import { taskById } from "@/lib/catalog/tasks";
import { useCatalog } from "@/components/shell";
import { formatNumber as number, formatDate } from "@/lib/i18n";
export default function Page() {
  const { byId, ids } = useCatalog();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    try {
      setScenarios(readScenarios(ids));
    } catch {
      setMessage(
        "Não foi possível ler seus cenários. O armazenamento pode estar indisponível ou inválido.",
      );
    }
    setReady(true);
  }, [ids]);
  function deleteScenario(id: string) {
    try {
      const next = scenarios.filter((s) => s.id !== id);
      localStorage.setItem(keys.scenarios, JSON.stringify(next));
      setScenarios(next);
      setRemove(null);
    } catch {
      setMessage("Não foi possível excluir o cenário.");
    }
  }
  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Cenários</h1>
          <p>Salvos apenas neste navegador.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/compare?models=">
            <SquarePen size={16} /> Nova comparação
          </Link>
        </div>
      </header>
      {message && (
        <div role="alert" className="notice">
          <Info size={16} />
          <span>{message}</span>
        </div>
      )}
      {!ready ? (
        <p className="empty" role="status">
          Carregando…
        </p>
      ) : !scenarios.length ? (
        <div className="surface empty compact">
          <Bookmark size={28} strokeWidth={1.5} />
          <h2>Nenhum cenário salvo.</h2>
          <Link className="button primary" href="/">
            Ver modelos <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <ul className="surface scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <span className="icon-tile">
                <Bookmark size={18} strokeWidth={1.75} />
              </span>
              <div className="scenario-main">
                <h2>{s.name}</h2>
                <p>{s.models.map((id) => byId.get(id)?.name).join(", ")}</p>
                <div className="meta">
                  <span>
                    <Repeat size={14} />
                    {number(s.requests)}/mês
                  </span>
                  <span>
                    <Target size={14} />
                    {s.minimum}% em {taskById(s.task)?.label}
                  </span>
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(s.createdAt)}
                  </span>
                </div>
              </div>
              {remove === s.id ? (
                <div className="actions" role="alert">
                  <span className="muted">Excluir?</span>
                  <button
                    className="button danger"
                    onClick={() => deleteScenario(s.id)}
                  >
                    Excluir cenário
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => setRemove(null)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="actions">
                  <Link
                    className="button"
                    href={`/compare?models=${s.models.join(",")}&scenario=${s.id}`}
                  >
                    Abrir <ArrowUpRight size={16} />
                  </Link>
                  <button
                    className="icon-button"
                    aria-label={`Excluir ${s.name}`}
                    title="Excluir"
                    onClick={() => setRemove(s.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
