/**
 * ElevenLabs Voice Studio — Core Application Logic
 * Pure Vanilla JavaScript (ES6+) with zero dependencies
 */

// ============================================================================
// 1. Constants & State Management
// ============================================================================
const STORAGE_KEY_API = 'elevenlabs_api_key';
const STORAGE_KEY_VOICE = 'elevenlabs_selected_voice';
const MAX_CHAR_LIMIT = 2500;
const MAX_HISTORY_ITEMS = 5;

// API Endpoints
const API_URL_VOICES = 'https://api.elevenlabs.io/v1/voices';
const API_URL_TTS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

// Application State
const appState = {
  apiKey: null,
  voices: [],
  selectedVoiceId: null,
  currentAudioUrl: null,
  isVerifyingKey: false,
  isGenerating: false,
  history: [] // Session history: [{ id, text, voiceName, modelId, blobUrl, timestamp }]
};

// ============================================================================
// 2. DOM Elements Cache
// ============================================================================
const dom = {
  // Global status
  statusMessage: document.getElementById('status-message'),
  statusIcon: document.getElementById('status-icon'),
  statusText: document.getElementById('status-text'),
  statusDismiss: document.getElementById('status-dismiss'),

  // API Key Section
  apiStatusPill: document.getElementById('api-status-pill'),
  apiStateA: document.getElementById('api-key-state-a'),
  apiStateB: document.getElementById('api-key-state-b'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveKeyBtn: document.getElementById('save-key-btn'),
  saveKeyText: document.getElementById('save-key-text'),
  saveKeySpinner: document.getElementById('save-key-spinner'),
  apiKeyError: document.getElementById('api-key-error'),
  lockedKeyOuter: document.getElementById('locked-key-outer'),
  lockedKeyBox: document.getElementById('locked-key-box'),
  lockedKeyValue: document.getElementById('locked-key-value'),
  removeKeyBtn: document.getElementById('remove-key-btn'),

  // Voice & Model Configuration
  voiceSelect: document.getElementById('voice-select'),
  voiceCountBadge: document.getElementById('voice-count-badge'),
  voiceError: document.getElementById('voice-error'),
  modelSelect: document.getElementById('model-select'),

  // Sliders
  stabilitySlider: document.getElementById('stability-slider'),
  stabilityValue: document.getElementById('stability-value'),
  similaritySlider: document.getElementById('similarity-slider'),
  similarityValue: document.getElementById('similarity-value'),

  // Text Input
  textInput: document.getElementById('text-input'),
  charCounter: document.getElementById('char-counter'),
  textError: document.getElementById('text-error'),

  // Generation Action
  generateBtn: document.getElementById('generate-btn'),
  generateBtnText: document.getElementById('generate-btn-text'),
  generateIcon: document.getElementById('generate-icon'),
  generateSpinner: document.getElementById('generate-spinner'),

  // Audio Output
  audioOutputCard: document.getElementById('audio-output-card'),
  audioPlayer: document.getElementById('audio-player'),
  downloadBtn: document.getElementById('download-btn'),
  audioMetaPill: document.getElementById('audio-meta-pill'),

  // Session History
  historySection: document.querySelector('.history-section'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  historyCount: document.getElementById('history-count')
};

// ============================================================================
// 3. Status & Inline Error Handling Helpers
// ============================================================================

/**
 * Display a global top-level status or alert message (aria-live compatible)
 * @param {string} message - Message text
 * @param {'error'|'success'|'info'} [type='info'] - Message variant
 */
function showGlobalStatus(message, type = 'info') {
  if (!dom.statusMessage) return;

  dom.statusMessage.className = `status-message ${type}`;
  dom.statusText.textContent = message;

  // Set appropriate semantic icon
  if (type === 'error') {
    dom.statusIcon.textContent = '⚠️';
  } else if (type === 'success') {
    dom.statusIcon.textContent = '✅';
  } else {
    dom.statusIcon.textContent = 'ℹ️';
  }

  dom.statusMessage.classList.remove('hidden');
}

/**
 * Hide the global status message
 */
function hideGlobalStatus() {
  if (dom.statusMessage) {
    dom.statusMessage.classList.add('hidden');
  }
}

/**
 * Display a localized inline error message below a specific form field
 * @param {HTMLElement} errorElement - Target error container
 * @param {string} message - Error explanation
 */
function showFieldError(errorElement, message) {
  if (!errorElement) return;
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

/**
 * Hide a localized inline error message
 * @param {HTMLElement} errorElement - Target error container
 */
function clearFieldError(errorElement) {
  if (!errorElement) return;
  errorElement.textContent = '';
  errorElement.classList.add('hidden');
}

/**
 * Clear all inline field errors across the page
 */
function clearAllFieldErrors() {
  clearFieldError(dom.apiKeyError);
  clearFieldError(dom.voiceError);
  clearFieldError(dom.textError);
}

// ============================================================================
// 4. API Key Verification & Lifecycle Management (State A & State B)
// ============================================================================

/**
 * Switch UI view between State A (unauthenticated) and State B (locked key)
 * @param {'A'|'B'} state - Desired authentication view state
 * @param {string} [key=''] - Active API key to display in State B
 */
function setAuthState(state, key = '') {
  clearAllFieldErrors();

  if (state === 'B') {
    // State B: Key is active and locked
    dom.apiStateA.classList.add('hidden');
    dom.apiStateB.classList.remove('hidden');

    // Display the key in the locked box
    dom.lockedKeyValue.textContent = key;

    // Update status indicators
    dom.apiStatusPill.textContent = 'Verified Active';
    dom.apiStatusPill.className = 'status-pill status-pill-success';

    // Enable voice selection control
    dom.voiceSelect.disabled = false;
  } else {
    // State A: No key saved
    dom.apiStateA.classList.remove('hidden');
    dom.apiStateB.classList.add('hidden');
    dom.apiKeyInput.value = '';
    dom.lockedKeyValue.textContent = '';

    // Update status indicators
    dom.apiStatusPill.textContent = 'Unconfigured';
    dom.apiStatusPill.className = 'status-pill status-pill-unconfigured';

    // Disable voice selection control and clear voices
    dom.voiceSelect.disabled = true;
    dom.voiceSelect.innerHTML = '<option value="" disabled selected>Save API key to load available voices...</option>';
    dom.voiceCountBadge.textContent = 'Waiting for Key';
    dom.voiceCountBadge.className = 'badge-mini';
  }
}

/**
 * Verify an API key with ElevenLabs API by making a GET request to /v1/voices
 * @param {string} key - Candidate API key
 * @returns {Promise<Array|null>} Array of voice objects if valid, null otherwise
 */
async function verifyApiKey(key) {
  const response = await fetch(API_URL_VOICES, {
    method: 'GET',
    headers: {
      'xi-api-key': key
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key (401 Unauthorized). Please check your key from ElevenLabs.');
    } else if (response.status === 429) {
      throw new Error('ElevenLabs quota limit reached (429 Too Many Requests). Please check your account quota.');
    } else {
      let errDetail = '';
      try {
        const errorJson = await response.json();
        errDetail = errorJson?.detail?.message || errorJson?.detail?.status || '';
      } catch (_) {
        // Response was not JSON
      }
      throw new Error(errDetail ? `API Error (${response.status}): ${errDetail}` : `Verification failed with HTTP ${response.status}`);
    }
  }

  const data = await response.json();
  if (data && Array.isArray(data.voices)) {
    return data.voices;
  }
  throw new Error('Unexpected response structure received from ElevenLabs.');
}

/**
 * Handler for the "Save Key" action
 * Validates non-empty, calls ElevenLabs to verify, saves to localStorage, and updates UI
 */
async function saveKey() {
  clearFieldError(dom.apiKeyError);
  hideGlobalStatus();

  const key = dom.apiKeyInput.value.trim();

  // Validate non-empty
  if (!key) {
    showFieldError(dom.apiKeyError, 'Please enter your ElevenLabs API key.');
    dom.apiKeyInput.focus();
    return;
  }

  // Pre-validate key prefix to prevent the common Key ID confusion
  if (!key.startsWith('sk_')) {
    showFieldError(
      dom.apiKeyError, 
      "ElevenLabs secret keys start with 'sk_'. You copied the Key ID from the dashboard list instead of the secret key. In your ElevenLabs dashboard, click '+ Create API Key' (or 'Rotate key') and copy the newly generated secret key."
    );
    dom.apiKeyInput.focus();
    return;
  }

  // Set loading state on button
  appState.isVerifyingKey = true;
  dom.saveKeyBtn.disabled = true;
  dom.saveKeySpinner.classList.remove('hidden');
  dom.saveKeyText.textContent = 'Verifying...';

  try {
    const voices = await verifyApiKey(key);

    // Save key to localStorage and state
    localStorage.setItem(STORAGE_KEY_API, key);
    appState.apiKey = key;
    appState.voices = voices;

    // Switch to State B
    setAuthState('B', key);

    // Populate the voice dropdown with returned voices
    populateVoiceDropdown(voices);

    showGlobalStatus('API key verified and saved successfully!', 'success');
  } catch (err) {
    console.error('API Key Verification Failed:', err);
    let msg = err.message;
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      msg = 'Network error: Unable to reach ElevenLabs API. Please check your internet connection.';
    }
    showFieldError(dom.apiKeyError, msg);
    showGlobalStatus(msg, 'error');
  } finally {
    appState.isVerifyingKey = false;
    dom.saveKeyBtn.disabled = false;
    dom.saveKeySpinner.classList.add('hidden');
    dom.saveKeyText.textContent = 'Save Key';
  }
}

/**
 * Handler for the "Remove Key" action
 * Clears localStorage, resets state, and returns to State A
 */
function removeKey() {
  localStorage.removeItem(STORAGE_KEY_API);
  localStorage.removeItem(STORAGE_KEY_VOICE);
  appState.apiKey = null;
  appState.voices = [];
  appState.selectedVoiceId = null;

  setAuthState('A');
  showGlobalStatus('API key removed from browser storage.', 'info');
}

/**
 * Enforce strict non-interactivity on the locked API key box (JS Event Listeners)
 * Blocks copy, cut, right-click (contextmenu), and text selection
 */
function setupLockedBoxProtection() {
  const protectedElements = [dom.lockedKeyOuter, dom.lockedKeyBox, dom.lockedKeyValue];
  const blockedEvents = ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart', 'mousedown'];

  blockedEvents.forEach(eventType => {
    protectedElements.forEach(el => {
      if (!el) return;
      el.addEventListener(eventType, (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, { capture: true, passive: false });
    });
  });

  // Document-level protection in case cursor selection drags through the locked box
  document.addEventListener('copy', (e) => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode && dom.lockedKeyOuter.contains(sel.anchorNode)) {
      e.preventDefault();
    }
  });

  document.addEventListener('cut', (e) => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode && dom.lockedKeyOuter.contains(sel.anchorNode)) {
      e.preventDefault();
    }
  });
}

// ============================================================================
// 5. Voice List & Dropdown Management
// ============================================================================

/**
 * Fetch voices for an already-saved key (e.g. on page reload)
 */
async function loadVoices() {
  if (!appState.apiKey) return;

  dom.voiceSelect.disabled = true;
  dom.voiceSelect.innerHTML = '<option value="" disabled selected>Loading voices from ElevenLabs...</option>';
  dom.voiceCountBadge.textContent = 'Loading...';
  clearFieldError(dom.voiceError);

  try {
    const voices = await verifyApiKey(appState.apiKey);
    appState.voices = voices;
    populateVoiceDropdown(voices);
  } catch (err) {
    console.error('Failed to load voices:', err);
    let msg = err.message;
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      msg = 'Network error: Failed to fetch voices from ElevenLabs.';
    }
    showFieldError(dom.voiceError, msg);
    dom.voiceSelect.innerHTML = '<option value="" disabled selected>Failed to load voices. Check key or network.</option>';
    dom.voiceCountBadge.textContent = 'Error';
    showGlobalStatus(msg, 'error');
  }
}

/**
 * Populate the voice select dropdown and restore previously selected voice
 * @param {Array} voices - Array of voice objects
 */
function populateVoiceDropdown(voices) {
  if (!Array.isArray(voices) || voices.length === 0) {
    dom.voiceSelect.innerHTML = '<option value="" disabled selected>No voices found for this account.</option>';
    dom.voiceSelect.disabled = true;
    dom.voiceCountBadge.textContent = '0 Voices';
    return;
  }

  dom.voiceSelect.innerHTML = '';
  dom.voiceSelect.disabled = false;

  const savedVoiceId = localStorage.getItem(STORAGE_KEY_VOICE);
  let hasSavedVoiceMatch = false;

  voices.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.voice_id;

    // Build informative label including category and accent if available
    const accent = voice.labels?.accent ? ` • ${voice.labels.accent}` : '';
    const desc = voice.labels?.descriptive ? ` (${voice.labels.descriptive})` : '';
    opt.textContent = `${voice.name}${accent}${desc}`;

    if (savedVoiceId && voice.voice_id === savedVoiceId) {
      opt.selected = true;
      hasSavedVoiceMatch = true;
    }

    dom.voiceSelect.appendChild(opt);
  });

  // Default to first voice if no saved selection matched
  if (!hasSavedVoiceMatch && voices.length > 0) {
    dom.voiceSelect.selectedIndex = 0;
    localStorage.setItem(STORAGE_KEY_VOICE, voices[0].voice_id);
  }

  appState.selectedVoiceId = dom.voiceSelect.value;
  dom.voiceCountBadge.textContent = `${voices.length} Voices`;
  dom.voiceCountBadge.className = 'badge-mini badge-accent';
}

/**
 * Handle voice dropdown selection change
 */
function onVoiceChange() {
  const selectedId = dom.voiceSelect.value;
  appState.selectedVoiceId = selectedId;
  localStorage.setItem(STORAGE_KEY_VOICE, selectedId);
  clearFieldError(dom.voiceError);
}

// ============================================================================
// 6. Text Input & Live Character Counter
// ============================================================================

/**
 * Update the character counter display and apply threshold styling
 */
function updateCharCount() {
  const currentLength = dom.textInput.value.length;
  dom.charCounter.textContent = `${currentLength.toLocaleString()} / ${MAX_CHAR_LIMIT.toLocaleString()}`;

  // Visual cues for character limit proximity
  if (currentLength >= MAX_CHAR_LIMIT) {
    dom.charCounter.className = 'char-counter limit';
  } else if (currentLength >= MAX_CHAR_LIMIT * 0.9) {
    dom.charCounter.className = 'char-counter warning';
  } else {
    dom.charCounter.className = 'char-counter';
  }

  if (currentLength > 0) {
    clearFieldError(dom.textError);
  }
}

// ============================================================================
// 7. Sliders Live Value Handlers
// ============================================================================

function setupSliders() {
  dom.stabilitySlider.addEventListener('input', () => {
    const val = parseFloat(dom.stabilitySlider.value).toFixed(2);
    dom.stabilityValue.textContent = val;
  });

  dom.similaritySlider.addEventListener('input', () => {
    const val = parseFloat(dom.similaritySlider.value).toFixed(2);
    dom.similarityValue.textContent = val;
  });
}

// ============================================================================
// 8. Speech Generation & Audio Playback
// ============================================================================

/**
 * Generate speech from text using ElevenLabs POST /v1/text-to-speech/{voice_id}
 */
async function generateSpeech() {
  clearAllFieldErrors();
  hideGlobalStatus();

  // Validation 1: API Key present
  if (!appState.apiKey) {
    showFieldError(dom.apiKeyError, 'API key is required. Please save an ElevenLabs API key first.');
    showGlobalStatus('Please enter and save your ElevenLabs API key before generating speech.', 'error');
    dom.apiKeyInput.focus();
    return;
  }

  // Validation 2: Voice selected
  const voiceId = dom.voiceSelect.value;
  if (!voiceId) {
    showFieldError(dom.voiceError, 'Please select a voice from the dropdown.');
    return;
  }

  // Validation 3: Text input not empty
  const text = dom.textInput.value.trim();
  if (!text) {
    showFieldError(dom.textError, 'Please enter some text to generate speech.');
    dom.textInput.focus();
    return;
  }

  // Retrieve current slider & model configurations
  const modelId = dom.modelSelect.value;
  const stability = parseFloat(dom.stabilitySlider.value);
  const similarityBoost = parseFloat(dom.similaritySlider.value);

  // Set loading state on Generate button
  appState.isGenerating = true;
  dom.generateBtn.disabled = true;
  dom.generateIcon.classList.add('hidden');
  dom.generateSpinner.classList.remove('hidden');
  dom.generateBtnText.textContent = 'Generating Speech...';

  const requestUrl = `${API_URL_TTS_BASE}/${encodeURIComponent(voiceId)}`;
  const payload = {
    text: text,
    model_id: modelId,
    voice_settings: {
      stability: stability,
      similarity_boost: similarityBoost
    }
  };

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': appState.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key (401 Unauthorized). Please check or update your key.');
      } else if (response.status === 429) {
        throw new Error('Quota exceeded or rate limit reached (429). Please check your ElevenLabs subscription or character quota.');
      } else {
        let errMessage = '';
        try {
          const errJson = await response.json();
          errMessage = errJson?.detail?.message || errJson?.detail?.status || '';
        } catch (_) {
          // Response body was not JSON
        }
        throw new Error(errMessage ? `Generation Failed (${response.status}): ${errMessage}` : `Generation failed with status code ${response.status}`);
      }
    }

    // Read the response audio stream as Blob
    const audioBlob = await response.blob();
    const newAudioUrl = URL.createObjectURL(audioBlob);

    // Revoke old blob URL to prevent memory leaks
    if (appState.currentAudioUrl) {
      URL.revokeObjectURL(appState.currentAudioUrl);
    }
    appState.currentAudioUrl = newAudioUrl;

    // Get current voice display name
    const selectedVoiceOption = dom.voiceSelect.options[dom.voiceSelect.selectedIndex];
    const voiceName = selectedVoiceOption ? selectedVoiceOption.textContent.split('•')[0].trim() : 'Voice';

    // Update audio player element
    dom.audioPlayer.src = newAudioUrl;
    dom.audioOutputCard.classList.remove('hidden');

    // Configure Download MP3 button
    const safeVoiceSlug = voiceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `elevenlabs_${safeVoiceSlug}_${timestamp}.mp3`;
    
    dom.downloadBtn.href = newAudioUrl;
    dom.downloadBtn.download = filename;

    // Auto-play the synthesized audio
    dom.audioPlayer.load();
    const playPromise = dom.audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // Autoplay may be blocked by browser policy without prior interaction
        console.warn('Audio auto-play prevented by browser policy:', err);
      });
    }

    // Add to session history
    addToHistory({
      text: text,
      voiceName: voiceName,
      modelId: modelId,
      blobUrl: newAudioUrl,
      downloadName: filename,
      timestamp: new Date()
    });

    showGlobalStatus('Speech generated successfully!', 'success');
  } catch (err) {
    console.error('Speech Generation Error:', err);
    let msg = err.message;
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      msg = 'Network error: Unable to reach ElevenLabs API. Please check your internet connection.';
    }
    showFieldError(dom.textError, msg);
    showGlobalStatus(msg, 'error');
  } finally {
    appState.isGenerating = false;
    dom.generateBtn.disabled = false;
    dom.generateSpinner.classList.add('hidden');
    dom.generateIcon.classList.remove('hidden');
    dom.generateBtnText.textContent = 'Generate Speech';
  }
}

// ============================================================================
// 9. Session History Management (Last 5 Generations)
// ============================================================================

/**
 * Add an item to session history (capped at 5 items)
 * @param {Object} item - History generation entry
 */
function addToHistory(item) {
  // If array already has MAX_HISTORY_ITEMS, revoke blob URL for oldest before discarding
  if (appState.history.length >= MAX_HISTORY_ITEMS) {
    const discarded = appState.history.pop();
    // Only revoke if it's not the currently active player URL
    if (discarded.blobUrl && discarded.blobUrl !== appState.currentAudioUrl) {
      try {
        URL.revokeObjectURL(discarded.blobUrl);
      } catch (_) {}
    }
  }

  // Prepend new item so newest is on top
  appState.history.unshift(item);
  renderHistory();
}

/**
 * Render the session history list
 */
function renderHistory() {
  const count = appState.history.length;
  dom.historyCount.textContent = `${count} / ${MAX_HISTORY_ITEMS}`;

  if (count === 0) {
    dom.historyEmpty.classList.remove('hidden');
    dom.historyList.classList.add('hidden');
    return;
  }

  dom.historyEmpty.classList.add('hidden');
  dom.historyList.classList.remove('hidden');
  dom.historyList.innerHTML = '';

  appState.history.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    // Format truncated preview
    const previewText = entry.text.length > 60 
      ? entry.text.substring(0, 60) + '...' 
      : entry.text;

    // Format local time
    const timeStr = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    li.innerHTML = `
      <div class="history-content">
        <p class="history-preview" title="${escapeHtml(entry.text)}">${escapeHtml(previewText)}</p>
        <div class="history-meta">
          <span class="history-voice">${escapeHtml(entry.voiceName)}</span>
          <span>•</span>
          <span>${timeStr}</span>
        </div>
      </div>
      <div class="history-actions">
        <button type="button" class="btn-replay" data-index="${index}" aria-label="Replay generation">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Replay
        </button>
      </div>
    `;

    // Attach replay click event listener
    const replayBtn = li.querySelector('.btn-replay');
    replayBtn.addEventListener('click', () => replayHistoryItem(index));

    dom.historyList.appendChild(li);
  });
}

/**
 * Replay an audio clip from session history
 * @param {number} index - Index in appState.history
 */
function replayHistoryItem(index) {
  const item = appState.history[index];
  if (!item || !item.blobUrl) return;

  // Set as current audio in player
  dom.audioPlayer.src = item.blobUrl;
  dom.audioOutputCard.classList.remove('hidden');
  
  dom.downloadBtn.href = item.blobUrl;
  dom.downloadBtn.download = item.downloadName || 'elevenlabs_speech.mp3';

  dom.audioPlayer.load();
  dom.audioPlayer.play().catch(err => {
    console.warn('Replay play interrupted:', err);
  });

  showGlobalStatus(`Replaying clip: "${item.text.substring(0, 35)}..."`, 'info');
}

/**
 * Basic HTML escaping helper for safe text rendering
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 10. Initialization & Event Listeners Wiring
// ============================================================================

function initEventListeners() {
  // Save Key Button
  dom.saveKeyBtn.addEventListener('click', saveKey);

  // Enter key in API Key Input triggers save
  dom.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveKey();
    }
  });

  // Remove Key Button
  dom.removeKeyBtn.addEventListener('click', removeKey);

  // Voice dropdown change
  dom.voiceSelect.addEventListener('change', onVoiceChange);

  // Textarea input event for live character count
  dom.textInput.addEventListener('input', updateCharCount);

  // Generate Button
  dom.generateBtn.addEventListener('click', generateSpeech);

  // Status message dismiss button
  if (dom.statusDismiss) {
    dom.statusDismiss.addEventListener('click', hideGlobalStatus);
  }

  // Setup locked key box protections
  setupLockedBoxProtection();

  // Setup fine-tuning sliders
  setupSliders();
}

/**
 * App entry point on DOMContentLoaded
 */
function initApp() {
  initEventListeners();
  updateCharCount();

  // Check for saved API key in localStorage
  const savedKey = localStorage.getItem(STORAGE_KEY_API);

  if (savedKey) {
    appState.apiKey = savedKey;
    setAuthState('B', savedKey);
    loadVoices();
  } else {
    setAuthState('A');
  }
}

// Run when the DOM is fully parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
