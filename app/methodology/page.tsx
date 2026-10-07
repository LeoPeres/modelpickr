import {
  Calculator,
  Database,
  Gauge,
  Info,
  Scale,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { sources } from "@/lib/catalog/build";
import { tasks } from "@/lib/catalog/tasks";
import { pointsPerDoubling } from "@/lib/engine";
function Heading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: string;
}) {
  return (
    <h2 className="section-title">
      <span className="icon-tile">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      {children}
    </h2>
  );
}
export default function Page() {
  return (
    <>
      <header className="page-head">
        <h1>Metodologia</h1>
        <p>De onde vêm os dados e como decidimos.</p>
      </header>
      <div className="notice">
        <Info size={16} />
        Dados públicos e gratuitos, atualizados uma vez por dia. Teste no seu
        próprio caso antes de trocar de modelo.
      </div>
      <div className="prose">
        <section>
          <Heading icon={Database}>Fontes</Heading>
          <dl className="definition-list">
            {sources.map((s) => (
              <div key={s.name}>
                <dt>
                  <a
                    className="link"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.name}
                  </a>{" "}
                  <span className="muted">· {s.license}</span>
                </dt>
                <dd>
                  {s.name === "models.dev"
                    ? "Preços oficiais de API, contexto, capacidades, datas e logos das empresas."
                    : "Epoch Capabilities Index (ECI) e resultados de benchmarks."}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Usamos só o preço da própria empresa que faz o modelo, não de
            revendedores. Modelos são ligados ao Epoch AI pelo nome; quando não
            há correspondência, a inteligência aparece como —, nunca como zero.
          </p>
        </section>
        <section>
          <Heading icon={Gauge}>Inteligência</Heading>
          <p>
            O ECI, do Epoch AI, combina dezenas de benchmarks em uma escala
            única e publica um intervalo de confiança para cada modelo. Quanto
            maior, mais capaz. A posição (#) é o ranking dentro do nosso
            catálogo.
          </p>
        </section>
        <section>
          <Heading icon={Scale}>Melhor escolha</Heading>
          <p>Você escolhe o objetivo, e a regra muda junto:</p>
          <dl className="definition-list">
            <div>
              <dt>Custo-benefício</dt>
              <dd>
                Dobrar o custo só compensa se render {pointsPerDoubling} ou mais
                pontos de ECI, perto da margem de erro do índice. Vence a maior
                pontuação ECI − {pointsPerDoubling} × log₂(custo). O volume de
                uso não muda o vencedor, só a proporção entre entrada e saída.
              </dd>
            </div>
            <div>
              <dt>Inteligência máxima</dt>
              <dd>
                Achamos o mais inteligente. Quem tem intervalo de confiança que
                alcança o dele está tecnicamente empatado; desses, indicamos o
                mais barato.
              </dd>
            </div>
            <div>
              <dt>Menor custo</dt>
              <dd>
                O mais barato entre os modelos com índice de inteligência.
              </dd>
            </div>
          </dl>
          <p>Modelos sem ECI não são recomendados. Empates aparecem juntos.</p>
        </section>
        <section>
          <Heading icon={Target}>Por tarefa</Heading>
          <p>
            Cada tarefa usa um único benchmark, sem misturar escalas. Indicamos
            o mais barato que atinge a nota mínima escolhida; quem não tem
            resultado fica de fora.
          </p>
          <dl className="definition-list">
            {tasks.map((t) => (
              <div key={t.id}>
                <dt>
                  {t.label} <span className="muted">· {t.benchmark}</span>
                </dt>
                <dd>{t.description}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <Heading icon={Calculator}>Custo</Heading>
          <p className="formula">
            solicitações × (entrada × preço de entrada + saída × preço de saída)
            ÷ 1.000.000
          </p>
          <p>
            Preços em USD por milhão de tokens. Se você informar uma parte da
            entrada em cache, ela é cobrada pelo preço de leitura em cache; quem
            não publica esse preço paga o de entrada. Não incluímos escrita em
            cache, batch, faixas de contexto longo, impostos ou descontos.
          </p>
        </section>
        <section>
          <Heading icon={ShieldCheck}>Independência</Heading>
          <p>
            A comparação é gratuita. Não recebemos de nenhuma empresa listada, e
            patrocínios futuros serão identificados e separados das
            recomendações.
          </p>
        </section>
      </div>
    </>
  );
}
