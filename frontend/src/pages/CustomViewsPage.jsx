import ForecastAccuracyChart from '../components/ForecastAccuracyChart';
import SKUVelocityHeatmap from '../components/SKUVelocityHeatmap';
import ReplenishmentPDFGenerator from '../components/ReplenishmentPDFGenerator';
import ForecastRulesEditor from '../components/ForecastRulesEditor';

export default function CustomViewsPage() {
  return (
    <div className="space-y-6" data-testid="custom-views-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forecast Views</h1>
        <p className="text-sm text-gray-600">Custom inventory demand forecasting views: accuracy, velocity, replenishment PDFs, and rules editor.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Visualizations</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ForecastAccuracyChart />
          <SKUVelocityHeatmap />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Tools</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ReplenishmentPDFGenerator />
          <ForecastRulesEditor />
        </div>
      </section>
    </div>
  );
}
