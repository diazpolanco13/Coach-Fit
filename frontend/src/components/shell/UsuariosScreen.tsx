import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Plus, UserPlus } from 'lucide-react'
import { useSession } from '@/components/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, type ManagedUser, type Role } from '@/lib/api'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  entrenador: 'Entrenador',
  usuario: 'Usuario',
}

const ROLE_OPTIONS: Role[] = ['usuario', 'entrenador', 'admin']

function formatWhen(raw: string | null): string {
  if (!raw) return 'Nunca'
  try {
    return new Date(raw).toLocaleString('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return raw
  }
}

function TempPasswordNotice({
  open,
  password,
  title,
  onClose,
}: {
  open: boolean
  password: string
  title: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-sm gap-0 overflow-visible p-0" showCloseButton={false}>
        <DialogHeader className="space-y-2 px-6 pt-6 pb-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Cópiala y pásasela por un canal seguro. No se vuelve a mostrar: si la
            pierdes, habrá que resetearla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 pb-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border bg-muted/40 px-3.5 py-2.5 font-mono text-sm tracking-wide">
              {password}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              aria-label="Copiar contraseña"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(password)
                  setCopied(true)
                } catch {
                  // Sin clipboard API: el usuario puede seleccionar el código.
                }
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Al entrar deberá elegir una contraseña nueva.
          </p>
        </div>
        <DialogFooter className="px-6 pt-3 pb-6">
          <Button type="button" onClick={onClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsuariosScreen() {
  const me = useSession()
  const isAdmin = me.role === 'admin'

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('usuario')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [tempTitle, setTempTitle] = useState('Contraseña temporal')

  const [pendingDeactivate, setPendingDeactivate] = useState<ManagedUser | null>(null)

  const trainers = useMemo(
    () => users.filter((u) => u.role === 'entrenador' && u.is_active),
    [users],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { users: next } = await api.users()
      setUsers(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const resetCreateForm = () => {
    setEmail('')
    setFullName('')
    setRole('usuario')
    setCreateError('')
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const body: {
        email: string
        full_name?: string | null
        role?: Role
      } = {
        email: email.trim(),
        full_name: fullName.trim() || null,
        role: isAdmin ? role : 'usuario',
      }
      const { user, temporary_password } = await api.createUser(body)
      setUsers((prev) =>
        [...prev.filter((u) => u.id !== user.id), user].sort((a, b) =>
          a.email.localeCompare(b.email, 'es'),
        ),
      )
      setCreateOpen(false)
      resetCreateForm()
      setTempTitle(`Contraseña para ${user.email}`)
      setTempPassword(temporary_password)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const patchRole = async (target: ManagedUser, next: Role) => {
    if (next === target.role) return
    setBusyId(target.id)
    setError('')
    try {
      const { user } = await api.patchUser(target.id, { role: next })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const resetPassword = async (target: ManagedUser) => {
    setBusyId(target.id)
    setError('')
    try {
      const { temporary_password } = await api.resetUserPassword(target.id)
      setTempTitle(`Nueva contraseña para ${target.email}`)
      setTempPassword(temporary_password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const setActive = async (target: ManagedUser, active: boolean) => {
    setBusyId(target.id)
    setError('')
    try {
      const { user } = await api.setUserActive(target.id, active)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
      setPendingDeactivate(null)
    }
  }

  const trainerName = (id: number | null) => {
    if (id == null) return null
    const t = trainers.find((u) => u.id === id) ?? users.find((u) => u.id === id)
    return t?.full_name || t?.email || `#${id}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea cuentas de prueba, asigna roles y resetea contraseñas.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            resetCreateForm()
            setCreateOpen(true)
          }}
        >
          <UserPlus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personas</CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Como administrador ves a todo el mundo.'
              : 'Ves tu cuenta y las personas asignadas a ti.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </div>
          ) : users.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay nadie. Crea el primero.
            </p>
          ) : (
            <ul className="divide-y">
              {users.map((u) => {
                const busy = busyId === u.id
                const isSelf = u.id === me.id
                return (
                  <li
                    key={u.id}
                    className={cn(
                      'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                      !u.is_active && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {u.full_name || u.email}
                        </span>
                        {!u.is_active ? (
                          <Badge variant="secondary">Inactivo</Badge>
                        ) : null}
                        {isSelf ? <Badge variant="secondary">Tú</Badge> : null}
                        {u.must_change_password ? (
                          <Badge variant="secondary">Pendiente de contraseña</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Último acceso: {formatWhen(u.last_login_at)}
                        {u.trainer_id != null ? (
                          <> · Entrenador: {trainerName(u.trainer_id)}</>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin ? (
                        <Select
                          value={u.role}
                          disabled={busy || (isSelf && u.role === 'admin')}
                          onValueChange={(v) => void patchRole(u, v as Role)}
                        >
                          <SelectTrigger className="w-[10.5rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void resetPassword(u)}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="size-3.5" />
                        )}
                        Resetear
                      </Button>

                      {!isSelf ? (
                        u.is_active ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPendingDeactivate(u)}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void setActive(u, true)}
                          >
                            Activar
                          </Button>
                        )
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="max-w-md gap-0 overflow-visible p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 px-6 pt-6 pb-3 pr-14">
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Se genera una contraseña temporal. La persona deberá cambiarla al
              entrar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser}>
            <div className="space-y-4 px-6 py-2">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  autoComplete="off"
                  required
                  className="h-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-name">Nombre</Label>
                <Input
                  id="user-name"
                  className="h-10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {createError ? (
                <p role="alert" className="text-sm text-destructive">
                  {createError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 px-6 pt-4 pb-6">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || !email.trim()}>
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeactivate != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null)
        }}
        title="Desactivar usuario"
        description={
          pendingDeactivate
            ? `Se cerrarán las sesiones de ${pendingDeactivate.email}. Podrás reactivarlo después.`
            : undefined
        }
        confirmLabel="Desactivar"
        destructive
        onConfirm={() => {
          if (pendingDeactivate) void setActive(pendingDeactivate, false)
        }}
      />

      <TempPasswordNotice
        open={tempPassword != null}
        password={tempPassword ?? ''}
        title={tempTitle}
        onClose={() => setTempPassword(null)}
      />
    </div>
  )
}
