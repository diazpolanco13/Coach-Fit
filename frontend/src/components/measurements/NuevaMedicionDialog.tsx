import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ProfileBodyDraft } from '@/components/measurements/NuevaMedicionForm'
import { NuevaMedicionForm } from '@/components/measurements/NuevaMedicionForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type NuevaMedicionDialogProps = {
  draft: ProfileBodyDraft
  photos: File[]
  onDraftChange: (field: keyof ProfileBodyDraft, value: string) => void
  onPhotosChange: (files: File[]) => void
  onRemovePhoto: (index: number) => void
  onSaveBody: () => Promise<boolean>
  onImportCsv: (file: File) => Promise<boolean>
  prominent?: boolean
}

export function NuevaMedicionDialog({
  draft,
  photos,
  onDraftChange,
  onPhotosChange,
  onRemovePhoto,
  onSaveBody,
  onImportCsv,
  prominent = false,
}: NuevaMedicionDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={prominent ? 'default' : 'outline'}>
          <Plus data-icon="inline-start" />
          Nueva medición
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,46rem)] max-w-none">
        <DialogHeader>
          <DialogTitle>Nueva medición</DialogTitle>
          <DialogDescription>
            Registra tu composición corporal y añade fotos de progreso si quieres.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 pt-0">
          <NuevaMedicionForm
            draft={draft}
            photos={photos}
            onDraftChange={onDraftChange}
            onPhotosChange={onPhotosChange}
            onRemovePhoto={onRemovePhoto}
            onSaveBody={onSaveBody}
            onImportCsv={onImportCsv}
            onSaved={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
