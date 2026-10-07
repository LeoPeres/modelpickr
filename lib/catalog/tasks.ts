// Task → benchmark mapping for the advanced comparison. A task offers one or
// more Epoch AI benchmarks and uses exactly one at a time, so scores are never
// mixed across benchmarks.
export type Benchmark = {
  /** Key of `CatalogModel.scores`. */
  id: string;
  name: string;
  /** Benchmark name exactly as it appears in Epoch AI's data. */
  epochName: string;
  description: string;
};
export type Task = {
  id: string;
  label: string;
  /** The first one is the historical default (older scenarios use it). */
  benchmarks: Benchmark[];
};
export const tasks: Task[] = [
  {
    id: "science",
    label: "Raciocínio científico",
    benchmarks: [
      {
        id: "gpqa-diamond",
        name: "GPQA Diamond",
        epochName: "GPQA diamond",
        description: "Questões de pós-graduação em biologia, física e química.",
      },
      {
        id: "hle",
        name: "Humanity's Last Exam",
        epochName: "HLE",
        description: "Questões de especialistas em dezenas de áreas.",
      },
    ],
  },
  {
    id: "math",
    label: "Matemática",
    benchmarks: [
      {
        id: "otis-aime",
        name: "OTIS Mock AIME 2024–2025",
        epochName: "OTIS Mock AIME 2024-2025",
        description: "Problemas de olimpíada no estilo AIME.",
      },
    ],
  },
  {
    id: "math-advanced",
    label: "Matemática avançada",
    benchmarks: [
      {
        id: "frontiermath",
        name: "FrontierMath 1–3",
        epochName: "FrontierMath-Tiers-1-3-v2-Private",
        description: "Problemas inéditos de matemática de pesquisa.",
      },
      {
        id: "frontiermath-t4",
        name: "FrontierMath 4",
        epochName: "FrontierMath-Tier-4-v2-Private",
        description: "O nível mais difícil do FrontierMath.",
      },
      {
        id: "proofbench",
        name: "ProofBench",
        epochName: "ProofBench",
        description: "Demonstrações avançadas verificadas formalmente.",
      },
    ],
  },
  {
    id: "software",
    label: "Engenharia de software",
    benchmarks: [
      {
        id: "swe-bench-verified",
        name: "SWE-bench Verified",
        epochName: "SWE-Bench verified",
        description: "Correção de issues reais em repositórios Python.",
      },
      {
        id: "frontiercode",
        name: "FrontierCode",
        epochName: "FrontierCode",
        description:
          "Tarefas criadas por mantenedores de código aberto; conta se o PR seria aceito.",
      },
      {
        id: "deepswe",
        name: "DeepSWE",
        epochName: "DeepSWE",
        description: "Tarefas longas de engenharia de software para agentes.",
      },
      {
        id: "frontierswe",
        name: "FrontierSWE",
        epochName: "FrontierSWE",
        description: "Desafios de engenharia no limite da capacidade humana.",
      },
      {
        id: "aider-polyglot",
        name: "Aider Polyglot",
        epochName: "Aider polyglot",
        description: "Exercícios de programação em seis linguagens.",
      },
    ],
  },
  {
    id: "ml-code",
    label: "Código de ML",
    benchmarks: [
      {
        id: "weirdml",
        name: "WeirdML",
        epochName: "WeirdML",
        description: "Tarefas de aprendizado de máquina resolvidas com código.",
      },
    ],
  },
  {
    id: "agents",
    label: "Agentes",
    benchmarks: [
      {
        id: "terminal-bench",
        name: "Terminal-Bench",
        epochName: "Terminal Bench",
        description: "Tarefas de várias etapas executadas em um terminal.",
      },
      {
        id: "apex-agents",
        name: "APEX-Agents",
        epochName: "APEX-Agents",
        description:
          "Tarefas profissionais longas; só passa se cumprir todos os critérios.",
      },
    ],
  },
  {
    id: "facts",
    label: "Conhecimento factual",
    benchmarks: [
      {
        id: "simpleqa-verified",
        name: "SimpleQA Verified",
        epochName: "SimpleQA Verified",
        description: "Perguntas factuais curtas, sem consulta à web.",
      },
    ],
  },
  {
    id: "abstract",
    label: "Raciocínio abstrato",
    benchmarks: [
      {
        id: "arc-agi-2",
        name: "ARC-AGI-2",
        epochName: "ARC-AGI-2",
        description: "Quebra-cabeças visuais de generalização.",
      },
      {
        id: "arc-agi",
        name: "ARC-AGI-1",
        epochName: "ARC-AGI",
        description: "A primeira versão, mais fácil, dos quebra-cabeças ARC.",
      },
    ],
  },
];
export const benchmarks = tasks.flatMap((t) => t.benchmarks);
export const taskById = (id: string) => tasks.find((t) => t.id === id);
/** The task's benchmark with this id, or its first one. */
export function benchmarkOf(task: Task, id?: string | null) {
  return task.benchmarks.find((b) => b.id === id) ?? task.benchmarks[0];
}
/**
 * Benchmark shown when the user has not picked one: the one with scores for
 * the most models; ties keep the list order.
 */
export function defaultBenchmark(
  task: Task,
  models: { scores: Record<string, number> }[],
) {
  const covered = (b: Benchmark) =>
    models.filter((m) => m.scores[b.id] !== undefined).length;
  return task.benchmarks.reduce((best, b) =>
    covered(b) > covered(best) ? b : best,
  );
}
