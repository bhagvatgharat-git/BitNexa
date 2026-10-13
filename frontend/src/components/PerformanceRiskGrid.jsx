import { Line } from 'react-chartjs-2';

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
};

export default function PerformanceRiskGrid({ portfolioPerformance }) {
  return (
    <section className="terminal-grid">
      <div className="panel-card performance-panel">
        <div className="panel-header">
          <h3>Portfolio Performance</h3>
          <span>YTD</span>
        </div>

        <div className="mini-chart">
          <Line data={portfolioPerformance} options={chartOptions} />
        </div>
      </div>

      <div className="panel-card risk-panel">
        <div className="panel-header">
          <h3>Risk Meter</h3>
          <span>Balanced</span>
        </div>

        <div className="risk-layout">
          <div className="risk-ring">
            <span>62%</span>
          </div>

          <div className="risk-breakdown">
            <div>
              <span>Volatility</span>
              <strong>Moderate</strong>
            </div>
            <div>
              <span>Drawdown</span>
              <strong>8.4%</strong>
            </div>
            <div>
              <span>Sharpe</span>
              <strong>1.72</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
