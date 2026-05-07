import React, { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/ToastProvider'
import { Send, Bot, User, Loader, RefreshCw, Sparkles, Download } from 'lucide-react'

const ROLES_RH = ['RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA']

// Message système suggéré affiché en bas de chat
const SUGGESTIONS = [
  'Combien d\'employés sont actifs ?',
  'Quelles demandes de congé sont en attente ?',
  'Résume la situation RH du mois',
  'Quels employés ont des missions en cours ?',
]

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16,
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: isUser ? '#02162e' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={16} color="#fff" />
          : <Bot size={16} color="#02162e" />
        }
      </div>
      <div style={{
        maxWidth: '72%',
        background: isUser ? '#02162e' : '#f8fafc',
        color: isUser ? '#fff' : '#1e293b',
        borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
        padding: '10px 14px',
        fontSize: '0.88rem',
        lineHeight: 1.6,
        border: isUser ? 'none' : '1px solid #e2e8f0',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

export default function AIAssistantPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const bottomRef = useRef()
  const toast = useToast()
  const isRH = ROLES_RH.includes((user?.role || '').toUpperCase())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const content = (text || input).trim()
    if (!content) return
    setInput('')

    const userMsg = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const r = await api.post('/api/ai/chat',
        { messages: newMessages }
      )
      setMessages((prev) => [...prev, { role: 'assistant', content: r.data.content }])
    } catch (err) {
      toast.error('Erreur lors de la communication avec l\'assistant.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    setSummaryLoading(true)
    try {
      const r = await api.get('/api/ai/dashboard-summary')
      setSummary(r.data)
    } catch (err) {
      toast.error('Impossible de générer le résumé.')
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#02162e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#02162e' }}>
              EMS Chat
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.83rem', color: '#64748b' }}>
              Données temps réel · Moteur IA ELITE CAPITAL
            </p>
          </div>
        </div>
        {isRH && (
          <button
            onClick={loadSummary}
            disabled={summaryLoading}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1.5px solid #02162e', background: '#fff',
              color: '#02162e', cursor: summaryLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              opacity: summaryLoading ? 0.7 : 1,
            }}
          >
            {summaryLoading ? <Loader size={14} /> : <RefreshCw size={14} />}
            Résumé du tableau de bord
          </button>
        )}
      </div>

      {/* Résumé IA */}
      {summary && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={16} color="#0284c7" />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0284c7' }}>
              Résumé IA — {new Date(summary.generated_at).toLocaleString('fr-FR')}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {summary.summary}
          </p>
        </div>
      )}

      {/* Zone chat */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Messages */}
        <div style={{ padding: '20px 24px', minHeight: 360, maxHeight: 500, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <Bot size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>
                Bonjour, je suis EMS Chat. Comment puis-je vous aider ?
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: 24 }}>
                Posez vos questions RH, analysez les données ou demandez des recommandations.
              </div>
              {/* Suggestions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: '1px solid #e2e8f0', background: '#f8fafc',
                      fontSize: '0.82rem', color: '#475569', cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <ChatBubble key={i} msg={m} />)
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: '0.85rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={16} color="#02162e" />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s 0.2s infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s 0.4s infinite' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Séparateur */}
        <div style={{ borderTop: '1px solid #f1f5f9' }} />

        {/* Input */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Posez votre question… (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
            disabled={loading}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1.5px solid #e2e8f0', fontSize: '0.88rem',
              resize: 'none', lineHeight: 1.5, outline: 'none',
              background: loading ? '#f8fafc' : '#fff',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: loading || !input.trim() ? '#e2e8f0' : '#02162e',
              color: loading || !input.trim() ? '#94a3b8' : '#fff',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.85rem', fontWeight: 600, flexShrink: 0,
            }}
          >
            {loading ? <Loader size={15} /> : <Send size={15} />}
          </button>
        </div>
      </div>

      {/* Note confidentialité */}
      <p style={{ marginTop: 14, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
        Les données sont interrogées en temps réel depuis la base ELITE CAPITAL. Aucune conversation n'est stockée.
      </p>
    </div>
  )
}
