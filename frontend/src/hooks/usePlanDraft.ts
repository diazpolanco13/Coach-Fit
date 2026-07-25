import { useCallback, useEffect, useReducer, useState } from 'react'
import { api } from '@/lib/api'
import { emptyDraft, isDirty, planReducer, toPayload } from '@/lib/plan'

/** El borrador del plan vive en el shell, no en la pantalla.
 *
 *  Esa es la pieza que hace que navegar sea gratis: ir a «Hoy» y volver no
 *  desmonta nada, así que no hay que preguntar por cambios sin guardar. El
 *  guard solo salta al cambiar de plan, al hacer algo destructivo y al recargar
 *  la página. */
export function usePlanDraft(planId: number | null, reloadToken: number) {
  const [draft, dispatch] = useReducer(planReducer, emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Depende de `reloadToken` y NO del array de planes: cualquier recarga de
  // fondo de la lista descartaría el borrador en curso si dependiera de él.
  useEffect(() => {
    if (planId == null) return
    let cancelled = false
    api
      .plan(planId)
      .then((plan) => !cancelled && dispatch({ type: 'LOAD', plan }))
      .catch((e) => !cancelled && setError(String((e as Error).message || e)))
    return () => {
      cancelled = true
    }
  }, [planId, reloadToken])

  const dirty = isDirty(draft)

  const save = useCallback(async () => {
    if (draft.planId == null) return false
    setSaving(true)
    setError('')
    try {
      const saved = await api.putPlan(draft.planId, toPayload(draft))
      dispatch({ type: 'LOAD', plan: saved })
      return true
    } catch (e) {
      setError(String((e as Error).message || e))
      return false
    } finally {
      setSaving(false)
    }
  }, [draft])

  // Recargar la pestaña con cambios sin guardar se los comía en silencio. El
  // navegador no deja personalizar el texto, pero sí avisar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return { draft, dispatch, dirty, saving, error, setError, save }
}
