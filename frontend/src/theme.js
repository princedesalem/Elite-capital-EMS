/**
 * ELITE CAPITAL GROUP S.A. — Charte graphique officielle
 *
 * NE PAS MODIFIER ces valeurs sans validation de la direction.
 * Ces constantes sont utilisées sur l'ensemble de l'application EMS.
 *
 * Deux dégradés DISTINCTS coexistent :
 *   BRAND_GRADIENT  → bannières de pages (tout bleu marine)
 *   NAV_GRADIENT    → navbar + fond login desktop (fondu vers blanc, intentionnel)
 */

/** Bleu nuit principal ELITE CAPITAL */
export const BRAND_NAVY = '#02162e'

/** Rouge ELITE CAPITAL */
export const BRAND_RED = '#ce2b2b'

/** Or ELITE CAPITAL */
export const BRAND_GOLD = '#c9a227'

/**
 * Dégradé BANNIÈRES DE PAGE — bleu nuit → bleu marine
 * Utilisé sur : Home, Employees, OrgChart, AbsencesPage, EmployeeTimeline, Organisation
 * ⚠️  NE PAS remplacer par NAV_GRADIENT (qui finit en blanc)
 */
export const BRAND_GRADIENT =
  'linear-gradient(90deg, #02162e 0%, #02162e 50%, #0a2e57 72%, #274a73 100%)'

/**
 * Dégradé NAVBAR / LOGIN — fondu de bleu nuit vers blanc
 * Utilisé sur : .nav (index.css), Login.jsx desktop background
 * ⚠️  NE PAS utiliser pour les bannières de pages
 */
export const NAV_GRADIENT =
  'linear-gradient(90deg, #02162e 0%, #02162e 45%, #d0daea 75%, #ffffff 100%)'
