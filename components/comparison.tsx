"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  BookmarkPlus,
  Bot,
  Brain,
  BrainCircuit,
  CalendarDays,
  Check,
  CircleDollarSign,
  Code2,
  Cpu,
  FileSearch,
  FlaskConical,
  Gauge,
  Infinity as InfinityIcon,
  Info,
  Library,
  MessageSquare,
  PiggyBank,
  Scale,
  Plus,
  SquarePen,
  Shapes,
  Share2,
  Sigma,
  SlidersHorizontal,
  SquareTerminal,
  Tags,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CatalogModel } from "@/lib/catalog/types";
import {
  type Task,
  benchmarkOf,
  defaultBenchmark,
  tasks,
  taskById,
} from "@/lib/catalog/tasks";
import {
  bestValues,
  defaultUsage,
  maxModels,
  monthlyCost,
  isGoal,
  pointsPerDoubling,
  rankModels,
  recommend,
  recommendForTask,
  selectionFromUrl,
  type Goal,
  type Scenario,
  type Usage,
} from "@/lib/engine";
import { keys, readScenarios } from "@/lib/storage";
import {
  formatContext,
  formatMonth,
  formatNumber as number,
  formatPrice,
  formatUsd as usd,
} from "@/lib/i18n";
import { useCatalog, useSelection } from "./shell";
import { ProviderLogo } from "./provider-logo";
import { ModelPicker, type PickerMode } from "./model-picker";
import { Carousel } from "./carousel";
import { CostChart, type ChartPoint } from "./cost-chart";

const taskIcons: Record<string, LucideIcon> = {
  science: FlaskConical,
  math: Sigma,
  "math-advanced": InfinityIcon,
  software: Code2,
  "ml-code": BrainCircuit,
  agents: SquareTerminal,
  facts: Library,
  abstract: Shapes,
};
const modalities: Record<string, string> = {
  text: "texto",
  image: "imagem",
  pdf: "PDF",
  audio: "áudio",
  video: "vídeo",
};
const yesNo = (v: boolean) => (v ? "Sim" : "Não");
const goalOptions: [Goal, string, LucideIcon][] = [
  ["value", "Custo-benefício", Scale],
  ["intelligence", "Inteligência máxima", Brain],
  ["cost", "Menor custo", PiggyBank],
];
const goalRules: Record<Goal, string> = {
  value: `Custo-benefício: dobrar o custo só compensa se render ${pointsPerDoubling} ou mais pontos de ECI.`,
  intelligence:
    "Inteligência máxima: o mais barato entre os empatados com o mais inteligente, pelo intervalo de confiança.",
  cost: "Menor custo: o mais barato entre os modelos com índice de inteligência.",
};
/** Example tokens per request; volume stays as the user set it. */
const usagePresets: {
  id: string;
  label: string;
  Icon: LucideIcon;
  usage: Required<Omit<Usage, "requests">>;
}[] = [
  {
    id: "chat",
    label: "Chat",
    Icon: MessageSquare,
    usage: { inputTokens: 1000, outputTokens: 500, cached: 0 },
  },
  {
    id: "rag",
    label: "RAG",
    Icon: FileSearch,
    usage: { inputTokens: 4000, outputTokens: 400, cached: 0 },
  },
  {
    id: "agent",
    label: "Agente",
    Icon: Bot,
    usage: { inputTokens: 20000, outputTokens: 800, cached: 70 },
  },
  {
    id: "classify",
    label: "Classificação",
    Icon: Tags,
    usage: { inputTokens: 300, outputTokens: 10, cached: 0 },
  },
];
const usageFields = [
  ["requests", "Solicitações por mês", 1e12],
  ["inputTokens", "Tokens de entrada", 1e12],
  ["outputTokens", "Tokens de saída", 1e12],
  ["cached", "Entrada em cache (%)", 100],
] as const;
const tagTone: Record<string, string> = {
  "Melhor escolha": "accent",
  "Mais inteligente": "intel",
  "Mais barato": "good",
};

export default function Comparison() {
  const params = useSearchParams();
  const router = useRouter();
  const { catalog, byId, ids: knownIds } = useCatalog();
  const { selected, setSelected, ready } = useSelection();
  const [ids, setIds] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage>(defaultUsage);
  const [task, setTask] = useState("science");
  /** Benchmark picked for the current task; null follows `defaultBenchmark`. */
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [minimum, setMinimum] = useState(80);
  const [reference, setReference] = useState("");
  const [differences, setDifferences] = useState(true);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [goal, setGoal] = useState<Goal>("value");
  const [focus, setFocus] = useState<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadedScenario = useRef<string | null>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready) return;
    const query = params.get("models");
    let next = query !== null ? selectionFromUrl(query, knownIds) : selected;
    const scenarioId = params.get("scenario");
    if (scenarioId && loadedScenario.current !== scenarioId) {
      loadedScenario.current = scenarioId;
      try {
        const saved = readScenarios(knownIds).find((s) => s.id === scenarioId);
        if (saved) {
          next = saved.models;
          setUsage({
            requests: saved.requests,
            inputTokens: saved.inputTokens,
            outputTokens: saved.outputTokens,
            cached: saved.cached ?? 0,
          });
          setTask(saved.task);
          // Older scenarios predate the choice and used the first benchmark.
          setBenchmark(
            saved.benchmark ?? taskById(saved.task)!.benchmarks[0].id,
          );
          setGoal(saved.goal ?? "value");
          setMinimum(saved.minimum);
          setReference(saved.reference);
          setName(saved.name);
          setEditing(saved);
        } else setMessage("Cenário não encontrado neste navegador.");
      } catch {
        setMessage("Não foi possível ler os cenários locais.");
      }
    }
    const goalParam = params.get("goal");
    if (isGoal(goalParam)) setGoal(goalParam);
    setIds(next);
    setSelected(next);
    setLoaded(true);
    if (query !== null && query !== next.join(","))
      setMessage(
        `Modelos desconhecidos, repetidos ou além de ${maxModels} foram ignorados.`,
      );
    if (!scenarioId)
      setReference((prev) => (next.includes(prev) ? prev : (next[0] ?? "")));
  }, [params, ready]);
  useEffect(() => {
    if (!pointed) return;
    const timer = setTimeout(() => setPointed(null), 1600);
    return () => clearTimeout(timer);
  }, [pointed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (ids.length < maxModels) setPicker({ kind: "add" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids.length]);
  function changeIds(next: string[]) {
    if (next.length > maxModels) {
      setMessage(`O limite é de ${maxModels} modelos.`);
      return;
    }
    setIds(next);
    setSelected(next);
    if (!next.includes(reference)) setReference(next[0] ?? "");
    const q = new URLSearchParams(params.toString());
    q.set("models", next.join(","));
    router.replace(`/compare?${q}`, { scroll: false });
  }
  /**
   * Starts from scratch: no models, default usage and goal, no scenario. It
   * pushes a history entry, so Back restores the previous comparison.
   */
  function startNew() {
    loadedScenario.current = null;
    setIds([]);
    setSelected([]);
    setReference("");
    setUsage(defaultUsage);
    setUsageOpen(false);
    setGoal("value");
    setTask("science");
    setBenchmark(null);
    setMinimum(80);
    setEditing(null);
    setName("");
    setSaveOpen(false);
    setFocus(null);
    setMessage("");
    router.push("/compare?models=", { scroll: false });
    window.scrollTo({ top: 0 });
    setPicker({ kind: "add" });
  }
  function changeGoal(next: Goal) {
    setGoal(next);
    setFocus(null);
    const q = new URLSearchParams(params.toString());
    if (next === "value") q.delete("goal");
    else q.set("goal", next);
    router.replace(`/compare?${q}`, { scroll: false });
  }
  /** From the chart: bring the model's card into view and flash it. */
  function showCard(id: string) {
    setFocus(null);
    requestAnimationFrame(() => setFocus(id));
    setPointed(id);
    cardsRef.current?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function pick(id: string) {
    if (picker?.kind === "replace") {
      changeIds(ids.map((v) => (v === picker.id ? id : v)));
      if (reference === picker.id) setReference(id);
    } else changeIds([...ids, id]);
    setFocus(id);
    setPicker(null);
  }

  const cost = (m: CatalogModel) => monthlyCost(usage, m.price);
  // Cards and details follow the ranking for the current goal; the cost list
  // is ordered by cost.
  const ranking = rankModels(
    ids.map((id) => byId.get(id)).filter((m): m is CatalogModel => Boolean(m)),
    usage,
    goal,
  );
  const chosen = ranking.map((r) => r.model);
  const rankOf = new Map(ranking.map((r) => [r.model.id, r.rank]));
  const enough = chosen.length >= 2;
  const balanced = recommend(chosen, usage, goal);
  const best = balanced.best[0];
  const smartest = balanced.smartest[0];
  const chartPoints: ChartPoint[] = chosen.flatMap((m) =>
    m.intelligence
      ? [
          {
            id: m.id,
            name: m.name,
            cost: cost(m),
            eci: Math.round(m.intelligence.value * 10) / 10,
            low: m.intelligence.low,
            high: m.intelligence.high,
          },
        ]
      : [],
  );
  const chartHighlight = new Set(balanced.best.map((m) => m.id));
  const t = taskById(task) ?? tasks[0];
  const benchmarkFor = (x: Task) =>
    x.id === t.id && benchmark
      ? benchmarkOf(x, benchmark)
      : defaultBenchmark(x, chosen);
  const coverage = (id: string) =>
    chosen.filter((m) => m.scores[id] !== undefined).length;
  const b = benchmarkFor(t);
  const taskRec = recommendForTask(chosen, b.id, minimum, usage);
  const range = useMemo(() => {
    const values = catalog.models
      .map((m) => m.intelligence?.value)
      .filter((v): v is number => v !== undefined);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      total: values.length,
    };
  }, [catalog]);
  const barWidth = (v: number) =>
    Math.max(4, ((v - range.min) / (range.max - range.min)) * 100);
  const referenceModel = byId.get(reference);
  const referenceCost = referenceModel ? cost(referenceModel) : null;
  const maxCost = Math.max(0, ...chosen.map(cost));
  const byCost = [...chosen].sort((a, b) => cost(a) - cost(b));
  const cached = usage.cached ?? 0;
  const preset = usagePresets.find(
    (p) =>
      p.usage.inputTokens === usage.inputTokens &&
      p.usage.outputTokens === usage.outputTokens &&
      p.usage.cached === cached,
  );
  const tagsFor = (m: CatalogModel) => {
    if (!enough) return [];
    const tags: string[] = [];
    if (balanced.best.includes(m)) tags.push("Melhor escolha");
    if (balanced.smartest.includes(m)) tags.push("Mais inteligente");
    if (balanced.cheapest.includes(m)) tags.push("Mais barato");
    return tags;
  };

  // Both detail tables share fixed column widths (CSS --label-w/--col-w) so
  // the sticky copy aligns.
  const tableStyle = { "--cols": chosen.length } as React.CSSProperties;
  const columns = (
    <colgroup>
      <col className="label-col" />
      {chosen.map((m) => (
        <col key={m.id} />
      ))}
    </colgroup>
  );
  function rankBadge(rank: number | null) {
    if (rank === null)
      return (
        <span className="rank-chip" title="Sem índice de inteligência">
          —
        </span>
      );
    const medal = ["gold", "silver", "bronze"][rank - 1];
    return (
      <span
        className={`rank-chip ${medal ?? ""}`}
        title={`${rank}º lugar · ${goalOptions.find(([g]) => g === goal)![1]}`}
      >
        {medal && <Trophy size={14} strokeWidth={2} />}#{rank}
      </span>
    );
  }
  function card(m: CatalogModel) {
    const tags = tagsFor(m);
    return (
      <article
        key={m.id}
        className={`model-card${tags.includes("Melhor escolha") ? " is-best" : ""}${pointed === m.id ? " is-pointed" : ""}`}
        onMouseEnter={() => setHovered(m.id)}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="card-top">
          <div className="card-id">
            <ProviderLogo
              provider={m.provider}
              name={m.providerName}
              size={44}
            />
            {enough && rankBadge(rankOf.get(m.id) ?? null)}
          </div>
          <div className="card-actions">
            <button
              className="icon-button"
              aria-label={`Trocar ${m.name}`}
              title="Trocar modelo"
              onClick={() => setPicker({ kind: "replace", id: m.id })}
            >
              <ArrowLeftRight size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={`Remover ${m.name}`}
              title="Remover"
              onClick={() => changeIds(ids.filter((id) => id !== m.id))}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <button
          className="card-name"
          title="Trocar modelo"
          onClick={() => setPicker({ kind: "replace", id: m.id })}
        >
          <strong>{m.name}</strong>
          <small>
            {m.providerName} · {formatMonth(m.releaseDate)}
          </small>
        </button>
        <div className="card-metric">
          <span className="metric-label">Inteligência</span>
          {m.intelligence ? (
            <>
              <span className="metric-value">
                {Math.round(m.intelligence.value)}
                <span className="rank" title="Posição no catálogo">
                  {m.intelligence.rank}º<small> de {range.total}</small>
                </span>
              </span>
              <span className="meter-track wide">
                <span
                  style={{
                    width: `${barWidth(m.intelligence.value)}%`,
                  }}
                />
              </span>
            </>
          ) : (
            <span className="metric-value na" title="Sem avaliação no Epoch AI">
              —
            </span>
          )}
        </div>
        <div className="card-metric">
          <span className="metric-label">Preço por 1M tokens</span>
          <span className="price-pair">
            <span>
              <strong>{formatPrice(m.price.input)}</strong>
              <small>entrada</small>
            </span>
            <span>
              <strong>{formatPrice(m.price.output)}</strong>
              <small>saída</small>
            </span>
          </span>
        </div>
        <div className="card-foot">
          <span className="muted">≈ {usd(cost(m))}/mês</span>
          {tags.length > 0 && (
            <span className="card-tags">
              {tags.map((tag) => (
                <span key={tag} className={`tag ${tagTone[tag]}`}>
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </article>
    );
  }
  function group(label: string, Icon: LucideIcon) {
    return (
      <tr className="group-row" key={label}>
        <th colSpan={chosen.length + 1}>
          <span>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </span>
        </th>
      </tr>
    );
  }
  function row(
    label: React.ReactNode,
    key: string,
    values: (string | number | null)[],
    opts: {
      higher?: boolean;
      format?: (n: number) => string;
      best?: boolean;
    } = {},
  ) {
    if (values.every((v) => v === null)) return null;
    if (differences && values.every((v) => v === values[0])) return null;
    const winners =
      opts.best && chosen.length > 1
        ? bestValues(
            values.map((v) => (typeof v === "number" ? v : null)),
            opts.higher ?? true,
          )
        : [];
    return (
      <tr key={key}>
        <th>{label}</th>
        {values.map((v, i) => (
          <td key={chosen[i].id} className={winners.includes(i) ? "best" : ""}>
            {v === null ? (
              <span className="na" title="Não disponível">
                —
              </span>
            ) : typeof v === "number" && opts.format ? (
              opts.format(v)
            ) : (
              v
            )}
            {winners.includes(i) && (
              <span className="badge">
                <Check size={11} strokeWidth={2.5} />
                {winners.length > 1 ? "Empate" : "Melhor"}
              </span>
            )}
          </td>
        ))}
      </tr>
    );
  }
  async function share() {
    const url = new URL("/compare", window.location.origin);
    url.searchParams.set("models", ids.join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      setMessage("Link copiado.");
    } catch {
      setMessage(`Copie o link: ${url}`);
    }
  }
  function save() {
    if (!enough || !name.trim()) return;
    try {
      const scenarios = readScenarios(knownIds);
      const scenario: Scenario = {
        ...usage,
        id: editing?.id ?? crypto.randomUUID(),
        name: name.trim(),
        models: ids,
        task: t.id,
        benchmark: b.id,
        goal,
        minimum,
        reference,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      };
      localStorage.setItem(
        keys.scenarios,
        JSON.stringify([
          ...scenarios.filter((s) => s.id !== scenario.id),
          scenario,
        ]),
      );
      setEditing(scenario);
      setSaveOpen(false);
      setMessage("Cenário salvo neste navegador.");
    } catch {
      setMessage(
        "Não foi possível salvar. Verifique o armazenamento do navegador.",
      );
    }
  }
  const alertScenario = `${name || "Comparação"}: ${chosen.map((m) => m.name).join(", ")}; ${number(usage.requests)} solicitações/mês; ${number(usage.inputTokens)} tokens de entrada${cached ? ` (${cached}% em cache)` : ""} e ${number(usage.outputTokens)} de saída; ${t.label} (${b.name}), mínimo ${minimum}%.`;
  function explain() {
    if (!best || !smartest) return "";
    const isSmartest = balanced.smartest.includes(best);
    const gap = smartest.intelligence!.value - best.intelligence!.value;
    const points = gap < 1 ? "menos de 1 ponto" : `${Math.round(gap)} pontos`;
    const pct =
      cost(smartest) > 0
        ? Math.round((1 - cost(best) / cost(smartest)) * 100)
        : null;
    const cheaper =
      pct !== null && pct > 0 ? `${pct}% mais barato` : "mais barato";
    if (goal === "intelligence")
      return isSmartest
        ? balanced.tied.length > 1
          ? "O mais inteligente da comparação e o mais barato entre os empatados com ele."
          : "O mais inteligente da comparação, sem empate técnico com os demais."
        : `Empatado em inteligência com ${smartest.name} e ${cheaper} no seu uso.`;
    if (goal === "value")
      return isSmartest
        ? "Também é o mais inteligente: nenhuma opção mais barata compensa a diferença."
        : `${points} de ECI abaixo de ${smartest.name}, e ${cheaper}.`;
    return isSmartest
      ? "O mais barato e também o mais inteligente da comparação."
      : `${cheaper[0].toUpperCase()}${cheaper.slice(1)} que ${smartest.name}, com ${points} de ECI a menos.`;
  }

  return (
    <>
      <header className="page-head compact with-actions">
        <div>
          <h1>Comparação</h1>
          <p>Preço e inteligência, lado a lado.</p>
        </div>
        <div className="actions">
          <button
            className="button"
            disabled={!ids.length && !editing}
            onClick={startNew}
          >
            <SquarePen size={16} /> Nova comparação
          </button>
          <button className="button" disabled={!enough} onClick={share}>
            <Share2 size={16} /> Compartilhar
          </button>
          <button
            className="button primary"
            disabled={!enough}
            onClick={() => setSaveOpen(!saveOpen)}
          >
            <BookmarkPlus size={16} />
            {editing ? "Salvar alterações" : "Salvar cenário"}
          </button>
        </div>
      </header>
      {message && (
        <div className="notice" role="status">
          <Info size={16} />
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Fechar mensagem"
            onClick={() => setMessage("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {saveOpen && (
        <form
          className="surface inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field grow">
            <span>Nome do cenário</span>
            <input
              required
              autoFocus
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assistente de suporte"
            />
          </label>
          <button className="button primary">Salvar neste navegador</button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setSaveOpen(false)}
          >
            Cancelar
          </button>
        </form>
      )}

      {enough && (
        <div className="goal-bar">
          <span className="goal-label">Seu objetivo</span>
          <div className="goal-options" role="radiogroup" aria-label="Objetivo">
            {goalOptions.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={goal === value}
                onClick={() => changeGoal(value)}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {enough && (
        <section className="usage-bar" aria-label="Seu uso">
          <div className="goal-bar">
            <span className="goal-label">Seu uso</span>
            <div
              className="goal-options"
              role="radiogroup"
              aria-label="Perfil de uso"
            >
              {usagePresets.map(({ id, label, Icon, usage: u }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={preset?.id === id}
                  onClick={() => setUsage({ ...usage, ...u })}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="usage-summary">
            <p>
              {number(usage.requests)} solicitações/mês ·{" "}
              {number(usage.inputTokens)} tokens de entrada
              {cached ? ` (${cached}% em cache)` : ""} ·{" "}
              {number(usage.outputTokens)} de saída
              {!preset && <span className="muted"> · personalizado</span>}
            </p>
            <button
              type="button"
              className="button ghost"
              aria-expanded={usageOpen}
              aria-controls="usage-fields"
              onClick={() => setUsageOpen(!usageOpen)}
            >
              <SlidersHorizontal size={15} />
              {usageOpen ? "Fechar" : "Ajustar"}
            </button>
          </div>
          {usageOpen && (
            <div className="surface padded fields" id="usage-fields">
              {usageFields.map(([key, label, max]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max={max}
                    step="1"
                    value={usage[key] ?? 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setUsage({
                        ...usage,
                        [key]: Number.isFinite(n)
                          ? Math.min(max, Math.max(0, n))
                          : 0,
                      });
                    }}
                  />
                </label>
              ))}
              <p className="footnote usage-note">
                Perfis são exemplos de tokens por solicitação; ajuste aos seus
                números. O cache usa o preço de leitura em cache de cada modelo.
              </p>
            </div>
          )}
        </section>
      )}
      {enough && (
        <section className="verdict-strip" aria-live="polite">
          {best ? (
            <>
              <ProviderLogo
                provider={best.provider}
                name={best.providerName}
                size={52}
              />
              <div className="verdict-text">
                <span className="verdict-label">
                  <BadgeCheck size={15} />
                  {balanced.best.length > 1
                    ? "Melhores escolhas · empate"
                    : "Melhor escolha"}{" "}
                  · {goalOptions.find(([g]) => g === goal)![1]}
                </span>
                <h2>{balanced.best.map((m) => m.name).join(" e ")}</h2>
                <p>{explain()}</p>
              </div>
              <div className="verdict-figures">
                <strong>{usd(cost(best))}</strong>
                <small>por mês no seu uso</small>
              </div>
            </>
          ) : (
            <div className="verdict-text">
              <span className="verdict-label">
                <Info size={15} /> Sem recomendação
              </span>
              <h2>Nenhum modelo tem índice de inteligência.</h2>
              <p>
                Compare pelo preço ou adicione modelos avaliados pelo Epoch AI.
              </p>
            </div>
          )}
        </section>
      )}

      {!loaded ? (
        <p className="empty" role="status">
          Carregando…
        </p>
      ) : (
        <div ref={cardsRef}>
          <Carousel
            label="Modelos comparados, do melhor para o pior"
            focusKey={focus}
            resetKey={goal}
            items={[
              ...chosen.map((m) => ({ key: m.id, node: card(m) })),
              ...(chosen.length < maxModels
                ? [
                    {
                      key: "__add",
                      node: (
                        <button
                          className="model-card add-card"
                          onClick={() => setPicker({ kind: "add" })}
                        >
                          <span className="add-icon">
                            <Plus size={22} />
                          </span>
                          <strong>Adicionar modelo</strong>
                          <small>
                            {chosen.length < 2
                              ? `Escolha ${chosen.length ? "mais um" : "dois modelos"} para comparar`
                              : `${chosen.length} de ${maxModels}`}
                          </small>
                          <kbd>Ctrl K</kbd>
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
      {enough && (
        <p className="footnote">
          Inteligência: Epoch Capabilities Index (ECI). {goalRules[goal]}
          <Link className="link" href="/methodology">
            Como calculamos
          </Link>
        </p>
      )}

      {enough && (
        <>
          <section className="block">
            <div className="block-head">
              <h2>Custo × inteligência</h2>
              <p>
                Custo mensal no seu uso e ECI. Mais acima e à esquerda é melhor.
              </p>
            </div>
            <div className="surface padded chart">
              {chartPoints.length && chartPoints.every((p) => p.cost > 0) ? (
                <>
                  <ul className="chart-legend">
                    <li>
                      <i className="dot" /> Modelo
                    </li>
                    <li>
                      <i className="dot is-top" /> Recomendado
                    </li>
                    {goal === "value" && best && (
                      <li>
                        <i className="dash" /> Mesmo custo-benefício do
                        recomendado
                      </li>
                    )}
                  </ul>
                  <CostChart
                    points={chartPoints}
                    emphasis={hovered}
                    onPick={showCard}
                    highlight={chartHighlight}
                    frontier={
                      goal === "value"
                        ? chartPoints.find((p) => p.id === best?.id)
                        : undefined
                    }
                  />
                </>
              ) : (
                <p className="chart-empty">
                  {chartPoints.length
                    ? "Informe um volume de uso para comparar custos."
                    : "Nenhum modelo selecionado tem ECI."}
                </p>
              )}
              {balanced.unrated.length > 0 && (
                <p className="chart-note">
                  Sem ECI, fora do gráfico:{" "}
                  {balanced.unrated.map((m) => m.name).join(", ")}.
                </p>
              )}
            </div>
          </section>
          <section className="block">
            <div className="block-head row">
              <div>
                <h2>Custo mensal</h2>
                <p>
                  Preço oficial da API, do mais barato ao mais caro
                  {cached ? `, com ${cached}% da entrada em cache` : ""}. Sem
                  batch ou impostos.
                </p>
              </div>
              <label className="field inline">
                <span>Comparar com</span>
                <select
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                >
                  {chosen.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="surface padded">
              <ul className="cost-list">
                {byCost.map((m) => {
                  const c = cost(m);
                  return (
                    <li key={m.id}>
                      <ProviderLogo
                        provider={m.provider}
                        name={m.providerName}
                        size={32}
                      />
                      <span className="cost-main">
                        <span className="cost-name">
                          {m.name}
                          {m.id === reference && (
                            <span className="tag">Referência</span>
                          )}
                        </span>
                        <span className="cost-bar">
                          <span
                            style={{
                              width: `${maxCost ? Math.max(1, (c / maxCost) * 100) : 0}%`,
                            }}
                          />
                        </span>
                      </span>
                      <span className="cost-figures">
                        <strong className="cost-value">{usd(c)}</strong>
                        <span
                          className={`cost-delta ${referenceCost !== null && c < referenceCost ? "good-text" : ""}`}
                        >
                          {m.id === reference || referenceCost === null
                            ? "/ mês"
                            : c === referenceCost
                              ? "Mesmo custo"
                              : `${c < referenceCost ? "−" : "+"}${usd(Math.abs(c - referenceCost))}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
          <section className="block">
            <div className="block-head row">
              <div>
                <h2>Detalhes</h2>
                <p>Benchmarks, capacidades e datas.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={differences}
                  onChange={(e) => setDifferences(e.target.checked)}
                />
                Só diferenças
              </label>
            </div>
            <div className="surface details-table">
              {/* Visual copy of the header: sticks to the viewport and follows
                  the body's horizontal scroll. The real <thead> stays for
                  assistive technology. */}
              <div className="sticky-head" ref={headRef} aria-hidden="true">
                <table
                  className="data-table comparison-table"
                  style={tableStyle}
                >
                  {columns}
                  <thead>
                    <tr>
                      <th />
                      {chosen.map((m) => (
                        <th key={m.id}>
                          <div className="model-head">
                            <ProviderLogo
                              provider={m.provider}
                              name={m.providerName}
                              size={28}
                            />
                            <span className="model-head-name">
                              {m.name}
                              <small>{m.providerName}</small>
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
              <div
                className="table-scroll"
                onScroll={(e) => {
                  if (headRef.current)
                    headRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }}
              >
                <table
                  className="data-table comparison-table"
                  style={tableStyle}
                >
                  {columns}
                  <thead className="head-hidden">
                    <tr>
                      <th>Característica</th>
                      {chosen.map((m) => (
                        <th key={m.id}>{m.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group("Preço · USD / 1M tokens", CircleDollarSign)}
                    {row(
                      "Entrada",
                      "in",
                      chosen.map((m) => m.price.input),
                      { best: true, higher: false, format: formatPrice },
                    )}
                    {row(
                      "Saída",
                      "out",
                      chosen.map((m) => m.price.output),
                      { best: true, higher: false, format: formatPrice },
                    )}
                    {row(
                      "Entrada em cache",
                      "cache",
                      chosen.map((m) => m.price.cacheRead),
                      { best: true, higher: false, format: formatPrice },
                    )}
                    {group("Inteligência · Epoch AI", Gauge)}
                    {row(
                      "ECI",
                      "eci",
                      chosen.map((m) => m.intelligence?.value ?? null),
                      {
                        best: true,
                        format: (n) => number(Math.round(n * 10) / 10),
                      },
                    )}
                    {row(
                      "Intervalo de confiança",
                      "ci",
                      chosen.map((m) =>
                        m.intelligence
                          ? `${Math.round(m.intelligence.low)}–${Math.round(m.intelligence.high)}`
                          : null,
                      ),
                    )}
                    {group("Benchmarks por tarefa · % de acerto", Target)}
                    {tasks.map((x) => {
                      const xb = benchmarkFor(x);
                      return row(
                        <span className="task-label">
                          {x.label}
                          <small>{xb.name}</small>
                        </span>,
                        x.id,
                        chosen.map((m) => m.scores[xb.id] ?? null),
                        { best: true, format: (n) => `${number(n)}%` },
                      );
                    })}
                    {group("Capacidades", Cpu)}
                    {row(
                      "Contexto",
                      "context",
                      chosen.map((m) => m.context),
                      { best: true, format: formatContext },
                    )}
                    {row(
                      "Saída máxima",
                      "max-output",
                      chosen.map((m) => m.maxOutput),
                      { best: true, format: formatContext },
                    )}
                    {row(
                      "Entende",
                      "modalities",
                      chosen.map((m) =>
                        m.inputModalities
                          .map((x) => modalities[x] ?? x)
                          .join(", "),
                      ),
                    )}
                    {row(
                      "Raciocínio",
                      "reasoning",
                      chosen.map((m) => yesNo(m.reasoning)),
                    )}
                    {row(
                      "Ferramentas",
                      "tools",
                      chosen.map((m) => yesNo(m.toolCall)),
                    )}
                    {row(
                      "Pesos abertos",
                      "open",
                      chosen.map((m) => yesNo(m.openWeights)),
                    )}
                    {group("Datas", CalendarDays)}
                    {row(
                      "Lançamento",
                      "release",
                      chosen.map((m) => formatMonth(m.releaseDate)),
                    )}
                    {row(
                      "Conhecimento até",
                      "knowledge",
                      chosen.map((m) =>
                        m.knowledge ? formatMonth(m.knowledge) : null,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="footnote">
              — indica dado não publicado pela fonte. Benchmarks na configuração
              reportada pelo Epoch AI.
            </p>
          </section>
          <section className="block">
            <div className="block-head">
              <h2>
                Por tarefa <span className="tag accent">Pro · prévia</span>
              </h2>
              <p>
                Escolha o tipo de trabalho e a nota mínima. Indicamos o mais
                barato que a atinge.
              </p>
            </div>
            <div className="task-grid" role="radiogroup" aria-label="Tarefa">
              {tasks.map((x) => {
                const Icon = taskIcons[x.id] ?? Target;
                const xb = benchmarkFor(x);
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={t.id === x.id}
                    className="task-option"
                    onClick={() => {
                      setTask(x.id);
                      setBenchmark(null);
                    }}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    <span>
                      {x.label}
                      <small>
                        {xb.name} · {coverage(xb.id)}/{chosen.length} com dados
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="recommend-grid">
              <div className="surface padded fields-stack">
                {t.benchmarks.length > 1 && (
                  <label className="field">
                    <span>Benchmark</span>
                    <select
                      value={b.id}
                      onChange={(e) => setBenchmark(e.target.value)}
                    >
                      {t.benchmarks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} · {coverage(x.id)}/{chosen.length} com dados
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="muted small">{b.description}</p>
                <label className="field">
                  <span>Nota mínima (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minimum}
                    onChange={(e) =>
                      setMinimum(
                        Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                  />
                </label>
                <input
                  type="range"
                  className="range"
                  min={0}
                  max={100}
                  value={minimum}
                  aria-label="Nota mínima"
                  onChange={(e) => setMinimum(Number(e.target.value))}
                />
                <ul className="score-list">
                  {taskRec.participants.map((p) => (
                    <li key={p.model.id}>
                      <span className="score-name">{p.model.name}</span>
                      <span className="score-track">
                        {p.score !== null && (
                          <span
                            className={p.score >= minimum ? "" : "below"}
                            style={{ width: `${p.score}%` }}
                          />
                        )}
                        <i style={{ left: `${minimum}%` }} />
                      </span>
                      <span className="score-value">
                        {p.score === null ? "—" : `${number(p.score)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={`verdict ${taskRec.winners.length ? "" : "is-empty"}`}
              >
                {taskRec.winners.length ? (
                  <>
                    <span className="verdict-label">
                      <BadgeCheck size={16} />
                      {taskRec.winners.length > 1
                        ? "Empate em custo"
                        : `Recomendado · ${t.label}`}
                    </span>
                    <h3>
                      {taskRec.winners.map((w) => w.model.name).join(" e ")}{" "}
                      <span>{usd(taskRec.winners[0].cost)} / mês</span>
                    </h3>
                    <p>
                      {taskRec.winners
                        .map((w) => `${number(w.score!)}%`)
                        .join(" e ")}{" "}
                      em {b.name}, mínimo {minimum}%.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="verdict-label">
                      <Info size={16} /> Sem recomendação
                    </span>
                    <h3>Nenhum modelo atinge o mínimo.</h3>
                    <p>
                      Reduza a nota mínima ou adicione modelos. Sem dado não
                      conta como zero.
                    </p>
                  </>
                )}
                <Link
                  className="verdict-link"
                  href={`/pro?scenario=${encodeURIComponent(alertScenario)}&usage=${t.id}`}
                >
                  Avise quando houver uma opção melhor
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
      {picker && (
        <ModelPicker
          mode={picker}
          selected={ids}
          onSelect={pick}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
