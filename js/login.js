// Sign-in page: Google confirms the user, the Worker issues a 30-day session, then we go to the app.
import { CONFIG } from './config.js';
import { signInWithGoogle, hasToken } from './api.js';
if (hasToken()) location.replace('index.html');
// Show the scene the person picked in Settings (saved in this browser), or the default city.
try { document.body.dataset.scene = JSON.parse(localStorage.getItem('hst') || '{}').settings?.scene || 'city'; } catch { /* keep default */ }

// The app sends people here with ?r=<reason> so the page can say why they are back.
const reason = new URLSearchParams(location.search).get('r') || '';
const MSG = {
  expired: ['Your session timed out. Sign in again to pick up where you left off.', 'info'],
  signedout: ['You are signed out.', 'info'],
  notallowed: ['This Google account has not been invited yet. Ask the app owner to add your email, or choose a different Google account.', 'error'],
  network: ['Could not reach the server. Check your connection and try again.', 'error'],
  error: ['Sign-in did not work. Please try again.', 'error']
};
const box = document.getElementById('login-msg');
function say(code) {
  const [text, kind] = MSG[code] || [code, 'info'];
  box.textContent = text; box.className = kind; box.hidden = false;
}
if (MSG[reason]) say(reason);

function go() {
  // After a sign-out or a refused account, skip auto sign-in so people are not signed straight back in.
  const quiet = reason === 'signedout' || reason === 'notallowed';
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    auto_select: !quiet,
    cancel_on_tap_outside: false,
    callback: async r => {
      say('Signing you in...');
      try { await signInWithGoogle(r.credential); location.replace('index.html'); }
      catch (e) { google.accounts.id.disableAutoSelect(); google.accounts.id.cancel(); say(MSG[e.code] ? e.code : 'error'); }
    }
  });
  google.accounts.id.renderButton(document.getElementById('signin'), { theme: 'outline', size: 'large', text: 'continue_with' });
  if (quiet) google.accounts.id.disableAutoSelect(); else google.accounts.id.prompt();
}
const wait = () => window.google?.accounts?.id ? go() : setTimeout(wait, 100);
wait();
