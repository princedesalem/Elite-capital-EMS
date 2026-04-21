/**
 * Bus d'événements léger pour notifier les pages des changements de données.
 *
 * L'usage :
 *   emit('ems:dataChanged', { url: '/api/conges', method: 'POST' })
 *   useBusEvent('ems:dataChanged', () => reload())
 *
 * Les événements sont propagés via ``window`` afin de traverser les composants
 * React sans Context supplémentaire. `useBusEvent` gère le désabonnement à la
 * destruction du composant et débounce par défaut à 300 ms pour éviter une
 * rafale de rechargements lorsqu'un lot de mutations arrive.
 */
import { useEffect, useRef } from 'react'

export function emit(name, detail) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch {
    // noop — environnement sans CustomEvent (tests ultra anciens).
  }
}

export function useBusEvent(name, handler, options = {}) {
  const { debounce = 300 } = options
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let timer = null
    const listener = (event) => {
      if (!debounce) {
        handlerRef.current?.(event?.detail)
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        handlerRef.current?.(event?.detail)
        timer = null
      }, debounce)
    }
    window.addEventListener(name, listener)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(name, listener)
    }
  }, [name, debounce])
}

export const DATA_CHANGED = 'ems:dataChanged'
export const NEW_NOTIFICATION = 'ems:newNotification'
