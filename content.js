// Content script - injects the main spoofing script into Netflix pages
(function() {
  'use strict';

  const injectScript = () => {
    if (document.getElementById('netflix-4k-inject')) return;

    const script = document.createElement('script');
    script.id = 'netflix-4k-inject';
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  };

  // Inject immediately
  injectScript();

  // Track state
  let lastUrl = location.href;
  let lastVideoId = null;

  // Extract video ID from URL
  const getVideoId = () => {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  };

  // Signal the injected script to reinit
  const signalReinit = (reason) => {
    console.log(`Netflix 4K Enabler: Signaling reinit (${reason})`);
    window.postMessage({ type: 'NETFLIX_4K_REINIT', reason }, '*');
  };

  // Check for navigation
  const checkNavigation = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const videoId = getVideoId();

      if (location.pathname.startsWith('/watch')) {
        // On a watch page
        if (videoId !== lastVideoId) {
          // New video
          lastVideoId = videoId;
          signalReinit(`new video ${videoId}`);
        } else {
          // Same video, URL still changed
          signalReinit('watch URL changed');
        }
      } else {
        // Left watch page
        lastVideoId = null;
      }
    }
  };

  // Poll for URL changes (backup)
  setInterval(checkNavigation, 200);

  // Listen for popstate
  window.addEventListener('popstate', () => {
    setTimeout(checkNavigation, 50);
  });

  // Intercept history methods
  const wrapHistory = (method) => {
    const original = history[method];
    history[method] = function(...args) {
      const result = original.apply(this, args);
      setTimeout(checkNavigation, 50);
      return result;
    };
  };

  wrapHistory('pushState');
  wrapHistory('replaceState');

  // Watch for player container being added (backup signal)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          // Check for Netflix player indicators
          if (node.classList && (
            node.classList.contains('watch-video') ||
            node.classList.contains('VideoContainer') ||
            node.classList.contains('nf-player-container') ||
            node.id === 'appMountPoint'
          )) {
            signalReinit('player container detected');
          }
          // Check for video element
          if (node.tagName === 'VIDEO' || node.querySelector?.('video')) {
            signalReinit('video element detected');
          }
        }
      }
    }
  });

  // Start observing once body exists
  const startObserver = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startObserver, 50);
    }
  };
  startObserver();

  // Initial video ID
  lastVideoId = getVideoId();

  console.log('Netflix 4K Enabler: Content script loaded');
})();
