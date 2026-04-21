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
    const onNotification = () => fnRef.current()
    // Debounce du rafraîchissement déclenché par une rafale de mutations.
    let debounceTimer = null
    const onDataChanged = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fnRef.current()
        debounceTimer = null
      }, 400)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('ems:newNotification', onNotification)
    window.addEventListener('ems:dataChanged', onDataChanged)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('ems:newNotification', onNotification)
      window.removeEventListener('ems:dataChanged', onDataChanged)
    }
  }, [])
}
