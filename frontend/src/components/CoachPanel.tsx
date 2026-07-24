import { Bot, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

function markdownLite(text: string) {
  return text.split('\n').map((line, i) => {
    const t = line.trim()
    if (t.startsWith('### '))
      return (
        <h3 key={i} className="mt-4 text-base font-semibold text-foreground">
          {t.slice(4)}
        </h3>
      )
    if (t.startsWith('## '))
      return (
        <h2 key={i} className="mt-5 text-lg font-semibold text-foreground">
          {t.slice(3)}
        </h2>
      )
    if (t.startsWith('- '))
      return (
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed text-muted-foreground">
          {t.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}
        </li>
      )
    if (!t) return <div key={i} className="h-2" />
    return (
      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
        {t.replace(/\*\*(.*?)\*\*/g, '$1')}
      </p>
    )
  })
}

export function CoachPanel({
  coachNotes,
  onNotesChange,
  onAsk,
  busy,
  advice,
  adviceSource,
}: {
  coachNotes: string
  onNotesChange: (v: string) => void
  onAsk: () => void
  busy: boolean
  advice: string
  adviceSource: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          Coach inteligente
        </CardTitle>
        <CardDescription>
          Propone qué hacer según volumen, RPE, días entrenados, peso y carreras.
          {adviceSource ? ` Fuente: ${adviceSource === 'vllm' ? 'Gemma local' : 'reglas locales'}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="notes">Notas para el coach (opcional)</Label>
        <Textarea
          id="notes"
          placeholder="Ej: me duele el hombro izquierdo, dormí mal, quiero bajar de peso..."
          value={coachNotes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <Button onClick={onAsk} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Pedir recomendación
        </Button>
        <Separator />
        <div className="max-h-[420px] overflow-auto pr-1">
          {advice ? (
            markdownLite(advice)
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay consejo. Pide una recomendación.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
