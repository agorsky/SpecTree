#!/bin/bash

# =============================================================================
# Database Seed Script
# Seeds the database with test users and sample data
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

print_info "Checking if database is running..."

# Check if Docker container is running
if ! docker ps | grep -q spectree-sql; then
    print_error "SQL Server container is not running!"
    print_info "Start it with: pnpm docker:up"
    exit 1
fi

print_info "Seeding database..."
pnpm --filter @spectree/api db:seed

print_success "Database seeded successfully!"
echo ""
echo "=========================================="
echo "  Login Credentials"
echo "=========================================="
echo ""
echo "  Email: admin@spectree.dev"
echo "  Password: Password123!"
echo ""
echo "  Email: aaron.gorsky@toro.com"
echo "  Password: SThp1994!"
echo "=========================================="
