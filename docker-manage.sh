#!/bin/bash

# GenAI Presentation Agent - Docker Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
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

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    mkdir -p uploads audio slides data
    print_success "Directories created"
}

# Function to build and start services
start_services() {
    print_status "Building and starting GenAI Presentation Agent..."
    docker-compose up --build -d
    print_success "Services started successfully"
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if docker-compose ps | grep -q "unhealthy"; then
        print_warning "Some services are not healthy. Check logs with: docker-compose logs"
    else
        print_success "All services are healthy"
    fi
}

# Function to start development services
start_dev() {
    print_status "Starting development environment..."
    docker-compose --profile dev up --build -d
    print_success "Development services started"
    print_status "Backend with hot reload available at: http://localhost:8001"
    print_status "Frontend available at: http://localhost:80"
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    docker-compose down
    print_success "Services stopped"
}

# Function to view logs
view_logs() {
    if [ -z "$1" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs -f
    else
        print_status "Showing logs for $1..."
        docker-compose logs -f "$1"
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed"
}

# Function to show status
show_status() {
    print_status "Service Status:"
    docker-compose ps
    
    echo ""
    print_status "Access URLs:"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/docs"
}

# Function to restart services
restart_services() {
    print_status "Restarting services..."
    docker-compose restart
    print_success "Services restarted"
}

# Function to show help
show_help() {
    echo "GenAI Presentation Agent - Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start       Build and start all services"
    echo "  dev         Start development environment with hot reload"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs [service]  View logs (optionally for specific service)"
    echo "  status      Show service status and access URLs"
    echo "  cleanup     Stop services and clean up Docker resources"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start production environment"
    echo "  $0 dev                      # Start development environment"
    echo "  $0 logs backend             # View backend logs"
    echo "  $0 status                   # Check service status"
}

# Main script logic
case "${1:-help}" in
    start)
        check_docker
        create_directories
        start_services
        show_status
        ;;
    dev)
        check_docker
        create_directories
        start_dev
        show_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        view_logs "$2"
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
