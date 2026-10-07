import {
  type Scenario,
  isGoal,
  validUsage,
  selectionFromUrl,
  maxModels,
} from "./engine";
import { taskById } from "./catalog/tasks";
export const keys = {
  selection: "modelmatch:selection",
  scenarios: "modelmatch:scenarios",
  interest: "modelmatch:interest",
};
export function readLocal<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
}
export function validScenario(s: unknown, knownIds: string[]): s is Scenario {
  if (!s || typeof s !== "object") return false;
  const v = s as Scenario;
  const known = new Set(knownIds);
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Array.isArray(v.models) &&
    v.models.length >= 2 &&
    v.models.length <= maxModels &&
    v.models.every((id) => known.has(id)) &&
    validUsage({
      requests: v.requests,
      inputTokens: v.inputTokens,
      outputTokens: v.outputTokens,
      cached: v.cached,
    }) &&
    Boolean(taskById(v.task)) &&
    Number.isFinite(v.minimum) &&
    v.minimum >= 0 &&
    v.minimum <= 100 &&
    v.models.includes(v.reference) &&
    (v.goal === undefined || isGoal(v.goal)) &&
    typeof v.createdAt === "string"
  );
}
/** Scenarios referencing models no longer in the catalog are dropped. */
export function readScenarios(knownIds: string[]) {
  const raw = readLocal<unknown>(keys.scenarios, []);
  if (!Array.isArray(raw)) throw new Error("Formato de cenários inválido.");
  return raw.filter((s): s is Scenario => validScenario(s, knownIds));
}
export function readSelection(knownIds: string[]) {
  const raw = readLocal<unknown>(keys.selection, []);
  return Array.isArray(raw)
    ? selectionFromUrl(
        raw.filter((v) => typeof v === "string").join(","),
        knownIds,
      )
    : [];
}
export type Interest = {
  email: string;
  usage: string;
  scenario: string;
  consent: boolean;
  createdAt: string;
};
export interface InterestAdapter {
  submit(
    interest: Interest,
  ): Promise<{ mode: "demo" | "sent"; message: string }>;
}
export const demoInterestAdapter: InterestAdapter = {
  async submit(interest) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(interest.email) ||
      !interest.consent ||
      !interest.scenario.trim()
    )
      throw new Error("Confira o e-mail, o cenário e o consentimento.");
    const existing = readLocal<Interest[]>(keys.interest, []);
    localStorage.setItem(
      keys.interest,
      JSON.stringify([...existing.slice(-19), interest]),
    );
    return {
      mode: "demo",
      message:
        "Interesse salvo somente neste navegador. Nenhum cadastro foi enviado e nenhum alerta será disparado.",
    };
  },
};
