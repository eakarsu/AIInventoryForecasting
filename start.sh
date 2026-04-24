#!/bin/bash

echo ""
echo "=============================================="
echo "  AI Inventory Forecasting Application"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Ports to use
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Cleaning port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Step 1: Clean up ports
echo -e "${CYAN}Step 1: Cleaning up ports...${NC}"
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
# Also clean common ports that might conflict
kill_port 5173
kill_port 3002
echo -e "${GREEN}Ports cleaned${NC}"

# Step 2: Check if PostgreSQL is running
echo -e "${CYAN}Step 2: Checking PostgreSQL...${NC}"
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    # Try different methods to start PostgreSQL
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql 2>/dev/null || true
    elif command -v pg_ctl &> /dev/null; then
        pg_ctl -D /usr/local/var/postgres start 2>/dev/null || true
    fi
    sleep 3
fi

if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}PostgreSQL is running${NC}"
else
    echo -e "${RED}PostgreSQL is not running. Please start it manually.${NC}"
    exit 1
fi

# Step 3: Load environment variables
echo -e "${CYAN}Step 3: Loading environment...${NC}"
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}Environment loaded from .env${NC}"
else
    echo -e "${RED}.env file not found${NC}"
    exit 1
fi

# Set default values if not in .env
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_DB=${POSTGRES_DB:-inventory_ai}
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
export BACKEND_PORT=$BACKEND_PORT
export FRONTEND_PORT=$FRONTEND_PORT

export PGPASSWORD="$POSTGRES_PASSWORD"

# Step 4: Create database if not exists
echo -e "${CYAN}Step 4: Setting up database...${NC}"
if psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" | grep -q 1; then
    echo -e "${GREEN}Database '$POSTGRES_DB' exists${NC}"
else
    echo -e "${YELLOW}Creating database '$POSTGRES_DB'...${NC}"
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -c "CREATE DATABASE $POSTGRES_DB"
    echo -e "${GREEN}Database created${NC}"
fi

# Step 5: Run schema.sql
echo -e "${CYAN}Step 5: Running database schema...${NC}"
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f backend/src/db/schema.sql > /dev/null 2>&1
echo -e "${GREEN}Schema applied${NC}"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 6: Install dependencies
echo -e "${CYAN}Step 6: Installing dependencies...${NC}"
(cd "$SCRIPT_DIR/backend" && npm install --silent) &
(cd "$SCRIPT_DIR/frontend" && npm install --silent) &
wait
echo -e "${GREEN}Dependencies installed${NC}"

# Step 7: Run seed.js
echo -e "${CYAN}Step 7: Seeding database with sample data...${NC}"
(cd "$SCRIPT_DIR/backend" && node src/db/seed.js)
echo -e "${GREEN}Database seeded (15+ items per feature)${NC}"

# Step 8: Start backend with auto-reload
echo -e "${CYAN}Step 8: Starting backend server with hot-reload...${NC}"
(cd "$SCRIPT_DIR/backend" && BACKEND_PORT=$BACKEND_PORT npm run dev 2>&1 | sed 's/^/[Backend] /') &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}Backend is ready${NC}"
else
    echo -e "${RED}Backend failed to start${NC}"
fi

# Step 9: Start frontend with hot-reload
echo -e "${CYAN}Step 9: Starting frontend server with hot-reload...${NC}"
(cd "$SCRIPT_DIR/frontend" && VITE_PORT=$FRONTEND_PORT npm run dev 2>&1 | sed 's/^/[Frontend] /') &
FRONTEND_PID=$!

# Wait for frontend to be ready
sleep 3

echo ""
echo -e "${GREEN}=============================================="
echo -e "  Application Started Successfully!"
echo -e "==============================================${NC}"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo ""
echo -e "${BLUE}Demo Login Credentials:${NC}"
echo -e "  Email:    ${CYAN}demo@inventory.ai${NC}"
echo -e "  Password: ${CYAN}demo123${NC}"
echo ""
echo -e "${BLUE}AI Features Available:${NC}"
echo -e "  - AI Demand Predictor (Seasonal/trend forecasting)"
echo -e "  - AI Supplier Risk Analyzer (Supply chain vulnerability)"
echo -e "  - AI Reorder Optimizer (Just-in-time ordering)"
echo -e "  - AI Dead Stock Identifier (Slow-moving inventory)"
echo -e "  - AI Warehouse Layout Optimizer (Storage efficiency)"
echo ""
echo -e "${YELLOW}Both servers auto-reload on code changes.${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Handle shutdown
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    # Clean up any remaining processes on the ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    echo -e "${GREEN}Servers stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
