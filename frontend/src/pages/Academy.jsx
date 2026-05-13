import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { toast } from '../components/ui/bridge'

/* ============================================================================
   Elite Academy - Page d'accueil catalogue
   Inspiration visuelle : formation.kpmg.fr, transposée à la charte ECG.
   Charte : navy #021630 / bleu profond #0b2f7d / rouge accent #ce2b2b
============================================================================ */

const CHARTE = {
  navy: '#021630',
  navyDeep: '#0b2456',
  navyMid: '#13357c',
  navyLight: '#1f4ba8',
  accent: '#ce2b2b',
  accentSoft: '#fee2e2',
  white: '#ffffff',
  ink: '#0f172a',
  inkSoft: '#475569',
  line: '#e2e8f0',
  bg: '#f7f8fb',
}

/* ── Icones SVG inline (style Lucide, monochrome) ─────────────────────── */
const SVG = {
  cap:    (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  flame:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  gem:    (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>,
  trophy: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  star:   (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>,
  medal:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10"/><path d="M7 9V3h10v6"/><circle cx="12" cy="14" r="5"/></svg>,
  award:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  rocket: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  books:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  play:   (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  cog:    (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  search: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  chart:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  briefcase: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  globe:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  target: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  tool:   (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  monitor:(p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  brain:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4.5 17V8a2.5 2.5 0 0 1 2.5-2.5A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44A2.5 2.5 0 0 0 19.5 17V8a2.5 2.5 0 0 0-2.5-2.5A2.5 2.5 0 0 0 14.5 2z"/></svg>,
  microscope:(p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M8 6h4"/><path d="M13 10V6.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3a.5.5 0 0 0 .5-.5V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v7"/></svg>,
  /* ── Icônes sémantiques supplémentaires ─── */
  cart:       (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  truck:      (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 6v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  shield:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  users:      (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  megaphone:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
  trendingUp: (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  coins:      (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>,
  clipboard:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  folder:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  server:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  handshake:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>,
  lightning:  (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  compass:    (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  network:      (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="18" width="6" height="4" rx="1"/><rect x="16" y="18" width="6" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="12" y1="10" x2="5" y2="20"/><line x1="12" y1="10" x2="19" y2="20"/></svg>,
  /* ── Icônes supplémentaires ─── */
  calendar:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:        (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  key:          (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  lock:         (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  leaf:         (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 22h3.17c1.28-2.78 2.73-5.68 5.01-8 3-3.17 8-4 8-4 0 0-1 5-4.5 8.5C13 21 12 22 12 22h3.5C19 18 21 12 21 7c0 0-1.5.5-4 1z"/></svg>,
  layers:       (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  alertTriangle:(p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  pencil:       (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  userPlus:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  pieChart:     (p={}) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
}

const BADGE_META = {
  premier_cours:   { Icon: SVG.cap,    label: 'Premier cours', color: '#1d4ed8' },
  serie_5:         { Icon: SVG.flame,  label: 'Série de 5',    color: '#ea580c' },
  perfectionniste: { Icon: SVG.gem,    label: '100% au quiz',  color: '#7c3aed' },
  top_apprenant:   { Icon: SVG.trophy, label: 'Top apprenant', color: '#b45309' },
  assidu:          { Icon: SVG.star,   label: 'Assidu',        color: '#0369a1' },
}

const LEVEL_COLORS = {
  Débutant:      { background: '#dcfce7', color: '#15803d' },
  Intermédiaire: { background: '#dbeafe', color: '#1d4ed8' },
  Avancé:        { background: '#fef3c7', color: '#b45309' },
}

/* Mapping sémantique titre → icône (1 icône unique par formation) */
const TITRE_ICON = {
  /* ── Onboarding ─── (spéciaux traités dans FormationCard) */
  'Bienvenue chez Elite Capital Group':          null, // → logo ECG (voir FormationCard)
  "Prise en main de l'extranet EMS":             null, // → texte "EMS" (voir FormationCard)
  /* ── Ressources Humaines ─── */
  'Gestion des conges et absences':              SVG.calendar,
  'Permissions et sorties':                      SVG.key,
  'Pointage et presence':                        SVG.clock,
  'Procedures disciplinaires':                   SVG.shield,
  'Score comportemental':                        SVG.star,
  'Demandes d\'explication':                     SVG.clipboard,
  'Gestion des remplacants':                     SVG.userPlus,
  /* ── Opérations & Finance ─── */
  'Gestion des missions':                        SVG.briefcase,
  'Notes de frais et remboursements':            SVG.coins,
  'Operations terrain':                          SVG.tool,
  /* ── Performance ─── */
  'Evaluations et entretiens annuels':           SVG.medal,
  'Performance reviews et objectifs':            SVG.trophy,
  /* ── Organisation ─── */
  'Fiche de poste : redaction et mise a jour':   SVG.pencil,
  'Organisation et organigramme':                SVG.network,
  /* ── Productivité ─── */
  'Workflow et gestion des taches':              SVG.lightning,
  'Assistant IA et productivite':                SVG.brain,
  'Documentation et base de connaissances':      SVG.books,
  /* ── Stratégie RH ─── */
  'Talent management':                           SVG.award,
  'Workforce planning':                          SVG.globe,
  /* ── Data & Analytics ─── */
  'Analytics et tableaux de bord':               SVG.chart,
  /* ── Conformité ─── */
  'Securite, confidentialite et bonnes pratiques': SVG.lock,
  /* ── Administration ─── */
  'Administration et parametrage EMS':           SVG.cog,
  /* ── Achats ─── */
  'Achats : fondamentaux':                       SVG.cart,
  'Achats : negociation et performance':         SVG.handshake,
  /* ── Commercial ─── */
  'Commercial : techniques de vente':            SVG.trendingUp,
  'Commercial : pilotage du pipeline':           SVG.target,
  /* ── Marketing ─── */
  'Marketing : strategie et positionnement':     SVG.rocket,
  'Marketing digital et content':                SVG.megaphone,
  /* ── Communication ─── */
  'Communication interne et externe':            SVG.users,
  'Communication : prise de parole et media training': SVG.flame,
  /* ── Système d'Information ─── */
  'SI : architecture et urbanisation':           SVG.layers,
  'SI : cybersecurite et gouvernance des donnees': SVG.server,
  /* ── Flotte ─── */
  'Flotte : gestion operationnelle':             SVG.truck,
  'Flotte : optimisation TCO et eco-conduite':   SVG.leaf,
  /* ── Audit ─── */
  'Audit interne : fondamentaux':                SVG.microscope,
  'Audit : controle interne et gestion des risques': SVG.alertTriangle,
  /* ── Projets ─── */
  'Gestion de projet : les essentiels':          SVG.folder,
  'Methodes agiles : Scrum et Kanban':           SVG.gem,
  /* ── CRM ─── */
  'CRM : fondamentaux et parcours client':       SVG.compass,
  'CRM : segmentation, scoring et automation':   SVG.pieChart,
}
const _FALLBACK_ICONS = [SVG.books, SVG.briefcase, SVG.globe, SVG.rocket, SVG.cap, SVG.flame, SVG.microscope, SVG.star]
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #021630, #1f4ba8)',
  'linear-gradient(135deg, #0b2456, #2563eb)',
  'linear-gradient(135deg, #0f172a, #334155)',
  'linear-gradient(135deg, #13357c, #4338ca)',
  'linear-gradient(135deg, #1e3a8a, #0ea5e9)',
  'linear-gradient(135deg, #0c4a6e, #0369a1)',
  'linear-gradient(135deg, #ce2b2b, #b91c1c)',
  'linear-gradient(135deg, #1e1b4b, #6d28d9)',
]

/* ── Carte formation ─────────────────────────────────────────────────────── */
function FormationCard({ formation, onEnroll, onOpen }) {
  const [hover, setHover] = useState(false)
  const pct = formation.progress ?? 0
  const levelColor = LEVEL_COLORS[formation.niveau] || LEVEL_COLORS['Débutant']
  const titreLookup = TITRE_ICON[formation.titre]
  const IconComp = titreLookup !== undefined ? titreLookup : (_FALLBACK_ICONS[(formation.id || 0) % _FALLBACK_ICONS.length])
  const gradient = CARD_GRADIENTS[(formation.id || 0) % CARD_GRADIENTS.length]
  const isEcgWelcome = formation.titre === 'Bienvenue chez Elite Capital Group'
  const isEmsIntro = formation.titre?.includes("extranet EMS") || formation.titre?.includes("Prise en main")

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hover ? CHARTE.navyMid : CHARTE.line}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform .2s, box-shadow .2s, border-color .2s',
        boxShadow: hover ? '0 16px 36px rgba(2,22,48,0.15)' : '0 2px 8px rgba(2,22,48,0.06)',
        transform: hover ? 'translateY(-6px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(formation)}
    >
      {isEcgWelcome ? (
        <div style={{
          height: 170, background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%)' }} />
          <img
            src="/logos/ecg-white.png"
            alt="Elite Capital Group"
            style={{
              position: 'relative',
              maxWidth: '80%', maxHeight: 110, objectFit: 'contain',
            }}
          />
        </div>
      ) : isEmsIntro ? (
        <div style={{
          height: 170, background: 'linear-gradient(135deg, #021630, #0b2456)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), transparent 60%)' }} />
          <span style={{
            position: 'relative',
            fontSize: 58, fontWeight: 900, color: '#fff',
            letterSpacing: '0.12em', fontFamily: 'Century Gothic, Arial, sans-serif',
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
          }}>EMS</span>
        </div>
      ) : formation.image_url ? (
        <img src={formation.image_url} alt="" style={{ width: '100%', height: 170, objectFit: 'cover' }} />
      ) : (
        <div style={{
          height: 170, background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%)' }} />
          <span style={{ position: 'relative', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}><IconComp s={64} /></span>
        </div>
      )}
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{
            display: 'inline-block', padding: '3px 11px', borderRadius: 20,
            fontSize: '.66rem', fontWeight: 700, letterSpacing: '.05em',
            textTransform: 'uppercase', ...levelColor,
          }}>{formation.niveau}</span>
          {formation.est_onboarding && (
            <span style={{
              padding: '3px 11px', borderRadius: 20, fontSize: '.66rem', fontWeight: 700,
              letterSpacing: '.05em', textTransform: 'uppercase',
              background: CHARTE.accentSoft, color: CHARTE.accent,
            }}>Onboarding</span>
          )}
          {formation.categorie && (
            <span style={{
              padding: '3px 11px', borderRadius: 20, fontSize: '.66rem', fontWeight: 600,
              background: '#f1f5f9', color: CHARTE.inkSoft,
            }}>{formation.categorie}</span>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: CHARTE.ink, marginBottom: 6, lineHeight: 1.35 }}>
          {formation.titre}
        </div>
        {formation.description && (
          <div style={{
            fontSize: '.83rem', color: CHARTE.inkSoft, marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{formation.description}</div>
        )}
        <div style={{ fontSize: '.76rem', color: '#94a3b8', marginBottom: 12 }}>
          {formation.nb_modules || 0} module{(formation.nb_modules||0) !== 1 ? 's' : ''} ·
          {' '}{formation.nb_lecons || 0} leçon{(formation.nb_lecons||0) !== 1 ? 's' : ''}
          {formation.duree_estimee_h > 0 && ` · ~${formation.duree_estimee_h}h`}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {formation.inscription_id ? (
            <>
              <div style={{ height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: formation.statut_inscription === 'termine' ? '#16a34a' : CHARTE.navyLight,
                  borderRadius: 99, transition: 'width .4s',
                }} />
              </div>
              <div style={{ fontSize: '.74rem', color: CHARTE.inkSoft, marginTop: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {formation.statut_inscription === 'termine' ? (<><span style={{ color:'#15803d' }}><svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> Complété</>) : `${pct}% complété`}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEnroll(formation) }}
              style={{
                padding: '8px 18px', background: CHARTE.navy, border: 'none',
                borderRadius: 24, color: '#fff', fontSize: '.82rem', cursor: 'pointer',
                fontWeight: 700, letterSpacing: '.02em',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = CHARTE.accent}
              onMouseLeave={e => e.currentTarget.style.background = CHARTE.navy}
            >
              S'inscrire
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function Academy() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const matricule = String(user?.matricule || user?.sub || '')

  const [catalogue, setCatalogue] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('')
  const [filterNiveau, setFilterNiveau] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showAll, setShowAll] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [cat, dash] = await Promise.all([
        api.get(`/api/academy/catalogue?employe_id=${matricule}`),
        matricule ? api.get(`/api/academy/dashboard/${matricule}`) : Promise.resolve({ data: null }),
      ])
      setCatalogue(Array.isArray(cat.data) ? cat.data : [])
      setDashboard(dash.data || null)
    } catch {
      setCatalogue([])
    } finally {
      setLoading(false)
    }
  }, [matricule])

  useEffect(() => { fetchData() }, [fetchData])

  const categories = useMemo(() =>
    [...new Set(catalogue.map(f => f.categorie).filter(Boolean))].sort(),
    [catalogue]
  )

  const filtered = useMemo(() => {
    let list = catalogue
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.titre.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.categorie || '').toLowerCase().includes(q)
      )
    }
    if (filterCategorie) list = list.filter(f => f.categorie === filterCategorie)
    if (filterNiveau) list = list.filter(f => f.niveau === filterNiveau)
    if (filterStatut === 'en_cours') list = list.filter(f => f.inscription_id && f.statut_inscription !== 'termine')
    if (filterStatut === 'termine') list = list.filter(f => f.statut_inscription === 'termine')
    if (filterStatut === 'non_inscrit') list = list.filter(f => !f.inscription_id)
    return list
  }, [catalogue, search, filterCategorie, filterNiveau, filterStatut])

  const onboarding = filtered.filter(f => f.est_onboarding)
  const nonOnboarding = filtered.filter(f => !f.est_onboarding)
  const enCours = catalogue.filter(f => f.inscription_id && f.statut_inscription !== 'termine')

  const handleEnroll = async (formation) => {
    try {
      await api.post(`/api/academy/inscriptions/${formation.id}?employe_id=${matricule}`)
      toast.success(`Inscrit à "${formation.titre}"`)
      fetchData()
      navigate(`/rh/academy/${formation.id}`)
    } catch {
      toast.error("Erreur lors de l'inscription")
    }
  }

  const handleOpen = (formation) => navigate(`/rh/academy/${formation.id}`)
  const isAdmin = user?.role === 'ADMIN'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: CHARTE.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: CHARTE.inkSoft, fontSize: '1.1rem' }}>Chargement de l'académie…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CHARTE.bg, color: CHARTE.ink, fontFamily: "'Century Gothic', CenturyGothic, 'Apple Gothic', sans-serif", paddingBottom: 80 }}>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div style={{
        background: `linear-gradient(115deg, ${CHARTE.navy} 0%, ${CHARTE.navyDeep} 40%, ${CHARTE.navyMid} 70%, ${CHARTE.navyLight} 100%)`,
        position: 'relative', overflow: 'hidden',
        minHeight: 580,
      }}>
        {/* Décorations */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 460, height: 460, borderRadius: '50%', background: 'rgba(96,165,250,0.10)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -160, left: '32%', width: 380, height: 380, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', left: '55%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(206,43,43,0.10)', pointerEvents: 'none', filter: 'blur(40px)' }} />

        {/* Topbar : logo gauche + search center + admin droite */}
        <div style={{
          position: 'relative', maxWidth: 1280, margin: '0 auto',
          padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          {/* Logo + nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 200 }}>
            <img src="/logo-ecg.png" alt="ECG" style={{ height: 42, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <div style={{ borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: 14 }}>
              <div style={{ color: '#fff', fontSize: '.78rem', fontWeight: 800, letterSpacing: '.18em' }}>ELITE</div>
              <div style={{ color: '#fff', fontSize: '.95rem', fontWeight: 300, letterSpacing: '.08em', marginTop: -2 }}>Academy</div>
            </div>
          </div>

          {/* Barre de recherche tri-zone */}
          <div style={{
            flex: 1, minWidth: 380, maxWidth: 720,
            display: 'flex', alignItems: 'stretch',
            background: '#fff', borderRadius: 50,
            boxShadow: '0 6px 28px rgba(2,22,48,0.25)',
            overflow: 'hidden',
          }}>
            <div style={{ flex: 1.2, padding: '8px 22px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: CHARTE.navy, letterSpacing: '.08em' }}>QUOI</div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Mot-clé"
                style={{ border: 'none', outline: 'none', fontSize: '.88rem', width: '100%', color: CHARTE.ink, background: 'transparent' }}
              />
            </div>
            <div style={{ flex: 1, padding: '8px 22px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: CHARTE.navy, letterSpacing: '.08em' }}>FORMAT</div>
              <select
                value={filterFormat}
                onChange={e => setFilterFormat(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '.88rem', width: '100%', color: filterFormat ? CHARTE.ink : '#94a3b8', background: 'transparent', cursor: 'pointer' }}
              >
                <option value="">Tous formats</option>
                <option value="texte">Texte</option>
                <option value="video">Vidéo</option>
                <option value="quiz">Quiz</option>
                <option value="presentation">Présentation</option>
              </select>
            </div>
            <div style={{ flex: 1.1, padding: '8px 22px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: CHARTE.navy, letterSpacing: '.08em' }}>CATÉGORIE</div>
              <select
                value={filterCategorie}
                onChange={e => setFilterCategorie(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '.88rem', width: '100%', color: filterCategorie ? CHARTE.ink : '#94a3b8', background: 'transparent', cursor: 'pointer' }}
              >
                <option value="">Toutes</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => { /* déjà filtré en live */ }}
              style={{
                width: 56, border: 'none', background: CHARTE.accent, color: '#fff',
                fontSize: '1.1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Rechercher"
            ><SVG.search s={18} /></button>
          </div>

          {/* Actions droite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isAdmin && (
              <button
                onClick={() => navigate('/rh/academy/admin')}
                style={{
                  padding: '9px 18px', background: 'rgba(255,255,255,0.12)',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  borderRadius: 40, color: '#fff', fontSize: '.82rem',
                  cursor: 'pointer', fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <SVG.cog s={14} /> Admin
              </button>
            )}
          </div>
        </div>

        {/* Contenu hero principal */}
        <div style={{
          position: 'relative', maxWidth: 1280, margin: '0 auto',
          padding: '20px 28px 60px',
          display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 320, maxWidth: 760 }}>
            <h1 style={{
              fontSize: 'clamp(2.2rem, 5vw, 4rem)',
              fontWeight: 900, color: '#fff',
              lineHeight: 1.08, letterSpacing: '-0.025em',
              margin: '12px 0 0',
            }}>
              Partageons plus qu'un savoir :<br />
              <span style={{
                background: `linear-gradient(90deg, #fff 0%, #fff 60%, ${CHARTE.accent} 60%, ${CHARTE.accent} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                fontStyle: 'italic',
              }}>
                notre expertise
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '1.05rem', maxWidth: 580, marginTop: 18, lineHeight: 1.55 }}>
              Le catalogue de formations Elite Capital Group. Maîtrisez chaque module de la plateforme,
              progressez sur les expertises métier et faites grandir votre carrière.
            </p>

            {/* Pills catégories */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
                {categories.map(c => {
                  const active = filterCategorie === c
                  return (
                    <button
                      key={c}
                      onClick={() => setFilterCategorie(active ? '' : c)}
                      style={{
                        padding: '8px 18px',
                        border: `1.5px solid ${active ? '#fff' : 'rgba(255,255,255,0.4)'}`,
                        borderRadius: 40,
                        background: active ? '#fff' : 'transparent',
                        color: active ? CHARTE.navy : '#fff',
                        fontSize: '.84rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all .15s',
                      }}
                    >{c}</button>
                  )
                })}
              </div>
            )}

            {/* CTA primaire */}
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setShowAll(true); document.getElementById('catalogue-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                style={{
                  padding: '14px 32px', background: CHARTE.accent, border: 'none',
                  borderRadius: 40, color: '#fff', fontSize: '.95rem',
                  cursor: 'pointer', fontWeight: 800, letterSpacing: '.03em',
                  boxShadow: '0 6px 20px rgba(206,43,43,0.4)',
                  transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(206,43,43,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(206,43,43,0.4)' }}
              >
                Toutes nos formations
              </button>
              {enCours.length > 0 && (
                <button
                  onClick={() => setFilterStatut('en_cours')}
                  style={{
                    padding: '14px 28px', background: 'rgba(255,255,255,0.12)',
                    border: '1.5px solid rgba(255,255,255,0.45)',
                    borderRadius: 40, color: '#fff', fontSize: '.92rem',
                    cursor: 'pointer', fontWeight: 700, backdropFilter: 'blur(8px)',
                  }}
                >
                  Reprendre ({enCours.length})
                </button>
              )}
            </div>
          </div>

          {/* Visuel décoratif droit */}
          <div style={{
            flex: '0 0 320px', minWidth: 280, height: 360,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at 60% 40%, rgba(206,43,43,0.18), transparent 60%), radial-gradient(circle at 30% 70%, rgba(96,165,250,0.22), transparent 60%)`,
              filter: 'blur(8px)',
            }} />
            <div style={{
              position: 'relative', width: 280, height: 280,
              borderRadius: '50%',
              background: `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))`,
              border: '1.5px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}>
              <div style={{ color: '#fff', opacity: 0.92, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}><SVG.cap s={120} /></div>
              {/* Stats flottantes */}
              {dashboard && (
                <>
                  <div style={{
                    position: 'absolute', top: -10, right: -10,
                    padding: '10px 16px', background: '#fff',
                    borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    minWidth: 90, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: CHARTE.navy }}>{dashboard.nb_en_cours || 0}</div>
                    <div style={{ fontSize: '.65rem', color: CHARTE.inkSoft, fontWeight: 700, letterSpacing: '.08em' }}>EN COURS</div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -10, left: -20,
                    padding: '10px 16px', background: '#fff',
                    borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    minWidth: 90, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: CHARTE.accent }}>{dashboard.nb_termines || 0}</div>
                    <div style={{ fontSize: '.65rem', color: CHARTE.inkSoft, fontWeight: 700, letterSpacing: '.08em' }}>COMPLÉTÉES</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════ Filtres secondaires ═══════════════════════ */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 28px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['', 'Débutant', 'Intermédiaire', 'Avancé'].map(n => {
            const active = filterNiveau === n
            return (
              <button key={n}
                onClick={() => setFilterNiveau(n)}
                style={{
                  padding: '7px 16px', borderRadius: 30,
                  border: `1.5px solid ${active ? CHARTE.navy : '#cbd5e1'}`,
                  background: active ? CHARTE.navy : '#fff',
                  color: active ? '#fff' : CHARTE.inkSoft,
                  fontSize: '.82rem', cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                  transition: 'all .15s',
                }}
              >{n || 'Tous niveaux'}</button>
            )
          })}
          <div style={{ width: 1, background: CHARTE.line, margin: '4px 8px' }} />
          {[
            ['', 'Tous statuts'],
            ['en_cours', 'En cours'],
            ['termine', 'Complétées'],
            ['non_inscrit', 'Non inscrit'],
          ].map(([v, label]) => {
            const active = filterStatut === v
            return (
              <button key={v}
                onClick={() => setFilterStatut(v)}
                style={{
                  padding: '7px 16px', borderRadius: 30,
                  border: `1.5px solid ${active ? CHARTE.accent : '#cbd5e1'}`,
                  background: active ? CHARTE.accent : '#fff',
                  color: active ? '#fff' : CHARTE.inkSoft,
                  fontSize: '.82rem', cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                  transition: 'all .15s',
                }}
              >{label}</button>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════ Sections catalogue ═══════════════════════ */}
      <div id="catalogue-section" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 28px 0' }}>

        {/* Badges utilisateur */}
        {dashboard?.badges?.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionTitle Icon={SVG.medal} title="Mes badges" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {dashboard.badges.map(b => {
                const meta = BADGE_META[b.type] || { Icon: SVG.medal, label: b.type, color: '#1d4ed8' }
                const BadgeIcon = meta.Icon
                return (
                  <div key={b.type} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 18px', background: '#fff',
                    border: `1.5px solid ${CHARTE.line}`,
                    borderRadius: 40, fontSize: '.85rem',
                    color: meta.color, fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}>
                    <BadgeIcon s={18} /> {meta.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top apprenants */}
        {dashboard?.leaderboard?.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionTitle Icon={SVG.trophy} title="Top Apprenants" />
            <div style={{
              background: '#fff', border: `1px solid ${CHARTE.line}`, borderRadius: 16,
              padding: '8px 22px', maxWidth: 520,
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            }}>
              {dashboard.leaderboard.slice(0, 3).map((entry, i) => (
                <div key={entry.employe_id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0',
                  borderBottom: i < 2 ? `1px solid ${CHARTE.line}` : 'none',
                  ...(entry.is_me ? { background: '#eff6ff', margin: '0 -22px', padding: '12px 22px', borderRadius: 10 } : {}),
                }}>
                  <span style={{ width: 30, textAlign: 'center', display: 'inline-flex', justifyContent: 'center', color: i === 0 ? '#b45309' : i === 1 ? '#64748b' : '#92400e' }}>
                    <SVG.medal s={20} />
                  </span>
                  <span style={{ minWidth: 18, fontWeight: 800, color: i === 0 ? '#b45309' : i === 1 ? '#64748b' : '#92400e', fontSize: '.95rem' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '.92rem', color: entry.is_me ? CHARTE.navyMid : CHARTE.ink }}>
                      {entry.nom} {entry.is_me && <span style={{ fontSize: '.72rem', color: CHARTE.navyLight }}>(vous)</span>}
                    </div>
                    <div style={{ fontSize: '.74rem', color: '#94a3b8' }}>
                      {entry.nb_formations} formation{entry.nb_formations !== 1 ? 's' : ''}
                      {entry.score_moyen != null && ` · ${entry.score_moyen}% moy.`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* En cours */}
        {enCours.length > 0 && !filterStatut && !filterNiveau && !filterCategorie && !search && (
          <div style={{ marginBottom: 44 }}>
            <SectionTitle Icon={SVG.play} title="Reprendre où j'en étais" />
            <Grid items={enCours} onEnroll={handleEnroll} onOpen={handleOpen} />
          </div>
        )}

        {/* Onboarding */}
        {onboarding.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <SectionTitle Icon={SVG.rocket} title="Parcours d'onboarding" right={
              <span style={{
                fontSize: '.72rem', background: CHARTE.accentSoft, color: CHARTE.accent,
                padding: '4px 12px', borderRadius: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
              }}>Nouvelles recrues</span>
            } />
            <Grid items={onboarding} onEnroll={handleEnroll} onOpen={handleOpen} />
          </div>
        )}

        {/* Catalogue général */}
        {nonOnboarding.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <SectionTitle Icon={SVG.books} title="Catalogue des formations" right={
              <span style={{ fontSize: '.82rem', color: CHARTE.inkSoft, fontWeight: 600 }}>
                {nonOnboarding.length} formation{nonOnboarding.length > 1 ? 's' : ''}
              </span>
            } />
            <Grid items={nonOnboarding} onEnroll={handleEnroll} onOpen={handleOpen} />
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            background: '#fff', borderRadius: 16, border: `1px dashed ${CHARTE.line}`,
            margin: '20px 0',
          }}>
            <div style={{ marginBottom: 12, opacity: 0.45, color: CHARTE.inkSoft, display: 'inline-flex' }}><SVG.search s={48} /></div>
            <div style={{ color: CHARTE.inkSoft, fontSize: '1rem', fontWeight: 600 }}>
              Aucune formation ne correspond à votre recherche.
            </div>
            <button
              onClick={() => { setSearch(''); setFilterCategorie(''); setFilterFormat(''); setFilterNiveau(''); setFilterStatut('') }}
              style={{
                marginTop: 18, padding: '10px 24px', background: CHARTE.navy,
                border: 'none', borderRadius: 30, color: '#fff', fontSize: '.85rem',
                cursor: 'pointer', fontWeight: 700,
              }}
            >Réinitialiser les filtres</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helpers visuels ─────────────────────────────────────────────────────── */
function SectionTitle({ Icon, title, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginBottom: 18, paddingBottom: 12,
      borderBottom: `2px solid ${CHARTE.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon ? <span style={{ color: CHARTE.navy, display: 'inline-flex' }}><Icon s={20} /></span> : null}
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: CHARTE.navy, letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      {right}
    </div>
  )
}

function Grid({ items, onEnroll, onOpen }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
      gap: 22,
    }}>
      {items.map(f => (
        <FormationCard key={f.id} formation={f} onEnroll={onEnroll} onOpen={onOpen} />
      ))}
    </div>
  )
}
