let presId = null;
let slides = [];
let current = 0;
let canAdvance = true;

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
  document.getElementById('slideContent').textContent = s.content || '';
  document.getElementById('progress').textContent = `Slide ${current + 1} of ${slides.length}`;
  if (s.audio_path) {
    const file = s.audio_path.split('/').pop();
    document.getElementById('audio').src = `${window.BACKEND_BASE}/audio/${file}`;
  }
}

async function narrate() {
  if (presId == null) return;
  const tone = document.getElementById('tone').value;
  const language = document.getElementById('language').value;
  const res = await fetch(`${window.BACKEND_BASE}/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation_id: presId, slide_index: current, tone, language })
  });
  const data = await res.json();
  await loadPresentation();
  render();
  if (data.audio_url) {
    document.getElementById('audio').src = `${window.BACKEND_BASE}${data.audio_url}`;
    const audio = document.getElementById('audio');
    audio.play();
    // After narration ends, prompt Q&A
    canAdvance = false;
    document.getElementById('nextBtn').disabled = true;
    audio.onended = () => {
      showQAModal();
    };
  }
}

function nextSlide() {
  if (!slides.length) return;
  if (!canAdvance) return;
  current = Math.min(current + 1, slides.length - 1);
  render();
}

function prevSlide() {
  if (!slides.length) return;
  current = Math.max(current - 1, 0);
  render();
}

function repeatSlide() {
  render();
  const audio = document.getElementById('audio');
  if (audio.src) audio.play();
}

async function ask() {
  if (presId == null) return;
  const q = document.getElementById('question').value.trim();
  if (!q) return;
  const tone = document.getElementById('tone').value;
  const language = document.getElementById('language').value;
  const res = await fetch(`${window.BACKEND_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation_id: presId, slide_index: current, question: q, tone, language })
  });
  const data = await res.json();
  document.getElementById('answer').textContent = data.answer || '';
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('uploadBtn').addEventListener('click', upload);
  document.getElementById('narrateBtn').addEventListener('click', narrate);
  document.getElementById('nextBtn').addEventListener('click', nextSlide);
  document.getElementById('prevBtn').addEventListener('click', prevSlide);
  document.getElementById('repeatBtn').addEventListener('click', repeatSlide);
  document.getElementById('askBtn').addEventListener('click', ask);
  document.getElementById('pauseBtn').addEventListener('click', () => {
    const audio = document.getElementById('audio');
    if (!audio.paused) audio.pause();
  });
  document.getElementById('resumeBtn').addEventListener('click', () => {
    const audio = document.getElementById('audio');
    if (audio.src) audio.play();
  });
  // Modal controls
  document.getElementById('skipBtn').addEventListener('click', () => {
    hideQAModal();
    canAdvance = true;
    document.getElementById('nextBtn').disabled = false;
  });
  document.getElementById('modalAskBtn').addEventListener('click', askInModal);
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
  const tone = document.getElementById('tone').value;
  const language = document.getElementById('language').value;
  const res = await fetch(`${window.BACKEND_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation_id: presId, slide_index: current, question: q, tone, language })
  });
  const data = await res.json();
  document.getElementById('modalAnswer').textContent = data.answer || '';
  // Allow advancing after at least one Q&A turn
  canAdvance = true;
  document.getElementById('nextBtn').disabled = false;
}