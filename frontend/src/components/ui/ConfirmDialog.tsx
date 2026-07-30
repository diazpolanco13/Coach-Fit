import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Confirmación con el look de la app. Sustituye `window.confirm`. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  dangerLabel,
  onDanger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Botón de confirmar en rojo (borrados). */
  destructive?: boolean
  onConfirm: () => void
  /** Tercera acción destructiva opcional (p. ej. «Salir sin guardar»). */
  dangerLabel?: string
  onDanger?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          {dangerLabel && onDanger ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onOpenChange(false)
                onDanger()
              }}
            >
              {dangerLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={destructive && !dangerLabel ? 'destructive' : 'default'}
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Aviso de una sola acción. Sustituye `window.alert`. */
export function NoticeDialog({
  open,
  onOpenChange,
  title,
  description,
  okLabel = 'Entendido',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  okLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {okLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
