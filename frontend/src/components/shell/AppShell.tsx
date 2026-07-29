import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise, UserProfile, WeekDay } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog, NoticeDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AppHeader } from '@/components/shell/AppHeader'
import { MobileBottomBar } from '@/components/shell/MobileBottomBar'
import { Sidebar } from '@/components/shell/Sidebar'
import { NavContext, type Guard } from '@/components/shell/NavContext'
import { DataContext } from '@/components/shell/DataContext'
import { EspacioScreen } from '@/components/gym/EspacioScreen'
import { PlanScreen } from '@/components/plan/PlanScreen'
import { RegistrarScreen } from '@/components/session/RegistrarScreen'
import { AjustesScreen } from '@/components/shell/AjustesScreen'
import { useGyms } from '@/hooks/useGyms'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePlanDraft } from '@/hooks/usePlanDraft'
import { usePlans } from '@/hooks/usePlans'
import { crumbsFor } from '@/lib/breadcrumbs'
import {
  changesPlan,
  espacioRoute,
  INICIO,
  isProgresoTab,
  parseRoute,
  planRoute,
  routeKey,
  type Route,
} from '@/lib/nav'
import { ProgresoTabs } from '@/components/shell/ProgresoTabs'
import { useAuth } from '@/components/auth/AuthContext'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import {
  getLastRoute,
  getSidebarCollapsed,
  setLastRoute,
  setSidebarCollapsed,
} from '@/lib/settings'
import { cn } from '@/lib/utils'

const HISTORY_MAX = 40

/** Lo que espera a que se resuelvan los cambios sin guardar. Navegar y cerrar
 *  sesión pierden lo mismo, así que comparten diálogo. */
type Pending = { kind: 'route'; route: Route } | { kind: 'logout' }

export type ScreenHelpers = {
  openGuide: (ex: Exercise) => void
  startTraining: (day: WeekDay) => void
  goRegister: (day: WeekDay) => void
  goRegisterDate: (date: string) => void
  go: (route: Route) => void
}

export function AppShell({
  exercises,
  equipmentUnlocks,
  weekDays,
  activePlanName,
  planGymId,
  onMarkDay,
  onWeekChanged,
  openGuide,
  startTraining,
  profile,
  screens,
}: {
  exercises: Exercise[]
  equipmentUnlocks: Record<string, string[]>
  weekDays: WeekDay[]
  activePlanName: string
  /** Espacio al que pertenece el plan activo. */
  planGymId: number | null
  onMarkDay: (day: WeekDay, completed: boolean) => Promise<void>
  onWeekChanged: () => Promise<void>
  openGuide: (ex: Exercise) => void
  startTraining: (day: WeekDay) => void
  profile?: UserProfile | null
  /** Pantallas que siguen viviendo en App: Hoy, Perfil, Fuerza, Cardio, Catálogo. Se
   *  reciben como función para poder darles los ayudantes de navegación. */
  screens: (h: ScreenHelpers) => {
    hoy: React.ReactNode
    coach: React.ReactNode
    perfil: React.ReactNode
    mediciones: React.ReactNode
    tendencias: React.ReactNode
    fuerza: React.ReactNode
    cardio: React.ReactNode
    consistencia: React.ReactNode
    catalogo: React.ReactNode
  }
}) {
  const { logout, changePassword } = useAuth()
  const [route, setRoute] = useState<Route>(() => parseRoute(getLastRoute()))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsedPref, setCollapsedPref] = useState(getSidebarCollapsed)
  const [registrarDate, setRegistrarDate] = useState<string | undefined>()
  // Lo que está esperando a que se resuelvan los cambios sin guardar. Empezó
  // siendo solo una ruta; cerrar sesión pierde lo mismo, así que pasa por el
  // mismo diálogo de tres botones en vez de construir un segundo.
  const [pending, setPending] = useState<Pending | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [deletePlan, setDeletePlan] = useState<{ id: number; name: string } | null>(null)
  const [deleteGym, setDeleteGym] = useState<{ id: number; name: string } | null>(null)
  const [gymNotice, setGymNotice] = useState<string | null>(null)
  const historyRef = useRef<Route[]>([])

  const isLg = useMediaQuery('(min-width: 1024px)')
  const isMd = useMediaQuery('(min-width: 768px)')
  // Entre md y lg el sidebar es un riel de iconos: no se persiste ese colapso,
  // porque el usuario no lo eligió y le sorprendería al volver al escritorio.
  const collapsed = isLg ? collapsedPref : true

  const plansApi = usePlans()
  const gymsApi = useGyms()
  const selectedPlanId = route.k === 'plan' ? route.id : null
  const draftApi = usePlanDraft(selectedPlanId, plansApi.reloadToken)

  // Ref y no estado: `dirty` cambia en cada pulsación de tecla, y leerlo desde
  // el contexto re-renderizaría el sidebar entero por carácter.
  const guardRef = useRef<Guard | null>(null)
  const dirtyRef = useRef(false)
  dirtyRef.current = draftApi.dirty

  const pushHistory = (from: Route) => {
    historyRef.current.push(from)
    if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift()
    setCanGoBack(true)
  }

  const clearHistory = () => {
    historyRef.current = []
    setCanGoBack(false)
  }

  const registerGuard = useCallback((guard: Guard | null) => {
    guardRef.current = guard
  }, [])

  const navigate = useCallback(
    (next: Route, opts?: { replace?: boolean }) => {
      if (routeKey(next) === routeKey(route)) {
        setDrawerOpen(false)
        return
      }
      // Solo se pregunta al cambiar de plan: ir a Hoy y volver no pierde nada,
      // porque el borrador vive aquí y no se desmonta.
      if (dirtyRef.current && changesPlan(route, next)) {
        setPending({ kind: 'route', route: next })
        return
      }
      if (!opts?.replace) pushHistory(route)
      setRoute(next)
      setDrawerOpen(false)
    },
    [route],
  )

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop()
    setCanGoBack(historyRef.current.length > 0)
    setRoute(prev ?? INICIO)
    setDrawerOpen(false)
  }, [])

  useEffect(() => setLastRoute(routeKey(route)), [route])

  // Una ruta guardada puede apuntar a un plan o espacio ya borrado. Sin esto,
  // pantalla en blanco al arrancar.
  useEffect(() => {
    if (route.k === 'plan' && plansApi.plans.length && !plansApi.plans.some((p) => p.id === route.id)) {
      clearHistory()
      setRoute(INICIO)
    }
    if (route.k === 'espacio' && gymsApi.gyms.length && !gymsApi.gyms.some((g) => g.id === route.id)) {
      clearHistory()
      setRoute(INICIO)
    }
  }, [route, plansApi.plans, gymsApi.gyms])

  // Abrir un plan de otro espacio cambia el espacio activo al suyo. Una sola
  // dirección: plan -> espacio, nunca al revés.
  useEffect(() => {
    if (route.k !== 'plan') return
    const plan = plansApi.plans.find((p) => p.id === route.id)
    if (plan?.gym_id && plan.gym_id !== gymsApi.activeGym?.id) gymsApi.setActiveGym(plan.gym_id)
  }, [route, plansApi.plans, gymsApi])

  const goRegisterDate = useCallback(
    (date: string) => {
      setRegistrarDate(date)
      navigate({ k: 'registrar', date })
    },
    [navigate],
  )

  const goRegister = useCallback((day: WeekDay) => goRegisterDate(day.date), [goRegisterDate])

  const dataValue = useMemo(
    () => ({
      exercises,
      equipmentUnlocks,
      gyms: gymsApi.gyms,
      activeGym: gymsApi.activeGym,
      maxGyms: gymsApi.maxGyms,
      setActiveGym: gymsApi.setActiveGym,
      reloadGyms: gymsApi.reloadGyms,
      activeEquipment: gymsApi.activeEquipment,
      openGuide,
      startTraining,
    }),
    [exercises, equipmentUnlocks, gymsApi, openGuide, startTraining],
  )

  const navValue = useMemo(
    () => ({ route, navigate, goBack, canGoBack, registerGuard, drawerOpen, setDrawerOpen }),
    [route, navigate, goBack, canGoBack, registerGuard, drawerOpen],
  )

  const planForCrumbs =
    route.k === 'plan'
      ? plansApi.plans.find((p) => p.id === route.id)
      : historyRef.current[historyRef.current.length - 1]?.k === 'plan'
        ? plansApi.plans.find(
            (p) => p.id === (historyRef.current[historyRef.current.length - 1] as { id: number }).id,
          )
        : plansApi.plans.find((p) => p.is_active)

  const crumbs = useMemo(() => {
    const from = historyRef.current[historyRef.current.length - 1] ?? null
    const planName =
      route.k === 'plan'
        ? draftApi.draft.name || planForCrumbs?.name
        : planForCrumbs?.name || activePlanName
    const gym =
      route.k === 'espacio'
        ? gymsApi.gyms.find((g) => g.id === route.id)
        : gymsApi.activeGym
    return crumbsFor(
      route,
      {
        planName,
        gymName: gym?.name,
        registrarDate: route.k === 'registrar' ? registrarDate ?? route.date : undefined,
      },
      from,
    )
  }, [route, draftApi.draft.name, planForCrumbs?.name, activePlanName, gymsApi, registrarDate])

  // --- Acciones que el sidebar dispara --------------------------------------

  const newPlan = async () => {
    const base = 'Plan nuevo'
    const taken = new Set(plansApi.plans.map((p) => p.name.toLowerCase()))
    let name = base
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`
    const created = await plansApi.createPlan({ name, gym_id: gymsApi.activeGym?.id ?? null })
    navigate(planRoute(created.id))
  }

  const newGym = async () => {
    const base = 'Espacio nuevo'
    const taken = new Set(gymsApi.gyms.map((g) => g.name.toLowerCase()))
    let name = base
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`
    const created = await (await import('@/lib/api')).api.createGym({ name, kind: 'comercial' })
    await gymsApi.reloadGyms()
    navigate(espacioRoute(created.id))
  }

  const deleteCurrentPlan = async (id: number) => {
    await plansApi.deletePlan(id)
    await onWeekChanged()
    clearHistory()
    setRoute(INICIO)
  }

  const deleteCurrentGym = async (id: number) => {
    const { api } = await import('@/lib/api')
    const res = await api.deleteGym(id)
    await gymsApi.reloadGyms()
    await plansApi.reloadPlans()
    if (res.plans_orphaned.length) {
      setGymNotice(
        `${res.plans_orphaned.length} plan(es) apuntaban a ese espacio y se han quedado sin anclar. Vuelve a asignarlos desde su pantalla.`,
      )
    }
    clearHistory()
    setRoute(INICIO)
  }

  const resolvePending = async (choice: 'guardar' | 'descartar' | 'cancelar') => {
    const target = pending
    setPending(null)
    if (choice === 'cancelar' || !target) return
    if (choice === 'guardar') {
      const ok = await draftApi.save()
      if (!ok) return
      await onWeekChanged()
    }
    // «Descartar» sigue adelante sin guardar: el borrador del plan quedará
    // atrás al cambiar de ruta (el shell no desmonta el draft del id anterior
    // hasta que el usePlanDraft cambie de plan).
    if (target.kind === 'logout') {
      await logout()
      return
    }
    pushHistory(route)
    setRoute(target.route)
    setDrawerOpen(false)
  }

  /** Cerrar sesión desmonta `App` entera, así que se lleva por delante el mismo
   *  borrador que se protege al navegar. Misma pregunta, mismo diálogo. */
  const requestLogout = () => {
    if (dirtyRef.current) {
      setPending({ kind: 'logout' })
      return
    }
    void logout()
  }

  const sidebar = (
    <Sidebar
      route={route}
      navigate={navigate}
      collapsed={collapsed && isMd}
      onToggleCollapse={
        isLg
          ? () => {
              const next = !collapsedPref
              setCollapsedPref(next)
              setSidebarCollapsed(next)
            }
          : undefined
      }
      plans={plansApi.plans}
      activePlanId={plansApi.activeId}
      dirtyPlanId={draftApi.dirty ? draftApi.draft.planId : null}
      gyms={gymsApi.gyms}
      activeGymId={gymsApi.activeGym?.id ?? null}
      canAddPlan={plansApi.plans.length < plansApi.maxPlans}
      canAddGym={gymsApi.gyms.length < gymsApi.maxGyms}
      onNewPlan={newPlan}
      onNewGym={newGym}
    />
  )

  const currentGym = route.k === 'espacio' ? gymsApi.gyms.find((g) => g.id === route.id) : undefined
  const rendered = screens({ openGuide, startTraining, goRegister, goRegisterDate, go: navigate })
  /** El espacio del plan activo manda sobre el seleccionado para todo lo que
   *  toque material real: entrenar y sugerir progresión. */
  const trainingGymId = planGymId ?? gymsApi.activeGym?.id ?? null

  return (
    <DataContext.Provider value={dataValue}>
      <NavContext.Provider value={navValue}>
        <div
          className="md:grid md:min-h-svh"
          style={{ gridTemplateColumns: `${collapsed ? 64 : 248}px minmax(0,1fr)` }}
        >
          {isMd ? (
            <aside className="sticky top-0 h-svh overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
              {sidebar}
            </aside>
          ) : (
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
                <SheetHeader className="border-sidebar-border">
                  <SheetTitle>Menú</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
              </SheetContent>
            </Sheet>
          )}

          <div className="flex min-w-0 flex-col">
            <AppHeader
              gyms={gymsApi.gyms}
              activeGym={gymsApi.activeGym}
              onChangeGym={gymsApi.setActiveGym}
              crumbs={crumbs}
              canGoBack={canGoBack || route.k === 'registrar'}
              onBack={goBack}
              onNavigate={navigate}
              showMenuButton={!isMd}
              onOpenMenu={() => setDrawerOpen(true)}
              route={route}
              profile={profile}
              onChangePassword={() => setPasswordOpen(true)}
              onLogout={requestLogout}
            />

            <main className={cn('mx-auto w-full max-w-[1100px] px-4 py-5 pb-20 sm:px-6 md:pb-8')}>
              {isProgresoTab(route) && <ProgresoTabs route={route} onNavigate={navigate} />}

              {route.k === 'hoy' && rendered.hoy}
              {route.k === 'coach' && rendered.coach}
              {route.k === 'perfil' && rendered.perfil}
              {route.k === 'mediciones' && rendered.mediciones}
              {route.k === 'tendencias' && rendered.tendencias}
              {route.k === 'fuerza' && rendered.fuerza}
              {route.k === 'cardio' && rendered.cardio}
              {route.k === 'consistencia' && rendered.consistencia}
              {route.k === 'catalogo' && rendered.catalogo}
              {route.k === 'ajustes' && <AjustesScreen />}

              {route.k === 'registrar' && (
                <RegistrarScreen
                  days={weekDays}
                  exercises={exercises}
                  initialDate={registrarDate}
                  gymId={trainingGymId}
                  // Sin `goBack()`: Registrar dejó de ser un formulario de ida y
                  // vuelta para convertirse en un sitio por el que se pasea. Al
                  // guardar te devolvía a la pantalla desde la que hubieras
                  // entrado —el plan, Hoy, lo que fuera—, así que perdías de
                  // vista la fecha que estabas mirando. Ahora te quedas en ella y
                  // la propia pantalla confirma. Para salir está «Volver».
                  onSaved={onWeekChanged}
                  onOpenExercise={openGuide}
                />
              )}

              {route.k === 'plan' && (
                <PlanScreen
                  draft={draftApi.draft}
                  dispatch={draftApi.dispatch}
                  dirty={draftApi.dirty}
                  loading={draftApi.loading}
                  saving={draftApi.saving}
                  error={draftApi.error}
                  onSave={async () => {
                    if (await draftApi.save()) await onWeekChanged()
                  }}
                  sub={route.sub}
                  isActive={plansApi.activeId === route.id}
                  weekDays={weekDays}
                  onDuplicate={async (gymId?: number) => {
                    const copy = await plansApi.duplicatePlan(route.id)
                    // La copia nace en el espacio del original: para «duplicar
                    // alli» hay que re-anclarla, y se hace aqui y no en el
                    // borrador porque el usuario aterriza en la copia ya movida,
                    // sin cambios pendientes que recordar guardar.
                    if (gymId != null && gymId !== copy.gym?.id) {
                      await plansApi.movePlanToGym(copy.id, gymId)
                    }
                    navigate(planRoute(copy.id))
                  }}
                  onActivate={async () => {
                    await plansApi.activatePlan(route.id)
                    await onWeekChanged()
                  }}
                  onDelete={() => setDeletePlan({ id: route.id, name: draftApi.draft.name })}
                  onMarkDay={onMarkDay}
                  onGoRegister={goRegister}
                  onGoTrain={startTraining}
                />
              )}

              {route.k === 'espacio' &&
                (currentGym ? (
                  <EspacioScreen
                    gym={currentGym}
                    sub={route.sub}
                    plans={plansApi.plans}
                    canDelete={gymsApi.gyms.length > 1}
                    onChanged={gymsApi.reloadGyms}
                    onDelete={() => setDeleteGym({ id: currentGym.id, name: currentGym.name })}
                  />
                ) : null)}
            </main>
          </div>

          <MobileBottomBar
            route={route}
            navigate={navigate}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        </div>

        {/* Perder trabajo debe ser una elección deliberada, no el valor por
            defecto. Tres botones, y sobre Dialog y no window.confirm: este
            último bloquea, no tiene estilo en móvil y se pinta detrás de un
            Sheet abierto. */}
        <Dialog open={pending != null} onOpenChange={(v) => !v && resolvePending('cancelar')}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Cambios sin guardar</DialogTitle>
              <DialogDescription>
                Tienes cambios sin guardar en «{draftApi.draft.name}».
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => resolvePending('cancelar')}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => resolvePending('descartar')}>
                Descartar
              </Button>
              <Button onClick={() => resolvePending('guardar')}>Guardar y salir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deletePlan != null}
          onOpenChange={(v) => !v && setDeletePlan(null)}
          title={`¿Eliminar «${deletePlan?.name ?? ''}»?`}
          description="No se puede deshacer."
          confirmLabel="Eliminar"
          destructive
          onConfirm={() => {
            if (deletePlan) void deleteCurrentPlan(deletePlan.id)
          }}
        />

        <ConfirmDialog
          open={deleteGym != null}
          onOpenChange={(v) => !v && setDeleteGym(null)}
          title={`¿Eliminar el espacio «${deleteGym?.name ?? ''}»?`}
          description="No se puede deshacer."
          confirmLabel="Eliminar"
          destructive
          onConfirm={() => {
            if (deleteGym) void deleteCurrentGym(deleteGym.id)
          }}
        />

        <NoticeDialog
          open={gymNotice != null}
          onOpenChange={(v) => !v && setGymNotice(null)}
          title="Espacio eliminado"
          description={gymNotice ?? undefined}
        />

        {/* Sin esto no habría forma de cambiar la contraseña después del primer
            login: la pantalla obligatoria solo aparece una vez. */}
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription>
                Al guardarla se cierran todas las demás sesiones.
              </DialogDescription>
            </DialogHeader>
            <ChangePasswordForm
              variant="settings"
              onSubmit={async (current, next) => {
                await changePassword(current, next)
                setPasswordOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </NavContext.Provider>
    </DataContext.Provider>
  )
}
