import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject({
  mode: 'auto', // auto-detect development vs production
  debug: false  // set to true to enable debug logging
});
