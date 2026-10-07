import { Suspense } from "react";
import Comparison from "@/components/comparison";
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="empty" role="status">
          Carregando…
        </p>
      }
    >
      <Comparison />
    </Suspense>
  );
}
