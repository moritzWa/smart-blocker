import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import BlockedPage from './BlockedPage.tsx';
import '../index.css';

// Dark mode detection
const applyDarkMode = () => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Apply on load
applyDarkMode();

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkMode);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BlockedPage />
    </StrictMode>
  );
}
