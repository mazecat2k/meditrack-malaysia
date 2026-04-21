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
    await DB.init();
    this.user = await Auth.requireAuth();
    if (!this.user) return;
    this._setUserInfo();
    MapManager.init('map');
    await this._loadDashboard();
    this._bindNav();
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
    // Init chatbot for all roles
    Chatbot.init(this.user, null);

    if (role === 'patient') {
      await PatientDash.init(this.user);
    } else if (role === 'hospital') {
      await HospitalDash.init(this.user);
    } else if (role === 'ambulance') {
      await AmbulanceDash.init(this.user);
    }
    MapManager.invalidate();
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
