import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Pencil,
  Replace,
  Trash2,
  X,
} from 'lucide-react'
import type { BodyMetric, BodyMetricInput } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BodyPhotoViewer, buildBodyPhotoGallery } from '@/components/BodyPhotoViewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type EditableField = 'weight_kg' | 'body_fat_pct' | 'muscle_pct' | 'visceral_fat' | 'water_pct' | 'bmr_kcal'

type Draft = Record<EditableField, string>

const FIELDS: Array<{
  key: EditableField
  label: string
  suffix?: string
  step: string
  digits: number
}> = [
  { key: 'weight_kg', label: 'Peso', suffix: 'kg', step: '0.1', digits: 1 },
  { key: 'body_fat_pct', label: 'Grasa', suffix: '%', step: '0.1', digits: 1 },
  { key: 'muscle_pct', label: 'Músculo', suffix: '%', step: '0.1', digits: 1 },
  { key: 'visceral_fat', label: 'Visceral', step: '1', digits: 0 },
  { key: 'water_pct', label: 'Agua', suffix: '%', step: '0.1', digits: 1 },
  { key: 'bmr_kcal', label: 'TMB', suffix: 'kcal', step: '1', digits: 0 },
]

function fmt(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function delta(current: number | null | undefined, previous: number | null | undefined, suffix = ''): string | null {
  if (current == null || previous == null) return null
  const change = current - previous
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}${suffix}`
}

function longDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function toDraft(metric: BodyMetric): Draft {
  return {
    weight_kg: metric.weight_kg == null ? '' : String(metric.weight_kg),
    body_fat_pct: metric.body_fat_pct == null ? '' : String(metric.body_fat_pct),
    muscle_pct: metric.muscle_pct == null ? '' : String(metric.muscle_pct),
    visceral_fat: metric.visceral_fat == null ? '' : String(metric.visceral_fat),
    water_pct: metric.water_pct == null ? '' : String(metric.water_pct),
    bmr_kcal: metric.bmr_kcal == null ? '' : String(metric.bmr_kcal),
  }
}

function parseOptional(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function PhotoCarousel({
  metric,
  busy,
  onAddPhotos,
  onReplacePhoto,
  onDeletePhoto,
  onOpenPhoto,
}: {
  metric: BodyMetric
  busy: boolean
  onAddPhotos: (metricId: number, files: File[]) => void
  onReplacePhoto: (metricId: number, photoId: number, file: File) => void
  onDeletePhoto: (metricId: number, photoId: number) => void
  onOpenPhoto: (photoId: number) => void
}) {
  const addRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const photos = metric.photos ?? []
  const remaining = Math.max(0, 3 - photos.length)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((current) => {
      if (!photos.length) return 0
      return Math.min(current, photos.length - 1)
    })
  }, [photos.length, metric.id])

  const current = photos[index]

  const go = (direction: -1 | 1) => {
    if (photos.length < 2) return
    setIndex((currentIndex) => (currentIndex + direction + photos.length) % photos.length)
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted">
        {current ? (
          <>
            <button
              type="button"
              className="block size-full cursor-zoom-in"
              title="Ver foto"
              onClick={() => onOpenPhoto(current.id)}
            >
              <img
                src={current.url}
                alt={current.original_name || `Foto medición ${metric.date}`}
                className="size-full object-cover"
              />
            </button>

            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  aria-label="Foto anterior"
                  disabled={busy}
                  className="absolute top-1/2 left-2 -translate-y-1/2 bg-background/85 shadow-sm"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  aria-label="Foto siguiente"
                  disabled={busy}
                  className="absolute top-1/2 right-2 -translate-y-1/2 bg-background/85 shadow-sm"
                  onClick={() => go(1)}
                >
                  <ChevronRight />
                </Button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((photo, photoIndex) => (
                    <button
                      key={photo.id}
                      type="button"
                      aria-label={`Ir a foto ${photoIndex + 1}`}
                      disabled={busy}
                      onClick={() => setIndex(photoIndex)}
                      className={cn(
                        'size-2 rounded-full transition-colors',
                        photoIndex === index ? 'bg-primary' : 'bg-background/70 hover:bg-background',
                      )}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label="Cambiar foto"
                disabled={busy}
                className="bg-background/85 shadow-sm"
                onClick={() => replaceRef.current?.click()}
              >
                <Replace />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                aria-label="Eliminar foto"
                disabled={busy}
                className="shadow-sm"
                onClick={() => {
                  if (window.confirm('¿Eliminar esta foto?')) {
                    onDeletePhoto(metric.id, current.id)
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => addRef.current?.click()}
            className={cn(
              'flex size-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground transition-colors',
              'hover:bg-primary/5 hover:text-foreground',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <ImagePlus className="size-5 text-primary" />
            <span>Añadir fotos</span>
          </button>
        )}
      </div>

      {current && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {index + 1}/{photos.length}
            {remaining > 0 ? ` · ${remaining} libres` : ' · Límite 3'}
          </span>
          {remaining > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => addRef.current?.click()}
            >
              <ImagePlus data-icon="inline-start" />
              Añadir
            </Button>
          )}
        </div>
      )}

      <input
        ref={addRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const selected = Array.from(e.currentTarget.files ?? []).slice(0, remaining)
          if (selected.length) onAddPhotos(metric.id, selected)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          if (file && current) onReplacePhoto(metric.id, current.id, file)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}

function MetricCard({
  metric,
  previous,
  busy,
  onAddPhotos,
  onReplacePhoto,
  onDeletePhoto,
  onUpdateMetric,
  onOpenPhoto,
}: {
  metric: BodyMetric
  previous?: BodyMetric
  busy: boolean
  onAddPhotos: (metricId: number, files: File[]) => void
  onReplacePhoto: (metricId: number, photoId: number, file: File) => void
  onDeletePhoto: (metricId: number, photoId: number) => void
  onUpdateMetric: (metricId: number, patch: BodyMetricInput) => Promise<void>
  onOpenPhoto: (photoId: number) => void
}) {
  const photos = metric.photos ?? []
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(metric))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(toDraft(metric))
  }, [metric, editing])

  const startEdit = () => {
    setDraft(toDraft(metric))
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(toDraft(metric))
    setEditing(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const patch = Object.fromEntries(
        FIELDS.map((field) => [field.key, parseOptional(draft[field.key])]),
      ) as BodyMetricInput
      await onUpdateMetric(metric.id, patch)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{longDate(metric.date)}</CardTitle>
            <CardDescription>
              {metric.measured_at ? `Medida a las ${metric.measured_at}` : 'Sin hora registrada'}
              {photos.length ? ` · ${photos.length}/3 fotos` : ' · Sin fotos'}
            </CardDescription>
          </div>
          {!editing ? (
            <Button type="button" variant="outline" size="xs" disabled={busy} onClick={startEdit}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Cancelar" disabled={saving} onClick={cancelEdit}>
                <X />
              </Button>
              <Button type="button" size="icon-xs" aria-label="Guardar" disabled={saving || busy} onClick={saveEdit}>
                <Check />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] md:items-start">
          <PhotoCarousel
            metric={metric}
            busy={busy || saving}
            onAddPhotos={onAddPhotos}
            onReplacePhoto={onReplacePhoto}
            onDeletePhoto={onDeletePhoto}
            onOpenPhoto={onOpenPhoto}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((field) => {
              const changeSuffix =
                field.key === 'weight_kg'
                  ? ' kg'
                  : field.key === 'body_fat_pct' || field.key === 'muscle_pct' || field.key === 'water_pct'
                    ? '%'
                    : ''
              const change =
                field.key === 'bmr_kcal' ? null : delta(metric[field.key], previous?.[field.key], changeSuffix)

              return (
                <div key={field.key} className="border-b border-border pb-2">
                  <div className="kicker">{field.label}</div>
                  {editing ? (
                    <div className="mt-1 flex items-center gap-1">
                      <Input
                        type="number"
                        step={field.step}
                        value={draft[field.key]}
                        disabled={saving}
                        onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                        className="font-heading text-lg font-extrabold"
                      />
                      {field.suffix && <span className="text-xs text-muted-foreground">{field.suffix}</span>}
                    </div>
                  ) : (
                    <>
                      <div className="font-heading text-xl font-extrabold">
                        {fmt(metric[field.key], field.digits)}
                        {field.suffix && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">{field.suffix}</span>
                        )}
                      </div>
                      {change && <div className="text-xs text-muted-foreground">vs ant. {change}</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MedicionesTab({
  metrics,
  onGoRegister,
  onAddPhotos,
  onReplacePhoto,
  onDeletePhoto,
  onUpdateMetric,
}: {
  metrics: BodyMetric[]
  onGoRegister: () => void
  onAddPhotos: (metricId: number, files: File[]) => Promise<void>
  onReplacePhoto: (metricId: number, photoId: number, file: File) => Promise<void>
  onDeletePhoto: (metricId: number, photoId: number) => Promise<void>
  onUpdateMetric: (metricId: number, patch: BodyMetricInput) => Promise<void>
}) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const gallery = buildBodyPhotoGallery(metrics)

  const withBusy = async (metricId: number, action: () => Promise<void>) => {
    setBusyId(metricId)
    try {
      await action()
    } finally {
      setBusyId(null)
    }
  }

  const openPhoto = (photoId: number) => {
    const nextIndex = gallery.findIndex((item) => item.photo.id === photoId)
    if (nextIndex < 0) return
    setViewerIndex(nextIndex)
    setViewerOpen(true)
  }

  if (!metrics.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="size-5 text-primary" />
            Historial de mediciones
          </CardTitle>
          <CardDescription>Todavía no hay lecturas corporales guardadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onGoRegister}>
            Registrar primera medición
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Mediciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial con fotos de progreso por lectura. {metrics.length} registros.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onGoRegister}>
          Nueva medición
        </Button>
      </div>

      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            previous={metrics[index + 1]}
            busy={busyId === metric.id}
            onAddPhotos={(metricId, files) => withBusy(metricId, () => onAddPhotos(metricId, files))}
            onReplacePhoto={(metricId, photoId, file) =>
              withBusy(metricId, () => onReplacePhoto(metricId, photoId, file))
            }
            onDeletePhoto={(metricId, photoId) => withBusy(metricId, () => onDeletePhoto(metricId, photoId))}
            onUpdateMetric={async (metricId, patch) => {
              await withBusy(metricId, () => onUpdateMetric(metricId, patch))
            }}
            onOpenPhoto={openPhoto}
          />
        ))}
      </div>

      <BodyPhotoViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        items={gallery}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </div>
  )
}
