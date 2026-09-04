import { PASSWORD_MIN_LENGTH, validatePassword } from '../../lib/api'

export function PasswordField({
  id = 'password',
  value,
  onChange,
  label = 'Password',
  showStrength = true,
  minLength,
  autoComplete = 'new-password',
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
        autoComplete={autoComplete}
        minLength={minLength ?? PASSWORD_MIN_LENGTH}
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
