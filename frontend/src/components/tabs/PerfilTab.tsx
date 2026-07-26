import { useMemo, useRef } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Camera, Scale, Trash2, UserRound } from 'lucide-react'
import type { BodyMetric, ProfileSummary, UserProfile } from '@/lib/api'
import {
  NuevaMedicionForm,
  type ProfileBodyDraft,
} from '@/components/measurements/NuevaMedicionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }

function fmt(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function delta(value: number | null | undefined, suffix = ''): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`
}

export function PerfilTab({
  metricsBody,
  summary,
  profile,
  draft,
  photos,
  onDraftChange,
  onPhotosChange,
  onRemovePhoto,
  onSaveBody,
  onImportCsv,
  onSetProfilePhoto,
  onClearProfilePhoto,
  onGoMediciones,
}: {
  metricsBody: BodyMetric[]
  summary: ProfileSummary | null
  profile: UserProfile | null
  draft: ProfileBodyDraft
  photos: File[]
  onDraftChange: (field: keyof ProfileBodyDraft, value: string) => void
  onPhotosChange: (files: File[]) => void
  onRemovePhoto: (index: number) => void
  onSaveBody: () => Promise<boolean>
  onImportCsv: (file: File) => Promise<boolean>
  onSetProfilePhoto: (file: File) => void
  onClearProfilePhoto: () => void
  onGoMediciones: () => void
}) {
  const latest = summary?.composition.latest ?? metricsBody[0] ?? null
  const chartData = useMemo(() => metricsBody.slice(0, 20).slice().reverse(), [metricsBody])
  const profilePhotoUrl = profile?.photo_url
    ? `${profile.photo_url}?t=${encodeURIComponent(profile.updated_at || '')}`
    : null
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const compositionItems = [
    { label: 'Peso', value: fmt(latest?.weight_kg), suffix: 'kg', change: delta(summary?.composition.delta.weight_kg, ' kg') },
    { label: 'IMC', value: fmt(latest?.bmi), suffix: undefined },
    { label: 'Grasa', value: fmt(latest?.body_fat_pct), suffix: '%', change: delta(summary?.composition.delta.body_fat_pct, '%') },
    { label: 'Músculo', value: fmt(latest?.muscle_pct), suffix: '%', change: delta(summary?.composition.delta.muscle_pct, '%') },
    { label: 'Agua', value: fmt(latest?.water_pct), suffix: '%' },
    { label: 'Visceral', value: fmt(latest?.visceral_fat, 0), suffix: undefined },
    { label: 'TMB', value: fmt(latest?.bmr_kcal, 0), suffix: 'kcal' },
    { label: 'Edad metabólica', value: fmt(latest?.metabolic_age, 0), suffix: undefined },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>Datos corporales básicos del usuario.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="flex size-20 overflow-hidden rounded-2xl bg-primary/10 text-primary">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Foto de perfil" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <UserRound className="size-10" />
                  </div>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0]
                  if (file) onSetProfilePhoto(file)
                  e.currentTarget.value = ''
                }}
              />
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="xs" onClick={() => avatarInputRef.current?.click()}>
                  <Camera className="size-3.5" />
                  {profilePhotoUrl ? 'Cambiar' : 'Subir'}
                </Button>
                {profilePhotoUrl && (
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar foto de perfil" onClick={onClearProfilePhoto}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="kicker">Peso</div>
                <div className="font-heading text-2xl font-extrabold">
                  {fmt(latest?.weight_kg)}
                  {latest?.weight_kg != null && <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>}
                </div>
              </div>
              <div>
                <div className="kicker">IMC</div>
                <div className="font-heading text-2xl font-extrabold">{fmt(latest?.bmi)}</div>
              </div>
              <div>
                <div className="kicker">Grasa</div>
                <div className="font-heading text-2xl font-extrabold">
                  {fmt(latest?.body_fat_pct)}
                  {latest?.body_fat_pct != null && <span className="ml-1 text-xs font-normal text-muted-foreground">%</span>}
                </div>
              </div>
              <div>
                <div className="kicker">Músculo</div>
                <div className="font-heading text-2xl font-extrabold">
                  {fmt(latest?.muscle_pct)}
                  {latest?.muscle_pct != null && <span className="ml-1 text-xs font-normal text-muted-foreground">%</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Composición corporal
          </CardTitle>
          <CardDescription>
            {latest ? `Última lectura ${latest.date}${latest.measured_at ? ` · ${latest.measured_at}` : ''}` : 'Importa Renpho o registra una medición'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {compositionItems.map((item) => (
              <div key={item.label} className="border-b border-border pb-2">
                <div className="kicker">{item.label}</div>
                <div className="font-heading text-2xl font-extrabold">
                  {item.value}
                  {item.suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{item.suffix}</span>}
                </div>
                {item.change && <div className="text-xs text-muted-foreground">28d {item.change}</div>}
              </div>
            ))}
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={chartTick} />
                <YAxis tick={chartTick} domain={['auto', 'auto']} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="weight_kg" name="Peso kg" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="body_fat_pct" name="Grasa %" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="muscle_pct" name="Músculo %" stroke="var(--accent-foreground)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Se necesitan al menos 2 mediciones para ver tendencia.</p>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onGoMediciones}>
              Ver historial con fotos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar medición</CardTitle>
          <CardDescription>Guarda lo esencial a mano o importa el CSV exportado desde Renpho.</CardDescription>
        </CardHeader>
        <CardContent>
          <NuevaMedicionForm
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
    </div>
  )
}
