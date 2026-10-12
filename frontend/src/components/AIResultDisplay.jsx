import { useState } from 'react';

export function normalizeAIData(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const candidate = trimmed.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  if (!/^(?:\{|\[|\")/.test(candidate)) return value;
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === 'string' && parsed !== value ? normalizeAIData(parsed) : parsed;
  } catch {
    return value;
  }
}

// Professional AI Result Display Component
export default function AIResultDisplay({ data, title, loading, error }) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 animate-pulse">
        <div className="flex items-center justify-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
          </div>
          <div>
            <p className="text-blue-700 font-semibold text-lg">Analyzing with AI...</p>
            <p className="text-blue-500 text-sm">This may take 10-30 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-red-700 font-semibold">Analysis Failed</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const normalizedData = normalizeAIData(data);

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-200 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{title || 'AI Analysis Results'}</h3>
            <p className="text-emerald-100 text-sm">Structured AI report</p>
          </div>
        </div>
        <svg
          className={`w-6 h-6 text-white transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          <RenderAIData data={normalizedData} />
        </div>
      )}
    </div>
  );
}

// Recursive component to render AI data beautifully
function RenderAIData({ data, depth = 0 }) {
  const normalized = normalizeAIData(data);
  if (normalized !== data) return <RenderAIData data={normalized} depth={depth} />;

  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">N/A</span>;
  }

  if (typeof data === 'string') {
    // Check for special string patterns
    if (data.match(/^(low|medium|high|critical)$/i)) {
      return <StatusBadge status={data} />;
    }
    if (data.match(/^(upward|stable|downward|growing|declining)$/i)) {
      return <TrendBadge trend={data} />;
    }
    return <span className="text-gray-700 whitespace-pre-wrap leading-relaxed">{data}</span>;
  }

  if (typeof data === 'number') {
    return <span className="font-semibold text-gray-900">{formatNumber(data)}</span>;
  }

  if (typeof data === 'boolean') {
    return (
      <span className={`px-2 py-1 rounded text-sm font-medium ${data ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
        {data ? 'Yes' : 'No'}
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400 italic">None</span>;
    }

    // Simple string array
    if (typeof data[0] === 'string') {
      return (
        <div className="flex flex-wrap gap-2">
          {data.map((item, i) => (
            <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-white border border-gray-200 text-gray-700">
              {item}
            </span>
          ))}
        </div>
      );
    }

    const tabular = data.every((item) => item && typeof item === 'object' && !Array.isArray(item));
    const columns = tabular ? [...new Set(data.flatMap((item) => Object.keys(item)))] : [];
    const scalarTable = tabular && columns.length <= 10 && data.every((item) => columns.every((key) => {
      const value = normalizeAIData(item[key]);
      return value == null || ['string', 'number', 'boolean'].includes(typeof value);
    }));
    if (scalarTable) {
      return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr>{columns.map((key) => <th key={key} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">{formatLabel(key)}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{data.map((row, index) => <tr key={index}>{columns.map((key) => <td key={key} className="px-3 py-2 align-top"><RenderAIData data={row[key]} depth={depth + 1} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }

    // Complex arrays remain readable as individual cards.
    return (
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
            <RenderAIData data={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);

    // Special case: summary should be highlighted
    const summaryEntry = entries.find(([key]) => key.toLowerCase() === 'summary');
    const otherEntries = entries.filter(([key]) => key.toLowerCase() !== 'summary');

    return (
      <div className="space-y-4">
        {summaryEntry && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
            <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-2">Summary</h4>
            <div className="text-gray-700 leading-relaxed"><RenderAIData data={summaryEntry[1]} depth={depth + 1} /></div>
          </div>
        )}

        <div className={`grid gap-4 ${depth === 0 ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {otherEntries.map(([key, value]) => (
            <DataCard key={key} label={key} value={value} depth={depth} />
          ))}
        </div>
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

function DataCard({ label, value, depth }) {
  const formattedLabel = formatLabel(label);
  const normalizedValue = normalizeAIData(value);
  const isNested = typeof normalizedValue === 'object' && normalizedValue !== null;
  const isWide = depth === 0 && isNested && (
    Array.isArray(normalizedValue)
    || Object.values(normalizedValue).some((item) => item && typeof item === 'object')
  );

  // Special styling for certain fields
  const getCardStyle = () => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('risk') || lowerLabel.includes('critical')) {
      return 'border-l-4 border-l-red-400';
    }
    if (lowerLabel.includes('saving') || lowerLabel.includes('improvement')) {
      return 'border-l-4 border-l-green-400';
    }
    if (lowerLabel.includes('recommendation') || lowerLabel.includes('action')) {
      return 'border-l-4 border-l-blue-400';
    }
    return '';
  };

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-100 shadow-sm ${isWide ? 'md:col-span-2 lg:col-span-3' : ''} ${getCardStyle()}`}>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {formattedLabel}
      </h4>
      <div className={isNested ? '' : 'text-lg'}>
        <RenderAIData data={value} depth={depth + 1} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
  };

  const icons = {
    low: '✓',
    medium: '!',
    high: '!!',
    critical: '!!!',
  };

  const key = status.toLowerCase();
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${styles[key] || 'bg-gray-100 text-gray-700'}`}>
      <span className="mr-1">{icons[key] || ''}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TrendBadge({ trend }) {
  const styles = {
    upward: 'bg-green-100 text-green-700',
    growing: 'bg-green-100 text-green-700',
    stable: 'bg-blue-100 text-blue-700',
    downward: 'bg-red-100 text-red-700',
    declining: 'bg-red-100 text-red-700',
  };

  const icons = {
    upward: '↑',
    growing: '↑',
    stable: '→',
    downward: '↓',
    declining: '↓',
  };

  const key = trend.toLowerCase();
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${styles[key] || 'bg-gray-100 text-gray-700'}`}>
      <span className="mr-1">{icons[key] || ''}</span>
      {trend.charAt(0).toUpperCase() + trend.slice(1)}
    </span>
  );
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toFixed(2);
}

// Export helper components
export { StatusBadge, TrendBadge };
