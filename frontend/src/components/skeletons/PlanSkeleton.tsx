import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Una tarjeta de día: cabecera con fecha y duración, la lista de ejercicios
 *  con su miniatura, y el panel de «qué entrena este día». */
function PlanDayCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>

        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-2.5 w-32" />
              </div>
              <Skeleton className="h-3.5 w-14 shrink-0" />
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          {[0, 1, 2, 3].map((muscle) => (
            <div key={muscle} className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PlanSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando plan">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="ml-auto h-9 w-24 rounded-md" />
      </div>

      {/* Volumen semanal por músculo. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-56" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <Skeleton className="h-3.5 w-64" />
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-20 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3.5 w-16 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <PlanDayCardSkeleton />
        <PlanDayCardSkeleton />
      </div>
    </div>
  )
}
