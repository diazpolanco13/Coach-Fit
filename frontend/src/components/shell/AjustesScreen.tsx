import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { getRestSeconds, setRestSeconds } from '@/lib/settings'

/** Preferencias del dispositivo, no del plan ni del espacio.
 *
 *  El descanso entre series vive aquí y no en el plan a propósito: es comodidad
 *  de uso, y `TrainingMode` lo lee de forma síncrona al montar, sin esperar a
 *  ninguna petición. */
export function AjustesScreen() {
  const [rest, setRest] = useState(getRestSeconds())

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de entrenamiento</CardTitle>
          <CardDescription>Se guardan en este navegador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Descanso entre series</Label>
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
          </div>
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
