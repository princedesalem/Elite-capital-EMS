import { useEffect, useRef } from 'react'

/**
 * Rafraîchit les données uniquement quand l'utilisateur revient sur l'onglet.
 * Pas de polling en arrière-plan.
 *
 * @param {() => void} refreshFn - Fonction de rechargement des données.
 */
export function useAutoRefresh(refreshFn) {
  const fnRef = useRef(refreshFn)
  useEffect(() => {
    fnRef.current = refreshFn
  }, [refreshFn])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fnRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
}
