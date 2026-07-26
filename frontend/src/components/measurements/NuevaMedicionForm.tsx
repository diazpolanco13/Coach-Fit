import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ImagePlus, Loader2, Upload, X } from 'lucide-react'
import {
  BODY_FIELD_GROUPS,
  BODY_TEXT_FIELDS,
  placeholderFor,
  stepFor,
  type BodyField,
} from '@/lib/bodyMetricFields'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type { ProfileBodyDraft } from '@/lib/bodyDraft'
import type { ProfileBodyDraft } from '@/lib/bodyDraft'

type NuevaMedicionFormProps = {
  draft: ProfileBodyDraft
  photos: File[]
  onDraftChange: (field: keyof ProfileBodyDraft, value: string) => void
  onPhotosChange: (files: File[]) => void
  onRemovePhoto: (index: number) => void
  onSaveBody: () => Promise<boolean>
  onImportCsv: (file: File) => Promise<boolean>
  onSaved?: () => void
}

const PRIMARY = BODY_FIELD_GROUPS.filter((group) => group.primary)
const SECONDARY = BODY_FIELD_GROUPS.filter((group) => !group.primary)
const SECONDARY_COUNT = SECONDARY.reduce((total, group) => total + group.fields.length, 0)

export function NuevaMedicionForm({
  draft,
  photos,
  onDraftChange,
  onPhotosChange,
  onRemovePhoto,
  onSaveBody,
  onImportCsv,
  onSaved,
}: NuevaMedicionFormProps) {
  const [photoPreviews, setPhotoPreviews] = useState<Array<{ file: File; url: string }>>([])
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showAll, setShowAll] = useState(false)

  /** Cuántas métricas del bloque plegado ya tienen valor: si el borrador viene
   *  con algo escrito, esconderlo sin avisar haría pensar que se perdió. */
  const filledSecondary = useMemo(
    () =>
      SECONDARY.reduce(
        (total, group) => total + group.fields.filter((field) => draft[field.key]?.trim()).length,
        0,
      ),
    [draft],
  )

  const numberField = (field: BodyField) => (
    <label key={field.key} className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
      <Input
        type="number"
        inputMode="decimal"
        step={stepFor(field.digits)}
        placeholder={placeholderFor(field)}
        value={draft[field.key]}
        disabled={saving}
        onChange={(event) => onDraftChange(field.key, event.target.value)}
      />
    </label>
  )

  useEffect(() => {
    const previews = photos.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setPhotoPreviews(previews)
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url))
  }, [photos])

  const save = async () => {
    if (!draft.weight_kg || saving) return
    setSaving(true)
    try {
      if (await onSaveBody()) onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const importCsv = async (file: File) => {
    if (importing) return
    setImporting(true)
    try {
      if (await onImportCsv(file)) onSaved?.()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Fecha</span>
          <Input
            type="date"
            value={draft.date}
            disabled={saving}
            onChange={(event) => onDraftChange('date', event.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Hora</span>
          <Input
            type="time"
            step="1"
            value={draft.measured_at}
            disabled={saving}
            onChange={(event) => onDraftChange('measured_at', event.target.value)}
          />
        </label>
        {PRIMARY.flatMap((group) => group.fields).map(numberField)}
      </div>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setShowAll((open) => !open)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <span className="text-sm font-medium">
            Resto de la balanza
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {filledSecondary
                ? `${filledSecondary} de ${SECONDARY_COUNT} con valor`
                : `${SECONDARY_COUNT} métricas más`}
            </span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', showAll && 'rotate-180')} />
        </button>

        {showAll && (
          <div className="space-y-4 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">
              Se guardan si las rellenas y se omiten si las dejas en blanco. Importando el CSV de Renpho
              llegan todas de una vez.
            </p>
            {SECONDARY.map((group) => (
              <div key={group.title} className="space-y-2">
                <div>
                  <div className="text-sm font-medium">{group.title}</div>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.fields.map(numberField)}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium">Clasificación</div>
                <p className="text-xs text-muted-foreground">
                  Las etiquetas que la balanza deduce del resto. Texto libre.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {BODY_TEXT_FIELDS.map((field) => (
                  <label key={field.key} className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                    <Input
                      placeholder={field.placeholder}
                      value={draft[field.key]}
                      disabled={saving}
                      onChange={(event) => onDraftChange(field.key, event.target.value)}
                    />
                  </label>
                ))}
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">Notas</span>
                  <Input
                    placeholder="Contexto de la lectura: ayuno, hidratación…"
                    value={draft.notes}
                    disabled={saving}
                    onChange={(event) => onDraftChange('notes', event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImagePlus className="size-4 text-primary" />
              Fotos de progreso
              <span className="text-xs font-normal text-muted-foreground">{photos.length}/3</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Puedes añadir hasta tres fotos a esta lectura.</p>
          </div>
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted">
            <ImagePlus className="size-3.5" />
            Seleccionar
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={saving || photos.length >= 3}
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.files ?? [])
                if (selected.length) onPhotosChange([...photos, ...selected].slice(0, 3))
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>

        {photoPreviews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photoPreviews.map((preview, index) => (
              <div
                key={`${preview.file.name}-${index}`}
                className="group relative size-24 overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img src={preview.url} alt={preview.file.name} className="size-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label="Quitar foto"
                  className="absolute top-1 right-1 opacity-95"
                  disabled={saving}
                  onClick={() => onRemovePhoto(index)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
        <Button type="button" disabled={!draft.weight_kg || saving || importing} onClick={save}>
          {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
          {saving ? 'Guardando…' : 'Guardar medición'}
        </Button>
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {importing ? 'Importando…' : 'Importar CSV de Renpho'}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={saving || importing}
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void importCsv(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}
