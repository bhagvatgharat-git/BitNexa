export default function AdminModal({
  adminForm,
  setAdminForm,
  adminError,
  adminLoading,
  handleAdminLogin,
  onClose,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel admin-login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="topbar-kicker" style={{ color: '#f59e0b' }}>🔐 Restricted Access</p>
            <h3>Admin Control Panel</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={handleAdminLogin}>
          <label className="modal-field">
            Admin Email
            <input
              type="email"
              value={adminForm.email}
              onChange={(e) => setAdminForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="admin@bitnexa.com"
              autoComplete="off"
            />
          </label>
          <label className="modal-field">
            Admin Password
            <input
              type="password"
              value={adminForm.password}
              onChange={(e) => setAdminForm((c) => ({ ...c, password: e.target.value }))}
              placeholder="••••••••"
            />
          </label>
          {adminError && <div className="error-banner">{adminError}</div>}
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={adminLoading}>
              {adminLoading ? 'Verifying…' : '🔐 Enter Admin Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
