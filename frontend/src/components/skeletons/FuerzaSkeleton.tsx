import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Silueta de la analítica de fuerza: cabecera con selector de ventana, los
 *  cuatro KPI, la tabla por músculo y los dos paneles de gráficas. */
export function FuerzaSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando analítica de fuerza">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-10 w-56 rounded-lg" />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((kpi) => (
          <Card key={kpi}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="size-7 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-1.5 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-3 p-4">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-24 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3.5 w-16 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {[260, 260].map((height, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full" style={{ height }} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
