import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Una tarjeta del historial: foto a la izquierda y las seis métricas a la
 *  derecha, con la misma altura fija que usa `MetricCard`. */
export function MedicionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] md:grid-cols-[10rem_minmax(0,1fr)] md:gap-x-4">
          <Skeleton className="h-[13rem] w-full rounded-xl sm:h-[14rem] md:h-[14.5rem]" />

          <div className="flex h-[13rem] flex-col sm:h-[14rem] md:h-[14.5rem]">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 sm:gap-x-3">
              {[0, 1, 2, 3, 4, 5].map((field) => (
                <div key={field} className="space-y-1.5 border-b border-border pb-1.5">
                  <Skeleton className="h-2.5 w-14" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              ))}
            </div>

            <div className="mt-auto flex gap-2 border-t border-border/60 pt-2">
              <Skeleton className="h-14 w-12 rounded-lg sm:h-16 sm:w-14" />
              <Skeleton className="h-14 w-12 rounded-lg sm:h-16 sm:w-14" />
            </div>
          </div>

          <div className="col-start-1">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MedicionesSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando mediciones">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: cards }, (_, index) => (
          <MedicionCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
