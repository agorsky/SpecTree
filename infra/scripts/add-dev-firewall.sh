#!/bin/bash
# =============================================================================
# Azure SQL Firewall Rule Management for Local Development
# =============================================================================
# This script temporarily adds or removes your current IP address from the
# Azure SQL Server firewall rules for local development purposes.
#
# Usage:
#   ./add-dev-firewall.sh add     # Add current IP to firewall
#   ./add-dev-firewall.sh remove  # Remove current IP from firewall
#   ./add-dev-firewall.sh status  # Check current firewall rules
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Appropriate permissions on the SQL Server
#
# Environment variables (or set below):
#   RESOURCE_GROUP - Resource group name
#   SQL_SERVER_NAME - SQL Server name (without .database.windows.net)
# =============================================================================

set -e

# Configuration - override via environment variables
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-spectree-dev}"
SQL_SERVER_NAME="${SQL_SERVER_NAME:-sql-spectree-dev}"
RULE_NAME="dev-$(whoami)-$(hostname | cut -d. -f1)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current public IP
get_current_ip() {
    local ip
    ip=$(curl -s https://api.ipify.org 2>/dev/null || curl -s https://ifconfig.me 2>/dev/null || curl -s https://icanhazip.com 2>/dev/null)
    if [[ -z "$ip" ]]; then
        log_error "Failed to detect current IP address"
        exit 1
    fi
    echo "$ip"
}

# Check if Azure CLI is logged in
check_az_login() {
    if ! az account show &>/dev/null; then
        log_error "Not logged in to Azure CLI. Please run 'az login' first."
        exit 1
    fi
    log_info "Azure CLI authenticated as: $(az account show --query user.name -o tsv)"
}

# Add firewall rule
add_rule() {
    local ip
    ip=$(get_current_ip)
    
    log_info "Adding firewall rule for IP: $ip"
    log_info "Rule name: $RULE_NAME"
    
    az sql server firewall-rule create \
        --resource-group "$RESOURCE_GROUP" \
        --server "$SQL_SERVER_NAME" \
        --name "$RULE_NAME" \
        --start-ip-address "$ip" \
        --end-ip-address "$ip" \
        --output table
    
    log_info "Firewall rule added successfully!"
    log_warn "Remember to remove this rule when done: $0 remove"
    
    # Print connection info
    echo ""
    log_info "Connection information:"
    echo "  Server: ${SQL_SERVER_NAME}.database.windows.net"
    echo "  Port: 1433"
    echo "  Your IP: $ip"
}

# Remove firewall rule
remove_rule() {
    log_info "Removing firewall rule: $RULE_NAME"
    
    if az sql server firewall-rule show \
        --resource-group "$RESOURCE_GROUP" \
        --server "$SQL_SERVER_NAME" \
        --name "$RULE_NAME" &>/dev/null; then
        
        az sql server firewall-rule delete \
            --resource-group "$RESOURCE_GROUP" \
            --server "$SQL_SERVER_NAME" \
            --name "$RULE_NAME" \
            --yes
        
        log_info "Firewall rule removed successfully!"
    else
        log_warn "Firewall rule '$RULE_NAME' does not exist"
    fi
}

# Show current firewall rules
show_status() {
    log_info "Current firewall rules for $SQL_SERVER_NAME:"
    
    az sql server firewall-rule list \
        --resource-group "$RESOURCE_GROUP" \
        --server "$SQL_SERVER_NAME" \
        --output table
    
    echo ""
    log_info "Your current IP: $(get_current_ip)"
}

# Show usage
show_usage() {
    echo "Usage: $0 {add|remove|status}"
    echo ""
    echo "Commands:"
    echo "  add     - Add current IP to SQL Server firewall"
    echo "  remove  - Remove your dev firewall rule"
    echo "  status  - Show current firewall rules and your IP"
    echo ""
    echo "Environment variables:"
    echo "  RESOURCE_GROUP   - Azure resource group (default: rg-spectree-dev)"
    echo "  SQL_SERVER_NAME  - SQL Server name (default: sql-spectree-dev)"
}

# Main
main() {
    check_az_login
    
    case "${1:-}" in
        add)
            add_rule
            ;;
        remove)
            remove_rule
            ;;
        status)
            show_status
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
