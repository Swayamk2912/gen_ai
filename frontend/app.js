let presId = null;
let slides = [];
let current = 0;
let canAdvance = true;
let isPlaying = false;
let isPaused = false;
let narrationSegments = [];
let syncInterval = null;
let currentSegment = 0;
let supportedLanguages = {};
let summaryReport = null;
let displayMode = 'content'; // 'content' or 'image'
let audioContext = null;
let audioAnalyser = null;
let audioSource = null;

async function upload() {
  const fileInput = document.getElementById('pptFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const progressEl = document.getElementById('progress');
  const file = fileInput.files[0];
  if (!file) {
    alert('Choose a .ppt or .pptx file first');
    return;
  }

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';
    progressEl.textContent = 'Uploading presentation…';

    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${window.BACKEND_BASE}/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const maybeText = await res.text().catch(() => '');
      throw new Error(`Upload failed (${res.status}). ${maybeText}`);
    }
    const data = await res.json();
    if (!data || !data.presentation_id) {
      throw new Error('Invalid response from server');
    }
    presId = data.presentation_id;
    await loadPresentation();
    current = 0;
    render();
    progressEl.textContent = `Slide ${current + 1} of ${slides.length}`;
  } catch (err) {
    console.error('Upload error:', err);
    alert(`Upload error: ${err.message || err}`);
    progressEl.textContent = 'Upload failed. Check server and BACKEND_BASE.';
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
}

async function loadPresentation() {
  const res = await fetch(`${window.BACKEND_BASE}/presentation/${presId}`);
  const data = await res.json();
  slides = data.slides || [];
  document.getElementById('progress').textContent = `Slide ${current + 1} of ${slides.length}`;
}

function render() {
  if (!slides.length) return;
  const s = slides[current];
  document.getElementById('slideTitle').textContent = s.title || `Slide ${current + 1}`;
  
  // Reset audio state when changing slides
  isPlaying = false;
  isPaused = false;
  narrationSegments = [];
  currentSegment = 0;
  clearSyncInterval();
  updateButtonStates();
  
  // Display slide image as primary content (actual PowerPoint slide)
  displaySlideImage(s);
  document.getElementById('progress').textContent = `Slide ${current + 1} of ${slides.length}`;
  
  // Only render text content if no slide image is available
  if (!s.image_path) {
    renderSlideContent(s.content || '');
  }
  
  // Show presenter mode indicator
  showPresenterMode();
  
  // Initialize presenter mode
  initializePresenterMode();
  
  // Initialize regenerate slides button
  initializeRegenerateButton();
  
  if (s.audio_path) {
    const file = s.audio_path.split('/').pop();
    const audio = document.getElementById('audio');
    if (audio) {
      audio.src = `${window.BACKEND_BASE}/audio/${file}`;
      audio.currentTime = 0; // Reset audio to beginning
      console.log('Set existing audio source to:', audio.src);
      
      // Auto-start narration for seamless presentation flow
      setTimeout(() => {
        if (!isPlaying && !isPaused) {
          startPresentationMode();
        }
      }, 500);
    } else {
      console.error('Audio element not found in render function');
    }
  } else {
    // Auto-generate narration for slides without audio for seamless presentation flow
    console.log('No existing audio found, auto-generating narration for slide:', current);
    
    // Update status to show auto-generation
    const statusIndicator = document.getElementById('statusIndicator');
    const presenterStatus = document.getElementById('presenterStatus');
    
    if (statusIndicator) {
      statusIndicator.textContent = 'Generating narration...';
      statusIndicator.className = 'status-indicator generating';
    }
    
    if (presenterStatus) {
      presenterStatus.textContent = 'Preparing AI narration...';
    }
    
    setTimeout(() => {
      if (!isPlaying && !isPaused) {
        narrate();
      }
    }, 500);
  }
}

function renderSlideContent(content) {
  const contentElement = document.getElementById('slideContent');
  
  if (!content) {
    contentElement.innerHTML = '';
    return;
  }
  
  // Enhanced slide content rendering for presenter mode
  const lines = content.split('\n');
  const htmlLines = lines.map((line, index) => {
    if (line.trim()) {
      // Detect bullet points and format them properly
      if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*')) {
        const bulletContent = line.trim().substring(1).trim();
        return `<div class="content-line bullet-point" data-line="${index}">
          <span class="bullet">•</span>
          <span class="bullet-text">${bulletContent}</span>
        </div>`;
      }
      // Detect numbered lists
      else if (/^\d+\./.test(line.trim())) {
        const number = line.trim().match(/^\d+/)[0];
        const text = line.trim().substring(number.length + 1).trim();
        return `<div class="content-line numbered-point" data-line="${index}">
          <span class="number">${number}.</span>
          <span class="numbered-text">${text}</span>
        </div>`;
      }
      // Regular content lines
      else {
        return `<div class="content-line regular-content" data-line="${index}">${line}</div>`;
      }
    } else {
      return '<div class="content-line empty"></div>';
    }
  });
  
  contentElement.innerHTML = htmlLines.join('');
  
  // Add presenter-style animations
  animateSlideContent();
}

function clearSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  // Also cleanup audio visualization when clearing sync
  cleanupAudioVisualization();
}

function startSyncWithAudio(segments) {
  narrationSegments = segments;
  currentSegment = 0;
  
  // Clear any existing highlighting
  document.querySelectorAll('.content-line').forEach(line => {
    line.classList.remove('highlighted', 'current-highlight');
  });
  
  // Start synchronization
  syncInterval = setInterval(updateSync, 100); // Update every 100ms
}

function updateSync() {
  const audio = document.getElementById('audio');
  if (!audio || audio.paused || !narrationSegments.length) {
    return;
  }
  
  // Use enhanced synchronization
  enhanceAudioSynchronization();
}

function highlightMatchingContent(highlightText, segmentType = null) {
  // Clear previous highlights
  document.querySelectorAll('.content-line, .slide-title, .bullet-point, .list-item, .paragraph').forEach(line => {
    line.classList.remove('current-highlight');
  });
  
  // Try different selectors based on segment type
  let selectors = ['.content-line'];
  
  if (segmentType === 'title') {
    selectors = ['.slide-title', '.content-line:first-child'];
  } else if (segmentType === 'bullet') {
    selectors = ['.bullet-point', '.content-line.bullet-point'];
  } else if (segmentType === 'list') {
    selectors = ['.list-item', '.content-line.numbered-point'];
  } else if (segmentType === 'paragraph') {
    selectors = ['.paragraph', '.content-line.regular-content'];
  }
  
  // Search through all relevant elements
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(element => {
      const elementText = element.textContent.toLowerCase().trim();
      const highlightLower = highlightText.toLowerCase().trim();
      
      // More flexible matching for better synchronization
      const words = highlightLower.split(/\s+/);
      const elementWords = elementText.split(/\s+/);
      
      // Check for exact match or significant word overlap
      if (elementText.includes(highlightLower) || 
          highlightLower.includes(elementText) ||
          words.some(word => word.length > 3 && elementWords.some(ew => ew.includes(word)))) {
        element.classList.add('current-highlight');
      }
    });
  });
  
  // Fallback: if no specific matches found, try general content lines
  if (!document.querySelector('.current-highlight')) {
    const lines = document.querySelectorAll('.content-line');
    
    lines.forEach(line => {
      const lineText = line.textContent.toLowerCase();
      const highlightLower = highlightText.toLowerCase();
      
      if (lineText.includes(highlightLower) || highlightLower.includes(lineText.trim())) {
        line.classList.add('current-highlight');
      }
    });
  }
}

function showPresenterMode() {
  const statusIndicator = document.getElementById('statusIndicator');
  const presenterStatus = document.getElementById('presenterStatus');
  const speakingIndicator = document.getElementById('speakingIndicator');
  
  if (statusIndicator) {
    statusIndicator.textContent = 'AI Presenter Ready';
    statusIndicator.className = 'status-indicator presenter-ready';
  }
  
  if (presenterStatus) {
    presenterStatus.textContent = 'Ready to present';
  }
  
  if (speakingIndicator) {
    speakingIndicator.style.display = 'none';
  }
}

function startPresentationMode() {
  const audio = document.getElementById('audio');
  const presenterStatus = document.getElementById('presenterStatus');
  const speakingIndicator = document.getElementById('speakingIndicator');
  
  if (audio && audio.src) {
    audio.play().then(() => {
      isPlaying = true;
      isPaused = false;
      updateButtonStates();
      
      // Update status to show AI is presenting
      const statusIndicator = document.getElementById('statusIndicator');
      if (statusIndicator) {
        statusIndicator.textContent = 'AI Presenting';
        statusIndicator.className = 'status-indicator presenting';
      }
      
      if (presenterStatus) {
        presenterStatus.textContent = 'AI is speaking...';
      }
      
      if (speakingIndicator) {
        speakingIndicator.style.display = 'flex';
      }
      
        // Start audio visualization (temporarily disabled to test audio)
        // startAudioVisualization();
    }).catch(error => {
      console.error('Auto-play failed:', error);
    });
  }
}

function startAudioVisualization() {
  const audio = document.getElementById('audio');
  const waveform = document.getElementById('audioWaveform');
  
  if (!audio || !waveform) return;
  
  // Clean up existing audio context if it exists
  cleanupAudioVisualization();
  
  // Create audio context for visualization
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioAnalyser = audioContext.createAnalyser();
    audioSource = audioContext.createMediaElementSource(audio);
    
    audioSource.connect(audioAnalyser);
    audioAnalyser.connect(audioContext.destination);
    
    audioAnalyser.fftSize = 256;
    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function visualize() {
      if (!isPlaying || !audioAnalyser) return;
      
      audioAnalyser.getByteFrequencyData(dataArray);
      
      // Create simple waveform visualization
      const bars = Math.min(20, bufferLength);
      const barWidth = 100 / bars;
      let waveformHTML = '';
      
      for (let i = 0; i < bars; i++) {
        const value = dataArray[Math.floor(i * bufferLength / bars)];
        const height = (value / 255) * 100;
        waveformHTML += `<div style="width: ${barWidth}%; height: ${height}%; background: var(--primary); margin: 0 1px; border-radius: 2px;"></div>`;
      }
      
      waveform.innerHTML = waveformHTML;
      requestAnimationFrame(visualize);
    }
    
    visualize();
  } catch (error) {
    console.log('Audio visualization not available:', error);
    // Fallback to static visualization - but don't let this block audio playback
    waveform.innerHTML = '<div style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 50%, var(--success) 100%); border-radius: 10px; animation: waveform-pulse 2s infinite;"></div>';
  }
}

function cleanupAudioVisualization() {
  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {
      console.log('Error closing audio context:', e);
    }
    audioContext = null;
  }
  audioAnalyser = null;
  audioSource = null;
}

function animateSlideContent() {
  const lines = document.querySelectorAll('.content-line:not(.empty)');
  
  // Add entrance animation to each line
  lines.forEach((line, index) => {
    line.style.opacity = '0';
    line.style.transform = 'translateY(20px)';
    line.style.transition = 'all 0.5s ease';
    
    setTimeout(() => {
      line.style.opacity = '1';
      line.style.transform = 'translateY(0)';
    }, index * 100); // Staggered animation
  });
}

function enhanceAudioSynchronization() {
  const audio = document.getElementById('audio');
  if (!audio || !narrationSegments.length) return;
  
  // Enhanced synchronization with better visual feedback
  const currentTime = audio.currentTime;
  
  // Find current segment
  let activeSegment = -1;
  for (let i = 0; i < narrationSegments.length; i++) {
    const segment = narrationSegments[i];
    if (currentTime >= segment.start_time && currentTime < segment.end_time) {
      activeSegment = i;
      break;
    }
  }
  
  if (activeSegment !== currentSegment && activeSegment >= 0) {
    // Remove previous highlighting
    document.querySelectorAll('.content-line, .slide-title, .bullet-point, .list-item, .paragraph').forEach(line => {
      line.classList.remove('current-highlight', 'speaking', 'title-highlight', 'bullet-highlight', 'list-highlight', 'paragraph-highlight');
    });
    
    // Add current highlighting based on segment type
    const segment = narrationSegments[activeSegment];
    if (segment.highlight_text) {
      highlightMatchingContent(segment.highlight_text, segment.type);
      
      // Add type-specific speaking indicator
      const highlightedLines = document.querySelectorAll('.current-highlight');
      highlightedLines.forEach(line => {
        line.classList.add('speaking');
        
        // Add type-specific highlighting
        if (segment.type === 'title') {
          line.classList.add('title-highlight');
        } else if (segment.type === 'bullet') {
          line.classList.add('bullet-highlight');
        } else if (segment.type === 'list') {
          line.classList.add('list-highlight');
        } else if (segment.type === 'paragraph') {
          line.classList.add('paragraph-highlight');
        }
      });
    }
    
    // Update status indicator with current segment info
    updateStatusIndicator(segment);
    
    currentSegment = activeSegment;
  }
}

function updateStatusIndicator(segment) {
  const statusIndicator = document.getElementById('statusIndicator');
  if (statusIndicator && segment) {
    let statusText = 'AI Presenting';
    if (segment.type === 'title') {
      statusText = 'Introducing slide topic';
    } else if (segment.type === 'bullet') {
      statusText = `Explaining point ${segment.index || ''}`;
    } else if (segment.type === 'list') {
      statusText = `Covering step ${segment.index || ''}`;
    } else if (segment.type === 'heading') {
      statusText = 'Discussing section';
    } else if (segment.type === 'paragraph') {
      statusText = 'Explaining details';
    }
    
    statusIndicator.textContent = statusText;
  }
}

async function narrate() {
  if (presId == null) return;
  const tone = document.getElementById('tone').value;
  const language = document.getElementById('language').value;
  
  console.log('Starting narration for slide:', current, 'with tone:', tone, 'language:', language);
  
  try {
    const res = await fetch(`${window.BACKEND_BASE}/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation_id: presId, slide_index: current, tone, language })
    });
    
    console.log('Narration response status:', res.status);
    
    if (!res.ok) {
      throw new Error(`Narration failed with status ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Narration data received:', data);
    
    await loadPresentation();
    
    // Preserve display mode when re-rendering
    const currentDisplayMode = displayMode;
    render();
    displayMode = currentDisplayMode; // Restore display mode
    displaySlideImage(slides[current]); // Re-display slide image
    
    if (data.audio_url) {
      const audio = document.getElementById('audio');
      if (!audio) {
        console.error('Audio element not found!');
        alert('Audio element not found. Please check the HTML structure.');
        return;
      }
      
      const audioUrl = `${window.BACKEND_BASE}${data.audio_url}`;
      console.log('Setting audio source to:', audioUrl);
      
      audio.src = audioUrl;
      
      // Add error handling for audio loading
      audio.onerror = (e) => {
        console.error('Audio loading error:', e);
        console.error('Audio src:', audio.src);
        console.error('Audio networkState:', audio.networkState);
        console.error('Audio readyState:', audio.readyState);
      };
      
      audio.onloadstart = () => {
        console.log('Audio loading started');
        document.getElementById('audioStatus').textContent = 'Loading audio...';
      };
      
      audio.oncanplay = () => {
        console.log('Audio can play');
        document.getElementById('audioStatus').textContent = 'Audio ready';
      };
      
      audio.onloadeddata = () => {
        console.log('Audio data loaded');
        document.getElementById('audioStatus').textContent = 'Audio loaded';
      };
      
      audio.onloadedmetadata = () => {
        console.log('Audio metadata loaded');
        document.getElementById('audioStatus').textContent = 'Metadata loaded';
      };
      
      // Set up audio event listeners for presenter mode
      audio.onplay = () => {
        console.log('Audio started playing');
        isPlaying = true;
        isPaused = false;
        updateButtonStates();
        
        // Update status to show AI is presenting
        const statusIndicator = document.getElementById('statusIndicator');
        const presenterStatus = document.getElementById('presenterStatus');
        const speakingIndicator = document.getElementById('speakingIndicator');
        
        if (statusIndicator) {
          statusIndicator.textContent = 'AI Presenting';
          statusIndicator.className = 'status-indicator presenting';
        }
        
        if (presenterStatus) {
          presenterStatus.textContent = 'AI is speaking...';
        }
        
        if (speakingIndicator) {
          speakingIndicator.style.display = 'flex';
        }
        
        // Start audio visualization (temporarily disabled to test audio)
        // startAudioVisualization();
        
        // Start synchronization if segments are available
        if (data.segments && data.segments.length > 0) {
          startSyncWithAudio(data.segments);
        }
      };
      
      audio.onpause = () => {
        isPlaying = false;
        isPaused = true;
        clearSyncInterval();
        updateButtonStates();
        
        // Update presenter status
        const presenterStatus = document.getElementById('presenterStatus');
        const speakingIndicator = document.getElementById('speakingIndicator');
        
        if (presenterStatus) {
          presenterStatus.textContent = 'Paused';
        }
        
        if (speakingIndicator) {
          speakingIndicator.style.display = 'none';
        }
        
        // Cleanup audio visualization
        cleanupAudioVisualization();
      };
      
      audio.onended = () => {
        isPlaying = false;
        isPaused = false;
        clearSyncInterval();
        updateButtonStates();
        
        // Update presenter status
        const presenterStatus = document.getElementById('presenterStatus');
        const speakingIndicator = document.getElementById('speakingIndicator');
        
        if (presenterStatus) {
          presenterStatus.textContent = 'Presentation complete';
        }
        
        if (speakingIndicator) {
          speakingIndicator.style.display = 'none';
        }
        
        // Cleanup audio visualization
        cleanupAudioVisualization();
        
        showQAModal();
      };
      
      // Start playing
      console.log('Attempting to play audio...');
      console.log('Audio element before play:', {
        src: audio.src,
        readyState: audio.readyState,
        networkState: audio.networkState,
        paused: audio.paused,
        duration: audio.duration
      });
      
      // Add more detailed debugging
      audio.addEventListener('loadstart', () => console.log('Audio loadstart event'));
      audio.addEventListener('loadeddata', () => console.log('Audio loadeddata event'));
      audio.addEventListener('canplay', () => console.log('Audio canplay event'));
      audio.addEventListener('canplaythrough', () => console.log('Audio canplaythrough event'));
      audio.addEventListener('error', (e) => console.error('Audio error event:', e));
      
      try {
        await audio.play();
        console.log('Audio play successful');
      } catch (playError) {
        console.error('Audio play failed:', playError);
        console.error('Play error details:', {
          name: playError.name,
          message: playError.message,
          code: playError.code
        });
        
        // Try to handle autoplay restrictions
        if (playError.name === 'NotAllowedError') {
          console.log('Autoplay blocked, user interaction required');
          // Show manual play button
          document.getElementById('manualPlayBtn').style.display = 'inline-block';
          document.getElementById('audioStatus').textContent = 'Click play button to start';
        }
      }
      
      // Prevent advancing during narration
      canAdvance = false;
      updateButtonStates();
    }
  } catch (error) {
    console.error('Narration error:', error);
    alert('Failed to generate narration. Please try again.');
  }
}

function nextSlide() {
  if (!slides.length) return;
  if (!canAdvance) return;
  
  // Stop current audio if playing
  const audio = document.getElementById('audio');
  if (audio && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  
  // Clear synchronization and cleanup audio visualization
  clearSyncInterval();
  
  // Reset audio state
  isPlaying = false;
  isPaused = false;
  narrationSegments = [];
  currentSegment = 0;
  
  current = Math.min(current + 1, slides.length - 1);
  render();
}

function prevSlide() {
  if (!slides.length) return;
  
  // Stop current audio if playing
  const audio = document.getElementById('audio');
  if (audio && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  
  // Clear synchronization and cleanup audio visualization
  clearSyncInterval();
  
  // Reset audio state
  isPlaying = false;
  isPaused = false;
  narrationSegments = [];
  currentSegment = 0;
  
  current = Math.max(current - 1, 0);
  render();
}

function repeatSlide() {
  const audio = document.getElementById('audio');
  if (audio && audio.src) {
    audio.currentTime = 0;
    audio.play();
    
    // Restart synchronization if segments are available
    if (narrationSegments.length > 0) {
      startSyncWithAudio(narrationSegments);
    }
  } else {
    // If no audio exists, regenerate narration
    narrate();
  }
}

function pauseAudio() {
  const audio = document.getElementById('audio');
  if (audio && !audio.paused) {
    audio.pause();
  }
}

function resumeAudio() {
  const audio = document.getElementById('audio');
  if (audio && audio.src) {
    audio.play();
  }
}

function updateButtonStates() {
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const narrateBtn = document.getElementById('narrateBtn');
  const audio = document.getElementById('audio');
  const statusIndicator = document.getElementById('statusIndicator');
  
  // Navigation buttons
  nextBtn.disabled = !canAdvance || current >= slides.length - 1;
  prevBtn.disabled = current <= 0;
  
  // Audio control buttons
  pauseBtn.disabled = !isPlaying;
  resumeBtn.disabled = !isPaused && !audio.src;
  
  // Narrate button
  narrateBtn.disabled = isPlaying;
  
  // Update status indicator
  if (isPlaying) {
    statusIndicator.textContent = 'Playing';
    statusIndicator.className = 'status-indicator playing';
  } else if (isPaused) {
    statusIndicator.textContent = 'Paused';
    statusIndicator.className = 'status-indicator paused';
  } else {
    statusIndicator.textContent = 'Ready';
    statusIndicator.className = 'status-indicator';
  }
}

async function ask() {
  if (presId == null) return;
  const q = document.getElementById('question').value.trim();
  if (!q) return;
  
  // Auto-detect language if question is in different language
  const detectedLang = await detectQuestionLanguage(q);
  const selectedLang = document.getElementById('language').value;
  const tone = document.getElementById('tone').value;
  
  // Use detected language if different from selected, or selected if same
  const answerLang = detectedLang !== selectedLang ? selectedLang : detectedLang;
  
  const res = await fetch(`${window.BACKEND_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation_id: presId, slide_index: current, question: q, tone, language: answerLang })
  });
  const data = await res.json();
  document.getElementById('answer').textContent = data.answer || '';
}

async function detectQuestionLanguage(question) {
  try {
    const res = await fetch(`${window.BACKEND_BASE}/detect-language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: question })
    });
    const data = await res.json();
    return data.language;
  } catch (error) {
    console.error('Language detection failed:', error);
    return 'en'; // Default to English
  }
}

async function loadSupportedLanguages() {
  try {
    const res = await fetch(`${window.BACKEND_BASE}/languages`);
    const data = await res.json();
    supportedLanguages = data.languages;
    
    // Update language selector with detected languages
    updateLanguageSelector();
  } catch (error) {
    console.error('Failed to load supported languages:', error);
  }
}

function updateLanguageSelector() {
  const languageSelect = document.getElementById('language');
  const currentValue = languageSelect.value;
  
  // Clear existing options
  languageSelect.innerHTML = '';
  
  // Add options for supported languages
  Object.entries(supportedLanguages).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${getLanguageFlag(code)} ${name}`;
    languageSelect.appendChild(option);
  });
  
  // Restore selected value
  languageSelect.value = currentValue;
}

function getLanguageFlag(langCode) {
  const flags = {
    'en': '🇺🇸', 'hi': '🇮🇳', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪',
    'it': '🇮🇹', 'pt': '🇵🇹', 'ru': '🇷🇺', 'ja': '🇯🇵', 'ko': '🇰🇷',
    'zh': '🇨🇳', 'ar': '🇸🇦', 'nl': '🇳🇱', 'sv': '🇸🇪', 'no': '🇳🇴',
    'da': '🇩🇰', 'fi': '🇫🇮', 'pl': '🇵🇱', 'tr': '🇹🇷', 'th': '🇹🇭', 'vi': '🇻🇳'
  };
  return flags[langCode] || '🌐';
}

window.addEventListener('DOMContentLoaded', () => {
  // Debug: Check if audio element exists
  const audio = document.getElementById('audio');
  console.log('Audio element found:', !!audio);
  if (audio) {
    console.log('Audio element details:', {
      id: audio.id,
      controls: audio.controls,
      src: audio.src,
      readyState: audio.readyState
    });
  }
  
  document.getElementById('uploadBtn').addEventListener('click', upload);
  document.getElementById('narrateBtn').addEventListener('click', narrate);
  document.getElementById('nextBtn').addEventListener('click', nextSlide);
  document.getElementById('prevBtn').addEventListener('click', prevSlide);
  document.getElementById('repeatBtn').addEventListener('click', repeatSlide);
  document.getElementById('askBtn').addEventListener('click', ask);
  document.getElementById('pauseBtn').addEventListener('click', pauseAudio);
  document.getElementById('resumeBtn').addEventListener('click', resumeAudio);
  document.getElementById('generateSummaryBtn').addEventListener('click', generateSummary);
  document.getElementById('exportSummaryBtn').addEventListener('click', exportSummary);
  document.getElementById('toggleDisplayBtn').addEventListener('click', toggleDisplayMode);
  document.getElementById('toggleContentBtn').addEventListener('click', toggleContentMode);
  document.getElementById('regenerateSlidesBtn').addEventListener('click', regenerateSlides);
  
  // Presenter mode controls
  document.getElementById('toggleSlideView').addEventListener('click', toggleSlideView);
  document.getElementById('toggleSlideZoom').addEventListener('click', toggleSlideZoom);
  
  // Manual audio controls
  document.getElementById('manualPlayBtn').addEventListener('click', () => {
    const audio = document.getElementById('audio');
    if (audio && audio.src) {
      audio.play().then(() => {
        console.log('Manual play successful');
        document.getElementById('manualPlayBtn').style.display = 'none';
      }).catch(e => {
        console.error('Manual play failed:', e);
      });
    }
  });
  
  // Add debug function to test slide loading
  window.debugSlides = async function() {
    if (presId) {
      try {
        const res = await fetch(`${window.BACKEND_BASE}/debug/slides/${presId}`);
        const data = await res.json();
        console.log('Debug slides data:', data);
        return data;
      } catch (error) {
        console.error('Debug failed:', error);
        return null;
      }
    }
  };
  
  // Add debug function to test audio
  window.testAudio = function() {
    const audio = document.getElementById('audio');
    if (!audio) {
      console.error('Audio element not found');
      return;
    }
    
    console.log('Testing audio element...');
    console.log('Audio src:', audio.src);
    console.log('Audio readyState:', audio.readyState);
    console.log('Audio networkState:', audio.networkState);
    
    // Try to set a test audio source
    audio.src = `${window.BACKEND_BASE}/audio/tts_9753e21363344f34b199c0a61998c678.mp3`;
    audio.load();
    
    audio.onloadstart = () => console.log('Audio load started');
    audio.oncanplay = () => console.log('Audio can play');
    audio.onerror = (e) => console.error('Audio error:', e);
    
    // Try to play
    audio.play().then(() => {
      console.log('Audio play successful');
    }).catch(e => {
      console.error('Audio play failed:', e);
    });
  };
  
  // Add simple audio test function
  window.testSimpleAudio = function() {
    const audio = document.getElementById('audio');
    if (!audio) {
      console.error('Audio element not found');
      return;
    }
    
    console.log('Simple audio test - setting source and playing...');
    audio.src = `${window.BACKEND_BASE}/audio/tts_9753e21363344f34b199c0a61998c678.mp3`;
    
    audio.play().then(() => {
      console.log('✅ Simple audio test SUCCESSFUL - audio is playing!');
    }).catch(e => {
      console.error('❌ Simple audio test FAILED:', e);
    });
  };
  
  // Modal controls
  document.getElementById('skipBtn').addEventListener('click', () => {
    hideQAModal();
    canAdvance = true;
    updateButtonStates();
  });
  document.getElementById('modalAskBtn').addEventListener('click', askInModal);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        prevSlide();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextSlide();
        break;
      case ' ':
        e.preventDefault();
        if (isPlaying) {
          pauseAudio();
        } else if (isPaused) {
          resumeAudio();
        } else {
          narrate();
        }
        break;
      case 'r':
        e.preventDefault();
        repeatSlide();
        break;
    }
  });
  
  // Initialize button states
  updateButtonStates();
  
  // Load supported languages
  loadSupportedLanguages();
});

function showQAModal() {
  document.getElementById('qaModal').style.display = 'block';
  document.getElementById('modalQuestion').focus();
}

function hideQAModal() {
  document.getElementById('qaModal').style.display = 'none';
  document.getElementById('modalQuestion').value = '';
  document.getElementById('modalAnswer').textContent = '';
}

async function askInModal() {
  if (presId == null) return;
  const q = document.getElementById('modalQuestion').value.trim();
  if (!q) return;
  
  // Auto-detect language for modal questions too
  const detectedLang = await detectQuestionLanguage(q);
  const selectedLang = document.getElementById('language').value;
  const tone = document.getElementById('tone').value;
  
  // Use detected language if different from selected, or selected if same
  const answerLang = detectedLang !== selectedLang ? selectedLang : detectedLang;
  
  const res = await fetch(`${window.BACKEND_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation_id: presId, slide_index: current, question: q, tone, language: answerLang })
  });
  const data = await res.json();
  document.getElementById('modalAnswer').textContent = data.answer || '';
  // Allow advancing after at least one Q&A turn
  canAdvance = true;
  updateButtonStates();
}

async function generateSummary() {
  if (presId == null) {
    alert('Please upload a presentation first');
    return;
  }
  
  const language = document.getElementById('language').value;
  const generateBtn = document.getElementById('generateSummaryBtn');
  const summaryDiv = document.getElementById('summaryReport');
  const exportBtn = document.getElementById('exportSummaryBtn');
  
  try {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    const res = await fetch(`${window.BACKEND_BASE}/ai-summary/${presId}?language=${language}`);
    if (!res.ok) {
      throw new Error(`Failed to generate summary (${res.status})`);
    }
    
    summaryReport = await res.json();
    displaySummaryReport(summaryReport);
    
    summaryDiv.style.display = 'block';
    exportBtn.style.display = 'inline-block';
    
  } catch (error) {
    console.error('Summary generation error:', error);
    alert(`Failed to generate summary: ${error.message}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '📊 Generate AI Summary';
  }
}

function displaySummaryReport(report) {
  const summaryDiv = document.getElementById('summaryReport');
  
  const html = `
    <div class="summary-container">
      <div class="summary-section">
        <h4>📋 Executive Summary</h4>
        <div class="summary-content">
          <pre>${report.executive_summary}</pre>
        </div>
      </div>
      
      <div class="summary-section">
        <h4>🎯 Key Topics</h4>
        <div class="topics-grid">
          ${report.key_topics.map(topic => `
            <div class="topic-card">
              <h5>${topic.title}</h5>
              <p class="topic-preview">${topic.content_preview}</p>
              <div class="topic-keywords">
                ${topic.keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join('')}
              </div>
              <div class="topic-meta">
                <span class="slide-ref">Slide ${topic.slide_index + 1}</span>
                <span class="importance">Importance: ${topic.importance.toFixed(1)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="summary-section">
        <h4>❓ Q&A Analysis</h4>
        <div class="qa-analysis">
          <div class="qa-stats">
            <div class="stat-item">
              <span class="stat-label">Total Questions:</span>
              <span class="stat-value">${report.qa_analysis.total_questions}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Engagement Level:</span>
              <span class="stat-value">${report.qa_analysis.engagement_level}</span>
            </div>
          </div>
          
          <div class="question-types">
            <h5>Question Types:</h5>
            <div class="type-bars">
              ${Object.entries(report.qa_analysis.question_types).map(([type, count]) => `
                <div class="type-bar">
                  <span class="type-label">${type.charAt(0).toUpperCase() + type.slice(1)}:</span>
                  <div class="bar-container">
                    <div class="bar" style="width: ${(count / report.qa_analysis.total_questions) * 100}%"></div>
                    <span class="bar-value">${count}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          ${report.qa_analysis.common_themes.length > 0 ? `
            <div class="common-themes">
              <h5>Common Themes:</h5>
              <div class="themes-list">
                ${report.qa_analysis.common_themes.map(theme => `<span class="theme-tag">${theme}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          ${report.qa_analysis.insights.length > 0 ? `
            <div class="qa-insights">
              <h5>Q&A Insights:</h5>
              <ul>
                ${report.qa_analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="summary-section">
        <h4>💡 Overall Insights</h4>
        <div class="insights-grid">
          ${report.insights.map(insight => `
            <div class="insight-card ${insight.type}">
              <h5>${insight.title}</h5>
              <p>${insight.description}</p>
              <div class="recommendation">
                <strong>Recommendation:</strong> ${insight.recommendation}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="summary-section">
        <h4>📊 Presentation Metadata</h4>
        <div class="metadata">
          <div class="meta-item">
            <span class="meta-label">Title:</span>
            <span class="meta-value">${report.presentation_metadata.title}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Slides:</span>
            <span class="meta-value">${report.presentation_metadata.total_slides}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Questions:</span>
            <span class="meta-value">${report.presentation_metadata.total_questions}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Language:</span>
            <span class="meta-value">${report.presentation_metadata.language}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  summaryDiv.innerHTML = html;
}

function exportSummary() {
  if (!summaryReport) {
    alert('No summary report to export');
    return;
  }
  
  // Create a simple text export
  const exportText = `
AI SUMMARY REPORT
==================

${summaryReport.executive_summary}

KEY TOPICS:
${summaryReport.key_topics.map(topic => `- ${topic.title} (Slide ${topic.slide_index + 1})`).join('\n')}

Q&A ANALYSIS:
- Total Questions: ${summaryReport.qa_analysis.total_questions}
- Engagement Level: ${summaryReport.qa_analysis.engagement_level}
- Question Types: ${Object.entries(summaryReport.qa_analysis.question_types).map(([type, count]) => `${type}: ${count}`).join(', ')}

INSIGHTS:
${summaryReport.insights.map(insight => `- ${insight.title}: ${insight.description}\n  Recommendation: ${insight.recommendation}`).join('\n')}

PRESENTATION METADATA:
- Title: ${summaryReport.presentation_metadata.title}
- Total Slides: ${summaryReport.presentation_metadata.total_slides}
- Total Questions: ${summaryReport.presentation_metadata.total_questions}
- Language: ${summaryReport.presentation_metadata.language}
  `.trim();
  
  // Create and download file
  const blob = new Blob([exportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-report-${presId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function displaySlideImage(slide) {
  const imageContainer = document.getElementById('slideImageContainer');
  const slideImage = document.getElementById('slideImage');
  const slideLoading = document.getElementById('slideLoading');
  const presenterStatus = document.getElementById('presenterStatus');
  
  console.log('Displaying slide in presenter mode:', slide); // Debug log
  
  // Show loading indicator
  if (slideLoading) {
    slideLoading.style.display = 'block';
  }
  
  // Update presenter status
  if (presenterStatus) {
    presenterStatus.textContent = 'Loading original PowerPoint slide...';
  }
  
  if (slide.image_path) {
    const imageUrl = `${window.BACKEND_BASE}${slide.image_path}`;
    console.log('Image URL:', imageUrl); // Debug log
    
    // Always clear the container first
    imageContainer.innerHTML = '';
    
    // Check if it's an HTML file
    if (slide.image_path.endsWith('.html')) {
      // For HTML files, create an iframe with enhanced styling
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.background = 'white';
      iframe.src = imageUrl;
      iframe.onload = () => {
        console.log('HTML slide loaded successfully:', imageUrl);
        if (slideLoading) slideLoading.style.display = 'none';
        if (presenterStatus) presenterStatus.textContent = 'Original PowerPoint slide loaded';
        animateSlideEntry();
      };
      iframe.onerror = () => {
        console.error('Failed to load HTML slide:', imageUrl);
        showImageError(imageContainer, 'Failed to load original slide');
        if (slideLoading) slideLoading.style.display = 'none';
        if (presenterStatus) presenterStatus.textContent = 'Slide load failed';
      };
      imageContainer.appendChild(iframe);
      console.log('Created iframe for HTML slide'); // Debug log
    } else {
      // For image files, use img tag with enhanced error handling
      slideImage.onload = () => {
        console.log('Image loaded successfully:', imageUrl);
        if (slideLoading) slideLoading.style.display = 'none';
        if (presenterStatus) presenterStatus.textContent = 'Original PowerPoint slide loaded';
        animateSlideEntry();
      };
      slideImage.onerror = () => {
        console.error('Failed to load image:', imageUrl);
        showImageError(imageContainer, 'Failed to load original slide');
        if (slideLoading) slideLoading.style.display = 'none';
        if (presenterStatus) presenterStatus.textContent = 'Slide load failed';
      };
      slideImage.src = imageUrl;
      slideImage.alt = `Original PowerPoint Slide ${slide.slide_number || current + 1}`;
      slideImage.style.display = 'block';
      imageContainer.appendChild(slideImage);
      console.log('Set image src:', imageUrl); // Debug log
    }
  } else {
    // No image available, show placeholder
    if (slideLoading) slideLoading.style.display = 'none';
    showImageError(imageContainer, 'No original slide available');
    if (presenterStatus) presenterStatus.textContent = 'No slide available';
  }
  
  // Also display the slide in the main content area for better visibility
  displaySlideInMainContent(slide);
}

function displaySlideInMainContent(slide) {
  const contentContainer = document.getElementById('slideContentContainer');
  const slideContent = document.getElementById('slideContent');
  
  if (!contentContainer || !slideContent) {
    console.error('Content containers not found');
    return;
  }
  
  // Clear existing content
  slideContent.innerHTML = '';
  
  if (slide.image_path) {
    const imageUrl = `${window.BACKEND_BASE}${slide.image_path}`;
    console.log('Displaying slide in main content:', imageUrl);
    
    // Create a container for the slide display
    const slideDisplayContainer = document.createElement('div');
    slideDisplayContainer.className = 'main-slide-display';
    slideDisplayContainer.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
    `;
    
    if (slide.image_path.endsWith('.html')) {
      // For HTML files, create an iframe
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 8px;
        background: white;
      `;
      iframe.src = imageUrl;
      iframe.onload = () => {
        console.log('Main content HTML slide loaded successfully:', imageUrl);
      };
      iframe.onerror = () => {
        console.error('Failed to load main content HTML slide:', imageUrl);
        slideDisplayContainer.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Failed to load slide</div>';
      };
      slideDisplayContainer.appendChild(iframe);
    } else {
      // For image files, use img tag
      const img = document.createElement('img');
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      `;
      img.src = imageUrl;
      img.alt = `PowerPoint Slide ${slide.slide_number || current + 1}`;
      img.onload = () => {
        console.log('Main content image loaded successfully:', imageUrl);
      };
      img.onerror = () => {
        console.error('Failed to load main content image:', imageUrl);
        slideDisplayContainer.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Failed to load slide</div>';
      };
      slideDisplayContainer.appendChild(img);
    }
    
    slideContent.appendChild(slideDisplayContainer);
  } else {
    // No slide image available, show text content as fallback
    console.log('No slide image available, showing text content');
    renderSlideContent(slide.content || '');
  }
}

function initializeRegenerateButton() {
  const regenerateBtn = document.getElementById('regenerateSlides');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', async () => {
      if (!presentationId) {
        alert('No presentation loaded');
        return;
      }
      
      const confirmed = confirm('This will regenerate all slides with enhanced quality. Continue?');
      if (!confirmed) return;
      
      try {
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = '🔄 Enhancing...';
        
        const response = await fetch(`${window.BACKEND_BASE}/regenerate-slides-enhanced/${presentationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Slides regenerated:', result);
          
          // Reload the presentation to get updated slides
          await loadPresentation();
          
          alert('Slides have been enhanced with better quality!');
        } else {
          const error = await response.json();
          alert(`Failed to enhance slides: ${error.detail}`);
        }
      } catch (error) {
        console.error('Error regenerating slides:', error);
        alert('Failed to enhance slides. Please try again.');
      } finally {
        regenerateBtn.disabled = false;
        regenerateBtn.textContent = '🔄 Enhance Quality';
      }
    });
  }
}

function animateSlideEntry() {
  const slideImage = document.getElementById('slideImage');
  if (slideImage) {
    slideImage.style.opacity = '0';
    slideImage.style.transform = 'scale(0.9)';
    slideImage.style.transition = 'all 0.5s ease';
    
    setTimeout(() => {
      slideImage.style.opacity = '1';
      slideImage.style.transform = 'scale(1)';
    }, 100);
  }
}

function initializePresenterMode() {
  // Ensure presenter mode is visible
  const presenterMode = document.getElementById('presenterMode');
  if (presenterMode) {
    presenterMode.style.display = 'grid';
  }
  
  // Initialize slide controls
  const toggleSlideView = document.getElementById('toggleSlideView');
  const toggleSlideZoom = document.getElementById('toggleSlideZoom');
  
  if (toggleSlideView) {
    toggleSlideView.textContent = '🖼️ Full View';
  }
  
  if (toggleSlideZoom) {
    toggleSlideZoom.textContent = '🔍 Zoom';
  }
  
  // Reset any existing zoom/pan
  const slideImage = document.getElementById('slideImage');
  if (slideImage) {
    slideImage.style.transform = 'scale(1)';
    slideImage.style.cursor = 'default';
  }
  
  // Reset full view if active
  const slideDisplay = document.getElementById('originalSlideDisplay');
  if (slideDisplay && slideDisplay.style.position === 'fixed') {
    slideDisplay.style.position = 'relative';
    slideDisplay.style.top = 'auto';
    slideDisplay.style.left = 'auto';
    slideDisplay.style.width = '100%';
    slideDisplay.style.height = '400px';
    slideDisplay.style.zIndex = 'auto';
    slideDisplay.style.background = '#000';
  }
}

function showImageError(container, message) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: var(--muted);">
      <div style="font-size: 48px; margin-bottom: 16px;">🖼️</div>
      <div style="font-size: 18px; margin-bottom: 8px;">${message}</div>
      <div style="font-size: 14px;">Slide content is available in text mode</div>
    </div>
  `;
}

function toggleDisplayMode() {
  const imageContainer = document.getElementById('slideImageContainer');
  const contentContainer = document.getElementById('slideContentContainer');
  const toggleDisplayBtn = document.getElementById('toggleDisplayBtn');
  const toggleContentBtn = document.getElementById('toggleContentBtn');
  
  if (displayMode === 'content') {
    // Switch to image mode - show PowerPoint slide
    displayMode = 'image';
    imageContainer.style.display = 'block';
    contentContainer.style.display = 'none';
    toggleDisplayBtn.textContent = '🖼️ Hide PowerPoint Slide';
    toggleContentBtn.textContent = '📝 Show Text Content';
  } else {
    // Switch to content mode - show extracted text
    displayMode = 'content';
    imageContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    toggleDisplayBtn.textContent = '🖼️ Show PowerPoint Slide';
    toggleContentBtn.textContent = '📝 Hide Text Content';
  }
}

function toggleContentMode() {
  const imageContainer = document.getElementById('slideImageContainer');
  const contentContainer = document.getElementById('slideContentContainer');
  const toggleDisplayBtn = document.getElementById('toggleDisplayBtn');
  const toggleContentBtn = document.getElementById('toggleContentBtn');
  
  if (displayMode === 'image') {
    // Switch to content mode - show extracted text
    displayMode = 'content';
    imageContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    toggleDisplayBtn.textContent = '🖼️ Show PowerPoint Slide';
    toggleContentBtn.textContent = '📝 Hide Text Content';
  } else {
    // Switch to image mode - show PowerPoint slide
    displayMode = 'image';
    imageContainer.style.display = 'block';
    contentContainer.style.display = 'none';
    toggleDisplayBtn.textContent = '🖼️ Hide PowerPoint Slide';
    toggleContentBtn.textContent = '📝 Show Text Content';
  }
}

async function regenerateSlides() {
  if (presId == null) {
    alert('Please upload a presentation first');
    return;
  }
  
  const regenerateBtn = document.getElementById('regenerateSlidesBtn');
  const progressEl = document.getElementById('progress');
  
  try {
    regenerateBtn.disabled = true;
    regenerateBtn.textContent = 'Regenerating...';
    progressEl.textContent = 'Regenerating slide images...';
    
    const res = await fetch(`${window.BACKEND_BASE}/regenerate-slides/${presId}`, {
      method: 'POST'
    });
    
    if (!res.ok) {
      throw new Error(`Regeneration failed (${res.status})`);
    }
    
    const data = await res.json();
    console.log('Regeneration result:', data);
    
    // Reload presentation data
    await loadPresentation();
    render();
    
    progressEl.textContent = `Slide ${current + 1} of ${slides.length}`;
    alert(`Successfully regenerated ${data.slides_count} slides!`);
    
  } catch (error) {
    console.error('Regeneration error:', error);
    alert(`Failed to regenerate slides: ${error.message}`);
  } finally {
    regenerateBtn.disabled = false;
    regenerateBtn.textContent = '🔄 Regenerate Slides';
  }
}

// Presenter Mode Slide Controls
function toggleSlideView() {
  const slideDisplay = document.getElementById('originalSlideDisplay');
  const toggleBtn = document.getElementById('toggleSlideView');
  
  if (slideDisplay && toggleBtn) {
    if (slideDisplay.style.position === 'fixed') {
      // Return to normal view
      slideDisplay.style.position = 'relative';
      slideDisplay.style.top = 'auto';
      slideDisplay.style.left = 'auto';
      slideDisplay.style.width = '100%';
      slideDisplay.style.height = '400px';
      slideDisplay.style.zIndex = 'auto';
      slideDisplay.style.background = '#000';
      toggleBtn.textContent = '🖼️ Full View';
    } else {
      // Enter full view mode
      slideDisplay.style.position = 'fixed';
      slideDisplay.style.top = '0';
      slideDisplay.style.left = '0';
      slideDisplay.style.width = '100vw';
      slideDisplay.style.height = '100vh';
      slideDisplay.style.zIndex = '9999';
      slideDisplay.style.background = '#000';
      toggleBtn.textContent = '📱 Normal View';
    }
  }
}

function toggleSlideZoom() {
  const slideImage = document.getElementById('slideImage');
  const zoomBtn = document.getElementById('toggleSlideZoom');
  
  if (slideImage && zoomBtn) {
    if (slideImage.style.transform.includes('scale(1.5)')) {
      // Reset zoom
      slideImage.style.transform = 'scale(1)';
      slideImage.style.cursor = 'default';
      zoomBtn.textContent = '🔍 Zoom';
    } else {
      // Apply zoom
      slideImage.style.transform = 'scale(1.5)';
      slideImage.style.cursor = 'move';
      zoomBtn.textContent = '🔍 Reset';
      
      // Add pan functionality when zoomed
      let isPanning = false;
      let startX, startY, currentX = 0, currentY = 0;
      
      slideImage.addEventListener('mousedown', (e) => {
        isPanning = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        slideImage.style.cursor = 'grabbing';
      });
      
      slideImage.addEventListener('mousemove', (e) => {
        if (isPanning) {
          e.preventDefault();
          currentX = e.clientX - startX;
          currentY = e.clientY - startY;
          slideImage.style.transform = `scale(1.5) translate(${currentX}px, ${currentY}px)`;
        }
      });
      
      slideImage.addEventListener('mouseup', () => {
        isPanning = false;
        slideImage.style.cursor = 'move';
      });
      
      slideImage.addEventListener('mouseleave', () => {
        isPanning = false;
        slideImage.style.cursor = 'move';
      });
    }
  }
}