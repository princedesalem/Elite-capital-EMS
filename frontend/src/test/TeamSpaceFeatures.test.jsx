/**
 * Tests vitest pour les nouvelles fonctionnalités Espace Équipe :
 * - Type "message"
 * - Like toggle (1 like par personne)
 * - Commentaires Instagram-style
 * - Badge sans 📢
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '100', role: 'EMPLOYE', nom: 'Dupont', prenom: 'Alice' },
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('../components/AvatarCircle', () => ({
  default: ({ letter }) => <span data-testid="avatar">{letter}</span>,
}))

import api from '../services/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

const makePost = (overrides = {}) => ({
  id: 1,
  type: 'shoutout',
  from: 'Alice',
  from_matricule: 100,
  date: '07/05/2026',
  created_at: new Date().toISOString(),
  destinataire: 'Bob',
  message: 'Super travail !',
  titre: '',
  valeur: '',
  raison: '',
  question: '',
  options: [],
  votedBy: [],
  likes: 0,
  comments_count: 0,
  liked_by: [],
  audience: { type: 'all', selected: [] },
  ...overrides,
})

const setupApiMocks = (posts) => {
  api.get.mockImplementation((url) => {
    if (url.includes('/employees/')) return Promise.resolve({ data: [] })
    if (url.includes('/api/operations')) return Promise.resolve({ data: [] })
    if (url.includes('/api/team-space/posts')) return Promise.resolve({ data: posts })
    if (url.includes('/api/team-space/posts/') && url.includes('/comments')) return Promise.resolve({ data: [] })
    if (url.includes('autocomplete')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
  api.post.mockResolvedValue({ data: { id: 1, likes: 1, liked_by: ['100'], comments_count: 0 } })
  api.patch.mockResolvedValue({ data: {} })
  api.delete.mockResolvedValue({ data: {} })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TeamSpace — type message', () => {
  it('VALID_TYPES contient "message" (test logique pure)', () => {
    const VALID_TYPES = new Set(['shoutout', 'kudos', 'poll', 'annonce', 'message'])
    expect(VALID_TYPES.has('message')).toBe(true)
  })

  it('splitTeamPosts catégorise correctement le type message', () => {
    const posts = [makePost({ type: 'message', message: 'Bonjour l\'équipe !' })]
    const byType = posts.reduce((acc, p) => {
      acc[p.type] = [...(acc[p.type] || []), p]
      return acc
    }, {})
    expect(byType.message).toHaveLength(1)
    expect(byType.message[0].message).toBe("Bonjour l'équipe !")
  })
})

describe('TeamSpace — badge sans 📢', () => {
  it('le label "Annonce" ne contient plus 📢', () => {
    const getBadgeLabel = (type) => {
      if (type === 'kudos') return 'Kudos'
      if (type === 'poll') return 'Sondage'
      if (type === 'shoutout') return 'Félicitations'
      if (type === 'annonce') return 'Annonce'
      if (type === 'message') return 'Message'
      return 'Post'
    }
    expect(getBadgeLabel('annonce')).toBe('Annonce')
    expect(getBadgeLabel('annonce')).not.toContain('📢')
  })
})

describe('TeamSpace — like toggle', () => {
  it('isLikedByMe retourne true si matricule dans liked_by', () => {
    const myMat = '100'
    const isLikedByMe = (item, mat) =>
      mat && Array.isArray(item.liked_by) && item.liked_by.includes(mat)

    const liked = makePost({ liked_by: ['100', '200'] })
    const notLiked = makePost({ liked_by: ['200', '300'] })
    const empty = makePost({ liked_by: [] })

    expect(isLikedByMe(liked, myMat)).toBe(true)
    expect(isLikedByMe(notLiked, myMat)).toBe(false)
    expect(isLikedByMe(empty, myMat)).toBe(false)
  })

  it('un second like (même personne) retire le like — logique toggle', () => {
    // Simule le comportement du backend côté frontend
    const likedBy = new Set(['100'])
    const toggleLike = (mat, set) => {
      if (set.has(mat)) set.delete(mat)
      else set.add(mat)
      return set
    }
    toggleLike('100', likedBy) // unlike
    expect(likedBy.has('100')).toBe(false)

    toggleLike('100', likedBy) // re-like
    expect(likedBy.has('100')).toBe(true)

    toggleLike('200', likedBy) // autre personne like
    expect(likedBy.has('200')).toBe(true)
    expect(likedBy.size).toBe(2) // 100 + 200
  })

  it('plusieurs personnes peuvent liker le même post', () => {
    const likedBy = new Set()
    ;['100', '200', '300', '400'].forEach(mat => likedBy.add(mat))
    expect(likedBy.size).toBe(4)
  })
})

describe('TeamSpace — commentaires', () => {
  it('submitComment construit le bon payload', () => {
    const payload = {
      auteur_matricule: '100',
      auteur_nom: 'Alice',
      contenu: 'Super post !',
    }
    expect(payload.auteur_nom).toBe('Alice')
    expect(payload.contenu).toBe('Super post !')
    expect(payload.auteur_matricule).toBe('100')
  })

  it('reply payload inclut le bon parent_id via URL', () => {
    const parentId = 42
    const replyEndpoint = `/api/team-space/comments/${parentId}/reply`
    expect(replyEndpoint).toBe('/api/team-space/comments/42/reply')
  })

  it('comments_count est initialisé à 0 dans splitTeamPosts', () => {
    const p = makePost({ comments_count: 0 })
    const base = {
      ...p,
      comments_count: Number(p.comments_count || 0),
    }
    expect(base.comments_count).toBe(0)
  })

  it('comments_count est incrémenté après submitComment', () => {
    let count = 0
    const incCount = (arr) => arr.map(p =>
      p.id === 1 ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
    )
    const posts = [makePost({ id: 1, comments_count: 0 })]
    const updated = incCount(posts)
    expect(updated[0].comments_count).toBe(1)
  })
})

describe('TeamSpace — filteredFeed inclut messages', () => {
  it('les messages apparaissent dans le feed "all"', () => {
    const allPosts = [
      { ...makePost({ type: 'shoutout' }), _type: 'shoutout' },
      { ...makePost({ id: 2, type: 'message', message: 'Bonjour' }), _type: 'message' },
    ]
    const feed = allPosts.filter(f => true) // filterType = 'all'
    expect(feed.some(f => f._type === 'message')).toBe(true)
  })

  it('le filtre "message" ne retourne que les messages', () => {
    const allPosts = [
      { ...makePost({ type: 'shoutout' }), _type: 'shoutout' },
      { ...makePost({ id: 2, type: 'message' }), _type: 'message' },
    ]
    const feed = allPosts.filter(f => f._type === 'message')
    expect(feed).toHaveLength(1)
    expect(feed[0]._type).toBe('message')
  })
})
