/**
 * PlayPulse - YouTube Playlist Duration & Speed Calculator
 * Client-side interactive application logic.
 */

// State management
let playlistData = null;
let activeSpeed = 1.0;
let dailyMins = 60;
let selectedVideoIndices = new Set();
let isDarkMode = true;
let lastFocusedElement = null;

// Elements
const form = document.getElementById('playlistForm');
const input = document.getElementById('playlistUrl');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnArrow = document.getElementById('btnArrow');
const btnSpinner = document.getElementById('btnSpinner');
const pasteBtn = document.getElementById('pasteBtn');
const clearBtn = document.getElementById('clearBtn');
const errorCard = document.getElementById('errorCard');
const errorMessageText = document.getElementById('errorMessageText');
const resultsDashboard = document.getElementById('resultsDashboard');
const toastContainer = document.getElementById('toastContainer');
const recentsBar = document.getElementById('recentsBar');
const customSpeedSlider = document.getElementById('customSpeedSlider');
const customSpeedDisplay = document.getElementById('customSpeedDisplay');
const videoSearchInput = document.getElementById('videoSearchInput');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const a11yStatus = document.getElementById('a11yStatus');

// Screen reader dynamic announcement helper
function announceStatus(message) {
  if (a11yStatus) {
    a11yStatus.textContent = '';
    setTimeout(() => {
      a11yStatus.textContent = message;
    }, 50);
  }
}

// Safe LocalStorage helpers
function safeGetStorage(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Fail gracefully in sandboxed / private modes
  }
}

// Theme setup
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIconSun = document.getElementById('themeIconSun');
const themeIconMoon = document.getElementById('themeIconMoon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  safeSetStorage('theme', theme);
  if (theme === 'light') {
    if (themeIconSun) themeIconSun.style.display = 'block';
    if (themeIconMoon) themeIconMoon.style.display = 'none';
    isDarkMode = false;
  } else {
    if (themeIconSun) themeIconSun.style.display = 'none';
    if (themeIconMoon) themeIconMoon.style.display = 'block';
    isDarkMode = true;
  }
}

// Google Analytics Event Tracking Helper
function trackEvent(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

const savedTheme = safeGetStorage('theme', 'dark');
applyTheme(savedTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    applyTheme(nextTheme);
    trackEvent('toggle_theme', { theme: nextTheme });
    showToast(`Switched to ${nextTheme} mode`);
    announceStatus(`Switched to ${nextTheme} mode`);
  });
}

// Input handlers
if (input) {
  input.addEventListener('input', () => {
    if (clearBtn) clearBtn.style.display = input.value.trim() ? 'inline-flex' : 'none';
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    announceStatus('Input cleared');
  });
}

if (pasteBtn) {
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        input.value = text.trim();
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        showToast('Pasted URL from clipboard');
        form.dispatchEvent(new Event('submit'));
      }
    } catch (err) {
      showToast('Please allow clipboard permissions to paste');
    }
  });
}

// Preset chips
document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const url = chip.getAttribute('data-url');
    if (input) {
      input.value = url;
      if (clearBtn) clearBtn.style.display = 'inline-flex';
      form.dispatchEvent(new Event('submit'));
    }
  });
});

// Toast helper
function showToast(message) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-emerald);" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  announceStatus(message);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Format seconds helper
function formatSecs(secs) {
  secs = Math.max(0, Math.round(secs));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return {
    days,
    hours,
    minutes,
    seconds,
    text: parts.join(' '),
    verbose: `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`
  };
}

function padZero(num) {
  return num < 10 ? '0' + num : '' + num;
}

// Loading State
function setLoading(isLoading) {
  if (!submitBtn) return;
  if (isLoading) {
    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnArrow) btnArrow.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (errorCard) errorCard.style.display = 'none';
  } else {
    submitBtn.disabled = false;
    if (btnText) btnText.style.display = 'inline-block';
    if (btnArrow) btnArrow.style.display = 'inline-block';
    if (btnSpinner) btnSpinner.style.display = 'none';
  }
}

// Client-side Session Cache (1 hour TTL)
const CLIENT_CACHE_TTL_MS = 3600 * 1000;

function getClientCachedPlaylist(urlOrId) {
  try {
    const raw = sessionStorage.getItem('pp_cache_' + urlOrId.trim());
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CLIENT_CACHE_TTL_MS) {
      sessionStorage.removeItem('pp_cache_' + urlOrId.trim());
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
}

function setClientCachedPlaylist(urlOrId, data) {
  try {
    sessionStorage.setItem('pp_cache_' + urlOrId.trim(), JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Quota exceeded or private mode, fail gracefully
  }
}

// Client-side URL pre-validation
function validatePlaylistInput(urlOrId) {
  const str = (urlOrId || '').trim();
  if (!str) {
    return { valid: false, message: 'Please enter a YouTube playlist URL or ID.' };
  }
  // Detect single video link without list parameter
  if ((str.includes('youtube.com/watch') || str.includes('youtu.be/')) && !str.includes('list=')) {
    return {
      valid: false,
      message: 'This link is for a single video. Please paste a YouTube playlist URL (with ?list=...) or playlist ID.'
    };
  }
  return { valid: true };
}

// Form Submission
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const playlistUrl = input.value.trim();
    if (!playlistUrl) return;

    // Client-side validation check
    const validation = validatePlaylistInput(playlistUrl);
    if (!validation.valid) {
      if (errorMessageText) errorMessageText.textContent = validation.message;
      if (errorCard) errorCard.style.display = 'block';
      errorCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast(validation.message);
      return;
    }

    // 1. Check client-side session cache for zero-latency response
    const cachedData = getClientCachedPlaylist(playlistUrl);
    if (cachedData) {
      playlistData = cachedData;
      selectedVideoIndices = new Set(cachedData.videos.map((_, i) => i));
      saveRecent(cachedData.playlist);
      renderDashboard();
      showToast('Playlist duration calculated successfully!');
      announceStatus(`Playlist calculated: ${cachedData.playlist.title}`);
      return;
    }

    setLoading(true);
    if (errorCard) errorCard.style.display = 'none';

    try {
      const response = await fetch('/get_playlist_duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlistUrl })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch playlist data.');
      }

      playlistData = data;
      selectedVideoIndices = new Set(data.videos.map((_, i) => i));
      
      // Cache on client
      setClientCachedPlaylist(playlistUrl, data);
      if (data.playlist && data.playlist.id) {
        setClientCachedPlaylist(data.playlist.id, data);
      }

      saveRecent(data.playlist);
      renderDashboard();
      trackEvent('calculate_playlist', {
        playlist_id: data.playlist.id,
        video_count: data.videos.length,
        total_seconds: data.totalSeconds
      });
      showToast('Playlist duration calculated successfully!');
      announceStatus(`Playlist calculated: ${data.playlist.title}`);

    } catch (err) {
      if (errorMessageText) errorMessageText.textContent = err.message || 'Unable to fetch playlist data.';
      if (errorCard) errorCard.style.display = 'block';
      if (resultsDashboard) resultsDashboard.style.display = 'none';
      errorCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      announceStatus(`Calculation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  });
}

// Render Dashboard
function renderDashboard() {
  if (!playlistData) return;

  const p = playlistData.playlist;
  const stats = playlistData.stats;
  const videos = playlistData.videos;

  // Meta info
  const titleEl = document.getElementById('playlistTitle');
  if (titleEl) titleEl.textContent = p.title;

  const channelEl = document.getElementById('playlistChannel');
  if (channelEl) channelEl.textContent = p.channelTitle;

  const videoCountEl = document.getElementById('playlistVideoCount');
  if (videoCountEl) videoCountEl.textContent = p.videoCount;

  const statVideoCountEl = document.getElementById('statVideoCountMeta');
  if (statVideoCountEl) statVideoCountEl.textContent = `${p.videoCount} videos`;

  const statAvgEl = document.getElementById('statAvgLength');
  if (statAvgEl) statAvgEl.textContent = stats.avgFormatted;

  const badgeEl = document.getElementById('videoListBadge');
  if (badgeEl) badgeEl.textContent = `${videos.length} videos`;
  
  const thumbEl = document.getElementById('playlistThumb');
  if (thumbEl) {
    thumbEl.src = p.thumbnail || (videos[0] ? videos[0].thumbnail : '');
    thumbEl.alt = `Thumbnail for ${p.title}`;
  }

  const ytLink = document.getElementById('ytExternalLink');
  if (ytLink) ytLink.href = `https://www.youtube.com/playlist?list=${p.id}`;

  // Range selector bounds
  if (rangeStart && rangeEnd) {
    rangeStart.min = 1;
    rangeStart.max = videos.length;
    rangeStart.value = 1;
    rangeEnd.min = 1;
    rangeEnd.max = videos.length;
    rangeEnd.value = videos.length;
  }

  // Insights
  const insAvg = document.getElementById('insightAvg');
  if (insAvg) insAvg.textContent = stats.avgFormatted;

  const insTotal = document.getElementById('insightTotalVideos');
  if (insTotal) insTotal.textContent = videos.length;
  
  if (stats.shortest) {
    const sDur = document.getElementById('insightShortestDur');
    if (sDur) sDur.textContent = stats.shortest.duration;
    const sTitle = document.getElementById('insightShortestTitle');
    if (sTitle) sTitle.textContent = stats.shortest.title;
  }
  if (stats.longest) {
    const lDur = document.getElementById('insightLongestDur');
    if (lDur) lDur.textContent = stats.longest.duration;
    const lTitle = document.getElementById('insightLongestTitle');
    if (lTitle) lTitle.textContent = stats.longest.title;
  }

  // Render Speed Matrix
  renderSpeedCards();

  // Render Video List
  renderVideoList();

  // Recalculate Active Time Display
  updateActiveTime();

  if (resultsDashboard) {
    resultsDashboard.style.display = 'block';
    resultsDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Render Speed Matrix Cards as Semantic Buttons
function renderSpeedCards() {
  const grid = document.getElementById('speedsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const speedList = [
    { key: '1.0', speed: 1.0, label: '1.0x', tag: 'Normal' },
    { key: '1.25', speed: 1.25, label: '1.25x', tag: '' },
    { key: '1.5', speed: 1.5, label: '1.5x', tag: 'Popular', isPopular: true },
    { key: '1.75', speed: 1.75, label: '1.75x', tag: '' },
    { key: '2.0', speed: 2.0, label: '2.0x', tag: 'Hyper' }
  ];

  const currentTotalSecs = getSelectedSeconds();

  speedList.forEach(item => {
    const adjSecs = Math.round(currentTotalSecs / item.speed);
    const fmt = formatSecs(adjSecs);
    const savedSecs = Math.max(0, currentTotalSecs - adjSecs);
    const savedFmt = formatSecs(savedSecs);
    const isCurrent = Math.abs(activeSpeed - item.speed) < 0.01;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `speed-card ${isCurrent ? 'active' : ''}`;
    card.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    card.setAttribute('aria-label', `${item.label} speed: ${fmt.text}${item.speed > 1.0 ? `, saves ${savedFmt.hours > 0 ? savedFmt.hours + 'h ' : ''}${savedFmt.minutes}m` : ''}`);

    card.innerHTML = `
      ${item.isPopular ? `
        <div class="speed-popular-tag">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Popular</span>
        </div>` : ''}
      <div class="speed-badge">${item.label}</div>
      <div class="speed-time">${fmt.text}</div>
      <div class="speed-saved">${item.speed === 1.0 ? 'Standard' : `Save ${savedFmt.hours > 0 ? savedFmt.hours + 'h ' : ''}${savedFmt.minutes}m`}</div>
    `;

    card.addEventListener('click', () => {
      activeSpeed = item.speed;
      if (customSpeedSlider) {
        customSpeedSlider.value = item.speed;
        updateCustomSpeedSliderFill(item.speed);
      }
      if (customSpeedDisplay) customSpeedDisplay.textContent = `${item.speed.toFixed(2)}x`;
      document.querySelectorAll('.speed-card').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-pressed', 'true');
      updateActiveTime();
      announceStatus(`Playback speed set to ${item.label}`);
    });

    grid.appendChild(card);
  });
}

// Get current total seconds based on selected/filtered videos
function getSelectedSeconds() {
  if (!playlistData) return 0;
  let total = 0;
  playlistData.videos.forEach((v, idx) => {
    if (selectedVideoIndices.has(idx)) {
      total += v.durationSeconds;
    }
  });
  return total;
}

// Update digital clock and active labels
function updateActiveTime() {
  const baseSecs = getSelectedSeconds();
  const effectiveSecs = Math.round(baseSecs / activeSpeed);
  const fmt = formatSecs(effectiveSecs);

  const speedLabel = document.getElementById('activeSpeedLabel');
  if (speedLabel) {
    speedLabel.textContent = `Total Watch Duration (${activeSpeed.toFixed(2)}x Speed • ${selectedVideoIndices.size} videos)`;
  }
  
  const digitDays = document.getElementById('digitDays');
  const digitBlockDays = document.getElementById('digitBlockDays');
  const separatorDays = document.getElementById('separatorDays');

  if (digitBlockDays && separatorDays && digitDays) {
    if (fmt.days > 0) {
      digitBlockDays.style.display = 'flex';
      separatorDays.style.display = 'inline';
      digitDays.textContent = padZero(fmt.days);
    } else {
      digitBlockDays.style.display = 'none';
      separatorDays.style.display = 'none';
    }
  }

  const dHours = document.getElementById('digitHours');
  if (dHours) dHours.textContent = padZero(fmt.hours);

  const dMins = document.getElementById('digitMins');
  if (dMins) dMins.textContent = padZero(fmt.minutes);

  const dSecs = document.getElementById('digitSecs');
  if (dSecs) dSecs.textContent = padZero(fmt.seconds);

  const verboseParts = [];
  if (fmt.days > 0) verboseParts.push(`${fmt.days} ${fmt.days === 1 ? 'day' : 'days'}`);
  if (fmt.hours > 0) verboseParts.push(`${fmt.hours} ${fmt.hours === 1 ? 'hour' : 'hours'}`);
  if (fmt.minutes > 0) verboseParts.push(`${fmt.minutes} ${fmt.minutes === 1 ? 'minute' : 'minutes'}`);
  if (fmt.seconds > 0 || verboseParts.length === 0) verboseParts.push(`${fmt.seconds} seconds`);

  const vText = document.getElementById('verboseDurationText');
  if (vText) vText.textContent = verboseParts.join(', ');

  // Update study schedule
  updateStudyPlan(effectiveSecs);
}


// Update dynamic slider track progress fill
function updateCustomSpeedSliderFill(val) {
  if (!customSpeedSlider) return;
  const current = val !== undefined ? parseFloat(val) : parseFloat(customSpeedSlider.value || 1.0);
  const min = parseFloat(customSpeedSlider.min) || 0.5;
  const max = parseFloat(customSpeedSlider.max) || 3.0;
  const pct = Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100));
  customSpeedSlider.style.setProperty('--slider-fill', `${pct}%`);
}

// Custom Slider listener
if (customSpeedSlider) {
  customSpeedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    activeSpeed = val;
    updateCustomSpeedSliderFill(val);
    if (customSpeedDisplay) customSpeedDisplay.textContent = `${val.toFixed(2)}x`;
    document.querySelectorAll('.speed-card').forEach(c => {
      const badge = c.querySelector('.speed-badge');
      const matches = badge && badge.textContent === `${val}x`;
      c.classList.toggle('active', matches);
      c.setAttribute('aria-pressed', matches ? 'true' : 'false');
    });
    updateActiveTime();
  });
}

// Study Plan Calculator with Edge Case & Year Support
function updateStudyPlan(totalSecs) {
  const daysCountEl = document.getElementById('studyDaysCount');
  const finishDateEl = document.getElementById('studyFinishDate');

  if (totalSecs === 0) {
    if (daysCountEl) daysCountEl.textContent = '0';
    if (finishDateEl) finishDateEl.textContent = 'Target completion: Select at least 1 video';
    return;
  }

  const totalMinutes = totalSecs / 60;
  const daysNeeded = (totalMinutes / dailyMins).toFixed(1);
  if (daysCountEl) daysCountEl.textContent = daysNeeded;

  const finishDate = new Date();
  const currentYear = finishDate.getFullYear();
  finishDate.setDate(finishDate.getDate() + Math.ceil(parseFloat(daysNeeded)));
  
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (finishDate.getFullYear() > currentYear) {
    dateOptions.year = 'numeric';
  }

  if (finishDateEl) {
    finishDateEl.textContent = `Target completion: ${finishDate.toLocaleDateString(undefined, dateOptions)}`;
  }
}

document.querySelectorAll('.study-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.study-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    dailyMins = parseInt(chip.getAttribute('data-mins'), 10);
    const label = document.getElementById('dailyTimeLabel');
    if (label) label.textContent = `${dailyMins} minutes/day`;
    updateActiveTime();
    announceStatus(`Daily study time set to ${dailyMins} minutes per day`);
  });
});

// Range Filter Logic with Validation
const rangeApplyBtn = document.getElementById('rangeApplyBtn');
if (rangeApplyBtn) {
  rangeApplyBtn.addEventListener('click', () => {
    if (!playlistData) return;
    const maxVideos = playlistData.videos.length;
    const start = parseInt(rangeStart.value, 10);
    const end = parseInt(rangeEnd.value, 10);

    if (isNaN(start) || isNaN(end)) {
      showToast('Please enter valid start and end video numbers.');
      return;
    }

    if (start < 1) {
      showToast('Start video number must be at least 1.');
      return;
    }

    if (end > maxVideos) {
      showToast(`End video number cannot exceed total videos (${maxVideos}).`);
      return;
    }

    if (start > end) {
      showToast(`Start number (#${start}) cannot be greater than end number (#${end}).`);
      return;
    }

    selectedVideoIndices.clear();
    for (let i = start - 1; i <= end - 1; i++) {
      selectedVideoIndices.add(i);
    }

    renderSpeedCards();
    renderVideoList();
    updateActiveTime();
    showToast(`Applied range: Videos #${start} to #${end}`);
    announceStatus(`Calculated range for videos #${start} to #${end}`);
  });
}

const rangeResetBtn = document.getElementById('rangeResetBtn');
if (rangeResetBtn) {
  rangeResetBtn.addEventListener('click', () => {
    if (!playlistData) return;
    selectedVideoIndices = new Set(playlistData.videos.map((_, i) => i));
    rangeStart.value = 1;
    rangeEnd.value = playlistData.videos.length;
    renderSpeedCards();
    renderVideoList();
    updateActiveTime();
    showToast('Reset to all videos');
    announceStatus('Reset to all videos');
  });
}

// Render Video List with Dynamic Badges & Accessible Checkboxes
function renderVideoList() {
  const container = document.getElementById('videoItemsList');
  if (!container || !playlistData) return;
  container.innerHTML = '';
  const filter = videoSearchInput ? videoSearchInput.value.toLowerCase().trim() : '';

  let visibleCount = 0;
  playlistData.videos.forEach((v, idx) => {
    if (filter && !v.title.toLowerCase().includes(filter)) return;
    visibleCount++;

    const isChecked = selectedVideoIndices.has(idx);
    const item = document.createElement('div');
    item.className = 'video-item';
    item.innerHTML = `
      <input type="checkbox" class="video-checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''} aria-label="Include video #${v.position}: ${v.title.replace(/"/g, '&quot;')}" style="cursor:pointer; width:18px; height:18px; accent-color: var(--brand-yt);" />
      <span class="video-pos">#${v.position}</span>
      <img src="${v.thumbnail || ''}" alt="" class="video-thumb-small" loading="lazy" aria-hidden="true" />
      <div class="video-title-wrap">
        <a href="https://www.youtube.com/watch?v=${v.id}&list=${playlistData.playlist.id}" target="_blank" rel="noopener noreferrer" class="video-title" title="${v.title}">
          ${v.title}
        </a>
      </div>
      <span class="video-item-dur">${v.duration}</span>
    `;

    const chk = item.querySelector('.video-checkbox');
    if (chk) {
      chk.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedVideoIndices.add(idx);
        } else {
          selectedVideoIndices.delete(idx);
        }
        renderSpeedCards();
        updateActiveTime();
      });
    }

    container.appendChild(item);
  });

  const badgeEl = document.getElementById('videoListBadge');
  if (badgeEl) {
    if (filter) {
      badgeEl.textContent = `${visibleCount} of ${playlistData.videos.length} videos`;
    } else {
      badgeEl.textContent = `${playlistData.videos.length} videos`;
    }
  }
}

if (videoSearchInput) {
  videoSearchInput.addEventListener('input', () => {
    renderVideoList();
  });
}

// Video List Drawer Toggle
const header = document.getElementById('videoListHeader');
const drawer = document.getElementById('videoListDrawer');
const chevron = document.getElementById('chevronIcon');
let drawerOpen = true;

if (header && drawer && chevron) {
  header.addEventListener('click', () => {
    drawerOpen = !drawerOpen;
    drawer.style.display = drawerOpen ? 'block' : 'none';
    chevron.style.transform = drawerOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    header.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  });
}

// Copy Summary Action
const copySummaryBtn = document.getElementById('copySummaryBtn');
if (copySummaryBtn) {
  copySummaryBtn.addEventListener('click', () => {
    if (!playlistData) return;
    const p = playlistData.playlist;
    const baseSecs = getSelectedSeconds();
    const normal = formatSecs(baseSecs);
    const at15 = formatSecs(baseSecs / 1.5);
    const at20 = formatSecs(baseSecs / 2.0);
    const atActive = formatSecs(baseSecs / activeSpeed);
    const savedAtActive = formatSecs(Math.max(0, baseSecs - baseSecs / activeSpeed));

    let summary = `🎬 ${p.title} (${selectedVideoIndices.size} of ${playlistData.videos.length} videos)\n`;
    summary += `👤 Channel: ${p.channelTitle}\n`;
    summary += `⏱️ Normal (1.0x): ${normal.text}\n`;
    if (Math.abs(activeSpeed - 1.0) > 0.01 && Math.abs(activeSpeed - 1.5) > 0.01 && Math.abs(activeSpeed - 2.0) > 0.01) {
      summary += `⚡ Selected (${activeSpeed.toFixed(2)}x Speed): ${atActive.text} (Save ${savedAtActive.text})\n`;
    }
    summary += `⚡ 1.5x Speed: ${at15.text} (Save ${formatSecs(baseSecs - baseSecs/1.5).text})\n`;
    summary += `🔥 2.0x Speed: ${at20.text} (Save ${formatSecs(baseSecs - baseSecs/2.0).text})\n`;
    summary += `🔗 https://www.youtube.com/playlist?list=${p.id}\n`;
    summary += `— Calculated via PlayPulse`;

    navigator.clipboard.writeText(summary).then(() => {
      trackEvent('copy_summary', { playlist_id: p.id });
      showToast('Formatted summary copied to clipboard!');
    });
  });
}

// Reset button
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (resultsDashboard) resultsDashboard.style.display = 'none';
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    activeSpeed = 1.0;
    if (customSpeedSlider) {
      customSpeedSlider.value = 1.0;
      updateCustomSpeedSliderFill(1.0);
    }
    if (customSpeedDisplay) customSpeedDisplay.textContent = '1.00x';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    announceStatus('Reset to start');
  });
}

// Recents in localStorage with SVG Clock Icon
function saveRecent(playlist) {
  try {
    let recents = JSON.parse(safeGetStorage('recent_playlists', '[]'));
    recents = recents.filter(r => r.id !== playlist.id);
    recents.unshift({
      id: playlist.id,
      title: playlist.title,
      videoCount: playlist.videoCount
    });
    recents = recents.slice(0, 4);
    safeSetStorage('recent_playlists', JSON.stringify(recents));
    renderRecents();
  } catch (e) {
    // Fail gracefully
  }
}

function renderRecents() {
  if (!recentsBar) return;
  try {
    const recents = JSON.parse(safeGetStorage('recent_playlists', '[]'));
    if (!recents.length) {
      recentsBar.style.display = 'none';
      return;
    }
    recentsBar.innerHTML = '<span class="preset-label">Recent:</span>';
    recents.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip';
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>${r.title.length > 25 ? r.title.substring(0, 25) + '...' : r.title} (${r.videoCount})</span>
      `;
      btn.addEventListener('click', () => {
        if (input) {
          input.value = `https://www.youtube.com/playlist?list=${r.id}`;
          if (clearBtn) clearBtn.style.display = 'inline-flex';
          form.dispatchEvent(new Event('submit'));
        }
      });
      recentsBar.appendChild(btn);
    });
    recentsBar.style.display = 'flex';
  } catch (e) {
    recentsBar.style.display = 'none';
  }
}

// Legal Modal Logic with Focus Trap & Inert
const legalModal = document.getElementById('legalModal');
const openPrivacyModalBtn = document.getElementById('openPrivacyModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalOkBtn = document.getElementById('modalOkBtn');

function openModal() {
  if (!legalModal) return;
  lastFocusedElement = document.activeElement;
  legalModal.classList.add('active');
  legalModal.setAttribute('aria-hidden', 'false');
  document.querySelector('.app-wrapper')?.setAttribute('inert', '');
  closeModalBtn?.focus();
}

function closeModal() {
  if (!legalModal) return;
  legalModal.classList.remove('active');
  legalModal.setAttribute('aria-hidden', 'true');
  document.querySelector('.app-wrapper')?.removeAttribute('inert');
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

if (openPrivacyModalBtn) openPrivacyModalBtn.addEventListener('click', openModal);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
if (legalModal) {
  legalModal.addEventListener('click', (e) => {
    if (e.target === legalModal) closeModal();
  });
  legalModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = legalModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && legalModal && legalModal.classList.contains('active')) {
    closeModal();
  }
});

// Initialize recents on page load
renderRecents();

// =============================================================================
// Scroll-Triggered Entrance Animations (ProjectX-inspired)
// =============================================================================
(function initReveal() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const revealEls = document.querySelectorAll('[data-reveal]');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // fire once
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -48px 0px',
    }
  );

  revealEls.forEach((el) => observer.observe(el));
})();

// Initialize slider track fill
updateCustomSpeedSliderFill(1.0);
