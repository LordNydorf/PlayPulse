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

// Theme setup
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIconSun = document.getElementById('themeIconSun');
const themeIconMoon = document.getElementById('themeIconMoon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
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

const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode 🌓`);
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
  });
}

if (pasteBtn) {
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        input.value = text.trim();
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        showToast('Pasted URL from clipboard 📋');
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
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-emerald);">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

// Form Submission
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const playlistUrl = input.value.trim();
    if (!playlistUrl) return;

    // 1. Check client-side session cache for zero-latency response
    const cachedData = getClientCachedPlaylist(playlistUrl);
    if (cachedData) {
      playlistData = cachedData;
      selectedVideoIndices = new Set(cachedData.videos.map((_, i) => i));
      saveRecent(cachedData.playlist);
      renderDashboard();
      showToast('Playlist duration calculated successfully! ⚡');
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
      showToast('Playlist duration calculated successfully! ⚡');

    } catch (err) {
      if (errorMessageText) errorMessageText.textContent = err.message || 'Unable to fetch playlist data.';
      if (errorCard) errorCard.style.display = 'block';
      if (resultsDashboard) resultsDashboard.style.display = 'none';
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
    thumbEl.alt = p.title;
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

// Render Speed Matrix Cards
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

    const card = document.createElement('div');
    card.className = `speed-card ${activeSpeed === item.speed ? 'active' : ''}`;
    card.innerHTML = `
      ${item.isPopular ? '<div class="speed-popular-tag">🔥 Popular</div>' : ''}
      <div class="speed-badge">${item.label}</div>
      <div class="speed-time">${fmt.text}</div>
      <div class="speed-saved">${item.speed === 1.0 ? 'Standard' : `Save ${savedFmt.hours > 0 ? savedFmt.hours + 'h ' : ''}${savedFmt.minutes}m`}</div>
    `;

    card.addEventListener('click', () => {
      activeSpeed = item.speed;
      if (customSpeedSlider) customSpeedSlider.value = item.speed;
      if (customSpeedDisplay) customSpeedDisplay.textContent = `${item.speed.toFixed(2)}x`;
      document.querySelectorAll('.speed-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateActiveTime();
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

// Custom Slider listener
if (customSpeedSlider) {
  customSpeedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    activeSpeed = val;
    if (customSpeedDisplay) customSpeedDisplay.textContent = `${val.toFixed(2)}x`;
    document.querySelectorAll('.speed-card').forEach(c => {
      const badge = c.querySelector('.speed-badge');
      c.classList.toggle('active', badge && badge.textContent === `${val}x`);
    });
    updateActiveTime();
  });
}

// Study Plan Calculator
function updateStudyPlan(totalSecs) {
  const totalMinutes = totalSecs / 60;
  const daysNeeded = (totalMinutes / dailyMins).toFixed(1);
  const daysCountEl = document.getElementById('studyDaysCount');
  if (daysCountEl) daysCountEl.textContent = daysNeeded;

  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + Math.ceil(parseFloat(daysNeeded)));
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const finishDateEl = document.getElementById('studyFinishDate');
  if (finishDateEl) {
    finishDateEl.textContent = `Target completion by: ${finishDate.toLocaleDateString(undefined, options)}`;
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
  });
});

// Range Filter Logic
const rangeApplyBtn = document.getElementById('rangeApplyBtn');
if (rangeApplyBtn) {
  rangeApplyBtn.addEventListener('click', () => {
    if (!playlistData) return;
    const start = Math.max(1, parseInt(rangeStart.value, 10) || 1);
    const end = Math.min(playlistData.videos.length, parseInt(rangeEnd.value, 10) || playlistData.videos.length);

    selectedVideoIndices.clear();
    for (let i = start - 1; i <= end - 1; i++) {
      selectedVideoIndices.add(i);
    }

    renderSpeedCards();
    renderVideoList();
    updateActiveTime();
    showToast(`Applied range: Videos #${start} to #${end} 🎯`);
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
    showToast('Reset to all videos 🔄');
  });
}

// Render Video List
function renderVideoList() {
  const container = document.getElementById('videoItemsList');
  if (!container || !playlistData) return;
  container.innerHTML = '';
  const filter = videoSearchInput ? videoSearchInput.value.toLowerCase().trim() : '';

  playlistData.videos.forEach((v, idx) => {
    if (filter && !v.title.toLowerCase().includes(filter)) return;

    const isChecked = selectedVideoIndices.has(idx);
    const item = document.createElement('div');
    item.className = 'video-item';
    item.innerHTML = `
      <input type="checkbox" class="video-checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: var(--brand-yt);" />
      <span class="video-pos">#${v.position}</span>
      <img src="${v.thumbnail || ''}" alt="" class="video-thumb-small" loading="lazy" />
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

    const summary = `🎬 ${p.title} (${selectedVideoIndices.size} videos)
👤 Channel: ${p.channelTitle}
⏱️ Normal (1.0x): ${normal.text}
⚡ 1.5x Speed: ${at15.text} (Save ${formatSecs(baseSecs - baseSecs/1.5).text})
🔥 2.0x Speed: ${at20.text} (Save ${formatSecs(baseSecs - baseSecs/2.0).text})
🔗 https://www.youtube.com/playlist?list=${p.id}
— Calculated via PlayPulse`;

    navigator.clipboard.writeText(summary).then(() => {
      showToast('Formatted summary copied to clipboard! 📋');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Recents in localStorage
function saveRecent(playlist) {
  let recents = JSON.parse(localStorage.getItem('recent_playlists') || '[]');
  recents = recents.filter(r => r.id !== playlist.id);
  recents.unshift({
    id: playlist.id,
    title: playlist.title,
    videoCount: playlist.videoCount
  });
  recents = recents.slice(0, 4);
  localStorage.setItem('recent_playlists', JSON.stringify(recents));
  renderRecents();
}

function renderRecents() {
  if (!recentsBar) return;
  const recents = JSON.parse(localStorage.getItem('recent_playlists') || '[]');
  if (!recents.length) {
    recentsBar.style.display = 'none';
    return;
  }
  recentsBar.innerHTML = '<span class="preset-label">Recent:</span>';
  recents.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'preset-chip';
    btn.innerHTML = `<span>🕒</span> ${r.title.length > 25 ? r.title.substring(0, 25) + '...' : r.title} (${r.videoCount})`;
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
}

// Legal Modal Logic
const legalModal = document.getElementById('legalModal');
const openPrivacyModalBtn = document.getElementById('openPrivacyModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalOkBtn = document.getElementById('modalOkBtn');

function openModal() {
  if (!legalModal) return;
  legalModal.classList.add('active');
  legalModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  if (!legalModal) return;
  legalModal.classList.remove('active');
  legalModal.setAttribute('aria-hidden', 'true');
}

if (openPrivacyModalBtn) openPrivacyModalBtn.addEventListener('click', openModal);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
if (legalModal) {
  legalModal.addEventListener('click', (e) => {
    if (e.target === legalModal) closeModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && legalModal && legalModal.classList.contains('active')) closeModal();
});

// Initialize recents on page load
renderRecents();
