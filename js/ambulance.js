// ambulance.js — Ambulance Driver Dashboard
const AmbulanceDash = {
  user: null,
  ambulance: null,
  emergency: null,
  pollInterval: null,

  init(user) {
    this.user = user;
    this.ambulance = DB.getAmbulanceByDriver(user.id);
    if (!this.ambulance) { Toast.show('No ambulance linked to your account.','error'); return; }
    this.emergency = DB.getActiveByAmbulance(this.ambulance.id);
    MapManager.loadHospitals(null);
    MapManager.loadAmbulances(true);
    MapManager.panTo(this.ambulance.lat, this.ambulance.lng, 13);
    this.renderPanel();
    this._startPolling();
  },

  renderPanel() {
    this.ambulance = DB.getAmbulanceByDriver(this.user.id);
    this.emergency = DB.getActiveByAmbulance(this.ambulance.id);
    const a = this.ambulance;
    const statusOpts = ['available','busy','off_duty'].map(v =>
      `<option value="${v}" ${a.status===v?'selected':''}>${{available:'🟢 Available',busy:'🟠 Busy',off_duty:'⚫ Off Duty'}[v]}</option>`).join('');

    const panel = document.getElementById('side-panel');
    panel.innerHTML = `
      <div class="panel-header">
        <h2>🚑 ${a.name}</h2>
        <p class="panel-sub">Vehicle: ${a.vehicleNo}</p>
      </div>

      <div class="amb-status-card">
        <label class="form-label">My Status</label>
        <select id="amb-status-sel" class="er-select" onchange="AmbulanceDash.updateStatus(this.value)">${statusOpts}</select>
        <div class="amb-status-indicator status-${a.status}">
          ${{available:'🟢 You are AVAILABLE for dispatch',busy:'🟠 You are currently BUSY',off_duty:'⚫ You are OFF DUTY'}[a.status]}
        </div>
      </div>

      <div class="loc-section">
        <h3 class="section-title">📍 My Location</h3>
        <div class="loc-coords">${a.lat.toFixed(4)}°N, ${a.lng.toFixed(4)}°E</div>
        <button class="save-btn" onclick="AmbulanceDash.updateLocation()">📡 Update My Location</button>
      </div>

      <div id="dispatch-section"><div class="dispatch-empty"><div class="dispatch-icon">⏳</div><p>Syncing...</p></div></div>

      <div class="amb-stats-section">
        <h3 class="section-title">Today's Stats</h3>
        <div class="amb-stats-grid">
          <div class="a-stat-box"><div class="a-stat-num">${this._countCompleted()}</div><div class="a-stat-lbl">Completed</div></div>
          <div class="a-stat-box"><div class="a-stat-num">${a.status==='available'?'YES':'NO'}</div><div class="a-stat-lbl">Available</div></div>
        </div>
      </div>`;
    this.updateDispatchUI();
  },

  async updateDispatchUI() {
    const ds = document.getElementById('dispatch-section');
    if (!ds) return;
    
    if (!this.emergency) {
      ds.innerHTML = `<div class="dispatch-empty"><div class="dispatch-icon">📡</div><p>No active dispatch.<br>Waiting for calls…</p></div>`;
      return;
    }
    const e = this.emergency;
    const patient = DB.getUserById(e.patientId);
    const hospital = e.hospitalId ? DB.getHospitalById(e.hospitalId) : null;

    // ── Phase 1: Ambulance going TO patient ──────────────────────
    if (e.status === 'dispatched') {
      const dist = DB.distKm(this.ambulance.lat, this.ambulance.lng, e.patientLat, e.patientLng);
      MapManager.setPatientMarker(e.patientLat, e.patientLng, '🚨 Patient');
      const route = await MapManager.drawRoute([this.ambulance.lat, this.ambulance.lng], [e.patientLat, e.patientLng]);
      const eta = Math.round(route.duration / 60);
      
      setTimeout(() => Chatbot.updateContext(`Driver responding to patient at (${e.patientLat.toFixed(4)}, ${e.patientLng.toFixed(4)}). ETA ~${eta} min.`), 100);
      ds.innerHTML = `<div class="dispatch-active">
        <div class="dispatch-title">🚨 EN ROUTE TO PATIENT</div>
        <div class="dispatch-row"><span>Patient:</span><strong>${patient?.name||'Unknown'}</strong></div>
        <div class="dispatch-row"><span>Location:</span><strong>${e.patientLat.toFixed(4)}°N, ${e.patientLng.toFixed(4)}°E</strong></div>
        <div class="dispatch-row"><span>Distance:</span><strong>${dist.toFixed(1)} km</strong></div>
        <div class="dispatch-row"><span>ETA:</span><strong>~${eta} min</strong></div>
        <button class="arrive-btn" onclick="AmbulanceDash.markArrivedAtPatient()">✅ Mark Arrived at Patient</button>
      </div>`;
      return;
    }

    // ── Phase 2: At patient, waiting for hospital pick ───────────
    if (e.status === 'arrived') {
      MapManager.setPatientMarker(e.patientLat, e.patientLng, '🚑 Patient on board');
      MapManager.clearRoute();
      ds.innerHTML = `<div class="dispatch-active" style="border-color:var(--amber)">
        <div class="dispatch-title" style="color:var(--amber)">⏳ WAITING — PATIENT CHOOSING HOSPITAL</div>
        <div class="dispatch-row"><span>Patient:</span><strong>${patient?.name||'Unknown'}</strong></div>
        <div class="dispatch-row"><span>Status:</span><strong>Patient selecting destination hospital</strong></div>
        <p style="font-size:12px;color:var(--text2);margin-top:8px">Stay at patient location. Hospital destination will appear once selected.</p>
      </div>`;
      return;
    }

    // ── Phase 3: Ambulance going TO hospital ─────────────────────
    if (e.status === 'en_route' && hospital) {
      const dist = DB.distKm(this.ambulance.lat, this.ambulance.lng, hospital.lat, hospital.lng);
      MapManager.setPatientMarker(e.patientLat, e.patientLng, '🚑 Pickup point');
      const route = await MapManager.drawRoute([this.ambulance.lat, this.ambulance.lng], [hospital.lat, hospital.lng]);
      const eta = Math.round(route.duration / 60);

      setTimeout(() => Chatbot.updateContext(`Driver heading to ${hospital.name} with patient. Distance: ${dist.toFixed(1)} km, ETA ~${eta} min.`), 100);
      ds.innerHTML = `<div class="dispatch-active" style="border-color:var(--accent)">
        <div class="dispatch-title" style="color:var(--accent)">🏥 EN ROUTE TO HOSPITAL</div>
        <div class="dispatch-row"><span>Patient:</span><strong>${patient?.name||'Unknown'}</strong></div>
        <div class="dispatch-row"><span>Hospital:</span><strong>${hospital.shortName}</strong></div>
        <div class="dispatch-row"><span>Address:</span><strong>${hospital.address}</strong></div>
        <div class="dispatch-row"><span>Distance:</span><strong>${dist.toFixed(1)} km</strong></div>
        <div class="dispatch-row"><span>ETA:</span><strong>~${eta} min</strong></div>
        <button class="arrive-btn" onclick="AmbulanceDash.arriveAtHospital()">✅ Mark Arrived at Hospital</button>
      </div>`;
      return;
    }

    ds.innerHTML = `<div class="dispatch-empty"><div class="dispatch-icon">✅</div><p>No active dispatch.</p></div>`;
  },


  updateStatus(status) {
    DB.updateAmbulance(this.ambulance.id, { status });
    this.ambulance = DB.getAmbulanceByDriver(this.user.id);
    MapManager.upsertAmbulanceMarker(this.ambulance);
    const ind = document.querySelector('.amb-status-indicator');
    if (ind) {
      ind.className = `amb-status-indicator status-${status}`;
      ind.textContent = {available:'🟢 You are AVAILABLE for dispatch',busy:'🟠 You are currently BUSY',off_duty:'⚫ You are OFF DUTY'}[status];
    }
    Toast.show(`Status updated to ${status.replace('_',' ')}`, 'success');
  },

  async updateLocation() {
    try {
      const pos = await MapManager.getUserLocation();
      DB.updateAmbulance(this.ambulance.id, { lat:pos.lat, lng:pos.lng });
      this.ambulance = DB.getAmbulanceByDriver(this.user.id);
      MapManager.moveAmbulanceTo(this.ambulance.id, pos.lat, pos.lng);
      MapManager.panTo(pos.lat, pos.lng, 14);
      const coords = document.querySelector('.loc-coords');
      if (coords) coords.textContent = `${pos.lat.toFixed(4)}°N, ${pos.lng.toFixed(4)}°E`;
      Toast.show('📍 Location updated!','success');
      if (this.emergency) MapManager.drawRoute([pos.lat, pos.lng], [this.emergency.patientLat, this.emergency.patientLng]);
    } catch(e) { Toast.show('Could not get location.','error'); }
  },

  markArrivedAtPatient() {
    if (!this.emergency) return;
    // Set status to 'arrived' — patient will see hospital picker
    DB.updateEmergency(this.emergency.id, { status:'arrived', arrivalTime:Date.now() });
    this.emergency = DB.getActiveByAmbulance(this.ambulance.id);
    MapManager.clearRoute();
    Toast.show('✅ Marked arrived at patient. Waiting for hospital selection.','success');
    this.renderPanel();
  },

  arriveAtHospital() {
    if (!this.emergency) return;
    const hospital = this.emergency.hospitalId ? DB.getHospitalById(this.emergency.hospitalId) : null;
    DB.updateEmergency(this.emergency.id, { status:'completed' });
    DB.updateAmbulance(this.ambulance.id, { status:'available', currentEmergencyId:null,
      lat: hospital?.lat || this.ambulance.lat,
      lng: hospital?.lng || this.ambulance.lng });
    this.emergency = null;
    MapManager.clearRoute();
    MapManager.removePatientMarker();
    Toast.show(`✅ Arrived at ${hospital?.shortName||'hospital'}!`,'success');
    this.renderPanel();
  },

  _countCompleted() {
    return DB.getEmergencies().filter(e => e.ambulanceId===this.ambulance.id && e.status==='completed').length;
  },

  _startPolling() {
    this.pollInterval = setInterval(() => {
      const prevId = this.emergency?.id;
      const prevStatus = this.emergency?.status;
      this.emergency = DB.getActiveByAmbulance(this.ambulance.id);
      if (this.emergency?.id !== prevId || this.emergency?.status !== prevStatus) {
        this.updateDispatchUI();
      }
    }, 3000);
  },

  destroy() { if(this.pollInterval) clearInterval(this.pollInterval); }
};
