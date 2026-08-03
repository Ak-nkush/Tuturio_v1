import { PASSWORD_MIN_LENGTH, validatePassword } from '../../lib/api'

export function PasswordField({
  id = 'password',
  value,
  onChange,
  label = 'Password',
  showStrength = true,
  minLength,
}) {
  const error = value ? validatePassword(value) : null
  const valid = value.length >= PASSWORD_MIN_LENGTH

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={id === 'password' ? 'new-password' : 'current-password'}
        minLength={minLength}
        required
      />
      {showStrength && value && (
        <span className={`auth-hint ${valid ? 'valid' : 'invalid'}`}>
          {error ?? `${value.length} characters — looks good`}
        </span>
      )}
    </div>
  )
}
