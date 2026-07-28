import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  getAfterSet,
  getCheckInPref,
  getRestSeconds,
  getRestTimerEnabled,
  getSessionView,
  setAfterSet,
  setCheckInPref,
  setRestSeconds,
  setRestTimerEnabled,
  setSessionView,
  type AfterSetPref,
  type CheckInPref,
  type SessionViewPref,
} from '@/lib/settings'
import { cn } from '@/lib/utils'

function PrefRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === o.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Preferencias del dispositivo, no del plan ni del espacio.
 *
 *  El descanso entre series vive aquí y no en el plan a propósito: es comodidad
 *  de uso, y `TrainingMode` lo lee de forma síncrona al montar, sin esperar a
 *  ninguna petición. */
export function AjustesScreen() {
  const [rest, setRest] = useState(getRestSeconds())
  const [restOn, setRestOn] = useState(getRestTimerEnabled())
  const [view, setView] = useState<SessionViewPref>(getSessionView())
  const [afterSet, setAfter] = useState<AfterSetPref>(getAfterSet())
  const [checkIn, setCheckIn] = useState<CheckInPref>(getCheckInPref())

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de entrenamiento</CardTitle>
          <CardDescription>Se guardan en este navegador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrefRow
            label="Vista por defecto de la sesión"
            value={view}
            options={[
              { id: 'focus', label: 'Foco' },
              { id: 'list', label: 'Lista' },
            ]}
            onChange={(v) => {
              setView(v)
              setSessionView(v)
            }}
          />

          <PrefRow
            label="Tras completar una serie"
            value={afterSet}
            options={[
              { id: 'next', label: 'Seguir en orden' },
              { id: 'stay', label: 'Quedarse' },
              { id: 'strip', label: 'Elegir en la franja' },
            ]}
            onChange={(v) => {
              setAfter(v)
              setAfterSet(v)
            }}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Temporizador de descanso</Label>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium',
                  restOn ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
                onClick={() => {
                  const next = !restOn
                  setRestOn(next)
                  setRestTimerEnabled(next)
                }}
              >
                {restOn ? 'Activado' : 'Apagado'}
              </button>
            </div>
            {restOn && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duración</span>
                  <span className="font-medium">{rest} s</span>
                </div>
                <Slider
                  min={30}
                  max={240}
                  step={15}
                  value={[rest]}
                  onValueChange={([v]) => {
                    setRest(v)
                    setRestSeconds(v)
                  }}
                />
              </>
            )}
          </div>

          <PrefRow
            label="Check-in al cerrar (ánimo / salud / energía)"
            value={checkIn}
            options={[
              { id: 'always', label: 'Siempre' },
              { id: 'touched', label: 'Solo si lo toqué' },
              { id: 'skip', label: 'Omitir' },
            ]}
            onChange={(v) => {
              setCheckIn(v)
              setCheckInPref(v)
            }}
          />

          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Regla de progresión</span>
            <strong>+peso si RPE ≤ 7</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Coach</span>
            <strong>Gemma local · reglas de respaldo</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
