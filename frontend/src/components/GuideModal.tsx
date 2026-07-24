import type { Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MediaImg } from '@/components/MediaImg'
import { muscleES } from '@/lib/muscle'

export function GuideModal({
  ex,
  onClose,
}: {
  ex: Exercise | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!ex} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-t-4 border-t-primary">
        {ex && (
          <>
            <DialogHeader>
              <DialogTitle>{ex.name_es}</DialogTitle>
              <DialogDescription>
                {muscleES(ex.target)} · {ex.equipment}
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
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {ex.guide_es.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
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
