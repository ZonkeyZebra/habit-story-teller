// Sign-in page: after Google confirms the user, go to the app page.
import { CONFIG } from './config.js';
import { setToken, hasToken } from './api.js';
if (hasToken()) location.replace('index.html');
// Show the scene the person picked in Settings (saved in this browser), or the default city.
try { document.body.dataset.scene = JSON.parse(localStorage.getItem('hst') || '{}').settings?.scene || 'city'; } catch { /* keep default */ }
function go() {
  google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: r => { setToken(r.credential); location.replace('index.html'); } });
  google.accounts.id.renderButton(document.getElementById('signin'), { theme: 'outline', size: 'large' });
}
const wait = () => window.google?.accounts?.id ? go() : setTimeout(wait, 100);
wait();
