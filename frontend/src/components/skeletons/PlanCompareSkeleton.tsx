import { Skeleton } from '@/components/ui/skeleton'

/** Silueta de una tarjeta de Comparar: título, radar, métricas y acciones. */
function PlanCompareCardSkeleton() {
  return (
    <article className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="size-2.5 shrink-0 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-full max-w-[280px]" />

      {/* Radar: círculo + ejes radiales sugieren el gráfico, no un rectángulo. */}
      <div className="relative mx-auto my-3 size-[160px]" aria-hidden>
        <Skeleton className="absolute inset-0 rounded-full opacity-40" />
        <Skeleton className="absolute inset-[18%] rounded-full opacity-55" />
        <Skeleton className="absolute inset-[36%] rounded-full opacity-70" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-[2px] w-full max-w-[120px] rounded-none opacity-30" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-full max-h-[120px] w-[2px] rounded-none opacity-30" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-3/4" />

      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </article>
  )
}

/** Carga de Comparar enfoque: misma estructura que el contenido real. */
export function PlanCompareSkeleton({ cards = 4 }: { cards?: number }) {
  const n = Math.min(Math.max(cards, 2), 6)
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando planes">
      <header>
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="mt-2 h-7 w-48" />
        <Skeleton className="mt-2 h-3.5 w-full max-w-md" />
        <Skeleton className="mt-1.5 h-3.5 w-72 max-w-full" />
      </header>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: n }, (_, i) => (
          <PlanCompareCardSkeleton key={i} />
        ))}
      </section>
    </div>
  )
}
