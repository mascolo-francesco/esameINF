import { ScheletroPagina } from "@/components/scheletro";
import { Skeleton } from "@/components/ui/skeleton";

export default function Caricamento() {
  return (
    <ScheletroPagina>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]" aria-hidden>
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    </ScheletroPagina>
  );
}
