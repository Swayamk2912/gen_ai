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
  
  // Render slide content with enhanced presenter-like display
  renderSlideContent(s.content || '');
  document.getElementById('progress').textContent = `Slide ${current + 1} of ${slides.length}`;
  
  // Display slide image if available
  displaySlideImage(s);
  
  // Show presenter mode indicator
  showPresenterMode();
  
  if (s.audio_path) {
    const file = s.audio_path.split('/').pop();
    const audio = document.getElementById('audio');
    audio.src = `${window.BACKEND_BASE}/audio/${file}`;
    audio.currentTime = 0; // Reset audio to beginning
    
    // Auto-start narration for seamless presentation flow
    setTimeout(() => {
      if (!isPlaying && !isPaused) {
        startPresentationMode();
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

function highlightMatchingContent(highlightText) {
  const lines = document.querySelectorAll('.content-line');
  
  lines.forEach(line => {
    const lineText = line.textContent.toLowerCase();
    const highlightLower = highlightText.toLowerCase();
    
    // Check if this line contains the highlight text
    if (lineText.includes(highlightLower) || highlightLower.includes(lineText.trim())) {
      line.classList.add('current-highlight');
    }
  });
}

function showPresenterMode() {
  const statusIndicator = document.getElementById('statusIndicator');
  statusIndicator.textContent = 'AI Presenter Ready';
  statusIndicator.className = 'status-indicator presenter-ready';
}

function startPresentationMode() {
  const audio = document.getElementById('audio');
  if (audio && audio.src) {
    audio.play().then(() => {
      isPlaying = true;
      isPaused = false;
      updateButtonStates();
      
      // Update status to show AI is presenting
      const statusIndicator = document.getElementById('statusIndicator');
      statusIndicator.textContent = 'AI Presenting';
      statusIndicator.className = 'status-indicator presenting';
    }).catch(error => {
      console.error('Auto-play failed:', error);
    });
  }
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
    document.querySelectorAll('.content-line').forEach(line => {
      line.classList.remove('current-highlight', 'speaking');
    });
    
    // Add current highlighting
    const segment = narrationSegments[activeSegment];
    if (segment.highlight_text) {
      highlightMatchingContent(segment.highlight_text);
      
      // Add speaking indicator
      const highlightedLines = document.querySelectorAll('.current-highlight');
      highlightedLines.forEach(line => {
        line.classList.add('speaking');
      });
    }
    
    currentSegment = activeSegment;
  }
}

async function narrate() {
  if (presId == null) return;
  const tone = document.getElementById('tone').value;
  const language = document.getElementById('language').value;
  
  try {
    const res = await fetch(`${window.BACKEND_BASE}/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation_id: presId, slide_index: current, tone, language })
    });
    const data = await res.json();
    await loadPresentation();
    
    // Preserve display mode when re-rendering
    const currentDisplayMode = displayMode;
    render();
    displayMode = currentDisplayMode; // Restore display mode
    displaySlideImage(slides[current]); // Re-display slide image
    
    if (data.audio_url) {
      const audio = document.getElementById('audio');
      audio.src = `${window.BACKEND_BASE}${data.audio_url}`;
      
      // Set up audio event listeners for presenter mode
      audio.onplay = () => {
        isPlaying = true;
        isPaused = false;
        updateButtonStates();
        
        // Update status to show AI is presenting
        const statusIndicator = document.getElementById('statusIndicator');
        statusIndicator.textContent = 'AI Presenting';
        statusIndicator.className = 'status-indicator presenting';
        
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
      };
      
      audio.onended = () => {
        isPlaying = false;
        isPaused = false;
        clearSyncInterval();
        updateButtonStates();
        showQAModal();
      };
      
      // Start playing
      await audio.play();
      
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
  
  // Clear synchronization
  clearSyncInterval();
  
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
  
  // Clear synchronization
  clearSyncInterval();
  
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
  const contentContainer = document.getElementById('slideContentContainer');
  const slideImage = document.getElementById('slideImage');
  
  console.log('Displaying slide:', slide); // Debug log
  
  if (slide.image_path) {
    const imageUrl = `${window.BACKEND_BASE}${slide.image_path}`;
    console.log('Image URL:', imageUrl); // Debug log
    
    // Always clear the container first
    imageContainer.innerHTML = '';
    
    // Check if it's an HTML file
    if (slide.image_path.endsWith('.html')) {
      // For HTML files, create an iframe
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '70vh';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.src = imageUrl;
      iframe.onload = () => {
        console.log('HTML slide loaded successfully:', imageUrl);
      };
      iframe.onerror = () => {
        console.error('Failed to load HTML slide:', imageUrl);
        showImageError(imageContainer, 'Failed to load slide');
      };
      imageContainer.appendChild(iframe);
      console.log('Created iframe for HTML slide'); // Debug log
    } else {
      // For image files, use img tag with error handling
      slideImage.onload = () => {
        console.log('Image loaded successfully:', imageUrl);
      };
      slideImage.onerror = () => {
        console.error('Failed to load image:', imageUrl);
        showImageError(imageContainer, 'Failed to load slide image');
      };
      slideImage.src = imageUrl;
      slideImage.alt = `Slide ${slide.slide_number || current + 1}`;
      imageContainer.appendChild(slideImage);
      console.log('Set image src:', imageUrl); // Debug log
    }
    
    // Show image container if in image mode
    if (displayMode === 'image') {
      imageContainer.style.display = 'block';
      contentContainer.style.display = 'none';
      console.log('Showing image container'); // Debug log
    } else {
      imageContainer.style.display = 'none';
      contentContainer.style.display = 'block';
      console.log('Showing content container'); // Debug log
    }
  } else {
    // No image available, show content only
    imageContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    console.log('No image path available, showing content only'); // Debug log
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
    // Switch to image mode
    displayMode = 'image';
    imageContainer.style.display = 'block';
    contentContainer.style.display = 'none';
    toggleDisplayBtn.textContent = '🖼️ Hide Slide Image';
    toggleContentBtn.textContent = '📝 Show Text Content';
  } else {
    // Switch to content mode
    displayMode = 'content';
    imageContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    toggleDisplayBtn.textContent = '🖼️ Show Slide Image';
    toggleContentBtn.textContent = '📝 Hide Text Content';
  }
}

function toggleContentMode() {
  const imageContainer = document.getElementById('slideImageContainer');
  const contentContainer = document.getElementById('slideContentContainer');
  const toggleDisplayBtn = document.getElementById('toggleDisplayBtn');
  const toggleContentBtn = document.getElementById('toggleContentBtn');
  
  if (displayMode === 'image') {
    // Switch to content mode
    displayMode = 'content';
    imageContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    toggleDisplayBtn.textContent = '🖼️ Show Slide Image';
    toggleContentBtn.textContent = '📝 Hide Text Content';
  } else {
    // Switch to image mode
    displayMode = 'image';
    imageContainer.style.display = 'block';
    contentContainer.style.display = 'none';
    toggleDisplayBtn.textContent = '🖼️ Hide Slide Image';
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