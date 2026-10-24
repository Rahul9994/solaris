import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/fonts.css';
import './styles/app.css';

const q = new URLSearchParams(location.search);

if (import.meta.env.DEV && q.has('lab')) {
  import('./cine/lab').then((m) => m.runLab());
} else {
  createRoot(document.getElementById('root')!).render(<App />);
}
