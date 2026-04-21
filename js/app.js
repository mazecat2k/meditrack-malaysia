// app.js — Main App Controller
window.Toast = {
  show(msg, type='info', duration=3500) {
    const container = document.getElementById('toast-container') || (() => { const d=document.createElement('div'); d.id='toast-container'; document.body.appendChild(d); return d; })();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(()=>toast.classList.add('toast-show'), 10);
    setTimeout(()=>{ toast.classList.remove('toast-show'); setTimeout(()=>toast.remove(), 400); }, duration);
  }
};

window.App = {
  user: null,

  async init() {
    try {
      console.log('[App] Starting init...');
      await DB.init();
      console.log('[App] DB ready. Checking auth...');
      this.user = await Auth.requireAuth();
      if (!this.user) { console.log('[App] No user, redirecting.'); return; }
      console.log('[App] User:', this.user.name, '(' + this.user.role + ')');
      this._setUserInfo();
      console.log('[App] Initializing map...');
      MapManager.init('map');

      // Trigger location prompt on startup
      console.log('[App] Requesting user location...');
      MapManager.getUserLocation().then(pos => {
        console.log('[App] Location obtained:', pos);
        MapManager.panTo(pos.lat, pos.lng, 13);
      }).catch(e => {
        console.warn('[App] Location denied or failed:', e.message);
      });

      console.log('[App] Loading dashboard...');
      await this._loadDashboard();
      console.log('[App] Binding nav...');
      this._bindNav();
      console.log('[App] ✅ Init complete!');
    } catch(err) {
      console.error('[App] ❌ INIT FAILED:', err);
      const panel = document.getElementById('side-panel');
      if (panel) panel.innerHTML = `<div style="padding:20px;color:#f44"><h3>⚠️ Error</h3><p>${err.message}</p><pre style="font-size:11px;overflow:auto">${err.stack}</pre></div>`;
    }
  },

  _setUserInfo() {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = this.user.name;
    if (roleEl) roleEl.textContent = { patient:'Patient / Public', hospital:'Hospital Authority', ambulance:'Ambulance Driver' }[this.user.role];
    if (avatarEl) avatarEl.textContent = { patient:'🧑', hospital:'🏥', ambulance:'🚑' }[this.user.role];
  },

  async _loadDashboard() {
    const role = this.user.role;
    // Init chatbot for all roles (may not be loaded yet if module is slow)
    if (window.Chatbot) Chatbot.init(this.user, null);

    if (role === 'patient') {
      await PatientDash.init(this.user);
    } else if (role === 'hospital') {
      await HospitalDash.init(this.user);
    } else if (role === 'ambulance') {
      await AmbulanceDash.init(this.user);
    }
    MapManager.invalidate();

    // Retry chatbot init if it wasn't ready on first try
    if (!window.Chatbot) {
      setTimeout(() => { if (window.Chatbot) Chatbot.init(this.user, null); }, 1000);
    }
  },

  _bindNav() {
    document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());
    document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
      document.getElementById('side-panel').classList.toggle('panel-hidden');
      MapManager.invalidate();
    });
    document.getElementById('btn-center-map')?.addEventListener('click', async () => {
      try {
        const pos = await MapManager.getUserLocation();
        MapManager.panTo(pos.lat, pos.lng, 14);
      } catch(e) { MapManager.panTo(4.2105, 109.4, 6); }
    });
  }
};

// window.addEventListener('DOMContentLoaded', () => App.init());
