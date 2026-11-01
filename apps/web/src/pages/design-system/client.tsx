import { hydrateRoot } from 'react-dom/client';
import DesignSystemPage from './page';

/* The gallery is the kit's contract. It hydrates as one root because every
   showcase is a live component; the landing page keeps its island boundary. */
const root = document.getElementById('app');
if (root) hydrateRoot(root, <DesignSystemPage />);
