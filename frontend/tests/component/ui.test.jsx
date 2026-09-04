import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from '../../src/components/brand/BrandLogo.jsx'
import { PasswordField } from '../../src/components/auth/PasswordField.jsx'
import { useState } from 'react'

function PasswordHarness() {
  const [value, setValue] = useState('')
  return <PasswordField value={value} onChange={setValue} />
}

describe('BrandLogo', () => {
  it('renders the wordmark with accessible name', () => {
    render(
      <MemoryRouter>
        <BrandLogo to="/tutor/dashboard" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Tuturio home' })).toHaveAttribute('href', '/tutor/dashboard')
    expect(screen.getByAltText('Tuturio')).toBeInTheDocument()
  })
})

describe('PasswordField', () => {
  it('shows a length hint until the password is long enough', async () => {
    const user = userEvent.setup()
    render(<PasswordHarness />)
    const input = screen.getByLabelText('Password')
    await user.type(input, 'short')
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'longenough')
    expect(screen.getByText(/looks good/i)).toBeInTheDocument()
  })
})
