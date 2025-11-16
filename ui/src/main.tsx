import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Debug HMR connection in Electron
if (import.meta.hot) {
	console.log('[HMR] Hot Module Replacement enabled');
	
	import.meta.hot.on('vite:css-update', (data) => {
		console.log('[HMR] CSS update received:', data);
	});
	
	import.meta.hot.on('vite:beforeUpdate', (payload) => {
		console.log('[HMR] Before update:', payload);
	});
	
	import.meta.hot.on('vite:afterUpdate', (payload) => {
		console.log('[HMR] After update:', payload);
	});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

