import React, { useState, useRef, useEffect } from 'react'

export default function AutocompleteInput({
  placeholder,
  value,
  onChange,
  options = [],
  disabled,
  required,
  className = 'input',
  style,
  strictSelection = false,
  onInputChange,
  onSelectOption,
  onValidityChange,
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [invalid, setInvalid] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const asText = (v) => String(v || '').trim().toLowerCase()

  const optionMatches = (opt, text) => {
    const normalized = asText(text)
    if (!normalized) return false
    return [opt.label, opt.value, opt.name].some(candidate => asText(candidate) === normalized)
  }

  const filtered = options.filter(o =>
    [o.label, o.value, o.name].some(candidate =>
      String(candidate || '').toLowerCase().includes(String(filter || value || '').toLowerCase())
    )
  )

  function setValidity(next) {
    setInvalid(!next)
    if (onValidityChange) onValidityChange(next)
  }

  function handleInput(e) {
    const v = e.target.value
    setFilter(v)
    onChange(v)
    if (onInputChange) onInputChange(v)
    if (strictSelection) setValidity(false)
    setOpen(true)
  }

  function handleSelect(opt) {
    onChange(opt.value ?? opt.name ?? opt.label)
    if (onSelectOption) onSelectOption(opt)
    setFilter('')
    setValidity(true)
    setOpen(false)
  }

  function handleBlur() {
    if (!strictSelection || !String(value || '').trim()) return
    const exactMatch = options.find(o => optionMatches(o, value))
    if (!exactMatch) {
      onChange('')
      if (onSelectOption) onSelectOption(null)
      setValidity(false)
      return
    }
    if (onSelectOption) onSelectOption(exactMatch)
    setValidity(true)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}>
      <input
        ref={inputRef}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        autoComplete="off"
        style={invalid ? { borderColor: '#dc2626', outlineColor: '#dc2626' } : undefined}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'var(--card)',
          border: '1px solid #d1d5db',
          borderTop: 'none',
          borderRadius: '0 0 5px 5px',
          maxHeight: 200,
          overflowY: 'auto',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          fontSize: '0.85rem',
        }}>
          {filtered.map((o, i) => (
            <li
              key={`${o.value}-${o.label}-${i}`}
              onMouseDown={e => {
                e.preventDefault()
                handleSelect(o)
              }}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
