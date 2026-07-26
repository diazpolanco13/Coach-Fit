import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Silueta de una tarjeta de métrica: cabecera, gráfica y las cuatro fichas.
 *  Las alturas son las del componente real (`MetricTrendCard`) para que al
 *  llegar los datos nada se mueva de sitio. */
function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="ml-auto h-7 w-20" />
            <Skeleton className="ml-auto h-3 w-28" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-[190px] w-full" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div key={tile} className="space-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function TendenciasSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando tendencias">
      <Skeleton className="h-4 w-72" />

      {/* Selector de rango y navegación de periodo. */}
      <div className="-mx-4 border-b border-border px-4 py-2 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-7 w-44" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-3 w-80" />
      </div>

      {Array.from({ length: cards }, (_, index) => (
        <MetricCardSkeleton key={index} />
      ))}
    </div>
  )
}
