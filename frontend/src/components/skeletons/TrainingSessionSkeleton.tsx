import { Skeleton } from '@/components/ui/skeleton'

/** Silueta de la sesión en foco: franja «Orden de hoy», media, series, steppers,
 *  RPE y CTA. Sustituye el spinner para que el salto al contenido real sea mínimo. */
export function TrainingSessionSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-busy="true"
      aria-label="Preparando tu entrenamiento"
    >
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-48 max-w-full" />
          </div>
          <Skeleton className="size-4 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-xl" />

          <div className="space-y-2">
            <Skeleton className="h-7 w-3/4 max-w-72" />
            <Skeleton className="h-3.5 w-40" />
          </div>

          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="size-9 rounded-lg" />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((col) => (
              <div key={col} className="space-y-1.5">
                <Skeleton className="h-3.5 w-10" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 flex-1 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-3 w-44" />
          </div>

          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
