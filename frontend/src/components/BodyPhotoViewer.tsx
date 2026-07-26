import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import type { BodyMetric, BodyMetricPhoto } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export type BodyPhotoGalleryItem = {
  photo: BodyMetricPhoto
  metric: BodyMetric
}

function fmt(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function longDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function StatPill({
  label,
  value,
  suffix,
  large,
}: {
  label: string
  value: string
  suffix: string
  large?: boolean
}) {
  return (
    <div className="rounded-xl bg-black/70 px-3 py-2 shadow-lg backdrop-blur-sm ring-1 ring-white/10">
      <div className="text-[11px] tracking-wide text-white/70 uppercase">{label}</div>
      <div
        className={cn(
          'font-heading font-extrabold leading-none text-white',
          large ? 'text-3xl' : 'text-2xl',
        )}
      >
        {value}
        <span className="ml-1 text-sm font-normal text-white/75">{suffix}</span>
      </div>
    </div>
  )
}

/** Flat gallery across measurement days; days without photos are skipped. */
export function buildBodyPhotoGallery(metrics: BodyMetric[]): BodyPhotoGalleryItem[] {
  const items: BodyPhotoGalleryItem[] = []
  for (const metric of metrics) {
    for (const photo of metric.photos ?? []) {
      items.push({ metric, photo })
    }
  }
  return items
}

function preloadUrl(url: string) {
  const img = new Image()
  img.src = url
}

export function BodyPhotoViewer({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BodyPhotoGalleryItem[]
  index: number
  onIndexChange: Dispatch<SetStateAction<number>>
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}) {
  const itemsRef = useRef(items)
  itemsRef.current = items
  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore
  const pendingNextRef = useRef(false)

  const len = items.length
  const safeIndex = len ? Math.min(Math.max(index, 0), len - 1) : 0
  const current = items[safeIndex]
  const metric = current?.metric
  const photo = current?.photo
  const canNavigate = len > 1 || hasMore
  const [imgLoaded, setImgLoaded] = useState(true)

  const ensureAhead = (fromIndex: number) => {
    if (!hasMoreRef.current) return
    if (fromIndex < itemsRef.current.length - 2) return
    onLoadMoreRef.current?.()
  }

  const step = (direction: -1 | 1) => {
    const list = itemsRef.current
    if (!list.length) {
      if (direction === 1 && hasMoreRef.current) onLoadMoreRef.current?.()
      return
    }

    onIndexChange((prev) => {
      const base = Math.min(Math.max(prev, 0), list.length - 1)
      const next = base + direction

      if (next < 0) {
        // No saltar al final mientras falten páginas: el "último" aún no es real.
        return hasMoreRef.current ? base : list.length - 1
      }

      if (next >= list.length) {
        if (hasMoreRef.current) {
          pendingNextRef.current = true
          onLoadMoreRef.current?.()
          return base
        }
        return 0
      }

      ensureAhead(next)
      return next
    })
  }
  const stepRef = useRef(step)
  stepRef.current = step

  // Tras prefetch: si el usuario pidió "siguiente" al final, avanzar.
  useEffect(() => {
    if (!pendingNextRef.current || !len) return
    if (safeIndex < len - 1) {
      pendingNextRef.current = false
      onIndexChange(safeIndex + 1)
      return
    }
    if (!hasMore && !loadingMore) {
      pendingNextRef.current = false
    }
  }, [len, safeIndex, hasMore, loadingMore, onIndexChange])

  // Keep controlled index inside bounds when the gallery shrinks (e.g. delete).
  useEffect(() => {
    if (!len) return
    if (index !== safeIndex) onIndexChange(safeIndex)
  }, [index, safeIndex, len, onIndexChange])

  // Stable keyboard listener via stepRef — no rebind per index.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepRef.current(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepRef.current(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Preload neighbors so day-to-day jumps feel instant.
  useEffect(() => {
    if (!open || len < 2) return
    const list = itemsRef.current
    const prev = list[(safeIndex - 1 + len) % len]
    const next = list[Math.min(safeIndex + 1, len - 1)]
    if (prev && safeIndex > 0) preloadUrl(prev.photo.url)
    if (next && safeIndex < len - 1) preloadUrl(next.photo.url)
    ensureAhead(safeIndex)
  }, [open, safeIndex, len, photo?.id])

  useEffect(() => {
    setImgLoaded(false)
  }, [photo?.id])

  const counterLabel = hasMore ? `${safeIndex + 1}/${len}…` : `${safeIndex + 1}/${len}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-[min(96vw,42rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none ring-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">
          Foto de medición {metric ? longDate(metric.date) : ''}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {metric
            ? `Peso ${fmt(metric.weight_kg)} kg, grasa ${fmt(metric.body_fat_pct)}%, músculo ${fmt(metric.muscle_pct)}%.`
            : 'Visor de fotos de mediciones'}
        </DialogDescription>

        <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
          {photo && metric ? (
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.original_name || `Foto medición ${metric.date}`}
              className={cn(
                'max-h-[85vh] w-full object-contain transition-opacity duration-150',
                imgLoaded ? 'opacity-100' : 'opacity-40',
              )}
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-white/70">Sin foto</div>
          )}

          {metric && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-20 pb-4">
              <div className="mb-3 inline-flex rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium tracking-wide text-white/85 uppercase shadow-lg backdrop-blur-sm ring-1 ring-white/10">
                {longDate(metric.date)}
                {metric.measured_at ? ` · ${metric.measured_at}` : ''}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <StatPill label="Peso" value={fmt(metric.weight_kg)} suffix="kg" large />
                <StatPill label="Grasa" value={fmt(metric.body_fat_pct)} suffix="%" />
                <StatPill label="Músculo" value={fmt(metric.muscle_pct)} suffix="%" />
                {canNavigate && (
                  <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur-sm ring-1 ring-white/10">
                    {loadingMore && <Loader2 className="size-3 animate-spin" />}
                    {counterLabel}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Cerrar"
            className="absolute top-3 right-3 z-10 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <X />
          </Button>

          {canNavigate && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Foto anterior"
                className="absolute top-1/2 left-3 z-10 -translate-y-1/2 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  step(-1)
                }}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Foto siguiente"
                className="absolute top-1/2 right-3 z-10 -translate-y-1/2 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  step(1)
                }}
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
