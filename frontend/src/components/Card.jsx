export default function Card({
  title,
  description,
  value,
  icon,
  trend,
  trendValue,
  onClick,
  className = '',
  children,
}) {
  const TrendIcon = trend === 'up' ? TrendUpIcon : trend === 'down' ? TrendDownIcon : null;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-primary-300' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {title && (
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
          )}
          {value !== undefined && (
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          )}
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
          {trend && trendValue && (
            <div className={`mt-2 flex items-center ${trendColor}`}>
              {TrendIcon && <TrendIcon className="w-4 h-4 mr-1" />}
              <span className="text-sm font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-3 bg-primary-100 rounded-lg">
            {icon}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function TrendUpIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function TrendDownIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  );
}

// Feature Card for Dashboard
export function FeatureCard({ title, description, icon, count, onClick }) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md hover:border-primary-300 transition-all duration-200"
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 p-3 bg-primary-100 rounded-lg">{icon}</div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {count !== undefined && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-medium text-primary-600 bg-primary-100 rounded-full">
              {count}
            </span>
          </div>
        )}
        <svg className="w-5 h-5 text-gray-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
