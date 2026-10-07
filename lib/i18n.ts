// Locale layer: stable IDs stay independent of displayed text.
export const locale = "pt-BR";
export const messages = {
  brand: "ModelPickr",
  slogan: "Compare modelos. Escolha melhor.",
  sources: "Dados: models.dev e Epoch AI",
  navigation: {
    catalog: "Modelos",
    compare: "Comparar",
    scenarios: "Cenários",
    methodology: "Metodologia",
    pro: "Pro",
  },
  theme: { light: "Ativar tema claro", dark: "Ativar tema escuro" },
  common: {
    missing: "Não disponível",
    save: "Salvar cenário",
    remove: "Remover",
    cancel: "Cancelar",
  },
} as const;
export const formatNumber = (n: number) =>
  new Intl.NumberFormat(locale).format(n);
export const formatUsd = (n: number) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
/** Axis-sized amounts: "US$ 50", "US$ 1,5 mil". */
export const formatUsdShort = (n: number) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
    new Date(value),
  );
export const formatContext = (n: number | null) =>
  n === null
    ? "—"
    : n >= 1000000
      ? `${formatNumber(Math.round(n / 100000) / 10)}M`
      : `${Math.round(n / 1000)}k`;
/** Per-token prices can be fractions of a cent; keep them readable. */
export const formatPrice = (n: number) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.1 ? 3 : 2,
  }).format(n);
export const formatMonth = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" })
        .format(new Date(`${value.slice(0, 7)}-15T12:00:00Z`))
        .replace(".", "")
    : "—";
