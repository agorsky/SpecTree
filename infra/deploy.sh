#!/bin/bash

# =============================================================================
# Azure Infrastructure Deployment Script
# Deploys SpecTree infrastructure using Bicep templates
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# Functions
# =============================================================================

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Deploy Azure infrastructure for SpecTree application.

OPTIONS:
    -e, --environment       Environment to deploy (dev|staging|prod). Required.
    -l, --location          Azure region (default: eastus)
    -n, --name              Base name for resources (default: spectree)
    -s, --subscription      Azure subscription ID
    --sql-admin-login       SQL Server admin login (will prompt if not provided)
    --sql-admin-password    SQL Server admin password (will prompt if not provided)
    --container-image       Container image to deploy
    --what-if               Run what-if deployment (preview changes)
    --validate              Validate templates only
    -h, --help              Show this help message

EXAMPLES:
    # Deploy to dev environment
    $(basename "$0") -e dev

    # Deploy to prod with specific subscription
    $(basename "$0") -e prod -s 12345678-1234-1234-1234-123456789012

    # Preview changes before deploying
    $(basename "$0") -e dev --what-if

    # Validate templates without deploying
    $(basename "$0") -e dev --validate

EOF
}

check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        print_info "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi

    # Check if logged in
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi

    # Check Bicep CLI
    if ! az bicep version &> /dev/null; then
        print_warning "Bicep CLI not found. Installing..."
        az bicep install
    fi

    print_success "Prerequisites check passed"
}

validate_environment() {
    local env=$1
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        print_error "Invalid environment: $env. Must be one of: dev, staging, prod"
        exit 1
    fi
}

prompt_credentials() {
    if [ -z "$SQL_ADMIN_LOGIN" ]; then
        read -p "Enter SQL Admin Login: " SQL_ADMIN_LOGIN
    fi

    if [ -z "$SQL_ADMIN_PASSWORD" ]; then
        read -s -p "Enter SQL Admin Password: " SQL_ADMIN_PASSWORD
        echo
    fi

    # Validate password complexity
    if [[ ${#SQL_ADMIN_PASSWORD} -lt 8 ]]; then
        print_error "SQL password must be at least 8 characters long"
        exit 1
    fi
}

# =============================================================================
# Main Script
# =============================================================================

# Default values
ENVIRONMENT=""
LOCATION="eastus"
BASE_NAME="spectree"
SUBSCRIPTION=""
SQL_ADMIN_LOGIN=""
SQL_ADMIN_PASSWORD=""
CONTAINER_IMAGE=""
WHAT_IF=false
VALIDATE_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -n|--name)
            BASE_NAME="$2"
            shift 2
            ;;
        -s|--subscription)
            SUBSCRIPTION="$2"
            shift 2
            ;;
        --sql-admin-login)
            SQL_ADMIN_LOGIN="$2"
            shift 2
            ;;
        --sql-admin-password)
            SQL_ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --container-image)
            CONTAINER_IMAGE="$2"
            shift 2
            ;;
        --what-if)
            WHAT_IF=true
            shift
            ;;
        --validate)
            VALIDATE_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$ENVIRONMENT" ]; then
    print_error "Environment is required. Use -e or --environment."
    usage
    exit 1
fi

validate_environment "$ENVIRONMENT"
check_prerequisites

# Set subscription if provided
if [ -n "$SUBSCRIPTION" ]; then
    print_info "Setting subscription to $SUBSCRIPTION"
    az account set --subscription "$SUBSCRIPTION"
fi

# Get current subscription info
CURRENT_SUB=$(az account show --query '[name, id]' -o tsv)
print_info "Using subscription: $CURRENT_SUB"

# Prompt for credentials if not provided
prompt_credentials

# Build deployment parameters
DEPLOYMENT_NAME="spectree-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"
TEMPLATE_FILE="${SCRIPT_DIR}/main.bicep"
PARAMETERS_FILE="${SCRIPT_DIR}/parameters/${ENVIRONMENT}.bicepparam"

# Build additional parameters
ADDITIONAL_PARAMS="sqlAdminLogin=${SQL_ADMIN_LOGIN} sqlAdminPassword=${SQL_ADMIN_PASSWORD}"
if [ -n "$CONTAINER_IMAGE" ]; then
    ADDITIONAL_PARAMS="${ADDITIONAL_PARAMS} containerImage=${CONTAINER_IMAGE}"
fi

print_info "Deployment configuration:"
print_info "  Environment: $ENVIRONMENT"
print_info "  Location: $LOCATION"
print_info "  Base Name: $BASE_NAME"
print_info "  Deployment Name: $DEPLOYMENT_NAME"
print_info "  Template: $TEMPLATE_FILE"
print_info "  Parameters: $PARAMETERS_FILE"

# Validate template
if [ "$VALIDATE_ONLY" = true ]; then
    print_info "Validating Bicep templates..."
    az deployment sub validate \
        --name "$DEPLOYMENT_NAME" \
        --location "$LOCATION" \
        --template-file "$TEMPLATE_FILE" \
        --parameters "$PARAMETERS_FILE" \
        --parameters $ADDITIONAL_PARAMS \
        --output table

    print_success "Template validation passed!"
    exit 0
fi

# What-if deployment
if [ "$WHAT_IF" = true ]; then
    print_info "Running what-if deployment..."
    az deployment sub what-if \
        --name "$DEPLOYMENT_NAME" \
        --location "$LOCATION" \
        --template-file "$TEMPLATE_FILE" \
        --parameters "$PARAMETERS_FILE" \
        --parameters $ADDITIONAL_PARAMS \
        --result-format FullResourcePayloads

    print_info "What-if completed. Review the changes above."
    read -p "Do you want to proceed with the actual deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled."
        exit 0
    fi
fi

# Run deployment
print_info "Starting deployment..."
DEPLOYMENT_OUTPUT=$(az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAMETERS_FILE" \
    --parameters $ADDITIONAL_PARAMS \
    --output json)

# Check deployment status
PROVISIONING_STATE=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.provisioningState')

if [ "$PROVISIONING_STATE" = "Succeeded" ]; then
    print_success "Deployment completed successfully!"
    echo
    print_info "Deployment outputs:"
    echo "$DEPLOYMENT_OUTPUT" | jq '.properties.outputs'
    
    # Extract key outputs
    RESOURCE_GROUP=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.resourceGroupName.value')
    CONTAINER_APP_FQDN=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppFqdn.value')
    
    echo
    print_success "======================================"
    print_success "Deployment Summary"
    print_success "======================================"
    print_info "Resource Group: $RESOURCE_GROUP"
    print_info "Container App URL: https://$CONTAINER_APP_FQDN"
    print_success "======================================"
else
    print_error "Deployment failed with state: $PROVISIONING_STATE"
    echo "$DEPLOYMENT_OUTPUT" | jq '.properties.error'
    exit 1
fi
