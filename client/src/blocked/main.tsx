import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import BlockedPage from './BlockedPage.tsx';
import '../index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BlockedPage />
    </StrictMode>
  );
}
