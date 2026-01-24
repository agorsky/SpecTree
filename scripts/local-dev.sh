#!/bin/bash

# =============================================================================
# Local Development Helper Script
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

usage() {
    cat << EOF
Usage: $(basename "$0") <command>

Commands:
    start       Start local development environment (SQL Server)
    stop        Stop local development environment
    restart     Restart local development environment
    status      Show status of containers
    logs        Show logs from SQL Server
    connect     Connect to SQL Server using sqlcmd
    reset       Stop containers and remove volumes (fresh start)

EOF
}

case "${1:-}" in
    start)
        print_info "Starting local development environment..."
        docker-compose up -d
        print_success "Environment started!"
        print_info "SQL Server: localhost:1433"
        print_info "Database: spectree"
        print_info "Username: sa"
        print_info "Password: LocalDev@Password123"
        ;;
    stop)
        print_info "Stopping local development environment..."
        docker-compose down
        print_success "Environment stopped."
        ;;
    restart)
        print_info "Restarting local development environment..."
        docker-compose down
        docker-compose up -d
        print_success "Environment restarted."
        ;;
    status)
        docker-compose ps
        ;;
    logs)
        docker-compose logs -f sqlserver
        ;;
    connect)
        print_info "Connecting to SQL Server..."
        docker exec -it spectree-sql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "LocalDev@Password123" -C
        ;;
    reset)
        print_warning "This will delete all data. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            docker-compose down -v
            print_success "Environment reset complete."
        else
            print_info "Cancelled."
        fi
        ;;
    *)
        usage
        ;;
esac
