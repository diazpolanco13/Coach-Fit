import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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

export function buildBodyPhotoGallery(metrics: BodyMetric[]): BodyPhotoGalleryItem[] {
  const items: BodyPhotoGalleryItem[] = []
  for (const metric of metrics) {
    for (const photo of metric.photos ?? []) {
      items.push({ metric, photo })
    }
  }
  return items
}

export function BodyPhotoViewer({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BodyPhotoGalleryItem[]
  index: number
  onIndexChange: (index: number) => void
}) {
  const safeIndex = items.length ? Math.min(Math.max(index, 0), items.length - 1) : 0
  const current = items[safeIndex]
  const metric = current?.metric
  const photo = current?.photo
  const canNavigate = items.length > 1

  const go = (direction: -1 | 1) => {
    if (!canNavigate) return
    onIndexChange((safeIndex + direction + items.length) % items.length)
  }

  useEffect(() => {
    if (!open || items.length < 2) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onIndexChange((safeIndex - 1 + items.length) % items.length)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexChange((safeIndex + 1) % items.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, items.length, safeIndex, onIndexChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(96vw,42rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none ring-0"
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
              src={photo.url}
              alt={photo.original_name || `Foto medición ${metric.date}`}
              className="max-h-[85vh] w-full object-contain"
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
                  <div className="ml-auto rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur-sm ring-1 ring-white/10">
                    {safeIndex + 1}/{items.length}
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
            className="absolute top-3 right-3 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
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
                className="absolute top-1/2 left-3 -translate-y-1/2 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
                onClick={() => go(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Foto siguiente"
                className="absolute top-1/2 right-3 -translate-y-1/2 border-0 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
                onClick={() => go(1)}
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
