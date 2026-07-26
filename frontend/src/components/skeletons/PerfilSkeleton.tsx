import { PROFILE_SECTIONS } from '@/lib/profileFields'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Las secciones y el número de campos salen del mismo catálogo que pinta el
 *  formulario: si mañana se añade un campo, el esqueleto lo refleja solo. */
export function PerfilSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando perfil">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-80" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <Skeleton className="size-20 rounded-2xl" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-7 w-56" />
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {PROFILE_SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.fields.map((field) => (
                <div
                  key={field.key}
                  className={cn('space-y-1.5', field.wide && 'sm:col-span-2 lg:col-span-3')}
                >
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
