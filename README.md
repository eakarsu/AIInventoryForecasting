# AI Inventory Forecasting Application

A full-stack inventory forecasting application with PostgreSQL, React, and Node.js. The governed workflow is deterministic and planner-controlled; model-provider output is explanatory only and cannot approve or create orders. See `docs/OPERATIONS.md` for the non-destructive lifecycle and outstanding release gates.

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **AI**: OpenRouter API
- **Authentication**: JWT-based login

## Features

1. **Product Inventory Management** - Track stock levels with AI restock recommendations
2. **Demand Forecasting** - AI-powered demand predictions with trend analysis
3. **Supplier Management** - Supplier directory with ratings and lead time tracking
4. **Purchase Orders** - Order tracking with automated reorder suggestions
5. **Stock Analytics** - Real-time insights and turnover analysis
6. **AI Recommendations** - Intelligent restocking, price optimization, and anomaly detection

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key (optional, for AI features)

### Configuration

1. Copy and configure the environment file:
```bash
cp .env.example .env
# Edit .env with your settings
```

2. Set your OpenRouter API key in `.env`:
```
OPENROUTER_API_KEY=your-openrouter-key
```

### Running the Application

```bash
# Make start script executable
chmod +x start.sh

# Run the application
./start.sh
```

This will:
- Clean up any processes on ports 3000 and 5173
- Start PostgreSQL if not running
- Create the database and run migrations
- Seed the database with sample data
- Start the backend server on port 3000
- Start the frontend server on port 5173

### Manual Setup

If you prefer to run components separately:

```bash
# Backend
cd backend
npm install
npm start

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Demo Login

Use the "Demo Login" button on the login page or enter:
- **Email**: demo@inventory.ai
- **Password**: demo123

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Forecasts
- `GET /api/forecasts` - List all forecasts
- `GET /api/forecasts/:id` - Get forecast details
- `POST /api/forecasts` - Create forecast
- `POST /api/forecasts/generate` - Generate AI forecast

### Suppliers
- `GET /api/suppliers` - List all suppliers
- `GET /api/suppliers/:id` - Get supplier details
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

### Orders
- `GET /api/orders` - List all orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order

### Analytics
- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/summary` - Get summary statistics

### AI
- `POST /api/ai/forecast` - Generate demand forecast
- `POST /api/ai/restock` - Get restock recommendations
- `POST /api/ai/price-optimization` - Get price suggestions
- `POST /api/ai/anomaly-detection` - Detect anomalies
- `POST /api/ai/supplier-scoring` - Score suppliers
- `POST /api/ai/trend-analysis` - Analyze trends

## Project Structure

```
/
├── .env                          # Environment variables
├── start.sh                      # Startup script
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js              # Express server
│       ├── db/
│       │   ├── connection.js     # PostgreSQL connection
│       │   ├── schema.sql        # Database schema
│       │   └── seed.js           # Seed data
│       ├── routes/               # API routes
│       ├── middleware/           # Auth middleware
│       └── services/             # AI services
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx               # Main app
        ├── components/           # Reusable components
        └── pages/                # Page components
```

## License

MIT
