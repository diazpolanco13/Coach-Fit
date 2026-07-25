import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dumbbell, Loader2, Trash2 } from 'lucide-react'
import { api, type Gym, type GymKind, type PlanSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { ExerciseResultRow, type CurationState } from '@/components/exercise/ExerciseResultRow'
import { useData } from '@/components/shell/DataContext'
import { EQUIPMENT_TYPE_ES, equipmentTypeES } from '@/lib/equipment'
import { GYM_KIND_ES } from '@/lib/gym'
import { curationOf, useExerciseFilter, type Curation } from '@/lib/exerciseFilter'
import { cn } from '@/lib/utils'

function GymDataCard({
  gym,
  plansHere,
  canDelete,
  onPatch,
  onDelete,
}: {
  gym: Gym
  plansHere: PlanSummary[]
  canDelete: boolean
  onPatch: (patch: { name?: string; kind?: GymKind; icon?: string; notes?: string }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(gym.name)
  const [icon, setIcon] = useState(gym.icon ?? '')
  const [notes, setNotes] = useState(gym.notes ?? '')

  useEffect(() => {
    setName(gym.name)
    setIcon(gym.icon ?? '')
    setNotes(gym.notes ?? '')
  }, [gym])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del espacio</CardTitle>
        <CardDescription>
          Dónde entrenas. Su inventario y su biblioteca determinan qué te propone la app aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== gym.name && onPatch({ name: name.trim() })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Icono</Label>
            <Input
              value={icon}
              maxLength={4}
              placeholder="🏠"
              className="w-16 text-center"
              onChange={(e) => setIcon(e.target.value)}
              onBlur={() => icon !== (gym.icon ?? '') && onPatch({ icon })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={gym.kind} onValueChange={(kind) => onPatch({ kind: kind as GymKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GYM_KIND_ES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Input
            value={notes}
            placeholder="Horarios, cómo entrar, qué máquinas hay…"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (gym.notes ?? '') && onPatch({ notes })}
          />
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {plansHere.length
              ? `${plansHere.length} ${plansHere.length === 1 ? 'plan usa' : 'planes usan'} este espacio`
              : 'Ningún plan usa este espacio todavía'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5 text-muted-foreground hover:text-destructive"
            disabled={!canDelete}
            title={canDelete ? undefined : 'No puedes borrar tu único espacio'}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            Eliminar espacio
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function GymInventoryPanel({
  gym,
  onAdd,
  onRemove,
}: {
  gym: Gym
  onAdd: (body: { name: string; equipment_type: string; weight_kg: number | null }) => Promise<void>
  onRemove: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('dumbbell')
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onAdd({
        name: name.trim(),
        equipment_type: type,
        weight_kg: weight ? Number(weight) : null,
      })
      setName('')
      setWeight('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="size-5 text-primary" /> Inventario
        </CardTitle>
        <CardDescription>
          Lo que hay en {gym.name}. Filtra la biblioteca y limita los pesos que el coach propone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input placeholder="ej: Mancuerna" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EQUIPMENT_TYPE_ES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.5"
              placeholder="ej: 12.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : 'Agregar'}
            </Button>
          </div>
        </div>

        <Separator />

        {gym.equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin equipo: aquí solo entra el trabajo con peso corporal.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {gym.equipment.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-medium">{eq.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {equipmentTypeES(eq.equipment_type)} {eq.weight_kg ? `· ${eq.weight_kg} kg` : ''}{' '}
                    {eq.quantity > 1 ? `· ×${eq.quantity}` : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${eq.name}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(eq.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const PAGE = 40

function GymCurationPanel({ gym, curation, onMark }: {
  gym: Gym
  curation: Curation
  onMark: (exerciseId: string, state: CurationState) => void
}) {
  const { exercises, equipmentUnlocks, openGuide } = useData()
  const { filter, patch, results, shown, visible, showMore, muscles, equipments } =
    useExerciseFilter(exercises, gym.equipment, equipmentUnlocks, PAGE, curation)

  const stateOf = (id: string): CurationState =>
    curation.hidden.has(id) ? 'oculto' : curation.favorites.has(id) ? 'favorito' : 'disponible'

  const chip = (value: typeof filter.curated, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => patch({ curated: value })}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm transition-colors',
        filter.curated === value
          ? 'border-primary bg-primary text-primary-foreground'
          : 'hover:bg-muted',
      )}
    >
      {label}
      {count != null && count > 0 && <span className="ml-1 opacity-70">{count}</span>}
    </button>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de {gym.name}</CardTitle>
        <CardDescription>
          Todo lo que el inventario permite está disponible por defecto. Marca como favorito lo que
          de verdad usas, y oculta lo que no quieres ver aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {chip('todos', 'Disponibles')}
          {chip('favoritos', 'Favoritos', curation.favorites.size)}
          {chip('ocultos', 'Ocultos', curation.hidden.size)}
        </div>

        <ExerciseRoleChips role={filter.role} onChange={(role) => patch({ role })} className="flex-wrap" />
        <ExerciseFilterBar
          filter={filter}
          onPatch={patch}
          muscles={muscles}
          equipments={equipments}
        />

        <p className="text-xs text-muted-foreground">
          {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
        </p>

        <div className="space-y-1">
          {shown.map((ex) => (
            <ExerciseResultRow
              key={ex.id}
              ex={ex}
              overloadedMax={null}
              curation={{ state: stateOf(ex.id), onChange: (s) => onMark(ex.id, s) }}
              onOpenGuide={openGuide}
            />
          ))}
          {!results.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nada coincide con los filtros.
            </p>
          )}
          {visible < results.length && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={showMore}>
                Ver más ({results.length - visible} restantes)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function EspacioScreen({
  gym,
  sub,
  plans,
  canDelete,
  onChanged,
  onDelete,
}: {
  gym: Gym
  sub: 'inventario' | 'biblioteca'
  plans: PlanSummary[]
  canDelete: boolean
  onChanged: () => Promise<unknown>
  onDelete: () => void
}) {
  const [error, setError] = useState('')
  /** Copia local de la curación para que marcar sea instantáneo: la petición va
   *  detrás y, si falla, se revierte. */
  const [localCuration, setLocalCuration] = useState<Curation>(() => curationOf(gym.curation))

  useEffect(() => setLocalCuration(curationOf(gym.curation)), [gym.curation])

  const plansHere = useMemo(() => plans.filter((p) => p.gym_id === gym.id), [plans, gym.id])

  const mark = useCallback(
    (exerciseId: string, state: CurationState) => {
      setLocalCuration((prev) => {
        const favorites = new Set(prev.favorites)
        const hidden = new Set(prev.hidden)
        favorites.delete(exerciseId)
        hidden.delete(exerciseId)
        if (state === 'favorito') favorites.add(exerciseId)
        if (state === 'oculto') hidden.add(exerciseId)
        return { favorites, hidden }
      })
      api
        .markExercise(gym.id, exerciseId, state)
        .then(() => onChanged())
        .catch((e) => {
          setError(String((e as Error).message || e))
          setLocalCuration(curationOf(gym.curation))
        })
    },
    [gym.id, gym.curation, onChanged],
  )

  const run = (fn: () => Promise<unknown>) =>
    fn()
      .then(() => onChanged())
      .catch((e) => setError(String((e as Error).message || e)))

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/40 p-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {sub === 'inventario' ? (
        <>
          <GymDataCard
            gym={gym}
            plansHere={plansHere}
            canDelete={canDelete}
            onPatch={(patch) => run(() => api.patchGym(gym.id, patch))}
            onDelete={onDelete}
          />
          <GymInventoryPanel
            gym={gym}
            onAdd={async (body) => {
              await run(() => api.addGymEquipment(gym.id, body))
            }}
            onRemove={(id) => run(() => api.deleteGymEquipment(gym.id, id))}
          />
        </>
      ) : (
        <GymCurationPanel gym={gym} curation={localCuration} onMark={mark} />
      )}
    </div>
  )
}
