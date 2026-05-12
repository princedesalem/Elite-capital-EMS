import React, { useRef, useEffect, useCallback } from 'react'

/**
 * SignatureCanvas — dessin HTML5 à la souris et au toucher.
 * Props:
 *   onSave(base64PngDataUrl) — appelé quand l'utilisateur valide
 *   onClear() — appelé quand l'utilisateur efface
 *   width, height — taille du canvas (px)
 */
export default function SignatureCanvas({ onSave, onClear, width = 400, height = 150 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const getPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    lastPos.current = getPos(e, canvas)
  }, [getPos])

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#021630'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }, [getPos])

  const stopDraw = useCallback(() => {
    drawing.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Clear on mount
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (onClear) onClear()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    if (onSave) onSave(dataUrl)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 2 }}>
        Signez dans le cadre ci-dessous (souris ou tactile)
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        style={{
          border: '1.5px solid #cbd5e1',
          borderRadius: 8,
          cursor: 'crosshair',
          touchAction: 'none',
          background: '#fff',
          maxWidth: '100%',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: '6px 14px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '6px 14px',
            background: '#021630',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Valider la signature
        </button>
      </div>
    </div>
  )
}
