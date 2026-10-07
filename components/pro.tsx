"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  Check,
  Cloud,
  FileDown,
  History,
  Info,
  LineChart,
} from "lucide-react";
import { demoInterestAdapter } from "@/lib/storage";
import { tasks } from "@/lib/catalog/tasks";
const features = [
  [Cloud, "Cenários sincronizados entre dispositivos"],
  [LineChart, "Monitoramento de preços e benchmarks"],
  [BellRing, "Alertas quando uma alternativa atinge seu mínimo por menos"],
  [History, "Histórico de mudanças"],
  [FileDown, "Relatórios exportáveis"],
] as const;
export default function Pro() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [usage, setUsage] = useState(params.get("usage") ?? "general");
  const [scenario, setScenario] = useState(params.get("scenario") ?? "");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const result = await demoInterestAdapter.submit({
        email,
        usage,
        scenario,
        consent,
        createdAt: new Date().toISOString(),
      });
      setStatus(result.message);
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar o interesse localmente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <h1>Pro</h1>
        <p>Saiba quando trocar de modelo para gastar menos.</p>
      </header>
      <div className="pro-layout">
        <div className="surface padded price-card">
          <span className="tag">Em preparação</span>
          <p className="price">
            US$ 9<span>/mês · proposto</span>
          </p>
          <ul className="feature-list">
            {features.map(([Icon, f]) => (
              <li key={f}>
                <Icon size={18} strokeWidth={1.75} />
                {f}
              </li>
            ))}
          </ul>
          <p className="footnote">
            <Check size={14} /> Comparação básica continua gratuita.
          </p>
        </div>
        <form
          className="surface padded stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>
            {params.get("scenario")
              ? "Avise quando houver uma opção melhor"
              : "Quero acesso"}
          </h2>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </label>
          <label className="field">
            <span>Tipo de uso</span>
            <select value={usage} onChange={(e) => setUsage(e.target.value)}>
              <option value="general">Geral</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Cenário desejado</span>
            <textarea
              required
              maxLength={2000}
              rows={4}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Modelos que usa, qualidade e custo que busca"
            />
          </label>
          <label className="check">
            <input
              required
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Aceito receber atualizações quando o serviço existir.
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Salvando…" : "Registrar interesse"}
            <ArrowRight size={16} />
          </button>
          {status && (
            <p role="status" className="notice">
              <Info size={16} />
              {status}
            </p>
          )}
          <p className="footnote">
            Demonstração: salvo só neste navegador. Nada é enviado.
          </p>
        </form>
      </div>
    </>
  );
}
