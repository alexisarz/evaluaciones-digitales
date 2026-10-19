import { useState } from 'react'

export default function PasswordInput({ value, onChange, ...props }) {
  const [visible, setVisible] = useState(false)
  return <div className="password-input">
    <input {...props} type={visible ? 'text' : 'password'} value={value} onChange={onChange} />
    <button type="button" className="password-visibility" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!visible && <path d="m4 20 16-16"/>}</svg>
    </button>
  </div>
}
