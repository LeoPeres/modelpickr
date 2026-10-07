import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound() {
  return (
    <div className="surface empty compact">
      <Compass size={28} strokeWidth={1.5} />
      <h1>Página não encontrada.</h1>
      <Link className="button primary" href="/">
        Ver modelos
      </Link>
    </div>
  );
}
