// ambulance.js — Ambulance Driver Dashboard
const AmbulanceDash = {
  user: null,
  ambulance: null,
  emergency: null,
  ambulanceListener: null,
  emergencyListener: null,

  async init(user) {
    this.user = user;
    this.ambulance = await DB.getAmbulanceByDriver(user.id);
    if (!this.ambulance) { Toast.show('No ambulance linked to your account.','error'); return; }
    this.emergency = await DB.getActiveByAmbulance(this.ambulance.id);
    
    // Subscribe to marker updates (now handled in map.js load functions)
    await MapManager.loadHospitals(null);
    await MapManager.loadAmbulances(true);
    MapManager.panTo(this.ambulance.lat, this.ambulance.lng, 13);
    
    this.renderPanel();
    this._subscribeToAmbulance();
  },

  async renderPanel() {
    this.ambulance = await DB.getAmbulanceByDriver(this.user.id);
    this.emergency = await DB.getActiveByAmbulance(this.ambulance.id);
    const a = this.ambulance;
    const statusOpts = ['available','busy','off_duty'].map(v =>
      `<option value="${v}" ${a.status===v?'selected':''}>${{available:'🟢 Available',busy:'🟠 Busy',off_duty:'⚫ Off Duty'}[v]}</option>`).join('');

    const panel = document.getElementById('side-panel');
    if (!panel) return;
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
          <div class="a-stat-box"><div class="a-stat-num" id="stat-completed">...</div><div class="a-stat-lbl">Completed</div></div>
          <div class="a-stat-box"><div class="a-stat-num">${a.status==='available'?'YES':'NO'}</div><div class="a-stat-lbl">Available</div></div>
        </div>
      </div>`;
    this.updateDispatchUI();
    this._updateCompletedCount();
  },

  async _updateCompletedCount() {
    const num = await this._countCompleted();
    const el = document.getElementById('stat-completed');
    if (el) el.textContent = num;
  },

  async updateDispatchUI() {
    const ds = document.getElementById('dispatch-section');
    if (!ds) return;
    
    if (!this.emergency) {
      ds.innerHTML = `<div class="dispatch-empty"><div class="dispatch-icon">📡</div><p>No active dispatch.<br>Waiting for calls…</p></div>`;
      return;
    }
    const e = this.emergency;
    const patient = await DB.getUserById(e.patientId);
    const hospital = e.hospitalId ? await DB.getHospitalById(e.hospitalId) : null;

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


  async updateStatus(status) {
    await DB.updateAmbulance(this.ambulance.id, { status });
    this.ambulance = await DB.getAmbulanceByDriver(this.user.id);
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
      await DB.updateAmbulance(this.ambulance.id, { lat:pos.lat, lng:pos.lng });
      this.ambulance = await DB.getAmbulanceByDriver(this.user.id);
      MapManager.panTo(pos.lat, pos.lng, 14);
      const coords = document.querySelector('.loc-coords');
      if (coords) coords.textContent = `${pos.lat.toFixed(4)}°N, ${pos.lng.toFixed(4)}°E`;
      Toast.show('📍 Location updated!','success');
      if (this.emergency) await MapManager.drawRoute([pos.lat, pos.lng], [this.emergency.patientLat, this.emergency.patientLng]);
    } catch(e) { Toast.show('Could not get location.','error'); }
  },

  async markArrivedAtPatient() {
    if (!this.emergency) return;
    await DB.updateEmergency(this.emergency.id, { status:'arrived', arrivalTime:Date.now() });
    this.emergency = await DB.getActiveByAmbulance(this.ambulance.id);
    MapManager.clearRoute();
    Toast.show('✅ Marked arrived at patient. Waiting for hospital selection.','success');
    this.renderPanel();
  },

  async arriveAtHospital() {
    if (!this.emergency) return;
    const hospital = this.emergency.hospitalId ? await DB.getHospitalById(this.emergency.hospitalId) : null;
    await DB.updateEmergency(this.emergency.id, { status:'completed' });
    await DB.updateAmbulance(this.ambulance.id, { 
      status:'available', 
      currentEmergencyId:null,
      lat: hospital?.lat || this.ambulance.lat,
      lng: hospital?.lng || this.ambulance.lng 
    });
    this.emergency = null;
    if (this.emergencyListener) { this.emergencyListener(); this.emergencyListener = null; }
    MapManager.clearRoute();
    MapManager.removePatientMarker();
    Toast.show(`✅ Arrived at ${hospital?.shortName||'hospital'}!`,'success');
    this.renderPanel();
  },

  async _countCompleted() {
    const ems = await DB.getEmergencies();
    return ems.filter(e => e.ambulanceId===this.ambulance.id && e.status==='completed').length;
  },

  _subscribeToAmbulance() {
     if (this.ambulanceListener) this.ambulanceListener();
     this.ambulanceListener = DB.subscribeDoc(DB.K.AMBULANCES, this.ambulance.id, async data => {
        if (!data) return;
        
        const prevEmergencyId = this.ambulance?.currentEmergencyId;
        this.ambulance = data;

        if (data.currentEmergencyId && data.currentEmergencyId !== prevEmergencyId) {
          this.emergency = await DB.getEmergency(data.currentEmergencyId);
          this._subscribeToEmergency(data.currentEmergencyId);
          this.updateDispatchUI();
          Toast.show('🚨 NEW DISPATCH RECEIVED!', 'success', 6000);
        } else if (!data.currentEmergencyId && prevEmergencyId) {
          this.emergency = null;
          if (this.emergencyListener) { this.emergencyListener(); this.emergencyListener = null; }
          this.updateDispatchUI();
        }
     });
  },

  _subscribeToEmergency(id) {
    if (this.emergencyListener) this.emergencyListener();
    this.emergencyListener = DB.subscribeDoc(DB.K.EMERGENCIES, id, data => {
      if (!data) return;
      if (data.status !== this.emergency?.status || data.hospitalId !== this.emergency?.hospitalId) {
        this.emergency = data;
        this.updateDispatchUI();
      }
    });
  },

  destroy() { 
    if(this.ambulanceListener) this.ambulanceListener(); 
    if(this.emergencyListener) this.emergencyListener();
  }
};
