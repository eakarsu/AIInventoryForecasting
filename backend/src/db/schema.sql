-- AI Inventory Forecasting Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS shipment_tracking CASCADE;
DROP TABLE IF EXISTS ecommerce_inventory_optimizations CASCADE;
DROP TABLE IF EXISTS warehouse_zones CASCADE;
DROP TABLE IF EXISTS dead_stock CASCADE;
DROP TABLE IF EXISTS reorder_optimizations CASCADE;
DROP TABLE IF EXISTS supplier_risks CASCADE;
DROP TABLE IF EXISTS demand_predictions CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS analytics CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS forecasts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    rating DECIMAL(5,2) DEFAULT 0,
    lead_time_days INTEGER DEFAULT 7,
    reliability_score DECIMAL(5,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    current_stock INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 10,
    max_stock_level INTEGER DEFAULT 1000,
    reorder_point INTEGER DEFAULT 20,
    reorder_quantity INTEGER DEFAULT 50,
    supplier_id INTEGER REFERENCES suppliers(id),
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    last_restocked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Forecasts table
CREATE TABLE forecasts (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    forecast_date DATE NOT NULL,
    predicted_demand INTEGER NOT NULL,
    actual_demand INTEGER,
    confidence_level DECIMAL(5,2),
    forecast_method VARCHAR(100),
    seasonality_factor DECIMAL(5,2),
    trend_direction VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery DATE,
    actual_delivery DATE,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE analytics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_type VARCHAR(50),
    category VARCHAR(100),
    period_start DATE,
    period_end DATE,
    product_id INTEGER REFERENCES products(id),
    comparison_value DECIMAL(15,2),
    change_percentage DECIMAL(10,2),
    trend VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Recommendations table
CREATE TABLE ai_recommendations (
    id SERIAL PRIMARY KEY,
    recommendation_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending',
    product_id INTEGER REFERENCES products(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    confidence_score DECIMAL(5,2),
    potential_impact VARCHAR(100),
    estimated_savings DECIMAL(12,2),
    action_required TEXT,
    expires_at TIMESTAMP,
    implemented_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NEW TABLES FOR 5 AI FEATURES
-- ============================================

-- 1. AI Demand Predictions Table
CREATE TABLE demand_predictions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    prediction_date DATE NOT NULL,
    period_type VARCHAR(50) DEFAULT 'weekly',
    predicted_quantity INTEGER NOT NULL,
    confidence_score DECIMAL(5,2),
    seasonality_index DECIMAL(5,2) DEFAULT 1.0,
    trend_coefficient DECIMAL(8,4),
    trend_direction VARCHAR(50),
    weather_impact DECIMAL(5,2),
    event_impact DECIMAL(5,2),
    historical_accuracy DECIMAL(5,2),
    ai_model_used VARCHAR(100),
    ai_reasoning TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AI Supplier Risk Analysis Table
CREATE TABLE supplier_risks (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    risk_level VARCHAR(50) NOT NULL,
    overall_risk_score DECIMAL(5,2),
    financial_risk_score DECIMAL(5,2),
    delivery_risk_score DECIMAL(5,2),
    quality_risk_score DECIMAL(5,2),
    geopolitical_risk_score DECIMAL(5,2),
    concentration_risk_score DECIMAL(5,2),
    risk_factors TEXT[],
    mitigation_strategies TEXT[],
    last_incident_date DATE,
    incident_count INTEGER DEFAULT 0,
    alternative_suppliers TEXT[],
    ai_analysis TEXT,
    review_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI Reorder Optimization Table
CREATE TABLE reorder_optimizations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    optimal_order_quantity INTEGER NOT NULL,
    optimal_order_date DATE,
    economic_order_quantity INTEGER,
    safety_stock_level INTEGER,
    reorder_point_suggested INTEGER,
    lead_time_days INTEGER,
    holding_cost_daily DECIMAL(10,2),
    ordering_cost DECIMAL(10,2),
    stockout_cost DECIMAL(10,2),
    total_cost_savings DECIMAL(12,2),
    service_level_target DECIMAL(5,2),
    demand_variability DECIMAL(5,2),
    ai_recommendation TEXT,
    urgency VARCHAR(50) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. AI Dead Stock Identification Table
CREATE TABLE dead_stock (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    days_without_sale INTEGER NOT NULL,
    last_sale_date DATE,
    quantity_in_stock INTEGER,
    stock_value DECIMAL(12,2),
    holding_cost_accumulated DECIMAL(12,2),
    turnover_rate DECIMAL(8,4),
    velocity_category VARCHAR(50),
    risk_category VARCHAR(50),
    recommended_action VARCHAR(100),
    discount_suggestion DECIMAL(5,2),
    liquidation_value DECIMAL(12,2),
    write_off_recommendation BOOLEAN DEFAULT FALSE,
    ai_analysis TEXT,
    action_taken VARCHAR(100),
    status VARCHAR(50) DEFAULT 'identified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. AI Warehouse Layout Optimization Table
CREATE TABLE warehouse_zones (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50),
    location_code VARCHAR(50),
    capacity_units INTEGER,
    current_utilization DECIMAL(5,2),
    optimal_utilization DECIMAL(5,2),
    access_frequency VARCHAR(50),
    temperature_controlled BOOLEAN DEFAULT FALSE,
    humidity_controlled BOOLEAN DEFAULT FALSE,
    product_categories TEXT[],
    suggested_products TEXT[],
    efficiency_score DECIMAL(5,2),
    travel_distance_score DECIMAL(5,2),
    picking_efficiency DECIMAL(5,2),
    storage_cost_per_unit DECIMAL(10,2),
    ai_layout_suggestion TEXT,
    last_optimized DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. AI E-commerce Inventory Optimization Table
-- ============================================
CREATE TABLE ecommerce_inventory_optimizations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    channel VARCHAR(100) NOT NULL,
    current_stock INTEGER,
    optimal_stock INTEGER,
    sell_through_rate DECIMAL(8,4),
    days_of_supply INTEGER,
    conversion_rate DECIMAL(5,2),
    cart_abandonment_rate DECIMAL(5,2),
    return_rate DECIMAL(5,2),
    profit_margin DECIMAL(5,2),
    price_elasticity DECIMAL(5,2),
    competitor_price DECIMAL(10,2),
    recommended_price DECIMAL(10,2),
    bundle_opportunities TEXT[],
    cross_sell_products TEXT[],
    seasonal_adjustment DECIMAL(5,2),
    marketing_impact DECIMAL(5,2),
    ai_recommendation TEXT,
    optimization_score DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. AI Shipment Tracking Table (Manufacturing)
-- ============================================
CREATE TABLE shipment_tracking (
    id SERIAL PRIMARY KEY,
    shipment_number VARCHAR(100) UNIQUE NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    origin_location VARCHAR(255),
    destination_location VARCHAR(255),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    shipment_type VARCHAR(50),
    weight_kg DECIMAL(10,2),
    volume_cbm DECIMAL(10,2),
    estimated_departure TIMESTAMP,
    actual_departure TIMESTAMP,
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    current_location VARCHAR(255),
    current_status VARCHAR(50),
    delay_days INTEGER DEFAULT 0,
    delay_reason TEXT,
    temperature_sensitive BOOLEAN DEFAULT FALSE,
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    current_temperature DECIMAL(5,2),
    handling_instructions TEXT,
    customs_status VARCHAR(50),
    customs_documents TEXT[],
    cost_estimate DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    insurance_value DECIMAL(12,2),
    priority_level VARCHAR(50) DEFAULT 'normal',
    ai_eta_prediction TIMESTAMP,
    ai_risk_assessment TEXT,
    ai_route_optimization TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_forecasts_product ON forecasts(product_id);
CREATE INDEX idx_forecasts_date ON forecasts(forecast_date);
CREATE INDEX idx_orders_supplier ON orders(supplier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_analytics_metric ON analytics(metric_name);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(recommendation_type);
CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);

-- New indexes for AI feature tables
CREATE INDEX idx_demand_predictions_product ON demand_predictions(product_id);
CREATE INDEX idx_demand_predictions_date ON demand_predictions(prediction_date);
CREATE INDEX idx_supplier_risks_supplier ON supplier_risks(supplier_id);
CREATE INDEX idx_supplier_risks_level ON supplier_risks(risk_level);
CREATE INDEX idx_reorder_optimizations_product ON reorder_optimizations(product_id);
CREATE INDEX idx_reorder_optimizations_urgency ON reorder_optimizations(urgency);
CREATE INDEX idx_dead_stock_product ON dead_stock(product_id);
CREATE INDEX idx_dead_stock_status ON dead_stock(status);
CREATE INDEX idx_warehouse_zones_type ON warehouse_zones(zone_type);
CREATE INDEX idx_ecommerce_inventory_product ON ecommerce_inventory_optimizations(product_id);
CREATE INDEX idx_ecommerce_inventory_channel ON ecommerce_inventory_optimizations(channel);
CREATE INDEX idx_shipment_tracking_number ON shipment_tracking(shipment_number);
CREATE INDEX idx_shipment_tracking_order ON shipment_tracking(order_id);
CREATE INDEX idx_shipment_tracking_status ON shipment_tracking(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forecasts_updated_at BEFORE UPDATE ON forecasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_recommendations_updated_at BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_demand_predictions_updated_at BEFORE UPDATE ON demand_predictions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supplier_risks_updated_at BEFORE UPDATE ON supplier_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reorder_optimizations_updated_at BEFORE UPDATE ON reorder_optimizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dead_stock_updated_at BEFORE UPDATE ON dead_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warehouse_zones_updated_at BEFORE UPDATE ON warehouse_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ecommerce_inventory_updated_at BEFORE UPDATE ON ecommerce_inventory_optimizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipment_tracking_updated_at BEFORE UPDATE ON shipment_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
