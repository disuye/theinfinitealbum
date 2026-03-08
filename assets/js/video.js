/* ── SMPLR YouTube Embed ── */

(function () {
  'use strict';

  const CHANNEL_ID = 'UCjrNDV1WvaW5gBPP2HzFt8A';
  const FEED_URL   = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;

  // Fallback if RSS fetch fails — update this periodically
  const FALLBACK_VIDEO_ID = 'YwvuMDLzr74';

  // CORS proxies (free/public — swap for your own proxy in production)
  const CORS_PROXIES = [
    function (url) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); },
    function (url) { return 'https://corsproxy.io/?url=' + encodeURIComponent(url); },
  ];

  var container = document.getElementById('smplr');
  var overlay   = document.getElementById('smplrOverlay');
  var loading   = document.getElementById('smplrLoading');
  var errorEl   = document.getElementById('smplrError');
  var player    = null;

  // ── Fetch latest video ID from channel RSS ──
  async function fetchLatestVideoId() {
    for (var i = 0; i < CORS_PROXIES.length; i++) {
      try {
        var proxyUrl = CORS_PROXIES[i](FEED_URL);
        var res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        var text = await res.text();
        var match = text.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        if (match && match[1]) {
          console.log('[SMPLR] Latest video ID: ' + match[1]);
          return match[1];
        }
      } catch (e) {
        console.warn('[SMPLR] Proxy failed:', e.message);
      }
    }
    console.warn('[SMPLR] All proxies failed, using fallback ID');
    return null;
  }

  // ── Load the YT IFrame API ──
  function loadYTApi() {
    return new Promise(function (resolve) {
      if (window.YT && window.YT.Player) return resolve();
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = resolve;
    });
  }

  // ── Create the player ──
  function createPlayer(videoId) {
    var playerDiv = document.createElement('div');
    playerDiv.id = 'smplrPlayer';
    container.insertBefore(playerDiv, container.firstChild);

    player = new YT.Player('smplrPlayer', {
      videoId: videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
        disablekb: 0,
        fs: 1,
      },
      events: {
        onReady: function () {
          loading.classList.add('hidden');
          player.playVideo();
        },
        onError: function (e) {
          console.error('[SMPLR] Player error:', e.data);
          loading.classList.add('hidden');
          errorEl.style.display = 'flex';
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) {
            errorEl.style.display = 'flex';
          }
        },
      },
    });
  }

  // ── Click-to-unmute ──
  overlay.addEventListener('click', function () {
    if (player && typeof player.unMute === 'function') {
      player.unMute();
      player.setVolume(33);
    }
    overlay.classList.add('hidden');
  });

  // ── Init ──
  async function init() {
    try {
      var results = await Promise.all([fetchLatestVideoId(), loadYTApi()]);
      createPlayer(results[0] || FALLBACK_VIDEO_ID);
    } catch (e) {
      console.error('[SMPLR] Init error:', e);
      loading.classList.add('hidden');
      errorEl.style.display = 'flex';
    }
  }

  init();
})();
