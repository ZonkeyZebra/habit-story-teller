import { CONFIG } from './config.js';
import { setToken } from './api.js';
export function initAuth(onSignedIn) {
  google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: r => { setToken(r.credential); onSignedIn(); } });
  google.accounts.id.renderButton(document.getElementById('signin'), { theme: 'outline', size: 'large' });
}
