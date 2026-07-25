import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MediaImg } from '@/components/MediaImg'
import {
  DIFFICULTY_ES,
  exerciseDifficulty,
  exerciseLoad,
  loadDots,
  muscleRegionLabel,
  regionES,
} from '@/lib/anatomy'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export function GuideModal({
  ex,
  exercises = [],
  onClose,
}: {
  ex: Exercise | null
  /** Catálogo completo: hace falta para listar la progresión de la familia. */
  exercises?: Exercise[]
  onClose: () => void
}) {
  // El listado del catalogo llega sin guias (son ~70% de su peso), asi que la
  // pedimos al abrir la ficha. Si el ejercicio ya la trae, no hay fetch.
  const [steps, setSteps] = useState<string[] | null>(null)

  useEffect(() => {
    if (!ex) return
    if (ex.guide_es?.length) {
      setSteps(ex.guide_es)
      return
    }
    let cancelled = false
    setSteps(null)
    api
      .exercise(ex.id)
      .then((full) => !cancelled && setSteps(full.guide_es ?? []))
      .catch(() => !cancelled && setSteps([]))
    return () => {
      cancelled = true
    }
  }, [ex])

  const family = useMemo(() => {
    if (!ex?.family_id) return []
    return exercises
      .filter((e) => e.family_id === ex.family_id)
      .sort((a, b) => exerciseDifficulty(a) - exerciseDifficulty(b) || a.id.localeCompare(b.id))
  }, [ex, exercises])

  const secondaries = (ex?.stimulus ?? [])
    .filter((s) => s.role === 'secondary')
    .sort((a, b) => b.weight - a.weight)

  return (
    <Dialog open={!!ex} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-t-4 border-t-primary">
        {ex && (
          <>
            <DialogHeader>
              <DialogTitle>{ex.name_es}</DialogTitle>
              <DialogDescription>
                {muscleRegionLabel(muscleES(ex.target), ex.target_region)} ·{' '}
                {equipmentES(ex.equipment)}
                {ex.difficulty != null && ` · ${DIFFICULTY_ES[exerciseDifficulty(ex)]}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4 pt-0">
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={ex.name_es}
                preferGif
                className="mx-auto max-h-56 object-contain"
              />

              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="kicker">Anatomía</div>
                <p>
                  Primario:{' '}
                  <strong>
                    {muscleRegionLabel(muscleES(ex.target), ex.target_region)}
                  </strong>
                </p>
                {secondaries.length > 0 && (
                  <p className="text-muted-foreground">
                    También:{' '}
                    {secondaries
                      .map((s) => {
                        const label = s.region
                          ? muscleRegionLabel(muscleES(s.muscle), s.region)
                          : muscleES(s.muscle)
                        return `${label} (${s.weight >= 0.5 ? 'medio' : 'bajo'})`
                      })
                      .join(' · ')}
                  </p>
                )}
                {!secondaries.length && ex.secondary_muscles?.length ? (
                  <p className="text-muted-foreground">
                    También: {ex.secondary_muscles.map(muscleES).join(', ')}
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  Carga relativa
                  <span className="inline-flex gap-0.5" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'size-1.5 rounded-full',
                          i < loadDots(exerciseLoad(ex))
                            ? 'bg-primary'
                            : 'bg-muted-foreground/25',
                        )}
                      />
                    ))}
                  </span>
                </p>
              </div>

              {family.length > 1 && (
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <div className="kicker">Progresión</div>
                  <p className="text-xs text-muted-foreground">
                    {ex.family_label_es || 'Misma familia'} — elige según tu nivel
                  </p>
                  <ol className="space-y-1">
                    {family.map((m) => {
                      const here = m.id === ex.id
                      return (
                        <li
                          key={m.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs',
                            here && 'bg-primary/10 font-medium',
                          )}
                        >
                          <span className="min-w-0 truncate">
                            {DIFFICULTY_ES[exerciseDifficulty(m)]}: {m.name_es}
                          </span>
                          {here && (
                            <Badge variant="brand" className="h-5 shrink-0 px-1.5 text-[10px]">
                              Estás aquí
                            </Badge>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {ex.target_region && (
                <p className="text-xs text-muted-foreground">
                  Énfasis: {regionES(ex.target_region)}
                </p>
              )}

              {steps === null ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando guía…
                </div>
              ) : steps.length ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  {steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Este ejercicio no tiene guía disponible.
                </p>
              )}
              <Button className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
