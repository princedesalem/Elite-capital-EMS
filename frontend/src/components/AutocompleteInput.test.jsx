import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AutocompleteInput from './AutocompleteInput'

function ControlledAutocomplete({ options, onSelectOption, onValidityChange }) {
  const [value, setValue] = useState('')

  return (
    <AutocompleteInput
      placeholder="Pays"
      value={value}
      onChange={setValue}
      options={options}
      strictSelection
      onSelectOption={onSelectOption}
      onValidityChange={onValidityChange}
    />
  )
}

describe('AutocompleteInput', () => {
  it('selects option on click in strict mode even when label differs from value', () => {
    const onSelectOption = vi.fn()
    const onValidityChange = vi.fn()
    const options = [
      { label: '🇨🇲 Cameroun', value: 'Cameroun', code: 'CM' },
      { label: '🇸🇳 Sénégal', value: 'Sénégal', code: 'SN' },
    ]

    render(
      <ControlledAutocomplete
        options={options}
        onSelectOption={onSelectOption}
        onValidityChange={onValidityChange}
      />
    )

    const input = screen.getByPlaceholderText('Pays')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'cam' } })

    const item = screen.getByText('🇨🇲 Cameroun')
    fireEvent.mouseDown(item)

    expect(input).toHaveValue('Cameroun')
    expect(onSelectOption).toHaveBeenCalledWith(expect.objectContaining({ code: 'CM' }))
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
  })

  it('keeps valid selection on blur when input equals option value', () => {
    const onSelectOption = vi.fn()
    const onValidityChange = vi.fn()
    const options = [{ label: '🇨🇲 Cameroun', value: 'Cameroun', code: 'CM' }]

    render(
      <ControlledAutocomplete
        options={options}
        onSelectOption={onSelectOption}
        onValidityChange={onValidityChange}
      />
    )

    const input = screen.getByPlaceholderText('Pays')
    fireEvent.change(input, { target: { value: 'Cameroun' } })
    fireEvent.blur(input)

    expect(input).toHaveValue('Cameroun')
    expect(onSelectOption).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'CM' }))
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
  })

  it('does not crash when the value prop is a number', () => {
    // Regression: autocomplete endpoints returned numeric IDs as value;
    // passing them back to the component caused (number).toLowerCase() TypeError.
    const options = [{ value: 1, label: 'ECG' }]
    render(
      <AutocompleteInput
        placeholder="Entité"
        value={1}
        onChange={() => {}}
        options={options}
      />
    )
    expect(screen.getByPlaceholderText('Entité')).toBeInTheDocument()
  })
})