// Task → benchmark mapping for the advanced comparison. Each task uses exactly
// one Epoch AI benchmark, so scores are never mixed across benchmarks.
export type Task = {
  id: string;
  label: string;
  benchmark: string;
  /** Benchmark name exactly as it appears in Epoch AI's data. */
  epochName: string;
  description: string;
};
export const tasks: Task[] = [
  {
    id: "science",
    label: "Raciocínio científico",
    benchmark: "GPQA Diamond",
    epochName: "GPQA diamond",
    description: "Questões de pós-graduação em biologia, física e química.",
  },
  {
    id: "math",
    label: "Matemática",
    benchmark: "OTIS Mock AIME 2024–2025",
    epochName: "OTIS Mock AIME 2024-2025",
    description: "Problemas de olimpíada no estilo AIME.",
  },
  {
    id: "math-advanced",
    label: "Matemática avançada",
    benchmark: "FrontierMath 1–3",
    epochName: "FrontierMath-Tiers-1-3-v2-Private",
    description: "Problemas inéditos de matemática de pesquisa.",
  },
  {
    id: "software",
    label: "Engenharia de software",
    benchmark: "SWE-bench Verified",
    epochName: "SWE-Bench verified",
    description: "Correção de issues reais em repositórios Python.",
  },
  {
    id: "ml-code",
    label: "Código de ML",
    benchmark: "WeirdML",
    epochName: "WeirdML",
    description: "Tarefas de aprendizado de máquina resolvidas com código.",
  },
  {
    id: "agents",
    label: "Agentes no terminal",
    benchmark: "Terminal-Bench",
    epochName: "Terminal Bench",
    description: "Tarefas de várias etapas executadas em um terminal.",
  },
  {
    id: "facts",
    label: "Conhecimento factual",
    benchmark: "SimpleQA Verified",
    epochName: "SimpleQA Verified",
    description: "Perguntas factuais curtas, sem consulta à web.",
  },
  {
    id: "abstract",
    label: "Raciocínio abstrato",
    benchmark: "ARC-AGI-2",
    epochName: "ARC-AGI-2",
    description: "Quebra-cabeças visuais de generalização.",
  },
];
export const taskById = (id: string) => tasks.find((t) => t.id === id);
