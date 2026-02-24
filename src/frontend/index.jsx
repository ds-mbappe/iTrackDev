import React from 'react';
import ForgeReconciler from '@forge/react';
import AccordionPanel from './components/AccordionPanel';

/**
 * Frontend entrypoint kept intentionally small.
 * Business logic and UI building blocks live in dedicated modules under
 * `components/` and `helpers/` to keep maintenance friction low.
 */
function App() {
  return <AccordionPanel />;
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
