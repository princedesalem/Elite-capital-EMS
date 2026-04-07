import React, { useEffect, useMemo, useState } from 'react'

export default function AvatarCircle({
  photoUrl,
  letter,
  size = 36,
  borderWidth = 1.5,
  borderColor = '#cbd5e1',
  textColor = '#021630',
  fallbackBackground = 'transparent',
  style = {},
}) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [photoUrl])

  const displayLetter = useMemo(() => {
    const raw = String(letter || '?').trim()
    return raw ? raw.toUpperCase() : '?'
  }, [letter])

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    border: `${borderWidth}px solid ${borderColor}`,
    background: fallbackBackground,
    ...style,
  }

  if (photoUrl && !imgError) {
    return (
      <div style={baseStyle}>
        <img
          src={photoUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        ...baseStyle,
        color: textColor,
        fontWeight: 700,
        fontSize: size * 0.38,
      }}
    >
      {displayLetter}
    </div>
  )
}