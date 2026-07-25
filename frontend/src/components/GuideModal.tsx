import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MediaImg } from '@/components/MediaImg'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'

export function GuideModal({
  ex,
  onClose,
}: {
  ex: Exercise | null
  onClose: () => void
}) {
  // El listado del catalogo llega sin guias (son ~70% de su peso), asi que la
  // pedimos al abrir la ficha. Si el ejercicio ya la trae, no hay fetch.
  const [steps, setSteps] = useState<string[] | null>(null)

  useEffect(() => {
    if (!ex) return
    if (ex.guide_es?.length) {
      setSteps(ex.guide_es)
      return
    }
    let cancelled = false
    setSteps(null)
    api
      .exercise(ex.id)
      .then((full) => !cancelled && setSteps(full.guide_es ?? []))
      .catch(() => !cancelled && setSteps([]))
    return () => {
      cancelled = true
    }
  }, [ex])

  return (
    <Dialog open={!!ex} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-t-4 border-t-primary">
        {ex && (
          <>
            <DialogHeader>
              <DialogTitle>{ex.name_es}</DialogTitle>
              <DialogDescription>
                {muscleES(ex.target)} · {equipmentES(ex.equipment)}
                {ex.secondary_muscles?.length ? ` · también: ${ex.secondary_muscles.map(muscleES).join(', ')}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4 pt-0">
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={ex.name_es}
                preferGif
                className="mx-auto max-h-56 object-contain"
              />
              {steps === null ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando guía…
                </div>
              ) : steps.length ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  {steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Este ejercicio no tiene guía disponible.
                </p>
              )}
              <Button className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
