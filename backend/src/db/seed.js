import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

const { Pool } = pg;

if (process.env.NODE_ENV === 'production' ||
    (process.env.ALLOW_DEMO_SEED !== 'true' && process.env.ALLOW_DEVELOPMENT_SEED !== 'yes')) {
  throw new Error('Demo seed is disabled; enable it explicitly outside production');
}
const demoPassword = process.env.DEMO_SEED_PASSWORD || process.env.DEMO_PASSWORD;
if (!demoPassword || demoPassword.length < 12) {
  throw new Error('DEMO_SEED_PASSWORD or DEMO_PASSWORD must contain at least 12 characters');
}
const demoEmail = process.env.DEMO_EMAIL || 'demo@inventory.ai';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_HOST,
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_DB,
  user: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_PASSWORD,
});

async function seed() {
  console.log('Starting database seed...');

  try {
    // Ensure user columns exist (for upgrades)
    console.log('Ensuring schema columns...');
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`);
    } catch (e) { /* columns may already exist */ }

    // Seed users (15+ items)
    console.log('Seeding users...');
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = `scrypt$${salt}$${crypto.scryptSync(demoPassword, salt, 64).toString('hex')}`;
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role, email_verified) VALUES
      ($2, $1, 'Demo User', 'admin', TRUE),
      ('john@inventory.ai', $1, 'John Smith', 'manager', TRUE),
      ('jane@inventory.ai', $1, 'Jane Doe', 'user', TRUE),
      ('sarah@inventory.ai', $1, 'Sarah Wilson', 'manager', TRUE),
      ('mike@inventory.ai', $1, 'Mike Johnson', 'user', FALSE),
      ('emily@inventory.ai', $1, 'Emily Davis', 'admin', TRUE),
      ('david@inventory.ai', $1, 'David Brown', 'manager', TRUE),
      ('lisa@inventory.ai', $1, 'Lisa Anderson', 'user', FALSE),
      ('tom@inventory.ai', $1, 'Tom Martinez', 'user', TRUE),
      ('anna@inventory.ai', $1, 'Anna Taylor', 'manager', TRUE),
      ('james@inventory.ai', $1, 'James Thomas', 'user', TRUE),
      ('kate@inventory.ai', $1, 'Kate Jackson', 'user', FALSE),
      ('chris@inventory.ai', $1, 'Chris White', 'manager', TRUE),
      ('maria@inventory.ai', $1, 'Maria Garcia', 'user', TRUE),
      ('robert@inventory.ai', $1, 'Robert Lee', 'admin', TRUE)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash, demoEmail]);

    // Seed suppliers (16 items)
    console.log('Seeding suppliers...');
    await pool.query(`
      INSERT INTO suppliers (name, email, phone, address, rating, lead_time_days, reliability_score, total_orders, on_time_delivery_rate, status) VALUES
      ('TechParts Global', 'sales@techparts.com', '+1-555-0101', '123 Industrial Way, San Jose, CA', 4.8, 5, 95.5, 150, 96.2, 'active'),
      ('ElectroCom Supply', 'orders@electrocom.com', '+1-555-0102', '456 Electronics Blvd, Austin, TX', 4.5, 7, 92.0, 120, 91.5, 'active'),
      ('Global Components Ltd', 'info@globalcomp.com', '+1-555-0103', '789 Component Dr, Seattle, WA', 4.2, 10, 88.5, 95, 87.0, 'active'),
      ('Prime Materials Inc', 'supply@primemats.com', '+1-555-0104', '321 Material Ave, Denver, CO', 4.7, 4, 94.0, 200, 95.0, 'active'),
      ('FastShip Electronics', 'sales@fastship.com', '+1-555-0105', '654 Shipping Lane, Miami, FL', 4.9, 3, 97.5, 180, 98.0, 'active'),
      ('Quality Parts Co', 'orders@qualityparts.com', '+1-555-0106', '987 Quality Rd, Chicago, IL', 4.3, 8, 89.0, 85, 88.5, 'active'),
      ('Reliable Supply Chain', 'info@reliablesupply.com', '+1-555-0107', '147 Reliable St, Boston, MA', 4.6, 6, 93.0, 140, 94.0, 'active'),
      ('Metro Components', 'sales@metrocomp.com', '+1-555-0108', '258 Metro Plaza, New York, NY', 4.1, 9, 86.5, 75, 85.0, 'active'),
      ('Pacific Supply Co', 'orders@pacificsupply.com', '+1-555-0109', '369 Pacific Way, Portland, OR', 4.4, 7, 90.5, 110, 90.0, 'active'),
      ('Mountain Materials', 'info@mountainmats.com', '+1-555-0110', '741 Mountain Rd, Salt Lake City, UT', 4.0, 12, 85.0, 60, 84.0, 'active'),
      ('Coastal Electronics', 'sales@coastalelec.com', '+1-555-0111', '852 Coastal Blvd, San Diego, CA', 4.7, 5, 94.5, 165, 95.5, 'active'),
      ('Midwest Parts Depot', 'orders@midwestparts.com', '+1-555-0112', '963 Midwest Dr, Minneapolis, MN', 4.2, 8, 87.5, 90, 86.5, 'active'),
      ('Southern Supply Network', 'info@southernsupply.com', '+1-555-0113', '174 Southern Ave, Atlanta, GA', 4.5, 6, 91.5, 125, 92.0, 'active'),
      ('Northern Components', 'sales@northerncomp.com', '+1-555-0114', '285 Northern Pkwy, Detroit, MI', 4.3, 7, 89.5, 100, 89.0, 'active'),
      ('Central Distribution', 'orders@centraldist.com', '+1-555-0115', '396 Central Blvd, Dallas, TX', 4.6, 5, 93.5, 155, 94.5, 'active'),
      ('Eastern Electronics Hub', 'info@easternhub.com', '+1-555-0116', '417 Eastern Way, Philadelphia, PA', 4.4, 6, 90.0, 115, 91.0, 'active')
      ON CONFLICT DO NOTHING
    `);

    // Seed products (18 items)
    console.log('Seeding products...');
    await pool.query(`
      INSERT INTO products (sku, name, description, category, unit_price, cost_price, current_stock, min_stock_level, max_stock_level, reorder_point, reorder_quantity, supplier_id, location, status) VALUES
      ('SKU-001', 'Wireless Bluetooth Headphones', 'Premium noise-canceling wireless headphones', 'Electronics', 149.99, 75.00, 245, 50, 500, 75, 100, 1, 'A-01-01', 'active'),
      ('SKU-002', 'USB-C Charging Cable 6ft', 'Fast charging USB-C cable', 'Accessories', 19.99, 5.50, 1250, 200, 2000, 300, 500, 2, 'A-02-03', 'active'),
      ('SKU-003', 'Mechanical Gaming Keyboard', 'RGB mechanical keyboard with blue switches', 'Electronics', 89.99, 42.00, 180, 30, 300, 50, 75, 1, 'B-01-02', 'active'),
      ('SKU-004', 'Ergonomic Office Mouse', 'Wireless ergonomic mouse', 'Electronics', 49.99, 22.00, 320, 50, 400, 75, 100, 3, 'A-03-01', 'active'),
      ('SKU-005', '27inch 4K Monitor', 'Ultra HD IPS display monitor', 'Electronics', 399.99, 220.00, 85, 20, 150, 30, 40, 4, 'C-01-01', 'active'),
      ('SKU-006', 'Laptop Stand Aluminum', 'Adjustable aluminum laptop stand', 'Accessories', 59.99, 25.00, 420, 75, 600, 100, 150, 5, 'A-04-02', 'active'),
      ('SKU-007', 'Webcam HD 1080p', 'Full HD webcam with microphone', 'Electronics', 79.99, 35.00, 195, 40, 300, 60, 80, 2, 'B-02-01', 'active'),
      ('SKU-008', 'Wireless Charging Pad', 'Fast wireless charging pad 15W', 'Accessories', 34.99, 12.00, 580, 100, 800, 150, 200, 6, 'A-05-03', 'active'),
      ('SKU-009', 'Smart Home Hub', 'Voice-controlled smart home hub', 'Smart Home', 129.99, 65.00, 150, 25, 200, 40, 50, 7, 'C-02-02', 'active'),
      ('SKU-010', 'Portable SSD 1TB', 'High-speed portable solid state drive', 'Storage', 119.99, 60.00, 210, 35, 300, 50, 75, 4, 'B-03-01', 'active'),
      ('SKU-011', 'Noise Canceling Earbuds', 'True wireless earbuds with ANC', 'Electronics', 199.99, 95.00, 175, 30, 250, 45, 60, 1, 'A-06-01', 'active'),
      ('SKU-012', 'USB Hub 7-Port', 'Powered USB 3.0 hub', 'Accessories', 44.99, 18.00, 390, 60, 500, 90, 120, 8, 'A-07-02', 'active'),
      ('SKU-013', 'Smart LED Light Bulbs 4pk', 'WiFi-enabled color changing bulbs', 'Smart Home', 49.99, 20.00, 280, 50, 400, 75, 100, 9, 'B-04-03', 'active'),
      ('SKU-014', 'Mechanical Numpad', 'Wireless mechanical number pad', 'Accessories', 39.99, 16.00, 145, 25, 200, 40, 50, 3, 'A-08-01', 'active'),
      ('SKU-015', 'Security Camera Indoor', 'WiFi indoor security camera', 'Smart Home', 69.99, 30.00, 225, 40, 350, 60, 80, 10, 'C-03-02', 'active'),
      ('SKU-016', 'Gaming Mouse Pad XL', 'Extended RGB gaming mouse pad', 'Accessories', 29.99, 10.00, 450, 75, 600, 100, 150, 5, 'A-09-03', 'active'),
      ('SKU-017', 'Thunderbolt Dock', 'Universal thunderbolt docking station', 'Electronics', 249.99, 130.00, 65, 15, 100, 25, 30, 11, 'C-04-01', 'active'),
      ('SKU-018', 'Smart Thermostat', 'WiFi-enabled smart thermostat', 'Smart Home', 179.99, 90.00, 95, 20, 150, 30, 40, 12, 'B-05-02', 'active')
      ON CONFLICT (sku) DO NOTHING
    `);

    // Seed forecasts (17 items)
    console.log('Seeding forecasts...');
    await pool.query(`
      INSERT INTO forecasts (product_id, forecast_date, predicted_demand, actual_demand, confidence_level, forecast_method, seasonality_factor, trend_direction, notes) VALUES
      (1, CURRENT_DATE + INTERVAL '7 days', 85, NULL, 92.5, 'ARIMA', 1.15, 'upward', 'Holiday season approaching'),
      (2, CURRENT_DATE + INTERVAL '7 days', 320, NULL, 88.0, 'Moving Average', 1.05, 'stable', 'Consistent demand'),
      (3, CURRENT_DATE + INTERVAL '7 days', 45, NULL, 85.5, 'Exponential Smoothing', 1.20, 'upward', 'Gaming season peak'),
      (4, CURRENT_DATE + INTERVAL '7 days', 78, NULL, 90.0, 'ARIMA', 1.00, 'stable', 'Work from home trend'),
      (5, CURRENT_DATE + INTERVAL '7 days', 22, NULL, 87.5, 'Neural Network', 1.10, 'upward', 'New model release'),
      (6, CURRENT_DATE + INTERVAL '7 days', 95, NULL, 91.0, 'Moving Average', 1.05, 'stable', 'Steady office demand'),
      (7, CURRENT_DATE + INTERVAL '7 days', 52, NULL, 89.0, 'ARIMA', 1.15, 'upward', 'Remote work expansion'),
      (8, CURRENT_DATE + INTERVAL '7 days', 145, NULL, 93.5, 'Exponential Smoothing', 1.25, 'upward', 'Phone upgrade cycle'),
      (9, CURRENT_DATE + INTERVAL '7 days', 35, NULL, 86.0, 'Neural Network', 1.30, 'upward', 'Smart home adoption'),
      (10, CURRENT_DATE + INTERVAL '7 days', 55, NULL, 88.5, 'ARIMA', 1.08, 'stable', 'Storage needs growing'),
      (11, CURRENT_DATE + INTERVAL '7 days', 42, NULL, 90.5, 'Moving Average', 1.12, 'upward', 'Audio upgrade trend'),
      (12, CURRENT_DATE + INTERVAL '7 days', 88, NULL, 87.0, 'Exponential Smoothing', 1.00, 'stable', 'Office equipment demand'),
      (13, CURRENT_DATE + INTERVAL '7 days', 72, NULL, 91.5, 'ARIMA', 1.35, 'upward', 'Energy efficiency focus'),
      (14, CURRENT_DATE + INTERVAL '7 days', 28, NULL, 84.0, 'Moving Average', 0.95, 'stable', 'Niche market'),
      (15, CURRENT_DATE + INTERVAL '7 days', 58, NULL, 92.0, 'Neural Network', 1.40, 'upward', 'Security concerns rising'),
      (1, CURRENT_DATE + INTERVAL '14 days', 92, NULL, 88.0, 'ARIMA', 1.20, 'upward', 'Peak holiday period'),
      (2, CURRENT_DATE + INTERVAL '14 days', 335, NULL, 85.5, 'Moving Average', 1.08, 'upward', 'Slight increase expected')
      ON CONFLICT DO NOTHING
    `);

    // Seed orders (16 items)
    console.log('Seeding orders...');
    await pool.query(`
      INSERT INTO orders (order_number, supplier_id, order_date, expected_delivery, actual_delivery, status, total_amount, shipping_cost, notes, created_by) VALUES
      ('PO-2024-001', 1, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '24 days', 'delivered', 15750.00, 250.00, 'Bulk order for Q4', 1),
      ('PO-2024-002', 2, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '18 days', CURRENT_DATE - INTERVAL '17 days', 'delivered', 8500.00, 150.00, 'Regular replenishment', 1),
      ('PO-2024-003', 3, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '11 days', 'delivered', 12300.00, 200.00, 'Emergency restock', 2),
      ('PO-2024-004', 4, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '11 days', CURRENT_DATE - INTERVAL '10 days', 'delivered', 22000.00, 350.00, 'Monitor bulk order', 1),
      ('PO-2024-005', 5, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '7 days', 'delivered', 6250.00, 100.00, 'Fast delivery needed', 2),
      ('PO-2024-006', 6, CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE - INTERVAL '2 days', NULL, 'in_transit', 9800.00, 175.00, 'Quality parts order', 1),
      ('PO-2024-007', 7, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '1 days', NULL, 'in_transit', 13500.00, 225.00, 'Smart home products', 1),
      ('PO-2024-008', 8, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '5 days', NULL, 'processing', 4200.00, 80.00, 'USB hubs restock', 2),
      ('PO-2024-009', 1, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', NULL, 'processing', 18900.00, 300.00, 'Headphones bulk', 1),
      ('PO-2024-010', 9, CURRENT_DATE - INTERVAL '1 days', CURRENT_DATE + INTERVAL '6 days', NULL, 'pending', 7500.00, 125.00, 'LED bulbs order', 1),
      ('PO-2024-011', 10, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 days', NULL, 'pending', 5400.00, 90.00, 'Security cameras', 2),
      ('PO-2024-012', 11, CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days', NULL, 'pending', 26000.00, 400.00, 'Docking stations', 1),
      ('PO-2024-013', 12, CURRENT_DATE, CURRENT_DATE + INTERVAL '8 days', NULL, 'pending', 11250.00, 180.00, 'Smart thermostats', 1),
      ('PO-2024-014', 2, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '38 days', CURRENT_DATE - INTERVAL '37 days', 'delivered', 9200.00, 160.00, 'Cables bulk order', 2),
      ('PO-2024-015', 4, CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '36 days', CURRENT_DATE - INTERVAL '35 days', 'delivered', 7800.00, 130.00, 'SSD restock', 1),
      ('PO-2024-016', 5, CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE - INTERVAL '32 days', CURRENT_DATE - INTERVAL '32 days', 'delivered', 4500.00, 75.00, 'Quick replenishment', 2)
      ON CONFLICT (order_number) DO NOTHING
    `);

    // Seed analytics (17 items)
    console.log('Seeding analytics...');
    await pool.query(`
      INSERT INTO analytics (metric_name, metric_value, metric_type, category, period_start, period_end, product_id, comparison_value, change_percentage, trend, notes) VALUES
      ('Total Revenue', 285000.00, 'currency', 'Sales', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 265000.00, 7.55, 'upward', 'Strong month-over-month growth'),
      ('Units Sold', 4250, 'count', 'Sales', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 3980, 6.78, 'upward', 'Volume increase'),
      ('Average Order Value', 67.05, 'currency', 'Sales', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 66.58, 0.71, 'stable', 'Consistent AOV'),
      ('Inventory Turnover', 4.2, 'ratio', 'Inventory', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 3.8, 10.53, 'upward', 'Improved turnover rate'),
      ('Stock-out Rate', 2.5, 'percentage', 'Inventory', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 3.2, -21.88, 'downward', 'Better stock management'),
      ('Carrying Cost', 12500.00, 'currency', 'Inventory', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 13200.00, -5.30, 'downward', 'Reduced holding costs'),
      ('Supplier Lead Time', 6.5, 'days', 'Supply Chain', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 7.2, -9.72, 'downward', 'Faster deliveries'),
      ('On-Time Delivery Rate', 94.5, 'percentage', 'Supply Chain', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 92.0, 2.72, 'upward', 'Improved reliability'),
      ('Gross Margin', 42.5, 'percentage', 'Financial', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 41.8, 1.67, 'upward', 'Margin improvement'),
      ('Return Rate', 1.8, 'percentage', 'Quality', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 2.1, -14.29, 'downward', 'Quality improvements'),
      ('Headphones Sales', 245, 'count', 'Product', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 1, 220, 11.36, 'upward', 'Strong performer'),
      ('USB Cables Sales', 1250, 'count', 'Product', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 2, 1180, 5.93, 'upward', 'Consistent demand'),
      ('Monitor Sales', 85, 'count', 'Product', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 5, 78, 8.97, 'upward', 'Growing category'),
      ('Smart Home Sales', 470, 'count', 'Product', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 380, 23.68, 'upward', 'Fastest growing category'),
      ('Forecast Accuracy', 91.2, 'percentage', 'AI', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 88.5, 3.05, 'upward', 'Model improvements'),
      ('Reorder Efficiency', 87.5, 'percentage', 'Inventory', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 84.0, 4.17, 'upward', 'Better predictions'),
      ('Days of Supply', 28, 'days', 'Inventory', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL, 32, -12.50, 'downward', 'Leaner inventory')
      ON CONFLICT DO NOTHING
    `);

    // Seed AI recommendations (16 items)
    console.log('Seeding AI recommendations...');
    await pool.query(`
      INSERT INTO ai_recommendations (recommendation_type, title, description, priority, status, product_id, supplier_id, confidence_score, potential_impact, estimated_savings, action_required, expires_at) VALUES
      ('restock', 'Restock Wireless Headphones', 'Stock levels approaching reorder point. Recommend ordering 100 units within 5 days.', 'high', 'pending', 1, 1, 94.5, 'Prevent stockout', 2500.00, 'Create purchase order for 100 units', CURRENT_DATE + INTERVAL '7 days'),
      ('price_optimization', 'Increase USB Cable Pricing', 'Market analysis suggests 8% price increase opportunity without affecting demand.', 'medium', 'pending', 2, NULL, 87.0, 'Revenue increase', 1800.00, 'Review and adjust pricing', CURRENT_DATE + INTERVAL '14 days'),
      ('supplier', 'Switch Monitor Supplier', 'Alternative supplier offers 12% better pricing with similar lead times.', 'medium', 'pending', 5, 4, 82.5, 'Cost reduction', 4200.00, 'Evaluate and negotiate with new supplier', CURRENT_DATE + INTERVAL '30 days'),
      ('demand_anomaly', 'Unusual Demand Spike Detected', 'Smart LED Bulbs showing 45% higher demand than forecast. Consider emergency restock.', 'high', 'pending', 13, NULL, 91.0, 'Capture sales opportunity', 3500.00, 'Order additional inventory immediately', CURRENT_DATE + INTERVAL '3 days'),
      ('restock', 'Low Stock Alert: Gaming Keyboard', 'Current stock will be depleted in 8 days based on current sales velocity.', 'high', 'pending', 3, 1, 93.0, 'Prevent stockout', 1800.00, 'Place order for 75 units', CURRENT_DATE + INTERVAL '5 days'),
      ('trend_analysis', 'Smart Home Category Growth', 'Smart home products showing 24% MoM growth. Consider expanding inventory.', 'medium', 'pending', NULL, NULL, 89.5, 'Market opportunity', 8500.00, 'Increase smart home inventory by 30%', CURRENT_DATE + INTERVAL '21 days'),
      ('supplier_scoring', 'Upgrade FastShip to Preferred', 'FastShip Electronics has 98% on-time delivery. Recommend preferred status.', 'low', 'pending', NULL, 5, 96.0, 'Supply chain reliability', 1200.00, 'Update supplier tier status', CURRENT_DATE + INTERVAL '30 days'),
      ('price_optimization', 'Bundle Opportunity Detected', 'Keyboard + Mouse bundle could increase average order value by 15%.', 'medium', 'pending', 3, NULL, 85.0, 'Revenue increase', 2200.00, 'Create bundle product listing', CURRENT_DATE + INTERVAL '14 days'),
      ('restock', 'Reorder Portable SSDs', 'Lead time consideration: Order now to avoid stockout during promotion.', 'medium', 'pending', 10, 4, 88.5, 'Inventory optimization', 1500.00, 'Order 75 units', CURRENT_DATE + INTERVAL '10 days'),
      ('demand_anomaly', 'Seasonal Demand Increase', 'Historical data shows 35% demand increase in coming month. Prepare inventory.', 'high', 'pending', 1, NULL, 92.5, 'Seasonal preparation', 5000.00, 'Increase stock levels across electronics', CURRENT_DATE + INTERVAL '14 days'),
      ('supplier', 'Diversify Supplier Base', 'High concentration risk: 40% of orders from single supplier. Recommend diversification.', 'medium', 'pending', NULL, NULL, 86.0, 'Risk mitigation', 0.00, 'Onboard 2-3 additional suppliers', CURRENT_DATE + INTERVAL '45 days'),
      ('price_optimization', 'Competitive Price Alert', 'Webcam pricing 5% above market average. Consider adjustment to maintain competitiveness.', 'low', 'pending', 7, NULL, 79.5, 'Market positioning', 800.00, 'Review competitor pricing', CURRENT_DATE + INTERVAL '7 days'),
      ('restock', 'Smart Thermostat Reorder', 'Approaching minimum stock level with high seasonal demand expected.', 'medium', 'pending', 18, 12, 90.0, 'Seasonal readiness', 2000.00, 'Order 40 units', CURRENT_DATE + INTERVAL '7 days'),
      ('trend_analysis', 'Work From Home Trend', 'Office accessories showing sustained demand. Monitor and ergonomic products strong.', 'low', 'implemented', NULL, NULL, 88.0, 'Market insight', 0.00, 'Maintain inventory levels', CURRENT_DATE + INTERVAL '30 days'),
      ('supplier_scoring', 'Review Mountain Materials', 'Reliability score dropped 5% last quarter. Schedule performance review.', 'medium', 'pending', NULL, 10, 84.0, 'Quality assurance', 500.00, 'Conduct supplier review meeting', CURRENT_DATE + INTERVAL '14 days'),
      ('demand_anomaly', 'USB Hub Demand Stable', 'Demand within expected range. No action required at this time.', 'low', 'implemented', 12, NULL, 95.0, 'Monitoring', 0.00, 'Continue monitoring', CURRENT_DATE + INTERVAL '30 days')
      ON CONFLICT DO NOTHING
    `);

    // Seed order items
    console.log('Seeding order items...');
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
      (1, 1, 100, 75.00, 7500.00),
      (1, 3, 50, 42.00, 2100.00),
      (1, 11, 65, 95.00, 6175.00),
      (2, 2, 500, 5.50, 2750.00),
      (2, 8, 200, 12.00, 2400.00),
      (2, 12, 150, 18.00, 2700.00),
      (3, 4, 150, 22.00, 3300.00),
      (3, 6, 200, 25.00, 5000.00),
      (3, 14, 100, 16.00, 1600.00),
      (4, 5, 50, 220.00, 11000.00),
      (4, 17, 40, 130.00, 5200.00),
      (5, 6, 100, 25.00, 2500.00),
      (5, 16, 150, 10.00, 1500.00),
      (6, 8, 300, 12.00, 3600.00),
      (6, 2, 800, 5.50, 4400.00),
      (7, 9, 75, 65.00, 4875.00),
      (7, 13, 150, 20.00, 3000.00),
      (7, 15, 100, 30.00, 3000.00)
      ON CONFLICT DO NOTHING
    `);

    // ============================================
    // SEED DATA FOR 5 NEW AI FEATURES
    // ============================================

    // 1. Seed Demand Predictions (16 items)
    console.log('Seeding demand predictions...');
    await pool.query(`
      INSERT INTO demand_predictions (product_id, prediction_date, period_type, predicted_quantity, confidence_score, seasonality_index, trend_coefficient, trend_direction, weather_impact, event_impact, historical_accuracy, ai_model_used, ai_reasoning, status) VALUES
      (1, CURRENT_DATE + INTERVAL '7 days', 'weekly', 95, 92.5, 1.25, 0.0523, 'upward', 1.05, 1.15, 89.5, 'LSTM Neural Network', 'Strong seasonal trend detected with holiday approaching. Historical patterns suggest 25% increase during this period.', 'active'),
      (2, CURRENT_DATE + INTERVAL '7 days', 'weekly', 380, 88.0, 1.08, 0.0312, 'upward', 1.00, 1.05, 91.2, 'Prophet', 'Consistent growth trend with minor seasonal variation. Work-from-home equipment demand remains steady.', 'active'),
      (3, CURRENT_DATE + INTERVAL '7 days', 'weekly', 52, 85.5, 1.35, 0.0678, 'upward', 1.00, 1.30, 86.8, 'XGBoost', 'Gaming peripherals peak during Q4. Major game releases expected to drive demand.', 'active'),
      (4, CURRENT_DATE + INTERVAL '7 days', 'weekly', 88, 90.0, 1.02, 0.0189, 'stable', 1.00, 1.00, 92.3, 'ARIMA', 'Ergonomic products show stable demand pattern. Remote work normalization provides baseline.', 'active'),
      (5, CURRENT_DATE + INTERVAL '7 days', 'weekly', 28, 87.5, 1.18, 0.0456, 'upward', 1.00, 1.12, 88.9, 'LSTM Neural Network', 'Monitor demand increasing with home office upgrades. New model releases drive interest.', 'active'),
      (6, CURRENT_DATE + INTERVAL '7 days', 'weekly', 105, 91.0, 1.05, 0.0234, 'stable', 1.00, 1.02, 90.1, 'Prophet', 'Laptop accessories maintain steady demand. Minor uptick expected for back-to-school season.', 'active'),
      (7, CURRENT_DATE + INTERVAL '7 days', 'weekly', 62, 89.0, 1.22, 0.0567, 'upward', 1.00, 1.18, 87.6, 'XGBoost', 'Video conferencing equipment demand rising with hybrid work adoption.', 'active'),
      (8, CURRENT_DATE + INTERVAL '7 days', 'weekly', 165, 93.5, 1.35, 0.0789, 'upward', 1.00, 1.28, 91.8, 'LSTM Neural Network', 'Wireless charging adoption accelerating. New phone releases drive accessory sales.', 'active'),
      (9, CURRENT_DATE + INTERVAL '7 days', 'weekly', 42, 86.0, 1.45, 0.0923, 'upward', 0.95, 1.35, 85.4, 'Prophet', 'Smart home hub demand surging. Voice assistant adoption reaching new demographics.', 'active'),
      (10, CURRENT_DATE + INTERVAL '7 days', 'weekly', 65, 88.5, 1.12, 0.0345, 'upward', 1.00, 1.08, 89.2, 'ARIMA', 'Storage demand growing with data creation trends. Content creator market expanding.', 'active'),
      (11, CURRENT_DATE + INTERVAL '7 days', 'weekly', 48, 90.5, 1.28, 0.0612, 'upward', 1.00, 1.22, 88.7, 'XGBoost', 'Premium audio products trending upward. Quality-conscious consumers driving demand.', 'active'),
      (12, CURRENT_DATE + INTERVAL '7 days', 'weekly', 98, 87.0, 1.00, 0.0156, 'stable', 1.00, 1.00, 90.4, 'Prophet', 'USB hub demand stable. Multi-device usage pattern established.', 'active'),
      (13, CURRENT_DATE + INTERVAL '7 days', 'weekly', 85, 91.5, 1.52, 0.1034, 'upward', 0.92, 1.42, 89.9, 'LSTM Neural Network', 'Smart lighting adoption accelerating. Energy efficiency concerns driving purchases.', 'active'),
      (14, CURRENT_DATE + INTERVAL '7 days', 'weekly', 32, 84.0, 0.95, -0.0123, 'stable', 1.00, 0.98, 86.3, 'ARIMA', 'Niche product with stable but limited demand. Finance professionals primary buyers.', 'active'),
      (15, CURRENT_DATE + INTERVAL '7 days', 'weekly', 72, 92.0, 1.55, 0.1123, 'upward', 1.00, 1.48, 91.5, 'XGBoost', 'Security camera demand surging with home security awareness increasing.', 'active'),
      (16, CURRENT_DATE + INTERVAL '7 days', 'weekly', 125, 89.5, 1.18, 0.0456, 'upward', 1.00, 1.12, 88.3, 'Prophet', 'Gaming accessories showing consistent growth. Esports popularity driving interest.', 'active')
      ON CONFLICT DO NOTHING
    `);

    // 2. Seed Supplier Risks (16 items)
    console.log('Seeding supplier risks...');
    await pool.query(`
      INSERT INTO supplier_risks (supplier_id, risk_level, overall_risk_score, financial_risk_score, delivery_risk_score, quality_risk_score, geopolitical_risk_score, concentration_risk_score, risk_factors, mitigation_strategies, last_incident_date, incident_count, alternative_suppliers, ai_analysis, review_date, status) VALUES
      (1, 'low', 18.5, 15.0, 12.5, 20.0, 25.0, 22.5, ARRAY['Minor delivery variations', 'Single region sourcing'], ARRAY['Maintain safety stock', 'Develop backup supplier'], CURRENT_DATE - INTERVAL '45 days', 2, ARRAY['ElectroCom Supply', 'Coastal Electronics'], 'TechParts Global maintains excellent financial stability and delivery performance. Minor concentration risk due to single-region operations. Recommend maintaining as primary supplier with backup arrangements.', CURRENT_DATE + INTERVAL '30 days', 'active'),
      (2, 'low', 22.0, 18.5, 20.0, 22.5, 28.0, 25.0, ARRAY['Moderate lead times', 'Currency exposure'], ARRAY['Forward contracts for FX', 'Increase order frequency'], CURRENT_DATE - INTERVAL '30 days', 3, ARRAY['TechParts Global', 'Pacific Supply Co'], 'ElectroCom Supply shows solid performance with moderate risk profile. Currency hedging recommended to manage FX exposure. Reliable alternative to primary suppliers.', CURRENT_DATE + INTERVAL '30 days', 'active'),
      (3, 'medium', 35.5, 32.0, 38.5, 30.0, 42.0, 35.0, ARRAY['Extended lead times', 'Quality inconsistencies', 'Limited capacity'], ARRAY['Implement quality inspections', 'Diversify orders', 'Negotiate capacity reservation'], CURRENT_DATE - INTERVAL '15 days', 5, ARRAY['Metro Components', 'Northern Components'], 'Global Components Ltd showing elevated risk due to recent quality issues and extended lead times. Recommend increased monitoring and gradual order reduction until improvements demonstrated.', CURRENT_DATE + INTERVAL '14 days', 'active'),
      (4, 'low', 15.0, 12.5, 18.0, 14.0, 15.0, 18.5, ARRAY['Minimal identified risks'], ARRAY['Standard monitoring protocols'], NULL, 0, ARRAY['FastShip Electronics', 'Central Distribution'], 'Prime Materials Inc demonstrates excellent performance across all risk categories. Top-tier supplier with strong financials and consistent delivery. Recommend for increased volume allocation.', CURRENT_DATE + INTERVAL '60 days', 'active'),
      (5, 'low', 12.0, 10.0, 8.5, 15.0, 12.0, 18.0, ARRAY['Premium pricing'], ARRAY['Negotiate volume discounts', 'Long-term contract'], CURRENT_DATE - INTERVAL '90 days', 1, ARRAY['Prime Materials Inc', 'Reliable Supply Chain'], 'FastShip Electronics is our lowest-risk supplier with exceptional delivery performance. Premium pricing offset by reliability. Candidate for strategic partnership.', CURRENT_DATE + INTERVAL '90 days', 'active'),
      (6, 'medium', 32.0, 28.5, 35.0, 30.0, 32.0, 38.5, ARRAY['Delivery delays', 'Capacity constraints', 'Regional disruptions'], ARRAY['Increase safety stock', 'Split orders with alternatives', 'Monitor weather impacts'], CURRENT_DATE - INTERVAL '10 days', 4, ARRAY['Midwest Parts Depot', 'Southern Supply Network'], 'Quality Parts Co experiencing moderate operational challenges. Recent delivery delays attributed to regional disruptions. Recommend order splitting and increased monitoring.', CURRENT_DATE + INTERVAL '21 days', 'active'),
      (7, 'low', 20.0, 18.0, 22.5, 18.5, 22.0, 20.0, ARRAY['Moderate concentration in product categories'], ARRAY['Category diversification', 'Backup supplier development'], CURRENT_DATE - INTERVAL '60 days', 2, ARRAY['Pacific Supply Co', 'Eastern Electronics Hub'], 'Reliable Supply Chain lives up to name with consistent performance. Minor concentration risk in smart home category. Recommend as reliable secondary supplier.', CURRENT_DATE + INTERVAL '45 days', 'active'),
      (8, 'medium', 38.0, 35.0, 42.0, 32.5, 45.0, 40.0, ARRAY['Urban logistics challenges', 'High operating costs', 'Staff turnover'], ARRAY['Premium shipping options', 'Buffer inventory', 'Alternative routing'], CURRENT_DATE - INTERVAL '8 days', 6, ARRAY['Eastern Electronics Hub', 'Quality Parts Co'], 'Metro Components facing operational challenges in urban logistics. Higher risk profile but strategic for Northeast coverage. Recommend reduced reliance and increased monitoring.', CURRENT_DATE + INTERVAL '14 days', 'active'),
      (9, 'low', 25.0, 22.0, 28.0, 22.5, 28.0, 25.0, ARRAY['West Coast concentration', 'Seasonal port congestion'], ARRAY['East Coast alternatives', 'Pre-holiday ordering'], CURRENT_DATE - INTERVAL '40 days', 3, ARRAY['Midwest Parts Depot', 'Central Distribution'], 'Pacific Supply Co maintains good performance with seasonal risk variations. Port congestion during peak seasons requires advance planning. Reliable regional supplier.', CURRENT_DATE + INTERVAL '30 days', 'active'),
      (10, 'high', 52.0, 48.5, 55.0, 45.0, 62.0, 55.0, ARRAY['Extended lead times', 'Geographic isolation', 'Weather disruptions', 'Financial concerns'], ARRAY['Significant safety stock', 'Alternative supplier qualification', 'Regular financial monitoring'], CURRENT_DATE - INTERVAL '5 days', 8, ARRAY['Northern Components', 'Midwest Parts Depot'], 'Mountain Materials shows elevated risk across multiple categories. Geographic challenges and recent financial concerns warrant careful monitoring. Recommend gradual reduction of dependency.', CURRENT_DATE + INTERVAL '7 days', 'active'),
      (11, 'low', 16.5, 14.0, 15.0, 18.0, 20.0, 18.5, ARRAY['Minor seasonal variations'], ARRAY['Seasonal inventory adjustments'], CURRENT_DATE - INTERVAL '75 days', 1, ARRAY['TechParts Global', 'Prime Materials Inc'], 'Coastal Electronics demonstrates strong performance with minimal risk factors. West Coast location provides strategic value. Recommend for increased allocation.', CURRENT_DATE + INTERVAL '60 days', 'active'),
      (12, 'medium', 30.0, 28.0, 32.5, 28.0, 35.0, 32.0, ARRAY['Regional weather exposure', 'Moderate lead times'], ARRAY['Weather monitoring', 'Increased safety stock'], CURRENT_DATE - INTERVAL '20 days', 4, ARRAY['Southern Supply Network', 'Central Distribution'], 'Midwest Parts Depot shows moderate risk profile with weather-related concerns. Reliable for regional coverage with appropriate risk mitigation.', CURRENT_DATE + INTERVAL '30 days', 'active'),
      (13, 'low', 22.5, 20.0, 25.0, 20.0, 25.0, 24.0, ARRAY['Regional focus', 'Growing capacity'], ARRAY['Monitor capacity utilization', 'Long-term agreements'], CURRENT_DATE - INTERVAL '55 days', 2, ARRAY['Central Distribution', 'Eastern Electronics Hub'], 'Southern Supply Network shows consistent performance with manageable risk levels. Growing capacity presents opportunity for increased partnership.', CURRENT_DATE + INTERVAL '45 days', 'active'),
      (14, 'medium', 34.0, 32.0, 38.0, 30.0, 38.0, 35.0, ARRAY['Automotive industry exposure', 'Economic sensitivity'], ARRAY['Diversify product mix', 'Monitor industry trends'], CURRENT_DATE - INTERVAL '25 days', 5, ARRAY['Global Components Ltd', 'Metro Components'], 'Northern Components shows moderate risk due to automotive industry concentration. Economic sensitivity requires monitoring. Suitable for diversification strategy.', CURRENT_DATE + INTERVAL '21 days', 'active'),
      (15, 'low', 18.0, 15.5, 20.0, 16.5, 22.0, 18.0, ARRAY['Texas weather exposure'], ARRAY['Seasonal planning', 'Alternative routing'], CURRENT_DATE - INTERVAL '50 days', 2, ARRAY['Southern Supply Network', 'Reliable Supply Chain'], 'Central Distribution maintains strong performance with minimal risk. Strategic central location provides logistics advantages. Recommend for increased volume.', CURRENT_DATE + INTERVAL '60 days', 'active'),
      (16, 'low', 24.0, 22.0, 26.0, 22.5, 28.0, 24.0, ARRAY['Northeast concentration'], ARRAY['Regional diversification', 'Weather contingencies'], CURRENT_DATE - INTERVAL '35 days', 3, ARRAY['Metro Components', 'Southern Supply Network'], 'Eastern Electronics Hub shows reliable performance with manageable Northeast concentration risk. Good regional coverage with consistent quality.', CURRENT_DATE + INTERVAL '45 days', 'active')
      ON CONFLICT DO NOTHING
    `);

    // 3. Seed Reorder Optimizations (16 items)
    console.log('Seeding reorder optimizations...');
    await pool.query(`
      INSERT INTO reorder_optimizations (product_id, supplier_id, optimal_order_quantity, optimal_order_date, economic_order_quantity, safety_stock_level, reorder_point_suggested, lead_time_days, holding_cost_daily, ordering_cost, stockout_cost, total_cost_savings, service_level_target, demand_variability, ai_recommendation, urgency, status) VALUES
      (1, 1, 120, CURRENT_DATE + INTERVAL '3 days', 115, 45, 85, 5, 0.35, 150.00, 450.00, 2850.00, 98.5, 12.5, 'Order 120 units immediately to maintain 98.5% service level. Current stock trajectory suggests potential stockout in 12 days without action. Seasonal demand peak approaching.', 'high', 'pending'),
      (2, 2, 600, CURRENT_DATE + INTERVAL '5 days', 580, 150, 350, 7, 0.08, 85.00, 120.00, 1250.00, 97.0, 8.5, 'High-velocity item with consistent demand. Large order quantity justified by low holding costs. Recommend consolidating with other orders from same supplier.', 'normal', 'pending'),
      (3, 1, 85, CURRENT_DATE + INTERVAL '2 days', 80, 35, 55, 5, 0.25, 120.00, 380.00, 1680.00, 98.0, 15.2, 'Gaming keyboard demand increasing ahead of holiday season. Higher safety stock recommended due to demand variability. Place order within 48 hours.', 'high', 'pending'),
      (4, 3, 110, CURRENT_DATE + INTERVAL '7 days', 105, 40, 80, 10, 0.15, 95.00, 220.00, 980.00, 96.5, 10.8, 'Stable demand pattern allows for standard replenishment cycle. Consider grouping with other Global Components orders for freight optimization.', 'normal', 'pending'),
      (5, 4, 45, CURRENT_DATE + INTERVAL '4 days', 42, 18, 32, 4, 0.85, 180.00, 850.00, 3200.00, 99.0, 14.5, 'High-value item requires premium service level. Low stock warning - current inventory covers only 15 days of demand. Expedited ordering recommended.', 'high', 'pending'),
      (6, 5, 160, CURRENT_DATE + INTERVAL '10 days', 155, 55, 110, 3, 0.12, 75.00, 180.00, 720.00, 97.5, 9.2, 'Fast supplier lead time allows for just-in-time approach. Current stock healthy but reorder due in 10 days to maintain buffer.', 'low', 'pending'),
      (7, 2, 90, CURRENT_DATE + INTERVAL '5 days', 85, 38, 68, 7, 0.22, 110.00, 320.00, 1450.00, 98.0, 13.8, 'Webcam demand elevated due to hybrid work trends. Increased safety stock accounts for demand variability. Order timing critical for video conferencing season.', 'normal', 'pending'),
      (8, 6, 220, CURRENT_DATE + INTERVAL '6 days', 210, 75, 165, 8, 0.06, 65.00, 95.00, 580.00, 96.0, 7.5, 'Low-cost consumable with steady demand. Larger order quantities reduce per-unit ordering costs. Warehouse capacity permits bulk storage.', 'normal', 'pending'),
      (9, 7, 55, CURRENT_DATE + INTERVAL '4 days', 52, 22, 45, 6, 0.42, 135.00, 520.00, 2100.00, 98.5, 18.5, 'Smart home hub showing strong growth trend. Higher demand variability requires increased safety stock. Critical product for smart home category expansion.', 'high', 'pending'),
      (10, 4, 80, CURRENT_DATE + INTERVAL '7 days', 78, 32, 58, 4, 0.38, 125.00, 420.00, 1680.00, 97.5, 11.2, 'Portable storage demand growing with content creator market. Recommend order timing to align with supplier promotional period for cost savings.', 'normal', 'pending'),
      (11, 1, 65, CURRENT_DATE + INTERVAL '3 days', 62, 28, 50, 5, 0.58, 145.00, 680.00, 2450.00, 98.5, 14.8, 'Premium earbuds require high service level for brand reputation. Current stock trajectory tight - immediate order recommended.', 'high', 'pending'),
      (12, 8, 130, CURRENT_DATE + INTERVAL '8 days', 125, 48, 95, 9, 0.11, 88.00, 175.00, 890.00, 96.5, 8.9, 'USB hub demand stable. Metro Components lead time requires earlier ordering. Consider safety stock increase due to urban logistics variability.', 'normal', 'pending'),
      (13, 9, 115, CURRENT_DATE + INTERVAL '5 days', 110, 42, 82, 7, 0.14, 92.00, 240.00, 1120.00, 97.0, 16.2, 'Smart lighting fastest growing category. Demand variability high but trend strongly positive. Order supports category expansion strategy.', 'normal', 'pending'),
      (14, 3, 55, CURRENT_DATE + INTERVAL '12 days', 52, 18, 42, 10, 0.10, 72.00, 145.00, 420.00, 95.0, 6.8, 'Niche product with predictable demand. Lower service level acceptable for specialty item. Standard replenishment cycle adequate.', 'low', 'pending'),
      (15, 10, 90, CURRENT_DATE + INTERVAL '4 days', 85, 35, 65, 12, 0.18, 105.00, 350.00, 1580.00, 98.0, 17.5, 'Security camera demand surging. Long lead time from Mountain Materials requires advance ordering. Consider supplier diversification for risk mitigation.', 'high', 'pending'),
      (16, 5, 165, CURRENT_DATE + INTERVAL '8 days', 160, 58, 115, 3, 0.08, 68.00, 125.00, 650.00, 96.0, 9.5, 'Gaming accessories showing consistent growth. FastShip quick turnaround allows flexible ordering. Bundle with other gaming peripherals for efficiency.', 'normal', 'pending')
      ON CONFLICT DO NOTHING
    `);

    // 4. Seed Dead Stock (16 items - mixing real dead stock scenarios)
    console.log('Seeding dead stock...');
    await pool.query(`
      INSERT INTO dead_stock (product_id, days_without_sale, last_sale_date, quantity_in_stock, stock_value, holding_cost_accumulated, turnover_rate, velocity_category, risk_category, recommended_action, discount_suggestion, liquidation_value, write_off_recommendation, ai_analysis, action_taken, status) VALUES
      (14, 45, CURRENT_DATE - INTERVAL '45 days', 145, 5795.55, 289.78, 0.85, 'slow', 'medium', 'discount_sale', 15.0, 4926.22, FALSE, 'Mechanical numpad showing slow movement. Niche product for finance professionals. Recommend 15% discount promotion targeting specific buyer segment through business channels.', NULL, 'identified'),
      (17, 62, CURRENT_DATE - INTERVAL '62 days', 65, 16249.35, 1137.45, 0.42, 'very_slow', 'high', 'bundle_promotion', 25.0, 12187.01, FALSE, 'Thunderbolt dock high-value item with limited market. Tech refresh cycle may be ending. Recommend bundling with monitors or offering enterprise discount program.', NULL, 'identified'),
      (5, 28, CURRENT_DATE - INTERVAL '28 days', 15, 5999.85, 167.99, 1.25, 'moderate', 'low', 'monitor', 0.0, 5999.85, FALSE, 'Monitor sales slowing after initial demand spike. New model rumors may be affecting purchases. Hold current pricing but monitor competitor activity.', NULL, 'monitoring'),
      (18, 55, CURRENT_DATE - INTERVAL '55 days', 95, 17099.05, 940.45, 0.55, 'slow', 'high', 'seasonal_promotion', 20.0, 13679.24, FALSE, 'Smart thermostat slow during current season. Expect demand recovery in winter. Recommend holding with seasonal promotion planning for Q4.', NULL, 'identified'),
      (9, 38, CURRENT_DATE - INTERVAL '38 days', 35, 4549.65, 172.89, 0.78, 'slow', 'medium', 'marketing_push', 10.0, 4094.69, FALSE, 'Smart home hub facing competition from newer models. Market still growing but product may need refresh. Recommend marketing push before considering clearance.', NULL, 'identified'),
      (3, 22, CURRENT_DATE - INTERVAL '22 days', 25, 2249.75, 49.49, 1.45, 'moderate', 'low', 'monitor', 0.0, 2249.75, FALSE, 'Gaming keyboard temporary slowdown between gaming seasons. Historical pattern suggests recovery expected. No action recommended at this time.', NULL, 'monitoring'),
      (11, 35, CURRENT_DATE - INTERVAL '35 days', 42, 8399.58, 293.98, 0.92, 'slow', 'medium', 'discount_sale', 12.0, 7391.63, FALSE, 'Premium earbuds facing market saturation. Multiple new competitors entered market. Recommend modest discount to maintain market share before new model launch.', NULL, 'identified'),
      (7, 48, CURRENT_DATE - INTERVAL '48 days', 55, 4399.45, 211.17, 0.68, 'slow', 'medium', 'bundle_promotion', 18.0, 3607.55, FALSE, 'Webcam post-pandemic demand normalization. Market oversupply from multiple vendors. Bundle with headphones or offer corporate packages.', NULL, 'identified'),
      (4, 15, CURRENT_DATE - INTERVAL '15 days', 28, 1399.72, 20.99, 1.85, 'moderate', 'low', 'monitor', 0.0, 1399.72, FALSE, 'Ergonomic mouse normal fluctuation in demand. Product lifecycle healthy. Continue monitoring without intervention.', NULL, 'monitoring'),
      (6, 42, CURRENT_DATE - INTERVAL '42 days', 85, 5099.15, 214.16, 0.72, 'slow', 'medium', 'discount_sale', 15.0, 4334.28, FALSE, 'Laptop stand oversupply from aggressive ordering. Quality product but excess inventory. Recommend 15% discount through office supply partnerships.', NULL, 'identified'),
      (10, 32, CURRENT_DATE - INTERVAL '32 days', 48, 5759.52, 184.30, 1.02, 'moderate', 'low', 'marketing_push', 8.0, 5298.76, FALSE, 'Portable SSD slight slowdown but market fundamentals strong. Content creator marketing campaign recommended to stimulate demand.', NULL, 'identified'),
      (12, 58, CURRENT_DATE - INTERVAL '58 days', 125, 5623.75, 326.18, 0.45, 'very_slow', 'high', 'clearance', 30.0, 3936.63, FALSE, 'USB hub market commoditized. Multiple low-cost alternatives available. Recommend aggressive clearance pricing to recover capital for reinvestment.', NULL, 'identified'),
      (15, 25, CURRENT_DATE - INTERVAL '25 days', 38, 2659.62, 66.49, 1.35, 'moderate', 'low', 'monitor', 0.0, 2659.62, FALSE, 'Security camera normal sales variation. Growing category with healthy outlook. No intervention needed.', NULL, 'monitoring'),
      (16, 18, CURRENT_DATE - INTERVAL '18 days', 65, 1949.35, 35.09, 1.65, 'moderate', 'low', 'monitor', 0.0, 1949.35, FALSE, 'Gaming mouse pad seasonal pattern. Esports events drive periodic spikes. Product performing within expectations.', NULL, 'monitoring'),
      (8, 52, CURRENT_DATE - INTERVAL '52 days', 175, 6123.25, 318.41, 0.58, 'slow', 'medium', 'bundle_promotion', 20.0, 4898.60, FALSE, 'Wireless charging pad commoditized market. Price pressure from alternatives. Bundle with phone cases or create multi-pack offerings.', NULL, 'identified'),
      (13, 12, CURRENT_DATE - INTERVAL '12 days', 22, 1099.78, 13.20, 2.15, 'fast', 'low', 'monitor', 0.0, 1099.78, FALSE, 'Smart LED bulbs healthy velocity. Recent pause likely temporary. Energy efficiency trends support continued demand. No action needed.', NULL, 'monitoring')
      ON CONFLICT DO NOTHING
    `);

    // 5. Seed Warehouse Zones (16 items)
    console.log('Seeding warehouse zones...');
    await pool.query(`
      INSERT INTO warehouse_zones (zone_name, zone_type, location_code, capacity_units, current_utilization, optimal_utilization, access_frequency, temperature_controlled, humidity_controlled, product_categories, suggested_products, efficiency_score, travel_distance_score, picking_efficiency, storage_cost_per_unit, ai_layout_suggestion, last_optimized, status) VALUES
      ('Zone A-01 Fast Pick', 'fast_pick', 'A-01', 500, 78.5, 85.0, 'very_high', FALSE, FALSE, ARRAY['Electronics', 'Accessories'], ARRAY['USB cables', 'Charging pads', 'Mouse pads'], 92.5, 95.0, 94.5, 0.15, 'High-velocity zone performing well. Consider expanding capacity by 15% to accommodate growing demand. Suggest relocating gaming keyboards here for improved pick efficiency.', CURRENT_DATE - INTERVAL '14 days', 'active'),
      ('Zone A-02 Standard', 'standard', 'A-02', 800, 65.0, 75.0, 'high', FALSE, FALSE, ARRAY['Accessories', 'Storage'], ARRAY['Laptop stands', 'USB hubs', 'SSD drives'], 88.0, 82.5, 86.5, 0.12, 'Underutilized zone with optimization opportunity. Current layout inefficient for larger items. Recommend shelf reconfiguration to improve vertical storage.', CURRENT_DATE - INTERVAL '21 days', 'active'),
      ('Zone A-03 Bulk Storage', 'bulk', 'A-03', 1200, 72.0, 80.0, 'medium', FALSE, FALSE, ARRAY['Accessories', 'Cables'], ARRAY['USB cables bulk', 'Charging cables', 'Adapters'], 85.5, 78.0, 82.0, 0.08, 'Bulk storage zone efficient for high-volume items. Consider pallet optimization for cable products. Forklift access pattern could be improved.', CURRENT_DATE - INTERVAL '28 days', 'active'),
      ('Zone B-01 Electronics', 'specialized', 'B-01', 400, 82.5, 85.0, 'high', TRUE, FALSE, ARRAY['Electronics'], ARRAY['Keyboards', 'Mice', 'Webcams'], 90.0, 88.5, 89.5, 0.22, 'Temperature-controlled electronics zone near optimal utilization. Current product mix appropriate. Consider adding humidity control for premium audio products.', CURRENT_DATE - INTERVAL '7 days', 'active'),
      ('Zone B-02 Premium', 'premium', 'B-02', 300, 68.0, 75.0, 'medium', TRUE, TRUE, ARRAY['Electronics', 'Audio'], ARRAY['Headphones', 'Earbuds', 'Monitors'], 86.5, 84.0, 85.5, 0.35, 'Premium storage underutilized. High-value items benefit from climate control. Suggest moving all audio products here for quality preservation.', CURRENT_DATE - INTERVAL '14 days', 'active'),
      ('Zone B-03 Standard', 'standard', 'B-03', 600, 55.0, 70.0, 'medium', FALSE, FALSE, ARRAY['Storage', 'Accessories'], ARRAY['SSD bulk', 'Docking stations'], 78.5, 72.0, 75.5, 0.10, 'Significantly underutilized zone. Layout review recommended. Consider consolidating with Zone B-04 or repurposing for smart home expansion.', CURRENT_DATE - INTERVAL '35 days', 'active'),
      ('Zone B-04 Overflow', 'overflow', 'B-04', 400, 25.0, 50.0, 'low', FALSE, FALSE, ARRAY['Mixed'], ARRAY['Seasonal items', 'Promotional stock'], 65.0, 60.0, 62.5, 0.08, 'Overflow zone currently underutilized. Seasonal stock cleared. Recommend temporary use for smart home inventory expansion or promotional stock staging.', CURRENT_DATE - INTERVAL '42 days', 'active'),
      ('Zone C-01 Smart Home', 'specialized', 'C-01', 450, 88.0, 85.0, 'high', FALSE, FALSE, ARRAY['Smart Home'], ARRAY['Smart hubs', 'Thermostats', 'Security cameras'], 94.5, 92.0, 93.5, 0.18, 'Smart home zone exceeding optimal utilization. Category growth requires immediate expansion. Recommend converting Zone B-04 overflow to smart home dedicated storage.', CURRENT_DATE - INTERVAL '5 days', 'active'),
      ('Zone C-02 High Value', 'secure', 'C-02', 250, 75.0, 80.0, 'medium', TRUE, TRUE, ARRAY['Electronics', 'Smart Home'], ARRAY['Monitors', 'Docking stations', 'Premium items'], 91.0, 89.5, 90.5, 0.45, 'Secure high-value zone operating efficiently. Access control working well. Current mix of monitors and docking stations appropriate. Premium audio candidates for inclusion.', CURRENT_DATE - INTERVAL '10 days', 'active'),
      ('Zone C-03 Returns', 'returns', 'C-03', 200, 42.0, 40.0, 'low', FALSE, FALSE, ARRAY['Returns', 'Refurbished'], ARRAY['Return processing', 'Quality check items'], 72.0, 68.0, 70.5, 0.25, 'Returns processing zone at expected capacity. Consider implementing faster processing workflow to reduce dwell time. Current 14-day average could be reduced to 10 days.', CURRENT_DATE - INTERVAL '21 days', 'active'),
      ('Zone C-04 Staging', 'staging', 'C-04', 350, 60.0, 65.0, 'very_high', FALSE, FALSE, ARRAY['Outbound'], ARRAY['Daily shipments', 'Priority orders'], 89.5, 94.5, 91.5, 0.20, 'Outbound staging zone performing well. Peak period capacity adequate. Consider adding second loading dock access to reduce congestion during high-volume periods.', CURRENT_DATE - INTERVAL '3 days', 'active'),
      ('Zone D-01 Reserve', 'reserve', 'D-01', 1000, 48.0, 60.0, 'low', FALSE, FALSE, ARRAY['Reserve Stock'], ARRAY['Safety stock', 'Bulk reserve'], 75.0, 70.0, 72.5, 0.06, 'Reserve stock zone underutilized. Good capacity for seasonal inventory build-up. Recommend using for Q4 holiday stock accumulation starting in October.', CURRENT_DATE - INTERVAL '30 days', 'active'),
      ('Zone D-02 Receiving', 'receiving', 'D-02', 400, 55.0, 60.0, 'high', FALSE, FALSE, ARRAY['Inbound'], ARRAY['New arrivals', 'Quality inspection'], 82.5, 85.0, 83.5, 0.15, 'Receiving zone operating efficiently. Quality inspection area adequate. Consider adding barcode scanning stations to accelerate check-in process.', CURRENT_DATE - INTERVAL '12 days', 'active'),
      ('Zone D-03 Hazmat', 'hazmat', 'D-03', 100, 35.0, 50.0, 'low', TRUE, FALSE, ARRAY['Batteries', 'Chemicals'], ARRAY['Battery packs', 'Cleaning supplies'], 88.0, 75.0, 82.0, 0.55, 'Hazmat storage compliant and secure. Current utilization appropriate for product mix. Battery storage for electronics accessories adequately handled.', CURRENT_DATE - INTERVAL '45 days', 'active'),
      ('Zone D-04 Cold Storage', 'cold', 'D-04', 150, 20.0, 40.0, 'low', TRUE, TRUE, ARRAY['Temperature Sensitive'], ARRAY['Specialty items'], 70.0, 65.0, 68.0, 0.75, 'Cold storage significantly underutilized. Current product mix does not require this capacity. Consider subleasing or repurposing 60% of space for general climate control.', CURRENT_DATE - INTERVAL '60 days', 'active'),
      ('Zone E-01 Cross Dock', 'cross_dock', 'E-01', 300, 72.0, 75.0, 'very_high', FALSE, FALSE, ARRAY['Transit'], ARRAY['Direct ship items', 'Drop ship'], 93.0, 96.0, 94.5, 0.12, 'Cross-dock operations highly efficient. Direct-to-customer shipments performing well. Consider expanding drop-ship program to reduce warehouse handling costs.', CURRENT_DATE - INTERVAL '2 days', 'active')
      ON CONFLICT DO NOTHING
    `);

    // ============================================
    // SEED DATA FOR 2 NEW AI FEATURES
    // ============================================

    // 6. Seed E-commerce Inventory Optimizations (16 items)
    console.log('Seeding e-commerce inventory optimizations...');
    await pool.query(`
      INSERT INTO ecommerce_inventory_optimizations (product_id, channel, current_stock, optimal_stock, sell_through_rate, days_of_supply, conversion_rate, cart_abandonment_rate, return_rate, profit_margin, price_elasticity, competitor_price, recommended_price, bundle_opportunities, cross_sell_products, seasonal_adjustment, marketing_impact, ai_recommendation, optimization_score, status) VALUES
      (1, 'Amazon', 245, 280, 0.0825, 18, 3.8, 68.5, 4.2, 42.5, -1.35, 142.99, 147.99, ARRAY['Headphones + Case Bundle', 'Audio Starter Pack'], ARRAY['Wireless Charging Pad', 'USB-C Cable'], 1.15, 1.22, 'Strong performer on Amazon. Increase stock by 15% for upcoming holiday season. Bundle opportunity with charging accessories could increase AOV by 25%. Consider sponsored ads investment.', 88.5, 'active'),
      (2, 'Shopify', 1250, 1400, 0.1245, 12, 4.2, 62.3, 2.8, 35.8, -0.85, 18.99, 19.99, ARRAY['Cable 3-Pack Bundle', 'Charging Essentials Kit'], ARRAY['Wireless Charger', 'USB Hub'], 1.08, 1.15, 'High velocity SKU with excellent conversion. Current pricing optimal. Recommend creating multi-pack bundles for B2B customers. Stock increase needed for promotional campaigns.', 92.0, 'active'),
      (3, 'Amazon', 180, 220, 0.0685, 22, 2.9, 72.1, 5.5, 45.2, -1.52, 84.99, 87.99, ARRAY['Gaming Keyboard + Mouse Bundle', 'Streamer Setup Kit'], ARRAY['Gaming Mouse', 'Mouse Pad XL'], 1.25, 1.35, 'Gaming category showing strong Q4 trends. Stock up for gaming season. Bundle with gaming mouse shows 40% attachment rate. Consider influencer marketing push.', 82.5, 'active'),
      (4, 'eBay', 320, 350, 0.0756, 20, 3.5, 65.8, 3.9, 38.5, -1.18, 47.99, 49.99, ARRAY['Ergonomic Office Bundle', 'WFH Essentials'], ARRAY['Laptop Stand', 'Webcam'], 1.02, 1.08, 'Stable demand in ergonomic category. eBay audience price-sensitive - maintain competitive pricing. Cross-sell with laptop stands showing good results.', 85.0, 'active'),
      (5, 'Direct Website', 85, 95, 0.0425, 28, 2.2, 78.5, 6.8, 48.5, -1.85, 389.99, 399.99, ARRAY['Monitor + Stand Bundle', 'Home Office Complete'], ARRAY['Docking Station', 'Webcam HD'], 1.12, 1.18, 'High-value item with longer consideration cycle. Website exclusive bundles driving conversions. Invest in retargeting campaigns to reduce cart abandonment.', 78.5, 'active'),
      (6, 'Amazon', 420, 450, 0.0895, 16, 4.5, 58.2, 2.5, 40.2, -0.95, 54.99, 59.99, ARRAY['Laptop Accessory Bundle', 'Desk Setup Essentials'], ARRAY['USB Hub', 'Wireless Mouse'], 1.05, 1.12, 'Excellent velocity and low return rate. Amazon Choice badge driving traffic. Maintain stock levels and consider A+ content refresh for Q4.', 90.5, 'active'),
      (7, 'Shopify', 195, 240, 0.0625, 24, 3.1, 70.5, 4.8, 42.8, -1.28, 74.99, 79.99, ARRAY['Video Call Pro Bundle', 'Streaming Starter Kit'], ARRAY['Ring Light', 'Microphone'], 1.18, 1.28, 'Webcam demand stable with hybrid work. Bundle with ring light showing strong attach rate. Recommend UGC campaign for social proof.', 80.0, 'active'),
      (8, 'Multi-Channel', 580, 650, 0.1125, 14, 4.8, 55.2, 2.2, 38.5, -0.78, 32.99, 34.99, ARRAY['Charging Station Bundle', 'Power Trio Pack'], ARRAY['USB-C Cable', 'Phone Stand'], 1.25, 1.32, 'High-velocity accessory performing well across all channels. Price elasticity low - potential for modest increase. Multi-pack bundles driving wholesale orders.', 94.5, 'active'),
      (9, 'Amazon', 150, 185, 0.0545, 26, 2.6, 74.8, 5.2, 45.8, -1.45, 124.99, 129.99, ARRAY['Smart Home Starter Bundle', 'Voice Control Pack'], ARRAY['Smart Bulbs', 'Smart Thermostat'], 1.35, 1.42, 'Smart home category growing rapidly. Competition increasing - focus on ecosystem bundles. Prime Day preparation should start now.', 76.5, 'active'),
      (10, 'Direct Website', 210, 250, 0.0685, 22, 3.2, 68.5, 3.5, 44.2, -1.25, 114.99, 119.99, ARRAY['Storage Upgrade Bundle', 'Creator Storage Pack'], ARRAY['USB Hub', 'Cable Kit'], 1.10, 1.18, 'Content creator audience growing. Website SEO driving organic traffic. Recommend affiliate program expansion for tech reviewers.', 84.0, 'active'),
      (11, 'Amazon', 175, 200, 0.0585, 25, 2.8, 72.5, 5.8, 48.2, -1.55, 189.99, 199.99, ARRAY['Premium Audio Bundle', 'Travel Audio Kit'], ARRAY['Carrying Case', 'Extra Ear Tips'], 1.22, 1.28, 'Premium pricing segment. Amazon reviews critical - maintain 4.5+ rating. Bundle with travel case showing good conversion. Consider Subscribe & Save for ear tips.', 79.5, 'active'),
      (12, 'eBay', 390, 420, 0.0865, 17, 3.8, 64.2, 3.2, 36.5, -0.92, 42.99, 44.99, ARRAY['USB Expansion Bundle', 'Desk Connectivity Kit'], ARRAY['USB-C Adapter', 'Cable Organizer'], 1.00, 1.05, 'Commodity product with stable demand. Price competition high on eBay - focus on bundle value. Bulk listings for office buyers recommended.', 86.0, 'active'),
      (13, 'Shopify', 280, 320, 0.0945, 15, 4.2, 60.5, 2.8, 42.5, -1.12, 46.99, 49.99, ARRAY['Smart Lighting Starter', 'Room Ambiance Pack'], ARRAY['Smart Hub', 'Motion Sensor'], 1.42, 1.52, 'Smart lighting fastest growing category. Shopify store conversion excellent. Recommend expanding color options and creating room-specific bundles.', 91.0, 'active'),
      (14, 'Direct Website', 145, 160, 0.0385, 32, 2.1, 75.8, 4.5, 35.2, -1.08, 37.99, 39.99, ARRAY['Finance Professional Bundle', 'Accounting Setup Kit'], ARRAY['Calculator', 'Document Scanner'], 1.00, 1.02, 'Niche product for specific audience. Low volume but loyal customers. B2B marketing through LinkedIn recommended. Consider accounting software partnerships.', 72.5, 'active'),
      (15, 'Amazon', 225, 265, 0.0785, 19, 3.5, 66.8, 4.2, 45.5, -1.38, 64.99, 69.99, ARRAY['Home Security Starter', 'Complete Surveillance Kit'], ARRAY['Motion Sensor', 'Door Sensor'], 1.48, 1.55, 'Security category trending upward. Amazon affiliate traffic strong. Stock increase needed for security awareness campaigns in Q4.', 87.5, 'active'),
      (16, 'Multi-Channel', 450, 500, 0.1085, 13, 4.5, 58.5, 2.5, 32.8, -0.72, 27.99, 29.99, ARRAY['Gaming Desk Bundle', 'Esports Setup Pack'], ARRAY['Gaming Keyboard', 'Gaming Mouse'], 1.15, 1.25, 'Gaming accessories performing well across channels. Low return rate indicates quality satisfaction. Esports sponsorship opportunities to explore.', 93.0, 'active')
      ON CONFLICT DO NOTHING
    `);

    // 7. Seed Shipment Tracking (16 items)
    console.log('Seeding shipment tracking...');
    await pool.query(`
      INSERT INTO shipment_tracking (shipment_number, order_id, supplier_id, origin_location, destination_location, carrier, tracking_number, shipment_type, weight_kg, volume_cbm, estimated_departure, actual_departure, estimated_arrival, actual_arrival, current_location, current_status, delay_days, delay_reason, temperature_sensitive, temperature_min, temperature_max, current_temperature, handling_instructions, customs_status, customs_documents, cost_estimate, actual_cost, insurance_value, priority_level, ai_eta_prediction, ai_risk_assessment, ai_route_optimization, status) VALUES
      ('SHP-2024-001', 1, 1, 'San Jose, CA, USA', 'Chicago Distribution Center', 'FedEx Freight', 'FX789456123', 'ground', 450.5, 2.8, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, 'Denver, CO - In Transit', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'Standard handling. Stack max 3 high.', 'domestic', ARRAY['BOL-001', 'Invoice-001'], 1250.00, NULL, 15000.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Low risk. Route clear with no weather delays expected. Carrier performance excellent on this lane.', 'Optimal route via I-80. Current ETA accurate. No diversions recommended.', 'in_transit'),
      ('SHP-2024-002', 2, 2, 'Austin, TX, USA', 'New York Warehouse', 'UPS Freight', 'UP456789012', 'ground', 280.0, 1.5, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '2 days', NULL, 'Memphis, TN - Hub Processing', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'Fragile electronics. Handle with care.', 'domestic', ARRAY['BOL-002', 'Invoice-002'], 980.00, NULL, 8500.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '2 days', 'Low risk. Shipment proceeding on schedule. Weather favorable along route.', 'Standard southern route optimal. UPS Memphis hub efficient for this volume.', 'in_transit'),
      ('SHP-2024-003', 3, 3, 'Seattle, WA, USA', 'Phoenix Distribution', 'Yellow Freight', 'YF123456789', 'ground', 520.0, 3.2, CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP, NULL, 'Las Vegas, NV - Delayed', 'delayed', 1, 'Traffic congestion in Las Vegas area', FALSE, NULL, NULL, NULL, 'Standard palletized freight.', 'domestic', ARRAY['BOL-003', 'Invoice-003'], 1450.00, NULL, 12000.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Moderate risk due to delay. Carrier rerouting through alternate facility. Expect 1 day delay.', 'Recommend I-15 bypass route to avoid continued Las Vegas congestion. Night delivery slot available.', 'delayed'),
      ('SHP-2024-004', 4, 4, 'Denver, CO, USA', 'Los Angeles DC', 'XPO Logistics', 'XP987654321', 'expedited', 180.0, 1.0, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP, NULL, 'Los Angeles, CA - Out for Delivery', 'out_for_delivery', 0, NULL, FALSE, NULL, NULL, NULL, 'Priority handling. Direct dock delivery.', 'domestic', ARRAY['BOL-004', 'Invoice-004'], 850.00, NULL, 22000.00, 'high', CURRENT_TIMESTAMP, 'Low risk. Final mile delivery in progress. Expect delivery within 4 hours.', 'Direct route completed efficiently. Expedited service met SLA requirements.', 'out_for_delivery'),
      ('SHP-2024-005', 5, 5, 'Miami, FL, USA', 'Atlanta Hub', 'Estes Express', 'ES567890123', 'ground', 320.0, 1.8, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Atlanta, GA - Delivered', 'delivered', 0, NULL, FALSE, NULL, NULL, NULL, 'Standard LTL freight.', 'domestic', ARRAY['BOL-005', 'Invoice-005', 'POD-005'], 620.00, 595.00, 6000.00, 'normal', NULL, 'Delivery completed successfully. No issues reported. Carrier performance: Excellent.', 'I-75 route performed as expected. 2-day transit optimal for this lane.', 'delivered'),
      ('SHP-2024-006', 6, 6, 'Shenzhen, China', 'Los Angeles Port', 'Maersk Line', 'MAEU789012345', 'ocean', 2500.0, 15.0, CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_TIMESTAMP + INTERVAL '5 days', NULL, 'Pacific Ocean - En Route', 'in_transit', 1, 'Port congestion at origin', FALSE, NULL, NULL, NULL, 'Container secured. Standard ocean freight.', 'in_customs_clearance', ARRAY['BL-006', 'Commercial-Invoice-006', 'Packing-List-006', 'Origin-Cert-006'], 4500.00, NULL, 95000.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '6 days', 'Moderate risk. Port congestion may affect unloading. Customs pre-clearance recommended.', 'Trans-Pacific route on schedule. LA port slot confirmed. Recommend drayage booking now.', 'in_transit'),
      ('SHP-2024-007', 7, 7, 'Boston, MA, USA', 'Dallas Warehouse', 'Old Dominion', 'OD234567890', 'ground', 410.0, 2.4, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, 'Nashville, TN - In Transit', 'in_transit', 0, NULL, TRUE, 15.0, 25.0, 19.5, 'Temperature controlled. Monitor continuously.', 'domestic', ARRAY['BOL-007', 'Invoice-007', 'Temp-Log-007'], 1650.00, NULL, 13500.00, 'high', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Low risk. Temperature maintained within range. Carrier temperature monitoring active.', 'Southern route avoiding mountain passes. Temperature-controlled trailer performing optimally.', 'in_transit'),
      ('SHP-2024-008', 8, 8, 'New York, NY, USA', 'Chicago Distribution', 'ABF Freight', 'AB345678901', 'ground', 290.0, 1.6, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, 'Cleveland, OH - In Transit', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'Fragile items. No stacking.', 'domestic', ARRAY['BOL-008', 'Invoice-008'], 780.00, NULL, 4200.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Low risk. Standard transit progressing normally. Weather clear along I-90 corridor.', 'I-90 direct route optimal. Carrier maintaining schedule. No delays expected.', 'in_transit'),
      ('SHP-2024-009', 1, 9, 'Portland, OR, USA', 'Minneapolis DC', 'Saia LTL', 'SA456789012', 'ground', 380.0, 2.2, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP, NULL, 'Billings, MT - Weather Delay', 'delayed', 2, 'Winter storm causing road closures', FALSE, NULL, NULL, NULL, 'Standard freight. Weather protection required.', 'domestic', ARRAY['BOL-009', 'Invoice-009'], 1120.00, NULL, 7500.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '2 days', 'High risk due to weather. Montana roads experiencing closures. 2-day delay expected minimum.', 'I-90 closed through Montana. Recommend southern reroute via I-80 when roads clear. Customer notified.', 'delayed'),
      ('SHP-2024-010', 10, 10, 'Salt Lake City, UT, USA', 'Phoenix Distribution', 'Werner Enterprises', 'WE567890123', 'ground', 550.0, 3.5, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Phoenix, AZ - Delivered', 'delivered', 0, NULL, FALSE, NULL, NULL, NULL, 'Bulk shipment. Forklift required.', 'domestic', ARRAY['BOL-010', 'Invoice-010', 'POD-010'], 890.00, 875.00, 5400.00, 'normal', NULL, 'Delivery completed on time. Carrier performance: Good. No damage reported.', 'I-15 south route efficient. 2-day transit achieved as planned.', 'delivered'),
      ('SHP-2024-011', 11, 11, 'San Diego, CA, USA', 'Houston Warehouse', 'Schneider National', 'SN678901234', 'expedited', 420.0, 2.6, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, 'El Paso, TX - In Transit', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'High-value electronics. Signature required.', 'domestic', ARRAY['BOL-011', 'Invoice-011'], 1350.00, NULL, 26000.00, 'high', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Low risk. Expedited shipment on track. Border crossing efficient at this lane.', 'I-10 east corridor clear. Expedited service meeting timeline. Driver hours compliant.', 'in_transit'),
      ('SHP-2024-012', 12, 12, 'Minneapolis, MN, USA', 'Atlanta Hub', 'JB Hunt', 'JB789012345', 'ground', 340.0, 2.0, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP, NULL, 'Louisville, KY - In Transit', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'Standard palletized goods.', 'domestic', ARRAY['BOL-012', 'Invoice-012'], 920.00, NULL, 11000.00, 'normal', CURRENT_TIMESTAMP, 'Low risk. Final leg of journey. Expect delivery today by 6 PM.', 'I-65 south route on schedule. Louisville hub processed efficiently. Final delivery imminent.', 'in_transit'),
      ('SHP-2024-013', 13, 13, 'Atlanta, GA, USA', 'Dallas DC', 'Averitt Express', 'AV890123456', 'ground', 260.0, 1.4, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP, 'Dallas, TX - Delivered', 'delivered', 1, 'Receiver not available - redelivery scheduled', FALSE, NULL, NULL, NULL, 'Office equipment. Inside delivery.', 'domestic', ARRAY['BOL-013', 'Invoice-013', 'POD-013'], 750.00, 780.00, 11250.00, 'normal', NULL, 'Delivered with 1 day delay due to receiver availability. Appointment scheduling recommended for future.', 'I-20 west route efficient. Consider requiring delivery appointments for this receiver.', 'delivered'),
      ('SHP-2024-014', 14, 2, 'Taipei, Taiwan', 'Seattle Port', 'Yang Ming Marine', 'YMLU456789012', 'ocean', 3200.0, 18.0, CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '17 days', CURRENT_TIMESTAMP + INTERVAL '3 days', NULL, 'Pacific Ocean - Approaching US Waters', 'in_transit', 1, 'Vessel speed reduction due to weather', FALSE, NULL, NULL, NULL, 'FCL container. Standard handling.', 'pending_customs', ARRAY['BL-014', 'Commercial-Invoice-014', 'Packing-List-014'], 5200.00, NULL, 120000.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '4 days', 'Moderate risk. Vessel encountering weather. Customs docs submitted for pre-clearance.', 'Trans-Pacific northern route. Weather delay minor. Seattle port capacity available.', 'in_transit'),
      ('SHP-2024-015', 15, 4, 'Denver, CO, USA', 'Miami Distribution', 'Heartland Express', 'HE901234567', 'ground', 480.0, 2.8, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '3 days', NULL, 'Oklahoma City, OK - In Transit', 'in_transit', 0, NULL, FALSE, NULL, NULL, NULL, 'Mixed freight. Secure load.', 'domestic', ARRAY['BOL-015', 'Invoice-015'], 1080.00, NULL, 7800.00, 'normal', CURRENT_TIMESTAMP + INTERVAL '3 days', 'Low risk. Long-haul shipment proceeding on schedule. Driver rest stops planned per ELD.', 'I-40 east to I-20 south route optimal. 4-day transit standard for this lane.', 'in_transit'),
      ('SHP-2024-016', 16, 5, 'Miami, FL, USA', 'New York DC', 'Southeastern Freight', 'SF012345678', 'expedited', 220.0, 1.2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, 'Jacksonville, FL - In Transit', 'in_transit', 0, NULL, TRUE, 18.0, 22.0, 20.5, 'Climate controlled. Urgent medical supplies.', 'domestic', ARRAY['BOL-016', 'Invoice-016', 'Temp-Log-016'], 1850.00, NULL, 45000.00, 'critical', CURRENT_TIMESTAMP + INTERVAL '1 day', 'Critical priority shipment. Temperature stable. Expedited handling at all checkpoints.', 'I-95 north express route. Dedicated driver team for continuous movement. ETA on track.', 'in_transit')
      ON CONFLICT (shipment_number) DO NOTHING
    `);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed();
