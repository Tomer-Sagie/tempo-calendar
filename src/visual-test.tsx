import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { VisualTestPage } from './components/VisualTestPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VisualTestPage />
  </StrictMode>,
);
