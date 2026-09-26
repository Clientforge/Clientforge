import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import G2gPublicApp from './g2gPublicApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <G2gPublicApp />
  </StrictMode>,
);
