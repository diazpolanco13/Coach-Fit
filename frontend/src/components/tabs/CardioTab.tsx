import { useMemo } from 'react'
import { Footprints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatRow } from '@/components/StatRow'
import {
  CARDIO_KINDS,
  CARDIO_NOTES_MAX,
  CARDIO_SURFACES,
  cardioKindLabel,
  cardioSessionTypeLabel,
  cardioSurfaceLabel,
  formatPace,
  sessionTypesFor,
  type CardioKind,
  type CardioRun,
  type CardioSessionType,
  type CardioSurface,
} from '@/lib/cardio'
import { todayISO } from '@/lib/utils'

export function CardioTab({
  metricsRuns,
  runKind,
  runSessionType,
  runSurface,
  runKm,
  runMin,
  runRpe,
  runNotes,
  onRunKindChange,
  onRunSessionTypeChange,
  onRunSurfaceChange,
  onRunKmChange,
  onRunMinChange,
  onRunRpeChange,
  onRunNotesChange,
  onSaveRun,
}: {
  metricsRuns: CardioRun[]
  runKind: CardioKind
  runSessionType: CardioSessionType
  runSurface: CardioSurface
  runKm: string
  runMin: string
  runRpe: number | null
  runNotes: string
  onRunKindChange: (v: CardioKind) => void
  onRunSessionTypeChange: (v: CardioSessionType) => void
  onRunSurfaceChange: (v: CardioSurface) => void
  onRunKmChange: (v: string) => void
  onRunMinChange: (v: string) => void
  onRunRpeChange: (v: number | null) => void
  onRunNotesChange: (v: string) => void
  onSaveRun: () => void
}) {
  const stats = useMemo(() => {
    const monthPrefix = todayISO().slice(0, 7)
    const monthRuns = metricsRuns.filter((r) => r.date.startsWith(monthPrefix))
    const runsThisMonth = monthRuns.length
    const kmThisMonth = monthRuns.reduce((sum, r) => sum + Number(r.distance_km || 0), 0)

    const paces = metricsRuns.slice(0, 8).map((r) => r.pace_min_per_km).filter((p): p is number => p != null)
    const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null

    const longestRun = metricsRuns.reduce((max, r) => Math.max(max, Number(r.distance_km || 0)), 0)
    return { runsThisMonth, kmThisMonth, avgPace, longestRun }
  }, [metricsRuns])

  const sessionOptions = sessionTypesFor(runKind)
  const showSessionChips = runKind !== 'hiit'
  const canSave = Boolean(runKm && runMin && Number(runKm) > 0 && Number(runMin) > 0 && runSessionType)

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'Sesiones este mes', value: String(stats.runsThisMonth) },
          { label: 'Km este mes', value: stats.kmThisMonth.toFixed(1), suffix: 'km' },
          {
            label: 'Ritmo medio',
            value: stats.avgPace != null ? formatPace(stats.avgPace) : '—',
            suffix: stats.avgPace != null ? '/km' : undefined,
          },
          { label: 'Más larga', value: stats.longestRun ? stats.longestRun.toFixed(1) : '—', suffix: stats.longestRun ? 'km' : undefined },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Footprints className="size-5 text-primary" /> Registrar cardio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Tipo</div>
            <div className="flex flex-wrap gap-2">
              {CARDIO_KINDS.map((k) => (
                <Button
                  key={k.id}
                  type="button"
                  size="sm"
                  variant={runKind === k.id ? 'default' : 'outline'}
                  onClick={() => onRunKindChange(k.id)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          </div>

          {showSessionChips && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Intención</div>
              <div className="flex flex-wrap gap-2">
                {sessionOptions.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={runSessionType === s.id ? 'default' : 'outline'}
                    onClick={() => onRunSessionTypeChange(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Dónde</div>
            <div className="flex flex-wrap gap-2">
              {CARDIO_SURFACES.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={runSurface === s.id ? 'default' : 'outline'}
                  onClick={() => onRunSurfaceChange(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.1" min="0" placeholder="km" value={runKm} onChange={(e) => onRunKmChange(e.target.value)} />
            <Input type="number" step="1" min="0" placeholder="min" value={runMin} onChange={(e) => onRunMinChange(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">RPE (opcional)</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  className="min-w-8 px-2"
                  variant={runRpe === n ? 'default' : 'outline'}
                  onClick={() => onRunRpeChange(runRpe === n ? null : n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Notas (opcional)</span>
              <span>
                {runNotes.length}/{CARDIO_NOTES_MAX}
              </span>
            </div>
            <Textarea
              value={runNotes}
              maxLength={CARDIO_NOTES_MAX}
              rows={2}
              placeholder="Cómo te sentiste, terreno, clima…"
              onChange={(e) => onRunNotesChange(e.target.value.slice(0, CARDIO_NOTES_MAX))}
            />
          </div>

          <Button disabled={!canSave} onClick={onSaveRun}>
            Guardar
          </Button>

          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {metricsRuns.slice(0, 8).map((r) => {
              const intent = cardioSessionTypeLabel(r.kind, r.session_type)
              const where = cardioSurfaceLabel(r.surface)
              const parts = [
                cardioKindLabel(r.kind),
                intent || null,
                where || null,
                `${r.distance_km} km`,
                r.duration_min != null ? `${r.duration_min} min` : null,
                r.pace_min_per_km != null ? `${formatPace(r.pace_min_per_km)} /km` : null,
                r.rpe != null ? `RPE ${r.rpe}` : null,
              ].filter(Boolean)
              return (
                <li key={r.id}>
                  <span className="text-muted-foreground/80">{r.date}</span>
                  {': '}
                  <span className="font-medium text-foreground">{parts[0]}</span>
                  {parts.slice(1).map((p, i) => (
                    <span key={i}> · {p}</span>
                  ))}
                  {r.notes ? (
                    <div className="pl-0 text-xs italic text-muted-foreground/80">{r.notes}</div>
                  ) : null}
                </li>
              )
            })}
            {!metricsRuns.length && <li>Sin sesiones aún.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
