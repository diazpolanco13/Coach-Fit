import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Loader2,
  Pencil,
  Replace,
  Trash2,
  X,
} from 'lucide-react'
import type { BodyMetric, BodyMetricInput } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BodyPhotoViewer, buildBodyPhotoGallery } from '@/components/BodyPhotoViewer'
import { NuevaMedicionDialog } from '@/components/measurements/NuevaMedicionDialog'
import type { ProfileBodyDraft } from '@/components/measurements/NuevaMedicionForm'
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
  index,
  onIndexChange,
  busy,
  onAddPhotos,
  onReplacePhoto,
  onDeletePhoto,
  onOpenPhoto,
  footer = true,
}: {
  metric: BodyMetric
  index: number
  onIndexChange: (index: number) => void
  busy: boolean
  onAddPhotos: (metricId: number, files: File[]) => void
  onReplacePhoto: (metricId: number, photoId: number, file: File) => void
  onDeletePhoto: (metricId: number, photoId: number) => void
  onOpenPhoto: (photoId: number) => void
  footer?: boolean
}) {
  const addRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const photos = metric.photos ?? []
  const remaining = Math.max(0, 3 - photos.length)
  const current = photos[index]

  const go = (direction: -1 | 1) => {
    if (photos.length < 2) return
    onIndexChange((index + direction + photos.length) % photos.length)
  }

  const openAdd = () => addRef.current?.click()

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-border bg-muted">
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
                      onClick={() => onIndexChange(photoIndex)}
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
            onClick={openAdd}
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

      {footer && current && (
        <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {index + 1}/{photos.length}
            {remaining > 0 ? ` · ${remaining} libres` : ' · Límite 3'}
          </span>
          {remaining > 0 && (
            <Button type="button" variant="outline" size="xs" disabled={busy} onClick={openAdd}>
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
  const [photoIndex, setPhotoIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(metric))
  const [saving, setSaving] = useState(false)
  const extraPhotos = photos
    .map((photo, index) => ({ photo, index }))
    .filter((item) => item.index !== photoIndex)

  useEffect(() => {
    setPhotoIndex((current) => {
      if (!photos.length) return 0
      return Math.min(current, photos.length - 1)
    })
  }, [photos.length, metric.id])

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
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
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
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] md:grid-cols-[10rem_minmax(0,1fr)] md:gap-x-4">
          {/* Fila 1: foto compacta + métricas y miniaturas */}
          <div className="h-[13rem] min-h-0 sm:h-[14rem] md:h-[14.5rem]">
            <PhotoCarousel
              metric={metric}
              index={photoIndex}
              onIndexChange={setPhotoIndex}
              busy={busy || saving}
              onAddPhotos={onAddPhotos}
              onReplacePhoto={onReplacePhoto}
              onDeletePhoto={onDeletePhoto}
              onOpenPhoto={onOpenPhoto}
              footer={false}
            />
          </div>

          <div className="flex h-[13rem] min-h-0 flex-col overflow-hidden sm:h-[14rem] md:h-[14.5rem]">
            <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 sm:gap-x-3">
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
                  <div key={field.key} className="border-b border-border pb-1.5">
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
                        <div className="font-heading text-lg font-extrabold sm:text-xl">
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

            {extraPhotos.length > 0 && (
              <div className="mt-auto flex min-h-0 items-end gap-2 border-t border-border/60 pt-2">
                <div className="flex min-w-0 gap-2 overflow-hidden">
                  {extraPhotos.map(({ photo, index }) => (
                    <button
                      key={photo.id}
                      type="button"
                      title={`Ver foto ${index + 1}`}
                      aria-label={`Mostrar foto ${index + 1} como principal`}
                      disabled={busy || saving}
                      onClick={() => setPhotoIndex(index)}
                      onDoubleClick={() => onOpenPhoto(photo.id)}
                      className={cn(
                        'h-14 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm transition sm:h-16 sm:w-14',
                        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        (busy || saving) && 'pointer-events-none opacity-60',
                      )}
                    >
                      <img
                        src={photo.url}
                        alt={photo.original_name || `Foto ${index + 1} · ${metric.date}`}
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fila 2: acciones bajo la foto (fuera de la fila con bases alineadas) */}
          {photos.length > 0 && (
            <div className="col-start-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {photoIndex + 1}/{photos.length}
                {photos.length < 3 ? ` · ${3 - photos.length} libres` : ' · Límite 3'}
              </span>
              {photos.length < 3 && (
                <label
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 font-medium text-foreground transition-colors hover:bg-muted',
                    (busy || saving) && 'pointer-events-none opacity-60',
                  )}
                >
                  <ImagePlus className="size-3.5" />
                  Añadir
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={busy || saving}
                    onChange={(e) => {
                      const selected = Array.from(e.currentTarget.files ?? []).slice(0, 3 - photos.length)
                      if (selected.length) onAddPhotos(metric.id, selected)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MedicionesTab({
  metrics,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  draft,
  photos,
  onDraftChange,
  onPhotosChange,
  onRemovePhoto,
  onSaveBody,
  onImportCsv,
  onAddPhotos,
  onReplacePhoto,
  onDeletePhoto,
  onUpdateMetric,
}: {
  metrics: BodyMetric[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  draft: ProfileBodyDraft
  photos: File[]
  onDraftChange: (field: keyof ProfileBodyDraft, value: string) => void
  onPhotosChange: (files: File[]) => void
  onRemovePhoto: (index: number) => void
  onSaveBody: () => Promise<boolean>
  onImportCsv: (file: File) => Promise<boolean>
  onAddPhotos: (metricId: number, files: File[]) => Promise<void>
  onReplacePhoto: (metricId: number, photoId: number, file: File) => Promise<void>
  onDeletePhoto: (metricId: number, photoId: number) => Promise<void>
  onUpdateMetric: (metricId: number, patch: BodyMetricInput) => Promise<void>
}) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const gallery = buildBodyPhotoGallery(metrics)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore, metrics.length])

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
          <NuevaMedicionDialog
            prominent
            draft={draft}
            photos={photos}
            onDraftChange={onDraftChange}
            onPhotosChange={onPhotosChange}
            onRemovePhoto={onRemovePhoto}
            onSaveBody={onSaveBody}
            onImportCsv={onImportCsv}
          />
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
            Historial con fotos de progreso por lectura. {total} registros
            {metrics.length < total ? ` · mostrando ${metrics.length}` : ''}.
          </p>
        </div>
        <NuevaMedicionDialog
          draft={draft}
          photos={photos}
          onDraftChange={onDraftChange}
          onPhotosChange={onPhotosChange}
          onRemovePhoto={onRemovePhoto}
          onSaveBody={onSaveBody}
          onImportCsv={onImportCsv}
        />
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

      <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-2">
        {loadingMore && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando más…
          </div>
        )}
        {!hasMore && metrics.length > 0 && (
          <p className="text-xs text-muted-foreground">Fin del historial</p>
        )}
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
