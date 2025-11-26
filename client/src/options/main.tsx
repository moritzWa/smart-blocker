import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Options from './Options.tsx';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>
);
