import { providers } from "@/lib/catalog/build";
/** Company mark from models.dev, tinted with the current text color. */
export function ProviderLogo({
  provider,
  name,
  size = 40,
}: {
  provider: string;
  name: string;
  size?: number;
}) {
  const known = providers.includes(provider);
  return (
    <span
      className="provider-logo"
      role="img"
      aria-label={name}
      title={name}
      style={{ width: size, height: size }}
    >
      {known ? (
        <span
          className="provider-mark"
          style={{
            maskImage: `url(/logos/${provider}.svg)`,
            WebkitMaskImage: `url(/logos/${provider}.svg)`,
          }}
        />
      ) : (
        <span style={{ fontSize: size * 0.36 }}>{name.slice(0, 2)}</span>
      )}
    </span>
  );
}
