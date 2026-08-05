import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Loader2, Play, Star } from 'lucide-react'
import { api, type Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MediaImg } from '@/components/MediaImg'
import { useData } from '@/components/shell/DataContext'
import { curationOf } from '@/lib/exerciseFilter'
import {
  DIFFICULTY_ES,
  exerciseDifficulty,
  exerciseLoad,
  loadDots,
  muscleRegionLabel,
  regionES,
} from '@/lib/anatomy'
import {
  cardioGuideSteps,
  cardioGuideTitle,
  cardioKindLabel,
  cardioSessionTypeLabel,
  cardioSurfaceLabel,
  formatCardioPrescription,
  isEnduranceCardio,
  type CardioGuideContext,
} from '@/lib/cardio'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export type GuideSelection = {
  exercise: Exercise
  /** Si viene del plan/sesión de cardio, la guía cambia según la intención. */
  cardio?: CardioGuideContext | null
}

function FoldSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <span className="kicker min-w-0 flex-1">{title}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="space-y-2 border-t border-border px-3 py-2.5">{children}</div>}
    </div>
  )
}

export function GuideModal({
  selection,
  exercises = [],
  gymId = null,
  onClose,
  onStart,
}: {
  selection: GuideSelection | null
  /** Catálogo completo: hace falta para listar la progresión de la familia. */
  exercises?: Exercise[]
  /** Espacio donde se guardan los favoritos (plan activo o espacio en uso). */
  gymId?: number | null
  onClose: () => void
  /** Si hay día del plan activo con este ejercicio, inicia la sesión ahí. */
  onStart?: () => void
}) {
  const { gyms, reloadGyms } = useData()
  const ex = selection?.exercise ?? null
  const cardio = selection?.cardio
  const endurance = Boolean(ex && isEnduranceCardio(ex))
  const gym = useMemo(
    () => (gymId != null ? gyms.find((g) => g.id === gymId) : null) ?? null,
    [gyms, gymId],
  )
  const serverFavorite = Boolean(ex && gym && curationOf(gym.curation).favorites.has(ex.id))
  const [favorite, setFavorite] = useState(serverFavorite)

  useEffect(() => {
    setFavorite(serverFavorite)
  }, [serverFavorite, ex?.id])

  const toggleFavorite = useCallback(() => {
    if (!ex || gymId == null) return
    const next = !favorite
    setFavorite(next)
    api
      .markExercise(gymId, ex.id, next ? 'favorito' : 'disponible')
      .then(() => reloadGyms())
      .catch(() => setFavorite(!next))
  }, [ex, gymId, favorite, reloadGyms])

  // El listado del catalogo llega sin guias (son ~70% de su peso), asi que la
  // pedimos al abrir la ficha. Cardio de resistencia usa guías propias.
  const [steps, setSteps] = useState<string[] | null>(null)

  useEffect(() => {
    if (!ex) return
    if (endurance) {
      setSteps(
        cardioGuideSteps(
          cardio ?? {
            kind: 'carrera_libre',
            session_type: 'rodaje_suave',
          },
        ),
      )
      return
    }
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
  }, [ex, endurance, cardio])

  const family = useMemo(() => {
    if (!ex?.family_id) return []
    return exercises
      .filter((e) => e.family_id === ex.family_id)
      .sort((a, b) => exerciseDifficulty(a) - exerciseDifficulty(b) || a.id.localeCompare(b.id))
  }, [ex, exercises])

  const secondaries = (ex?.stimulus ?? [])
    .filter((s) => s.role === 'secondary')
    .sort((a, b) => b.weight - a.weight)

  const title = endurance
    ? cardioGuideTitle(cardio, ex?.name_es ?? 'Cardio')
    : (ex?.name_es ?? '')

  const subtitle = endurance
    ? [
        cardio
          ? formatCardioPrescription({
              cardio_kind: cardio.kind,
              cardio_surface: cardio.surface,
              session_type: cardio.session_type,
              target_km: cardio.target_km,
              target_min: cardio.target_min,
              exercise: ex,
            })
          : null,
        equipmentES(ex?.equipment ?? ''),
        ex?.difficulty != null ? DIFFICULTY_ES[exerciseDifficulty(ex)] : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ex
      ? `${muscleRegionLabel(muscleES(ex.target), ex.target_region)} · ${equipmentES(ex.equipment)}${
          ex.difficulty != null ? ` · ${DIFFICULTY_ES[exerciseDifficulty(ex)]}` : ''
        }`
      : ''

  return (
    <Dialog open={!!ex} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[min(100%-1.5rem,22rem)] max-w-sm flex-col gap-0 overflow-hidden border-t-4 border-t-primary p-0">
        {ex && (
          <>
            <DialogHeader className="shrink-0 pr-12">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>{subtitle}</DialogDescription>
                </div>
                {gymId != null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      'mt-0.5 shrink-0',
                      favorite ? 'text-amber-500' : 'text-muted-foreground',
                    )}
                    aria-label={
                      favorite
                        ? `Quitar de favoritos ${ex.name_es}`
                        : `Marcar ${ex.name_es} como favorito`
                    }
                    aria-pressed={favorite}
                    onClick={toggleFavorite}
                  >
                    <Star className={favorite ? 'fill-amber-500' : undefined} />
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={ex.name_es}
                preferGif
                className="mx-auto w-full max-h-56 object-contain"
              />

              {endurance && cardio?.session_type && (
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="brand">{cardioKindLabel(cardio.kind)}</Badge>
                  <Badge variant="secondary">
                    {cardioSessionTypeLabel(cardio.kind, cardio.session_type)}
                  </Badge>
                  {cardio.surface && (
                    <Badge variant="outline">{cardioSurfaceLabel(cardio.surface)}</Badge>
                  )}
                </div>
              )}

              <div className="space-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <div className="kicker">Anatomía</div>
                <p>
                  Primario:{' '}
                  <strong>
                    {muscleRegionLabel(muscleES(ex.target), ex.target_region)}
                  </strong>
                </p>
                {secondaries.length > 0 && (
                  <p className="text-xs text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground">
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
                {ex.target_region && !endurance && (
                  <p className="text-xs text-muted-foreground">
                    Énfasis: {regionES(ex.target_region)}
                  </p>
                )}
              </div>

              {family.length > 1 && !endurance && (
                <FoldSection title="Progresión">
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
                </FoldSection>
              )}

              <FoldSection title={endurance ? 'Cómo hacer esta sesión' : 'Instrucciones'}>
                {steps === null ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
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
                  <p className="py-1 text-center text-sm text-muted-foreground">
                    Este ejercicio no tiene guía disponible.
                  </p>
                )}
              </FoldSection>
            </div>

            <DialogFooter className="shrink-0 flex-row gap-2 border-t border-border bg-card p-3 sm:justify-stretch">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                type="button"
                className="flex-1 gap-1.5"
                disabled={!onStart}
                title={
                  onStart
                    ? 'Abrir la sesión en este ejercicio'
                    : 'Este ejercicio no está en el plan activo de esta semana'
                }
                onClick={() => onStart?.()}
              >
                <Play className="size-3.5" />
                Iniciar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
