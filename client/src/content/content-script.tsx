// Content Script - Runs on every page, checks if blocked and shows overlay
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import BlockOverlay from './BlockOverlay.tsx';
import cssText from '../index.css?inline';

console.log('Smart Blocker content script loaded on:', window.location.href);

let overlayRoot: ReturnType<typeof createRoot> | null = null;
let overlayElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

// Check if current site should be blocked
async function checkAndBlock() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_BLOCKED',
      url: window.location.href,
    });

    if (response.blocked) {
      showBlockOverlay();
    }
  } catch (error) {
    console.error('Smart Blocker error:', error);
  }
}

function showBlockOverlay() {
  // Don't create duplicate overlays
  if (overlayElement) {
    return;
  }

  console.log('🚫 Showing block overlay with Shadow DOM');

  // Create overlay container
  overlayElement = document.createElement('div');
  overlayElement.id = 'smart-blocker-overlay-root';
  document.documentElement.appendChild(overlayElement);

  // Create Shadow DOM for CSS isolation
  shadowRoot = overlayElement.attachShadow({ mode: 'open' });

  // Inject Tailwind CSS into Shadow DOM
  const style = document.createElement('style');
  style.textContent = cssText;
  shadowRoot.appendChild(style);

  // Fix for Tailwind v4 Shadow DOM bug: manually define @property variables
  const fixStyle = document.createElement('style');
  fixStyle.textContent = `
    :host {
      --tw-border-style: solid;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-color: initial;
      --tw-ring-shadow: 0 0 #0000;
      --tw-ring-color: currentColor;
      --tw-ring-offset-shadow: 0 0 #0000;
    }
  `;
  shadowRoot.appendChild(fixStyle);
  console.log('CSS injected into Shadow DOM, length:', cssText.length);

  // Create React root container inside Shadow DOM
  const reactRoot = document.createElement('div');
  shadowRoot.appendChild(reactRoot);

  // Render React component
  overlayRoot = createRoot(reactRoot);
  overlayRoot.render(
    <StrictMode>
      <BlockOverlay
        hostname={window.location.hostname}
        onUnblock={handleUnblock}
        onGoBack={() => window.history.back()}
      />
    </StrictMode>
  );
}

function removeOverlay() {
  if (overlayRoot) {
    overlayRoot.unmount();
    overlayRoot = null;
  }
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}

async function handleUnblock(minutes: number) {
  const domain = window.location.hostname.replace(/^www\./, '');

  console.log(`Requesting unblock for ${domain} for ${minutes} minutes`);

  const response = await chrome.runtime.sendMessage({
    type: 'UNBLOCK_SITE',
    domain,
    minutes,
  });

  if (response.success) {
    console.log('✅ Unblock successful, reloading page');
    removeOverlay();
    location.reload();
  }
}

// Run check when page loads
checkAndBlock();
