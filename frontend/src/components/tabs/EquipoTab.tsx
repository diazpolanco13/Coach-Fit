import { useState } from 'react'
import { Dumbbell, Trash2 } from 'lucide-react'
import type { UserEquipment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { getRestSeconds, setRestSeconds } from '@/lib/settings'

export function EquipoTab({
  planName,
  equipment,
  equipmentName,
  equipmentType,
  equipmentWeight,
  onEquipmentNameChange,
  onEquipmentTypeChange,
  onEquipmentWeightChange,
  onAddEquipment,
  onRemoveEquipment,
}: {
  planName: string
  equipment: UserEquipment[]
  equipmentName: string
  equipmentType: string
  equipmentWeight: string
  onEquipmentNameChange: (v: string) => void
  onEquipmentTypeChange: (v: string) => void
  onEquipmentWeightChange: (v: string) => void
  onAddEquipment: () => void
  onRemoveEquipment: (id: number) => void
}) {
  const [restSeconds, setRestSecondsState] = useState(getRestSeconds())

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="size-5 text-primary" /> Mi Equipamiento
          </CardTitle>
          <CardDescription>Registra los pesos y equipos que tienes disponibles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input placeholder="ej: Mancuerna" value={equipmentName} onChange={(e) => onEquipmentNameChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={equipmentType} onValueChange={onEquipmentTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dumbbell">Mancuerna</SelectItem>
                  <SelectItem value="band">Liga</SelectItem>
                  <SelectItem value="bench">Banco</SelectItem>
                  <SelectItem value="pull_up_bar">Barra de dominadas</SelectItem>
                  <SelectItem value="wheel">Rueda abdominal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="ej: 12.5"
                value={equipmentWeight}
                onChange={(e) => onEquipmentWeightChange(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={onAddEquipment}>Agregar</Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Equipamiento registrado</h3>
            {equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay equipamiento registrado aún.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {equipment.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="text-sm">
                      <div className="font-medium">{eq.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {eq.equipment_type} {eq.weight_kg ? `· ${eq.weight_kg} kg` : ''} {eq.quantity > 1 ? `· ×${eq.quantity}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${eq.name}`}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveEquipment(eq.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias de entrenamiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Descanso entre series</Label>
              <span className="font-medium">{restSeconds} s</span>
            </div>
            <Slider
              min={30}
              max={240}
              step={15}
              value={[restSeconds]}
              onValueChange={([v]) => {
                setRestSecondsState(v)
                setRestSeconds(v)
              }}
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-muted-foreground">Regla de progresión</span>
              <strong>+peso si RPE ≤ 7</strong>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-muted-foreground">Plan semanal</span>
              <strong>{planName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach</span>
              <strong>Gemma local · reglas de respaldo</strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
