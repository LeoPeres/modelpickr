import { Suspense } from "react";
import Pro from "@/components/pro";
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="empty" role="status">
          Carregando…
        </p>
      }
    >
      <Pro />
    </Suspense>
  );
}
