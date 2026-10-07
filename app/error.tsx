"use client";
import { TriangleAlert } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="surface empty compact" role="alert">
      <TriangleAlert size={28} strokeWidth={1.5} />
      <h1>Algo deu errado.</h1>
      <p>Seus cenários locais continuam salvos.</p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
