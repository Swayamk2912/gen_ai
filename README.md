# GenAI Presentation Agent

An intelligent presentation assistant that transforms PowerPoint presentations into interactive, narrated experiences with multi-language support, AI-powered Q&A, and comprehensive analytics.

## 🚀 Quick Start

### Option 1: Docker (Recommended)

#### Prerequisites
- Docker and Docker Compose installed
- Git (to clone the repository)

#### Quick Start with Docker
```bash
# Clone the repository
git clone <repository-url>
cd gen_ai

# Start the application
./docker-manage.sh start

# Or manually with docker-compose
docker-compose up --build -d
```

#### Access the Application
- **Web Interface**: Open `http://localhost` in your browser
- **Backend API**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs`

#### Development Mode
```bash
# Start with hot reload for development
./docker-manage.sh dev

# Or manually
docker-compose --profile dev up --build -d
```

### Option 2: Local Development

#### 1. Create Virtual Environment (Optional)
```bash
python -m venv myenv
myenv\Scripts\activate  # Windows
# or
source myenv/bin/activate  # Linux/Mac
```

#### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Run Backend Server
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

#### 4. Access the Application
- **Web Interface**: Open `http://127.0.0.1:8000/app` in your browser
- **Direct Frontend**: Open `frontend/index.html` in a browser (set `window.BACKEND_BASE` if needed)

## ✨ Features

### 🎯 Core Capabilities
- **PowerPoint Upload & Parsing**: Upload `.pptx` files and extract slide content with enhanced image generation
- **AI-Powered Narration**: Generate contextual slide narrations with multiple tones and languages
- **Text-to-Speech**: Convert narrations to audio using Google Text-to-Speech (gTTS)
- **Interactive Q&A**: Ask questions about slides with AI-powered responses and memory logging
- **Multi-Language Support**: Full support for 20+ languages including Hindi, Spanish, French, German, etc.

### 🌍 Multi-Language Features
- **Supported Languages**: English, Hindi, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Turkish, Thai, Vietnamese
- **Language Detection**: Automatic detection of input text language
- **Real-time Translation**: Translate content and responses between languages
- **Localized Narration**: Generate narrations in target language with appropriate cultural context

### 🎨 User Interface
- **Dual Display Mode**: View original PowerPoint slides alongside AI-generated content
- **Enhanced Slide Visualization**: High-quality slide image generation with multiple fallback methods
- **Real-time Highlighting**: Synchronized text highlighting during audio playback
- **Interactive Controls**: Play, pause, repeat, and navigation controls
- **Responsive Design**: Modern, mobile-friendly interface

### 🧠 AI & Analytics
- **RAG-Powered Q&A**: Retrieval-Augmented Generation for contextual question answering
- **Comprehensive Analytics**: AI-generated summary reports with insights and recommendations
- **Engagement Tracking**: Monitor audience interaction and question patterns
- **Content Analysis**: Extract key topics, themes, and content density metrics

### 📊 Advanced Features
- **Slide Regeneration**: Enhance slide quality and regenerate slide images
- **PDF Export**: Generate PDF reports using ReportLab
- **Database Persistence**: SQLite database for storing presentations, slides, and Q&A logs
- **Audio Management**: Efficient audio file generation and caching
- **Debug Tools**: Built-in debugging endpoints for troubleshooting

## 🔧 API Endpoints

### Core Endpoints
- `POST /upload` - Upload PowerPoint presentation
- `GET /presentation/{id}` - Get presentation metadata and slides
- `POST /narrate` - Generate slide narration and audio
- `POST /qa` - Ask questions about slides
- `GET /summary/{id}` - Get basic presentation summary
- `GET /ai-summary/{id}` - Get comprehensive AI-generated summary report

### Translation & Language
- `GET /languages` - Get supported languages list
- `POST /detect-language` - Detect text language
- `POST /translate` - Translate text between languages

### Media & Files
- `GET /audio/{filename}` - Serve generated audio files
- `GET /slides/{filename}` - Serve slide images and HTML files
- `GET /sample-pdf` - Generate sample PDF report

### Utility
- `POST /regenerate-slides/{id}` - Regenerate slide images
- `POST /regenerate-slides-enhanced/{id}` - Enhanced slide regeneration
- `GET /debug/slides/{id}` - Debug slide data and files

## 🛠️ Technical Architecture

### Backend (FastAPI)
- **Framework**: FastAPI with async support
- **Database**: SQLite with SQLAlchemy
- **AI Services**: Custom AI service with RAG implementation
- **TTS**: Google Text-to-Speech (gTTS) with multi-language support
- **Translation**: Multi-provider translation service (LibreTranslate, Google Translate, MyMemory)
- **Image Processing**: PIL/Pillow for slide image generation
- **PDF Generation**: ReportLab for report creation

### Frontend (Vanilla JavaScript)
- **Framework**: Pure HTML/CSS/JavaScript
- **UI Components**: Modern, responsive design with CSS Grid/Flexbox
- **Audio Controls**: Custom audio player with waveform visualization
- **Real-time Updates**: Dynamic content loading and synchronization
- **Keyboard Shortcuts**: Arrow keys for navigation, Space for play/pause

### Data Storage
- **Presentations**: Metadata and file references
- **Slides**: Content, images, and audio paths
- **Q&A Logs**: Questions, answers, and timestamps
- **Audio Files**: Generated TTS audio with caching
- **Slide Images**: Generated slide representations

## 📋 Requirements

### Python Dependencies
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-multipart==0.0.9
python-pptx==0.6.23
gTTS==2.5.4
jinja2==3.1.4
numpy==1.26.4
scikit-learn==1.4.2
aiofiles==23.2.1
requests==2.32.3
reportlab==4.2.2
```

### Optional Dependencies
- **PIL/Pillow**: For enhanced slide image generation
- **matplotlib**: For alternative slide visualization methods

## 🐳 Docker Configuration

### Docker Services
- **Backend**: FastAPI application running on port 8000
- **Frontend**: Nginx serving static files on port 80
- **Development**: Hot-reload backend on port 8001

### Docker Management Script
The project includes a convenient management script (`docker-manage.sh`) with the following commands:

```bash
./docker-manage.sh start      # Start production environment
./docker-manage.sh dev        # Start development environment
./docker-manage.sh stop       # Stop all services
./docker-manage.sh restart    # Restart services
./docker-manage.sh logs       # View logs
./docker-manage.sh status     # Check service status
./docker-manage.sh cleanup    # Clean up Docker resources
```

### Docker Compose Services
```yaml
services:
  backend:     # FastAPI backend service
  frontend:    # Nginx frontend service
  backend-dev: # Development backend with hot reload
```

### Environment Configuration
Copy `env.example` to `.env` and modify as needed:
```bash
cp env.example .env
```

### Volume Mounts
- `./uploads:/app/uploads` - PowerPoint files
- `./audio:/app/audio` - Generated audio files
- `./slides:/app/slides` - Generated slide images
- `./data:/app/data` - SQLite database

## 🔧 Configuration

### Environment Variables
- `BACKEND_BASE`: Frontend backend URL (default: `http://127.0.0.1:8000`)
- `PYTHONPATH`: Python path for imports
- `DATABASE_URL`: Database connection string
- `MAX_FILE_SIZE`: Maximum upload file size
- `CORS_ORIGINS`: CORS allowed origins

### Directory Structure
```
gen_ai/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── Dockerfile           # Backend Docker configuration
│   ├── services/
│   │   ├── ai.py            # AI and narration services
│   │   ├── ppt_parser.py    # PowerPoint parsing and image generation
│   │   ├── tts.py           # Text-to-speech service
│   │   └── translation.py   # Multi-language translation
│   ├── db.py                # Database models and operations
│   └── rag.py               # RAG implementation
├── frontend/
│   ├── index.html           # Main web interface
│   ├── app.js               # Frontend JavaScript
│   ├── styles.css           # Styling
│   └── Dockerfile           # Frontend Docker configuration
├── uploads/                 # Uploaded PowerPoint files
├── audio/                   # Generated audio files
├── slides/                  # Generated slide images
├── data/                    # SQLite database
├── docker-compose.yml       # Docker Compose configuration
├── nginx.conf               # Nginx configuration
├── docker-manage.sh         # Docker management script
└── env.example              # Environment variables template
```

## 🚨 Troubleshooting

### Docker Issues

**Services Not Starting**
```bash
# Check service status
./docker-manage.sh status

# View logs
./docker-manage.sh logs backend
./docker-manage.sh logs frontend

# Restart services
./docker-manage.sh restart
```

**Port Conflicts**
- Ensure ports 80 and 8000 are available
- Modify ports in `docker-compose.yml` if needed
- Check for other services using the same ports

**Volume Mount Issues**
- Ensure directories exist: `mkdir -p uploads audio slides data`
- Check file permissions on host system
- Verify Docker has access to mounted directories

**Build Failures**
```bash
# Clean up and rebuild
./docker-manage.sh cleanup
docker-compose up --build --force-recreate
```

### Application Issues

**Audio Not Playing**
- Check if gTTS is working: `pip install gtts`
- Verify internet connection (gTTS requires internet)
- Check browser audio permissions
- In Docker: Check if audio files are being generated in `/app/audio`

**Slide Images Not Loading**
- Ensure PIL/Pillow is installed: `pip install Pillow`
- Check slides directory permissions
- Try regenerating slides using the "Enhance Quality" button
- In Docker: Check `/app/slides` directory

**Translation Not Working**
- Verify internet connection
- Check if translation services are accessible
- Try different language combinations
- Check Docker logs for translation service errors

**Database Issues**
- Delete `data/app.db` to reset database
- Check file permissions in data directory
- In Docker: Ensure `/app/data` is properly mounted

### Performance Optimization
- **Large Presentations**: Consider splitting into smaller presentations
- **Audio Caching**: Generated audio files are cached for reuse
- **Image Optimization**: Slide images are optimized for web delivery
- **Docker Resources**: Increase Docker memory allocation for large presentations
- **Volume Performance**: Use named volumes for better performance in production

## 🔮 Future Enhancements

- **Offline TTS**: Integration with `pyttsx3` for offline speech synthesis
- **AI Model Integration**: Support for OpenAI GPT, Ollama, or other LLMs
- **Advanced Analytics**: More detailed presentation analytics and insights
- **Export Options**: Additional export formats (PowerPoint, video)
- **Collaboration**: Multi-user support and sharing features
- **Voice Recognition**: Speech-to-text for interactive presentations

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

**Note**: This application requires an internet connection for TTS and translation services. For offline usage, consider implementing local TTS solutions like `pyttsx3`.


