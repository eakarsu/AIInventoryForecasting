export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="animate-pulse">
        <div className="h-12 bg-gray-100 border-b" />
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-16 border-b border-gray-100 flex items-center px-6 space-x-4">
            {[...Array(cols)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
          <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-40" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 6 }) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[...Array(fields)].map((_, i) => (
          <div key={i}>
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
