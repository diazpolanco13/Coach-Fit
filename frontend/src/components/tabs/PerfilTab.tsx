import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BellRing,
  Camera,
  Check,
  Loader2,
  MessageCircle,
  Pencil,
  Target,
  Trash2,
  Send,
  UserRound,
  X,
} from 'lucide-react'
import type { UserProfile, UserProfileInput } from '@/lib/api'
import {
  ACTIVITY_OPTIONS,
  PROFILE_SECTIONS,
  SEX_OPTIONS,
  draftFromProfile,
  profilePatch,
  type ProfileDraft,
  type ProfileFieldDef,
} from '@/lib/profileFields'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PerfilSkeleton } from '@/components/skeletons/PerfilSkeleton'

const SECTION_ICONS: Record<string, React.ReactNode> = {
  identidad: <UserRound className="size-5 text-primary" />,
  contacto: <MessageCircle className="size-5 text-primary" />,
  avisos: <BellRing className="size-5 text-primary" />,
  entrenamiento: <Target className="size-5 text-primary" />,
}

/** Lista de zonas del navegador. Sin dependencia ni lista escrita a mano: si el
 *  runtime no la expone, el campo sigue siendo un texto libre y el servidor
 *  valida igual. */
function timezoneOptions(): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  try {
    return supported ? supported('timeZone') : []
  } catch {
    return []
  }
}

function displayValue(field: ProfileFieldDef, draft: ProfileDraft): string {
  const raw = draft[field.key]?.trim()
  if (!raw) return '—'
  if (field.kind === 'select') {
    return field.options.find((option) => option.value === raw)?.label ?? raw
  }
  if (field.key === 'telegram_username') return `@${raw}`
  if (field.key === 'height_cm') return `${raw} cm`
  return raw
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
  timezones,
}: {
  field: ProfileFieldDef
  value: string
  disabled: boolean
  onChange: (value: string) => void
  timezones: string[]
}) {
  if (field.kind === 'select') {
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <option value="">Sin definir</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  const listId = field.key === 'timezone' && timezones.length ? 'profile-timezones' : undefined

  return (
    <>
      <Input
        type={field.kind}
        inputMode={field.inputMode}
        step={field.step}
        placeholder={field.placeholder}
        value={value}
        disabled={disabled}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
      />
      {listId && (
        <datalist id={listId}>
          {timezones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      )}
    </>
  )
}

export function PerfilTab({
  profile,
  onSaveProfile,
  onSetProfilePhoto,
  onClearProfilePhoto,
}: {
  profile: UserProfile | null
  /** `null` si guardó; el mensaje de error si no. */
  onSaveProfile: (patch: UserProfileInput) => Promise<string | null>
  onSetProfilePhoto: (file: File) => void
  onClearProfilePhoto: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile))
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const timezones = useMemo(timezoneOptions, [])

  // Mientras se edita no se pisa el borrador: un refresco de fondo borraria lo
  // que la persona esta escribiendo.
  useEffect(() => {
    if (!editing) setDraft(draftFromProfile(profile))
  }, [profile, editing])

  // Tras todos los hooks: `null` es «aun no llego», no «perfil vacio» — un
  // perfil sin rellenar llega igual, solo que con los campos en null.
  if (profile === null) return <PerfilSkeleton />

  const photoUrl = profile?.photo_url
    ? `${profile.photo_url}?t=${encodeURIComponent(profile.updated_at || '')}`
    : null
  const name = profile?.full_name?.trim() || 'Sin nombre'

  const startEdit = () => {
    setDraft(draftFromProfile(profile))
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(draftFromProfile(profile))
    setError('')
    setEditing(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const patch = profilePatch(draft, profile)
      if (!Object.keys(patch).length) {
        setEditing(false)
        return
      }
      const failure = await onSaveProfile(patch)
      if (failure) setError(failure)
      else setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" />
                Perfil
              </CardTitle>
              <CardDescription>
                Quién eres y cómo contactarte. Tus lecturas corporales están en las otras pestañas.
              </CardDescription>
            </div>
            {!editing ? (
              <Button type="button" variant="outline" size="sm" onClick={startEdit}>
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={cancelEdit}>
                  <X data-icon="inline-start" />
                  Cancelar
                </Button>
                <Button type="button" size="sm" disabled={saving} onClick={save}>
                  {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="flex size-20 overflow-hidden rounded-2xl bg-primary/10 text-primary">
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto de perfil" className="size-full object-cover" />
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
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  if (file) onSetProfilePhoto(file)
                  event.currentTarget.value = ''
                }}
              />
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="xs" onClick={() => avatarInputRef.current?.click()}>
                  <Camera className="size-3.5" />
                  {photoUrl ? 'Cambiar' : 'Subir'}
                </Button>
                {photoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Quitar foto de perfil"
                    onClick={onClearProfilePhoto}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-heading text-2xl font-extrabold tracking-tight">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile?.age != null && <span>{profile.age} años</span>}
                {profile?.height_cm != null && <span>{profile.height_cm} cm</span>}
                {profile?.sex && (
                  <span>{SEX_OPTIONS.find((option) => option.value === profile.sex)?.label ?? profile.sex}</span>
                )}
                {profile?.activity_level && (
                  <span>
                    {ACTIVITY_OPTIONS.find((option) => option.value === profile.activity_level)?.label ??
                      profile.activity_level}
                  </span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {PROFILE_SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {SECTION_ICONS[section.key]}
              {section.title}
            </CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.fields.map((field) => (
                <div key={field.key} className={cn(field.wide && 'sm:col-span-2 lg:col-span-3')}>
                  <div className="kicker">{field.label}</div>
                  {editing ? (
                    <div className="mt-1 space-y-1">
                      <FieldInput
                        field={field}
                        value={draft[field.key]}
                        disabled={saving}
                        timezones={timezones}
                        onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                      />
                      {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
                    </div>
                  ) : (
                    <div className="mt-0.5 truncate text-sm font-medium" title={displayValue(field, draft)}>
                      {displayValue(field, draft)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {section.key === 'avisos' && !editing && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Send className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Todavía no se envía ningún mensaje: estos datos solo se guardan para cuando existan los avisos
                automáticos.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
