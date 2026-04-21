// patient.js — Patient Dashboard Logic
window.PatientDash = {
  user: null,
  userLat: 3.1412, userLng: 101.6865,
  activeEmergency: null,
  simInterval: null,
  etaSeconds: 0,
  emergencyListener: null,

  async init(user) {
    this.user = user;
    this.activeEmergency = await DB.getActiveByPatient(user.id);
    this.renderPanel();
    await this._locateUser();
    
    // Subscribe to marker updates (now handled in map.js load functions)
    await MapManager.loadHospitals(h => this.showHospitalDetail(h));
    await MapManager.loadAmbulances(false); 
    
    if (this.activeEmergency) {
      this._subscribeToEmergency(this.activeEmergency.id);
      this._renderTracker(await DB.getAmbulanceById(this.activeEmergency.ambulanceId));
    }
  },

  async _locateUser() {
    try {
      const pos = await MapManager.getUserLocation();
      this.userLat = pos.lat; this.userLng = pos.lng;
    } catch(e) {}
    
    // Spawn local ambulances if there are less than 3 within 30km (for Demo)
    const ambs = await DB.getAmbulances();
    const nearAmbs = ambs.filter(a => DB.distKm(this.userLat, this.userLng, a.lat, a.lng) < 30);
    if (nearAmbs.length < 3) {
      for (let i = nearAmbs.length; i < 3; i++) {
        const offsetLat = (Math.random() - 0.5) * 0.05;
        const offsetLng = (Math.random() - 0.5) * 0.05;
        await DB.addAmbulance({ 
          id: DB.genId(), driverId: null, 
          vehicleNo: 'MED ' + Math.floor(Math.random()*9000+1000), 
          name: `Local Unit ${i+1}`, status: 'available', 
          lat: this.userLat + offsetLat, lng: this.userLng + offsetLng, 
          currentEmergencyId: null 
        });
      }
    }

    MapManager.setPatientMarker(this.userLat, this.userLng, '📍 You');
    MapManager.panTo(this.userLat, this.userLng, 12);
    await this._refreshHospitalList();
  },

  renderPanel() {
    const panel = document.getElementById('side-panel');
    panel.innerHTML = `
      <div class="panel-header">
        <h2>🏥 Nearby Hospitals</h2>
        <p class="panel-sub">Tap a hospital to see details</p>
      </div>
      <div id="sos-area" class="sos-area">
        <button id="sos-btn" class="sos-btn" onclick="PatientDash.callAmbulance()">
          <span class="sos-icon">🚨</span>
          <span>CALL AMBULANCE</span>
        </button>
      </div>
      <div id="emergency-tracker" class="emergency-tracker hidden"></div>
      <div id="hospital-list" class="hospital-list"></div>
      <div id="hospital-detail" class="hospital-detail hidden"></div>`;
    this._refreshHospitalList();
  },

  async _refreshHospitalList() {
    const list = document.getElementById('hospital-list');
    if (!list) return;
    const hospitalsAll = await DB.getHospitals();
    const hospitals = hospitalsAll
      .map(h => ({ ...h, dist: DB.distKm(this.userLat, this.userLng, h.lat, h.lng) }))
      .sort((a,b) => a.dist - b.dist)
      .slice(0, 10);
    list.innerHTML = hospitals.map(h => this._hospitalCard(h)).join('');
  },

  _hospitalCard(h) {
    const pct = Math.round((h.availableBeds / h.totalBeds) * 100);
    const cls = h.erStatus==='full'||h.availableBeds===0 ? 'status-full' : h.availableBeds<=15||h.erStatus==='limited' ? 'status-limited' : 'status-open';
    const label = h.erStatus==='full'||h.availableBeds===0 ? '🔴 Full' : h.availableBeds<=15||h.erStatus==='limited' ? `🟡 Limited` : '🟢 Available';
    return `<div class="hosp-card" onclick="PatientDash.showHospitalDetailById('${h.id}')">
      <div class="hosp-card-top">
        <span class="hosp-name">${h.shortName}</span>
        <span class="hosp-badge ${cls}">${label}</span>
      </div>
      <div class="hosp-card-row">
        <span class="hosp-city">📍 ${h.city}</span>
        <span class="hosp-dist">${h.dist.toFixed(1)} km away</span>
      </div>
      <div class="vacancy-bar-wrap">
        <div class="vacancy-bar"><div class="vacancy-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="vacancy-text">${h.availableBeds}/${h.totalBeds} beds</span>
      </div>
    </div>`;
  },

  async showHospitalDetailById(id) {
    const h = await DB.getHospitalById(id);
    this.showHospitalDetail(h);
  },

  showHospitalDetail(h) {
    if (!h) return;
    MapManager.panTo(h.lat, h.lng, 15);
    const detail = document.getElementById('hospital-detail');
    const list = document.getElementById('hospital-list');
    if (!detail || !list) return;
    const dist = DB.distKm(this.userLat, this.userLng, h.lat, h.lng);
    const pct = Math.round((h.availableBeds / h.totalBeds) * 100);
    const cls = h.erStatus==='full'||h.availableBeds===0 ? 'status-full' : h.availableBeds<=15||h.erStatus==='limited' ? 'status-limited' : 'status-open';
    const erLabel = { open:'🟢 ER Open', limited:'🟡 ER Limited', full:'🔴 ER Full', critical:'🔴 ER Critical' }[h.erStatus] || h.erStatus;
    detail.innerHTML = `
      <button class="back-btn" onclick="PatientDash.closeDetail()">← Back</button>
      <h3 class="detail-name">${h.name}</h3>
      <p class="detail-addr">📍 ${h.address}</p>
      <p class="detail-phone">📞 <a href="tel:${h.phone}">${h.phone}</a></p>
      <p class="detail-dist">🗺️ ${dist.toFixed(1)} km from your location</p>
      <div class="detail-stats">
        <div class="stat-box ${cls}"><div class="stat-num">${h.availableBeds}</div><div class="stat-lbl">Available Beds</div></div>
        <div class="stat-box"><div class="stat-num">${h.totalBeds}</div><div class="stat-lbl">Total Beds</div></div>
        <div class="stat-box"><div class="stat-num">${erLabel}</div><div class="stat-lbl">ER Status</div></div>
      </div>
      <div class="vacancy-bar-wrap"><div class="vacancy-bar"><div class="vacancy-fill ${cls}" style="width:${pct}%"></div></div></div>
      <div class="detail-type-badge">${h.type==='public'?'🏛️ Public Hospital':'🏥 Private Hospital'}</div>`;
    list.classList.add('hidden');
    detail.classList.remove('hidden');
  },

  closeDetail() {
    document.getElementById('hospital-detail')?.classList.add('hidden');
    document.getElementById('hospital-list')?.classList.remove('hidden');
  },

  async callAmbulance() {
    if (this.activeEmergency) { Toast.show('You already have an active emergency!','warn'); return; }
    const ambulance = await MapManager.getNearestAvailableAmbulance(this.userLat, this.userLng);
    if (!ambulance) { Toast.show('No ambulances available right now. Please call 999 directly.','error'); return; }
    
    const emergency = {
      id: DB.genId(), patientId: this.user.id, ambulanceId: ambulance.id,
      hospitalId: null, status:'dispatched',
      patientLat: this.userLat, patientLng: this.userLng,
      timestamp: Date.now(), arrivalTime: null
    };
    
    await DB.addEmergency(emergency);
    await DB.updateAmbulance(ambulance.id, { status:'busy', currentEmergencyId:emergency.id });
    this.activeEmergency = emergency;
    this._subscribeToEmergency(emergency.id);
    
    Toast.show('🚑 Calculating routing...','info');
    const route = await MapManager.drawRoute([ambulance.lat, ambulance.lng], [this.userLat, this.userLng]);
    this.etaSeconds = route.duration;
    
    Toast.show('🚑 Ambulance dispatched! Help is on the way.','success');
    document.getElementById('sos-btn').disabled = true;
    document.getElementById('sos-btn').textContent = '🚑 Ambulance Dispatched';
    
    this._startSimulation(ambulance.id, route.path);
    this._renderTracker(ambulance);
    const ctx = `Patient at (${this.userLat.toFixed(4)}, ${this.userLng.toFixed(4)}) called an ambulance. ${ambulance.name} (${ambulance.vehicleNo}) is on the way, ETA ~${Math.round(this.etaSeconds/60)} min. Patient will choose destination hospital after pickup.`;
    if (window.Chatbot) Chatbot.updateContext(ctx);
  },

  _subscribeToEmergency(id) {
    if (this.emergencyListener) this.emergencyListener();
    this.emergencyListener = DB.subscribeDoc(DB.K.EMERGENCIES, id, data => {
      if (!data) return;
      
      // If driver marked as arrived
      if (data.status === 'arrived' && this.activeEmergency?.status !== 'arrived') {
        this._onAmbulanceArrived(data.ambulanceId);
      }
      // If completed or cancelled by driver/system
      if (data.status === 'completed' || data.status === 'cancelled') {
        this._resetEmergencyUI();
      }
      this.activeEmergency = data;
    });
  },

  async _renderTracker(ambulance) {
    const tracker = document.getElementById('emergency-tracker');
    if (!tracker || !ambulance) return;
    tracker.classList.remove('hidden');
    tracker.innerHTML = `
      <div class="tracker-card">
        <div class="tracker-title">🚑 Ambulance En Route to You</div>
        <div class="tracker-row"><span>Unit:</span><strong>${ambulance.name} (${ambulance.vehicleNo})</strong></div>
        <div class="tracker-row"><span>Status:</span><strong>Coming to your location</strong></div>
        <div class="tracker-row"><span>ETA:</span><strong id="eta-display">${this._fmtEta(this.etaSeconds)}</strong></div>
        <div class="tracker-bar-wrap"><div class="tracker-bar" id="tracker-bar"></div></div>
        <button class="cancel-btn" onclick="PatientDash.cancelEmergency()">Cancel Emergency</button>
      </div>`;
  },

  _startSimulation(ambulanceId, path) {
    if (this.simInterval) clearInterval(this.simInterval);
    const realEta = this.etaSeconds; // real ETA from OSRM
    const demoSteps = Math.min(Math.max(60, Math.round(realEta / 15)), 120); // 60-120 demo steps
    let steps = 0;

    this.simInterval = setInterval(async () => {
      steps++;
      const pct = Math.min(1, steps / demoSteps);
      const pathIdx = Math.min(path.length - 1, Math.floor(pct * path.length));
      const [newLat, newLng] = path[pathIdx];
      
      // Update Firestore so the driver/others see the movement
      try { await DB.updateAmbulance(ambulanceId, { lat:newLat, lng:newLng }); } catch(e) { console.warn('Amb update error:', e.message); }
      
      // Show real ETA counting down proportionally
      const remainingEta = Math.max(0, Math.round(realEta * (1 - pct)));
      const etaEl = document.getElementById('eta-display');
      const barEl = document.getElementById('tracker-bar');
      if (etaEl) etaEl.textContent = this._fmtEta(remainingEta);
      if (barEl) barEl.style.width = Math.min(100, pct * 100) + '%';
      
      if (steps >= demoSteps) {
        clearInterval(this.simInterval);
        this._onAmbulanceArrived(ambulanceId);
      }
    }, 1000);
  },

  async _onAmbulanceArrived(ambulanceId) {
    if (this.simInterval) clearInterval(this.simInterval);
    Toast.show('🚑 Ambulance arrived! Please choose a hospital.', 'success');
    if (this.activeEmergency && this.activeEmergency.status !== 'arrived') {
       await DB.updateEmergency(this.activeEmergency.id, { status:'arrived', arrivalTime:Date.now() });
    }
    MapManager.clearRoute();
    const tracker = document.getElementById('emergency-tracker');
    if (tracker) tracker.innerHTML = await this._renderHospitalPicker(ambulanceId);
  },

  async _renderHospitalPicker(ambulanceId) {
    const hospitalsAll = await DB.getHospitals();
    const hospitals = hospitalsAll
      .map(h => ({ ...h, dist: DB.distKm(this.userLat, this.userLng, h.lat, h.lng) }))
      .sort((a,b) => {
        const aFull = a.erStatus==='full'||a.availableBeds===0;
        const bFull = b.erStatus==='full'||b.availableBeds===0;
        if (aFull !== bFull) return aFull ? 1 : -1;
        return a.dist - b.dist;
      });
    const cls  = h => h.erStatus==='full'||h.availableBeds===0 ? 'status-full' : h.availableBeds<=15||h.erStatus==='limited' ? 'status-limited' : 'status-open';
    const badge = h => h.erStatus==='full'||h.availableBeds===0 ? '🔴 Full' : h.availableBeds<=15||h.erStatus==='limited' ? `🟡 ${h.availableBeds} beds` : `🟢 ${h.availableBeds} beds`;
    return `<div class="hospital-picker">
      <div class="picker-arrived">🚑 Ambulance Arrived!</div>
      <div class="picker-title">Choose your destination hospital:</div>
      <div class="picker-list">
        ${hospitals.map(h => {
          const isFull = h.erStatus==='full'||h.availableBeds===0;
          return `<div class="hosp-pick-card${isFull?' pick-disabled':''}" ${!isFull?`onclick="PatientDash.selectHospital('${h.id}','${ambulanceId}')"`:''} title="${isFull?'Hospital is full':h.name}">
            <div class="pick-top">
              <span class="pick-name">${h.shortName}</span>
              <span class="pick-badge ${cls(h)}">${badge(h)}</span>
            </div>
            <div class="pick-row">
              <span>📍 ${h.city}</span>
              <span>🗺️ ${h.dist.toFixed(1)} km</span>
              <span>📞 ${h.phone}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  async selectHospital(hospitalId, ambulanceId) {
    const hospital = await DB.getHospitalById(hospitalId);
    if (!hospital || !this.activeEmergency) return;
    const upd = { hospitalId, status:'en_route' };
    await DB.updateEmergency(this.activeEmergency.id, upd);
    this.activeEmergency = { ...this.activeEmergency, ...upd };
    
    Toast.show('🏥 Calculating route to hospital...','info');
    const route = await MapManager.drawRoute([this.userLat, this.userLng], [hospital.lat, hospital.lng]);
    this.etaSeconds = route.duration; // real ETA in seconds from OSRM
    
    // Show route from patient → hospital
    MapManager.setPatientMarker(this.userLat, this.userLng, '🚑 You (in ambulance)');
    MapManager.panTo((this.userLat+hospital.lat)/2, (this.userLng+hospital.lng)/2, 11);
    
    const distToHosp = DB.distKm(this.userLat, this.userLng, hospital.lat, hospital.lng);
    const etaMin = Math.round(this.etaSeconds / 60);
    Toast.show(`🏥 Heading to ${hospital.shortName}! ETA ~${etaMin} min`, 'info');
    
    if (window.Chatbot) {
      Chatbot.updateContext(`Patient in ambulance heading to ${hospital.name}. Distance: ${distToHosp.toFixed(1)} km, ETA ~${etaMin} min. ER status: ${hospital.erStatus}.`);
    }
    this._renderEnRouteTracker(hospital);
    this._startHospitalSim(ambulanceId, hospital, route.path);
  },

  _renderEnRouteTracker(hospital) {
    const tracker = document.getElementById('emergency-tracker');
    if (!tracker) return;
    const erLabel = {open:'🟢 Open',limited:'🟡 Limited',full:'🔴 Full',critical:'🔴 Critical'}[hospital.erStatus] || hospital.erStatus;
    tracker.innerHTML = `
      <div class="tracker-card phase-two">
        <div class="tracker-phase-label">Phase 2 — To Hospital</div>
        <div class="tracker-title">🏥 En Route to ${hospital.shortName}</div>
        <div class="tracker-row"><span>Hospital:</span><strong>${hospital.name}</strong></div>
        <div class="tracker-row"><span>ER Status:</span><strong>${erLabel}</strong></div>
        <div class="tracker-row"><span>Beds Free:</span><strong>${hospital.availableBeds} / ${hospital.totalBeds}</strong></div>
        <div class="tracker-row"><span>ETA:</span><strong id="eta-display">${this._fmtEta(this.etaSeconds)}</strong></div>
        <div class="tracker-bar-wrap"><div class="tracker-bar phase-bar" id="tracker-bar"></div></div>
        <div class="tracker-addr">📍 ${hospital.address}</div>
      </div>`;
  },

  _startHospitalSim(ambulanceId, hospital, path) {
    if (this.simInterval) clearInterval(this.simInterval);
    const realEta = this.etaSeconds; // real ETA from OSRM
    const demoSteps = Math.min(Math.max(60, Math.round(realEta / 15)), 120); // 60-120 demo steps
    let steps = 0;
    
    console.log(`[Sim] Hospital sim: ${realEta}s real ETA, compressed to ${demoSteps} demo steps`);
    
    this.simInterval = setInterval(async () => {
      steps++;
      const pct = Math.min(1, steps / demoSteps);
      const pathIdx = Math.min(path.length - 1, Math.floor(pct * path.length));
      const [currentLat, currentLng] = path[pathIdx];
      
      try { await DB.updateAmbulance(ambulanceId, { lat:currentLat, lng:currentLng }); } catch(e) { console.warn('Amb update error:', e.message); }
      
      // Show real ETA counting down proportionally
      const remainingEta = Math.max(0, Math.round(realEta * (1 - pct)));
      const etaEl = document.getElementById('eta-display');
      const barEl = document.getElementById('tracker-bar');
      if (etaEl) etaEl.textContent = this._fmtEta(remainingEta);
      if (barEl) barEl.style.width = Math.min(100, pct * 100) + '%';
      
      if (steps >= demoSteps) {
        clearInterval(this.simInterval);
        this._onHospitalArrival(ambulanceId, hospital);
      }
    }, 1000);
  },

  async _onHospitalArrival(ambulanceId, hospital) {
    Toast.show(`✅ Arrived at ${hospital.shortName}!`, 'success');
    await DB.updateAmbulance(ambulanceId, { status:'available', currentEmergencyId:null, lat:hospital.lat, lng:hospital.lng });
    if (this.activeEmergency) await DB.updateEmergency(this.activeEmergency.id, { status:'completed' });
    this._resetEmergencyUI();
    const tracker = document.getElementById('emergency-tracker');
    if (tracker) tracker.innerHTML = `<div class="arrived-box">✅ Arrived at ${hospital.shortName}!<br><small>Please proceed to the Emergency Department.</small></div>`;
  },

  async cancelEmergency() {
    if (!this.activeEmergency) return;
    if (this.simInterval) clearInterval(this.simInterval);
    await DB.updateAmbulance(this.activeEmergency.ambulanceId, { status:'available', currentEmergencyId:null });
    await DB.updateEmergency(this.activeEmergency.id, { status:'cancelled' });
    this._resetEmergencyUI();
    Toast.show('Emergency cancelled.','info');
  },

  _resetEmergencyUI() {
    this.activeEmergency = null;
    if (this.simInterval) clearInterval(this.simInterval);
    MapManager.clearRoute();
    MapManager.removePatientMarker();
    const tracker = document.getElementById('emergency-tracker');
    if (tracker) tracker.classList.add('hidden');
    const btn = document.getElementById('sos-btn');
    if (btn) { btn.disabled=false; btn.innerHTML='<span class="sos-icon">🚨</span><span>CALL AMBULANCE</span>'; }
  },

  _fmtEta(s) { const m=Math.floor(s/60), sec=s%60; return `${m}m ${sec}s`; },

  destroy() {
    if (this.emergencyListener) this.emergencyListener();
    if (this.simInterval) clearInterval(this.simInterval);
  }
};
