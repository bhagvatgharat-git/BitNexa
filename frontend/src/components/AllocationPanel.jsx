export default function AllocationPanel({ title = 'Portfolio Allocation', badge = 'Demo', portfolioBreakdown, alertFeed, alertsCount, style }) {
  return (
    <section className="portfolio-grid" style={style}>
      <div className="panel-card">
        <div className="panel-header">
          <h3>{title}</h3>
          <span>{badge}</span>
        </div>
        <div className="allocation-list">
          {portfolioBreakdown.map((item) => (
            <div key={item.label} className="allocation-row">
              <div className="allocation-header">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
              <div className="allocation-bar">
                <span style={{ width: `${item.weight}%`, background: item.color }} />
              </div>
              <small>{item.weight}% allocation</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <h3>Signal Alerts</h3>
          <span>{alertsCount ? `${alertsCount} saved` : '3 new'}</span>
        </div>
        <div className="alert-list">
          {alertFeed.map((alert) => (
            <div key={`${alert.title}-${alert.detail}`} className={`alert-item ${alert.tone}`}>
              <div className="alert-dot" />
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
