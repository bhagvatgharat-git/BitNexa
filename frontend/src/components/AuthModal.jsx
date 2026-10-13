export default function AuthModal({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authError,
  handleAuthSubmit,
  handleDemoLogin,
  onClose,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="topbar-kicker">Secure access</p>
            <h3>{authMode === 'login' ? 'Login to BitNexa' : 'Create account'}</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>

        <form className="modal-body" onSubmit={handleAuthSubmit} autoComplete="on">
          {authMode === 'register' && (
            <label className="modal-field" htmlFor="auth-name">
              Full name
              <input
                id="auth-name"
                name="name"
                type="text"
                value={authForm.name}
                onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="modal-field" htmlFor="auth-email">
            Email
            <input
              id="auth-email"
              name="email"
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Enter your email"
              autoComplete={authMode === 'login' ? 'username' : 'email'}
              required
            />
          </label>

          <label className="modal-field" htmlFor="auth-password">
            Password
            <input
              id="auth-password"
              name="password"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Enter your password"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {authError && <div className="error-banner">{authError}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setAuthForm({ name: '', email: '', password: '' });
                setAuthMode((current) => (current === 'login' ? 'register' : 'login'));
              }}
            >
              {authMode === 'login' ? 'Create account' : 'Use login'}
            </button>
            <button type="submit" className="primary-btn">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </div>

          {authMode === 'login' && (
            <div className="modal-demo-strip">
              <span className="modal-demo-label">Just exploring?</span>
              <button type="button" className="demo-login-btn" onClick={handleDemoLogin}>
                ⚡ Continue as Demo
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
