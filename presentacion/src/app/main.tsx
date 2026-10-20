import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Notes } from './Notes';

// `?notas`: la ventana del expositor; sin nada, la proyección.
const notes = new URLSearchParams(window.location.search).has('notas');
createRoot(document.getElementById('root')!).render(notes ? <Notes /> : <App />);
