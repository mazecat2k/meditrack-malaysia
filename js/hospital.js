// hospital.js — Hospital Authority Dashboard
const HospitalDash = {
  user: null,
  hospital: null,
  emergencyListener: null,

  async init(user) {
    this.user = user;
    this.hospital = await DB.getHospitalById(user.hospitalId);
    if (!this.hospital) { Toast.show('No hospital linked to your account.','error'); return; }
    
    // Subscribe to marker updates
    await MapManager.loadHospitals(h => this.showHospitalDetail(h));
    MapManager.panTo(this.hospital.lat, this.hospital.lng, 14);
    
    await this.renderPanel();
    this._subscribeToIncoming();
  },

  async renderPanel() {
    this.hospital = await DB.getHospitalById(this.user.hospitalId);
    const h = this.hospital;
    const erOpts = ['open','limited','full','critical'].map(v =>
      `<option value="${v}" ${h.erStatus===v?'selected':''}>${{open:'🟢 Open',limited:'🟡 Limited',full:'🔴 Full',critical:'🔴 Critical'}[v]}</option>`).join('');

    const panel = document.getElementById('side-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="panel-header">
        <h2>🏥 ${h.shortName}</h2>
        <p class="panel-sub">${h.city} · ${h.type==='public'?'Public':'Private'}</p>
      </div>

      <div class="hosp-stats-grid">
        <div class="h-stat-box status-open"><div class="h-stat-num" id="avail-display">${h.availableBeds}</div><div class="h-stat-lbl">Available Beds</div></div>
        <div class="h-stat-box"><div class="h-stat-num">${h.totalBeds}</div><div class="h-stat-lbl">Total Beds</div></div>
        <div class="h-stat-box"><div class="h-stat-num">${h.totalBeds - h.availableBeds}</div><div class="h-stat-lbl">Occupied</div></div>
        <div class="h-stat-box"><div class="h-stat-num">${Math.round((h.availableBeds/h.totalBeds)*100)}%</div><div class="h-stat-lbl">Vacancy Rate</div></div>
      </div>

      <div class="update-section">
        <h3 class="section-title">Update Vacancy</h3>
        <label class="form-label">Available Beds: <span id="slider-val">${h.availableBeds}</span></label>
        <input type="range" id="beds-slider" min="0" max="${h.totalBeds}" value="${h.availableBeds}" class="beds-slider"
          oninput="document.getElementById('slider-val').textContent=this.value">
        <label class="form-label">ER Status</label>
        <select id="er-status-sel" class="er-select">${erOpts}</select>
        <button class="save-btn" onclick="HospitalDash.saveVacancy()">💾 Update Now</button>
      </div>

      <div class="incoming-section">
        <h3 class="section-title">Incoming Patients</h3>
        <div id="incoming-list" class="incoming-list">...</div>
      </div>

      <div class="all-hospitals-section">
        <h3 class="section-title">All Hospitals Overview</h3>
        <div id="all-hosp-list" class="all-hosp-list">...</div>
      </div>`;
    await this._refreshIncomingUI();
    await this._refreshAllHospitalsUI();
  },

  async _refreshIncomingUI() {
    const el = document.getElementById('incoming-list');
    if (el) el.innerHTML = await this._renderIncoming();
  },

  async _refreshAllHospitalsUI() {
    const el = document.getElementById('all-hosp-list');
    if (el) el.innerHTML = await this._renderAllHospitals();
  },

  async _renderIncoming() {
    const ems = await DB.getEmergencies();
    const emergencies = ems.filter(e => e.hospitalId===this.hospital.id && ['dispatched','en_route'].includes(e.status));
    if (!emergencies.length) return '<p class="empty-msg">No incoming patients right now.</p>';
    
    // Map over emergencies and fetch ambulance info for each
    const cards = await Promise.all(emergencies.map(async e => {
      const amb = await DB.getAmbulanceById(e.ambulanceId);
      const elapsed = Math.round((Date.now() - e.timestamp) / 60000);
      return `<div class="incoming-card">
        <div class="incoming-icon">🚑</div>
        <div class="incoming-info">
          <div class="inc-title">Patient incoming via ${amb?.name||'Ambulance'}</div>
          <div class="inc-sub">${elapsed} min ago · ${amb?.vehicleNo||''}</div>
        </div>
      </div>`;
    }));
    return cards.join('');
  },

  async _renderAllHospitals() {
    const hospitals = await DB.getHospitals();
    return hospitals.map(h => {
      const cls = h.erStatus==='full'||h.availableBeds===0?'status-full':h.availableBeds<=15||h.erStatus==='limited'?'status-limited':'status-open';
      return `<div class="mini-hosp-card" onclick="MapManager.panTo(${h.lat},${h.lng},14)">
        <span class="mini-hosp-name">${h.shortName}</span>
        <span class="mini-hosp-badge ${cls}">${h.availableBeds} beds</span>
      </div>`;
    }).join('');
  },

  async saveVacancy() {
    const beds = parseInt(document.getElementById('beds-slider').value);
    const er = document.getElementById('er-status-sel').value;
    await DB.updateHospital(this.hospital.id, { availableBeds:beds, erStatus:er });
    this.hospital = await DB.getHospitalById(this.hospital.id);
    Toast.show('✅ Vacancy updated successfully!','success');
    document.getElementById('avail-display').textContent = beds;
  },

  showHospitalDetail(h) {
    MapManager.panTo(h.lat, h.lng, 15);
    Toast.show(`Viewing: ${h.name}`, 'info');
  },

  _subscribeToIncoming() {
    if (this.emergencyListener) this.emergencyListener();
    this.emergencyListener = db.collection(DB.K.EMERGENCIES)
      .where('hospitalId', '==', this.hospital.id)
      .onSnapshot(async () => {
         await this._refreshIncomingUI();
      });
  },

  destroy() { if(this.emergencyListener) this.emergencyListener(); }
};
