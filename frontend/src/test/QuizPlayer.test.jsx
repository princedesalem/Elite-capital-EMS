/**
 * Tests Vitest pour le composant QuizPlayer (theme clair, anti-triche).
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../components/ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import api from '../services/api'
import QuizPlayer from '../components/QuizPlayer'

const QUESTIONS = [
  {
    id: 1,
    question: 'Quelle est la capitale du Cameroun ?',
    options: ['Douala', 'Yaoundé', 'Garoua', 'Bafoussam'],
    bonne_reponse: 1,
    explication: 'Yaoundé est la capitale politique du Cameroun.',
  },
  {
    id: 2,
    question: '2 + 2 = ?',
    options: ['3', '4', '5'],
    bonne_reponse: 1,
    explication: '2+2=4',
  },
]

describe('QuizPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche la 1ere question', () => {
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={1} leconId={1} />)
    expect(screen.getByText(/capitale du Cameroun/i)).toBeInTheDocument()
    expect(screen.getByText('Question 1 sur 2')).toBeInTheDocument()
  })

  it('le bouton Valider est desactive sans selection', () => {
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={1} leconId={1} />)
    const valider = screen.getByRole('button', { name: /Valider ma réponse/i })
    expect(valider).toBeDisabled()
  })

  it('active le bouton apres clic sur une option', () => {
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={1} leconId={1} />)
    fireEvent.click(screen.getByText('Yaoundé'))
    const valider = screen.getByRole('button', { name: /Valider ma réponse/i })
    expect(valider).not.toBeDisabled()
  })

  it('affiche l\'explication apres validation', () => {
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={1} leconId={1} />)
    fireEvent.click(screen.getByText('Yaoundé'))
    fireEvent.click(screen.getByRole('button', { name: /Valider ma réponse/i }))
    expect(screen.getByText(/Yaoundé est la capitale/i)).toBeInTheDocument()
  })

  it('soumet le quiz au format reponses_detaillees', async () => {
    api.post.mockResolvedValue({
      data: { score: 100, correct: 2, total: 2, badge: true, details: [] },
    })
    const onComplete = vi.fn()
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={42} leconId={7} onComplete={onComplete} />)
    // Q1 : choisir Yaoundé puis valider puis question suivante
    fireEvent.click(screen.getByText('Yaoundé'))
    fireEvent.click(screen.getByRole('button', { name: /Valider ma réponse/i }))
    fireEvent.click(screen.getByRole('button', { name: /Question suivante/i }))
    // Q2 : choisir 4 puis valider puis voir score
    fireEvent.click(screen.getByText('4'))
    fireEvent.click(screen.getByRole('button', { name: /Valider ma réponse/i }))
    fireEvent.click(screen.getByRole('button', { name: /Voir mon score/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/academy/quiz/submit',
        expect.objectContaining({
          inscription_id: 42,
          lecon_id: 7,
          reponses_detaillees: [
            { question_id: 1, option_text: 'Yaoundé' },
            { question_id: 2, option_text: '4' },
          ],
        })
      )
    })
  })

  it('affiche le score 100% et le badge en cas de reussite', async () => {
    api.post.mockResolvedValue({
      data: { score: 100, correct: 2, total: 2, badge: true, details: [
        { question: 'Q1', reponse_donnee: 'Yaoundé', bonne_reponse: 'Yaoundé', correct: true },
        { question: 'Q2', reponse_donnee: '4', bonne_reponse: '4', correct: true },
      ]},
    })
    render(<QuizPlayer questions={QUESTIONS} inscriptionId={1} leconId={1} />)
    fireEvent.click(screen.getByText('Yaoundé'))
    fireEvent.click(screen.getByRole('button', { name: /Valider/i }))
    fireEvent.click(screen.getByRole('button', { name: /Question suivante/i }))
    fireEvent.click(screen.getByText('4'))
    fireEvent.click(screen.getByRole('button', { name: /Valider/i }))
    fireEvent.click(screen.getByRole('button', { name: /Voir mon score/i }))
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText(/Quiz réussi/i)).toBeInTheDocument()
    })
  })

  it('affiche un etat vide si aucune question', () => {
    render(<QuizPlayer questions={[]} inscriptionId={1} leconId={1} />)
    expect(screen.getByText(/Aucune question/i)).toBeInTheDocument()
  })
})
