import { initials } from "./format";

// Avatar de iniciales con tinte pálido propio (identidad, no dato).
// Los tonos de las personas del equipo están a ≥60° entre sí (skill app-screens).
export function Avatar({
  name,
  hue,
  size = 32,
}: {
  name: string;
  hue: number;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 42% 90%)`,
        color: `hsl(${hue} 45% 28%)`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
