export default function StrategyGrid({ strategyCards }) {
  return (
    <section className="strategy-grid">
      {strategyCards.map((card) => (
        <div key={card.title} className={`panel-card strategy-card ${card.tone}`}>
          <span className="eyebrow strategy-tag">{card.tag}</span>
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          <div className="strategy-footer">
            <span>{card.signal}</span>
            <button type="button" className="tiny-btn">Apply</button>
          </div>
        </div>
      ))}
    </section>
  );
}
