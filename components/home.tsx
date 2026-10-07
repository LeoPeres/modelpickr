"use client";
import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bookmark,
  Brain,
  Check,
  Coins,
  Scale,
  Sparkles,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import type { CatalogModel } from "@/lib/catalog/types";
import {
  defaultUsage,
  monthlyCost,
  rankModels,
  recommend,
  type Goal,
} from "@/lib/engine";
import { formatDate, formatNumber, formatUsd } from "@/lib/i18n";
import Catalog from "./catalog";
import { HeroChart } from "./hero-chart";
import { ProviderLogo } from "./provider-logo";
import { useCatalog, useSelection } from "./shell";

type Tone = "accent" | "intel" | "good" | "gold";
type Preset = {
  title: string;
  text: string;
  Icon: LucideIcon;
  tone: Tone;
  goal: Goal;
  models: CatalogModel[];
};
const presetSize = 4;
const compareUrl = (models: CatalogModel[], goal: Goal) =>
  `/compare?models=${models.map((m) => m.id).join(",")}&goal=${goal}`;

export default function Home() {
  const { catalog } = useCatalog();
  const { selected, toggle } = useSelection();
  const data = useMemo(() => {
    const rated = catalog.models.filter((m) => m.intelligence);
    const ranked = (goal: Goal) =>
      rankModels(rated, defaultUsage, goal).map((r) => r.model);
    const smartest = ranked("intelligence");
    const value = ranked("value");
    const cheap = ranked("cost");
    const presets: Preset[] = [
      {
        title: "Melhor custo-benefício",
        text: "Mais inteligência por dólar gasto.",
        Icon: Scale,
        tone: "accent",
        goal: "value",
        models: value.slice(0, presetSize),
      },
      {
        title: "Mais inteligentes",
        text: "O topo do Epoch Capabilities Index.",
        Icon: Brain,
        tone: "intel",
        goal: "intelligence",
        models: [...rated]
          .sort((a, b) => b.intelligence!.value - a.intelligence!.value)
          .slice(0, presetSize),
      },
      {
        title: "Mais baratos",
        text: "Os menores preços entre os avaliados.",
        Icon: Coins,
        tone: "good",
        goal: "cost",
        models: cheap.slice(0, presetSize),
      },
      {
        title: "Pesos abertos",
        text: "Os melhores que você também pode hospedar.",
        Icon: Unlock,
        tone: "gold",
        goal: "value",
        models: smartest.filter((m) => m.openWeights).slice(0, presetSize),
      },
    ].filter((p) => p.models.length >= 2) as Preset[];
    const example = presets[0];
    const verdict = example
      ? recommend(example.models, defaultUsage, "value").best[0]
      : undefined;
    return {
      rated,
      providers: new Set(catalog.models.map((m) => m.provider)).size,
      marks: [
        value[0] && {
          model: value[0],
          label: "Custo-benefício",
          tone: "accent" as const,
        },
        smartest[0] &&
          smartest[0] !== value[0] && {
            model: smartest[0],
            label: "Mais inteligente",
            tone: "intel" as const,
          },
        cheap[0] &&
          cheap[0] !== value[0] && {
            model: cheap[0],
            label: "Mais barato",
            tone: "good" as const,
          },
      ].filter((m) => !!m),
      frontier: value[0] as CatalogModel | undefined,
      presets,
      example,
      verdict,
    };
  }, [catalog]);
  const exampleUrl = data.example
    ? compareUrl(data.example.models, data.example.goal)
    : "/compare";

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-copy">
          <Link href="/methodology" className="hero-eyebrow">
            <span className="live-dot" aria-hidden="true" />
            {catalog.live ? "Atualizado em" : "Cópia de"}{" "}
            {formatDate(catalog.generatedAt)} · models.dev e Epoch AI
          </Link>
          <h1 id="hero-title">
            O modelo certo, <em>pelo preço certo.</em>
          </h1>
          <p className="hero-lede">
            Preço e inteligência de {catalog.models.length} modelos das
            principais APIs, lado a lado. Dados públicos, nunca estimados.
          </p>
          <div className="actions">
            <a
              className="button primary large"
              href="#modelos"
              onClick={(e) => {
                e.preventDefault();
                const smooth = !matchMedia("(prefers-reduced-motion: reduce)")
                  .matches;
                document
                  .getElementById("modelos")
                  ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
              }}
            >
              Explorar modelos <ArrowDown size={16} />
            </a>
            <Link className="button large" href={exampleUrl}>
              Ver um exemplo <ArrowRight size={16} />
            </Link>
          </div>
          <dl className="hero-stats">
            <div>
              <dt>Modelos</dt>
              <dd>{formatNumber(catalog.models.length)}</dd>
            </div>
            <div>
              <dt>Empresas</dt>
              <dd>{formatNumber(data.providers)}</dd>
            </div>
            <div>
              <dt>Com ECI</dt>
              <dd>{formatNumber(data.rated.length)}</dd>
            </div>
          </dl>
        </div>
        <figure className="hero-visual surface">
          <figcaption>
            <span>
              <strong>Custo × inteligência</strong>
              <small>Toque num ponto para selecionar</small>
            </span>
            <span className="hero-legend" aria-hidden="true">
              <i className="dash" /> Mesmo custo-benefício
            </span>
          </figcaption>
          <HeroChart
            models={data.rated}
            marks={data.marks}
            frontier={data.frontier}
            selected={selected}
            onToggle={toggle}
          />
          <p className="hero-axis-note">
            Preço médio por 1M tokens (escala log) · Epoch Capabilities Index
          </p>
        </figure>
      </section>

      <section className="block" aria-labelledby="how-title">
        <div className="block-head">
          <h2 id="how-title">Como funciona</h2>
          <p>Três passos até a decisão.</p>
        </div>
        <ol className="steps">
          <li className="step surface">
            <span className="step-number">1</span>
            <h3>Selecione</h3>
            <p>Marque de 2 a 10 modelos na lista ou no gráfico.</p>
            <div className="step-demo" aria-hidden="true">
              {data.example?.models.slice(0, 3).map((m, i) => (
                <span key={m.id} className="demo-row">
                  <span className={`demo-check ${i < 2 ? "is-on" : ""}`}>
                    {i < 2 && <Check size={11} strokeWidth={3} />}
                  </span>
                  <ProviderLogo
                    provider={m.provider}
                    name={m.providerName}
                    size={22}
                  />
                  {m.name}
                </span>
              ))}
            </div>
          </li>
          <li className="step surface">
            <span className="step-number">2</span>
            <h3>Diga o que importa</h3>
            <p>Escolha o objetivo e o perfil de uso: chat, RAG, agente…</p>
            <div className="step-demo" aria-hidden="true">
              <span className="demo-chips">
                <span className="is-on">Custo-benefício</span>
                <span>Inteligência</span>
                <span>Custo</span>
              </span>
              <span className="demo-chips soft">
                <span className="is-on">Chat</span>
                <span>RAG</span>
                <span>Agente</span>
              </span>
            </div>
          </li>
          <li className="step surface">
            <span className="step-number">3</span>
            <h3>Decida</h3>
            <p>Veja a recomendação, o custo mensal e salve o cenário.</p>
            {data.verdict && (
              <Link href={exampleUrl} className="step-demo demo-verdict">
                <ProviderLogo
                  provider={data.verdict.provider}
                  name={data.verdict.providerName}
                  size={30}
                />
                <span>
                  <small>Melhor escolha</small>
                  <strong>{data.verdict.name}</strong>
                </span>
                <span className="demo-cost">
                  {formatUsd(monthlyCost(defaultUsage, data.verdict.price))}
                  <small>/mês</small>
                </span>
              </Link>
            )}
          </li>
        </ol>
        <ul className="also">
          <li>
            <Link href="/scenarios">
              <Bookmark size={16} />
              <span>
                <strong>Cenários</strong> salvos neste navegador para retomar
                depois.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/methodology">
              <BookOpen size={16} />
              <span>
                <strong>Metodologia</strong> aberta: fórmulas, fontes e limites.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/pro">
              <Sparkles size={16} />
              <span>
                <strong>Pro</strong>, em preparação: alertas quando vale trocar
                de modelo.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      {data.presets.length > 0 && (
        <section className="block" aria-labelledby="presets-title">
          <div className="block-head">
            <h2 id="presets-title">Comece por aqui</h2>
            <p>Comparações prontas, montadas com os dados de hoje.</p>
          </div>
          <div className="presets">
            {data.presets.map(({ title, text, Icon, tone, goal, models }) => (
              <Link
                key={title}
                href={compareUrl(models, goal)}
                className={`preset surface tone-${tone}`}
              >
                <span className="preset-head">
                  <span className="icon-tile">
                    <Icon size={18} />
                  </span>
                  <ArrowRight className="preset-arrow" size={18} />
                </span>
                <span className="preset-title">{title}</span>
                <span className="preset-text">{text}</span>
                <span className="preset-models">
                  <span className="avatar-stack">
                    {models.map((m) => (
                      <ProviderLogo
                        key={m.id}
                        provider={m.provider}
                        name={m.providerName}
                        size={26}
                      />
                    ))}
                  </span>
                  <small>{models.map((m) => m.name).join(", ")}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="modelos" className="block" aria-labelledby="catalog-title">
        <Catalog />
      </section>
    </>
  );
}
