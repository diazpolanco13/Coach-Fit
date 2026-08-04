import { useEffect, useState } from 'react'
import { Clock, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  durationToInput,
  formatClock,
  formatSessionSchedule,
  parseDurationInput,
} from '@/lib/sessionTime'

const STEP = 15

export function SessionScheduleEditor({
  open,
  onOpenChange,
  startedAt,
  durationMin,
  busy,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  startedAt: string | null | undefined
  durationMin: number | null | undefined
  busy?: boolean
  onSave: (startedAt: string, durationMin: number) => void | Promise<void>
}) {
  const [time, setTime] = useState(startedAt || formatClock())
  const [durationRaw, setDurationRaw] = useState(durationToInput(durationMin) || '1:00')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTime(startedAt || formatClock())
    setDurationRaw(durationToInput(durationMin) || '1:00')
    setError('')
  }, [open, startedAt, durationMin])

  const parsed = parseDurationInput(durationRaw)

  const nudge = (delta: number) => {
    const base = parsed ?? 60
    const next = Math.max(1, Math.min(600, base + delta))
    setDurationRaw(durationToInput(next))
  }

  const submit = async () => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError('Usa hora HH:MM')
      return
    }
    if (parsed == null) {
      setError('Duración: 1:30, 90 o 30m')
      return
    }
    setError('')
    await onSave(time, parsed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Horario del entrenamiento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="session-start">Hora de inicio</Label>
            <Input
              id="session-start"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 px-3.5 text-base tabular-nums [&::-webkit-calendar-picker-indicator]:ml-2 [&::-webkit-calendar-picker-indicator]:opacity-80"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-duration">Duración</Label>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                onClick={() => nudge(-STEP)}
                aria-label="Menos 15 minutos"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                id="session-duration"
                value={durationRaw}
                onChange={(e) => setDurationRaw(e.target.value)}
                placeholder="1:30"
                className="h-11 px-4 text-center font-heading text-xl font-bold tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                onClick={() => nudge(STEP)}
                aria-label="Más 15 minutos"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Formato 1:30, 90 min o 30m
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SessionScheduleChip({
  startedAt,
  durationMin,
  onClick,
}: {
  startedAt: string | null | undefined
  durationMin: number | null | undefined
  onClick: () => void
}) {
  const label = formatSessionSchedule(startedAt, durationMin)
  const filled = Boolean(label)
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        filled
          ? 'inline-flex h-8 items-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/25'
          : 'inline-flex h-8 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground'
      }
    >
      <Clock className="size-4 shrink-0 opacity-80" />
      <span className="tabular-nums">{label || 'Añadir horario'}</span>
    </button>
  )
}
