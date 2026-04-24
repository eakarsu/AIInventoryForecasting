import { useState } from 'react';
import DetailModal from './DetailModal';

export default function NewItemForm({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  initialValues = {},
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach((field) => {
      if (field.required && !values[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(values);
      setValues(initialValues);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setValues(initialValues);
    setErrors({});
    onClose();
  };

  const renderField = (field) => {
    const value = values[field.name] || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="input"
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className="input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className="input"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="input"
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center mt-2">
            <input
              type="checkbox"
              id={field.name}
              checked={!!value}
              onChange={(e) => handleChange(field.name, e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor={field.name} className="ml-2 text-sm text-gray-600">
              {field.checkboxLabel || 'Yes'}
            </label>
          </div>
        );

      default:
        return (
          <input
            type={field.type || 'text'}
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
        );
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      actions={
        <>
          <button onClick={handleClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.submit && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errors.submit}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.name} className={field.fullWidth ? 'md:col-span-2' : ''}>
              <label htmlFor={field.name} className="label">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
              {errors[field.name] && (
                <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>
      </form>
    </DetailModal>
  );
}

// Commonly used field configurations
export const productFields = [
  { name: 'sku', label: 'SKU', required: true, placeholder: 'e.g., SKU-001' },
  { name: 'name', label: 'Product Name', required: true, placeholder: 'Product name' },
  { name: 'category', label: 'Category', type: 'select', options: [
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Accessories', label: 'Accessories' },
    { value: 'Smart Home', label: 'Smart Home' },
    { value: 'Storage', label: 'Storage' },
  ]},
  { name: 'unit_price', label: 'Unit Price', type: 'number', required: true, min: 0, step: 0.01 },
  { name: 'cost_price', label: 'Cost Price', type: 'number', min: 0, step: 0.01 },
  { name: 'current_stock', label: 'Current Stock', type: 'number', min: 0 },
  { name: 'min_stock_level', label: 'Min Stock Level', type: 'number', min: 0 },
  { name: 'reorder_point', label: 'Reorder Point', type: 'number', min: 0 },
  { name: 'location', label: 'Location', placeholder: 'e.g., Warehouse A' },
  { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
];

export const supplierFields = [
  { name: 'name', label: 'Supplier Name', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone' },
  { name: 'lead_time_days', label: 'Lead Time (Days)', type: 'number', min: 1 },
  { name: 'rating', label: 'Rating', type: 'number', min: 0, max: 5, step: 0.1 },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]},
  { name: 'address', label: 'Address', type: 'textarea', fullWidth: true },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const forecastFields = [
  { name: 'product_id', label: 'Product', type: 'select', required: true, options: [] },
  { name: 'forecast_date', label: 'Forecast Date', type: 'date', required: true },
  { name: 'predicted_demand', label: 'Predicted Demand', type: 'number', required: true, min: 0 },
  { name: 'confidence_level', label: 'Confidence Level (%)', type: 'number', min: 0, max: 100 },
  { name: 'forecast_method', label: 'Forecast Method', type: 'select', options: [
    { value: 'ARIMA', label: 'ARIMA' },
    { value: 'Moving Average', label: 'Moving Average' },
    { value: 'Exponential Smoothing', label: 'Exponential Smoothing' },
    { value: 'Neural Network', label: 'Neural Network' },
    { value: 'AI Model', label: 'AI Model' },
  ]},
  { name: 'trend_direction', label: 'Trend Direction', type: 'select', options: [
    { value: 'upward', label: 'Upward' },
    { value: 'stable', label: 'Stable' },
    { value: 'downward', label: 'Downward' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];
