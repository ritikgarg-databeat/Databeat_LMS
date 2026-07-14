import { RouterProvider } from 'react-router-dom';

import { router } from '@/routes/router';

/** Root application component: renders the route tree. All context providers wrap this in main.tsx. */
function App() {
  return <RouterProvider router={router} />;
}

export default App;
