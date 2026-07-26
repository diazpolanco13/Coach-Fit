import { useEffect, useState } from 'react'
import { ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ProfileBodyDraft = {
  date: string
  weight_kg: string
  body_fat_pct: string
  muscle_pct: string
  visceral_fat: string
  water_pct: string
  bmr_kcal: string
}

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

const fields: Array<{
  key: Exclude<keyof ProfileBodyDraft, 'date'>
  label: string
  placeholder: string
  step: string
}> = [
  { key: 'weight_kg', label: 'Peso', placeholder: 'kg', step: '0.1' },
  { key: 'body_fat_pct', label: 'Grasa corporal', placeholder: '%', step: '0.1' },
  { key: 'muscle_pct', label: 'Músculo', placeholder: '%', step: '0.1' },
  { key: 'visceral_fat', label: 'Grasa visceral', placeholder: 'Nivel', step: '1' },
  { key: 'water_pct', label: 'Agua', placeholder: '%', step: '0.1' },
  { key: 'bmr_kcal', label: 'TMB', placeholder: 'kcal', step: '1' },
]

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
        {fields.map((field) => (
          <label key={field.key} className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            <Input
              type="number"
              inputMode="decimal"
              step={field.step}
              placeholder={field.placeholder}
              value={draft[field.key]}
              disabled={saving}
              onChange={(event) => onDraftChange(field.key, event.target.value)}
            />
          </label>
        ))}
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
