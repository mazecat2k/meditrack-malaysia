// map.js — Leaflet Map Management
window.MapManager = {
  map: null,
  hospitalMarkers: {},
  ambulanceMarkers: {},
  patientMarker: null,
  routeLine: null,
  userMarker: null,

  init(containerId) {
    this.map = L.map(containerId, { zoomControl:false, attributionControl:true }).setView([4.2105, 109.4], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
      subdomains:'abcd', maxZoom:19
    }).addTo(this.map);
    L.control.zoom({ position:'bottomright' }).addTo(this.map);
    return this.map;
  },

  // ── Hospital Markers ─────────────────────────────────────────
  async loadHospitals(onClickCb) {
    // One-time initial load
    const hospitals = await DB.getHospitals();
    hospitals.forEach(h => this.upsertHospitalMarker(h, onClickCb));

    // Listen for real-time updates
    DB.subscribe(DB.K.HOSPITALS, hospitals => {
      hospitals.forEach(h => this.upsertHospitalMarker(h, onClickCb));
    });
  },

  upsertHospitalMarker(h, onClickCb) {
    const icon = this._hospitalIcon(h);
    if (this.hospitalMarkers[h.id]) {
      this.hospitalMarkers[h.id].setIcon(icon).setLatLng([h.lat, h.lng]);
    } else {
      const m = L.marker([h.lat, h.lng], { icon }).addTo(this.map);
      m.bindTooltip(`<b>${h.shortName}</b><br>${this._vacancyLabel(h)}`, { permanent:false, direction:'top', className:'map-tooltip' });
      if (onClickCb) m.on('click', () => onClickCb(h));
      this.hospitalMarkers[h.id] = m;
    }
  },

  async refreshHospitalMarker(hospitalId, onClickCb) {
    const h = await DB.getHospitalById(hospitalId);
    if (h) this.upsertHospitalMarker(h, onClickCb);
  },

  _hospitalIcon(h) {
    const color = h.erStatus==='open' && h.availableBeds>20 ? '#22c55e' : h.erStatus==='full' || h.availableBeds===0 ? '#ef4444' : '#f59e0b';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
      <path d="M18 0C8 0 0 8 0 18c0 12 18 24 18 24S36 30 36 18C36 8 28 0 18 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="18" y="22" text-anchor="middle" fill="white" font-size="14" font-family="Arial" font-weight="bold">+</text>
    </svg>`;
    return L.divIcon({ html:svg, className:'', iconSize:[36,42], iconAnchor:[18,42], popupAnchor:[0,-42] });
  },

  _vacancyLabel(h) {
    if (h.erStatus==='full' || h.availableBeds===0) return '🔴 Full';
    if (h.availableBeds<=15 || h.erStatus==='limited') return `🟡 Limited (${h.availableBeds} beds)`;
    return `🟢 Available (${h.availableBeds} beds)`;
  },

  // ── Ambulance Markers ─────────────────────────────────────────
  async loadAmbulances(showAll) {
    // Initial Load
    const ambulances = await DB.getAmbulances();
    ambulances.forEach(a => {
      if (showAll || a.status !== 'off_duty') this.upsertAmbulanceMarker(a);
    });

    // Listen for real-time updates
    DB.subscribe(DB.K.AMBULANCES, ambulances => {
      ambulances.forEach(a => {
        if (showAll || a.status !== 'off_duty') {
          this.upsertAmbulanceMarker(a);
        } else {
          this.removeAmbulanceMarker(a.id);
        }
      });
    });
  },

  upsertAmbulanceMarker(a) {
    const icon = this._ambulanceIcon(a.status);
    if (this.ambulanceMarkers[a.id]) {
      this.ambulanceMarkers[a.id].setIcon(icon).setLatLng([a.lat, a.lng]);
    } else {
      const m = L.marker([a.lat, a.lng], { icon }).addTo(this.map);
      m.bindTooltip(`🚑 ${a.name}<br>${a.vehicleNo}`, { permanent:false, direction:'top', className:'map-tooltip' });
      this.ambulanceMarkers[a.id] = m;
    }
  },

  removeAmbulanceMarker(id) {
    if (this.ambulanceMarkers[id]) { this.map.removeLayer(this.ambulanceMarkers[id]); delete this.ambulanceMarkers[id]; }
  },

  async moveAmbulanceTo(id, lat, lng) {
    if (this.ambulanceMarkers[id]) this.ambulanceMarkers[id].setLatLng([lat, lng]);
    else { const a = await DB.getAmbulanceById(id); if(a) { a.lat=lat; a.lng=lng; this.upsertAmbulanceMarker(a); } }
  },

  _ambulanceIcon(status) {
    const color = status==='available'?'#22c55e': status==='busy'?'#f97316':'#6b7280';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect x="2" y="2" width="36" height="36" rx="8" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="20" y="26" text-anchor="middle" fill="white" font-size="20">🚑</text>
    </svg>`;
    return L.divIcon({ html:svg, className:'', iconSize:[40,40], iconAnchor:[20,20] });
  },

  // ── Patient / User Marker ─────────────────────────────────────
  setPatientMarker(lat, lng, label) {
    const icon = L.divIcon({ html:`<div class="pulse-ring"><div class="pulse-dot"></div></div>`, className:'', iconSize:[30,30], iconAnchor:[15,15] });
    if (this.patientMarker) this.map.removeLayer(this.patientMarker);
    this.patientMarker = L.marker([lat,lng],{icon}).addTo(this.map);
    if (label) this.patientMarker.bindTooltip(label, {permanent:true, direction:'top', className:'map-tooltip patient-tooltip'}).openTooltip();
    return this.patientMarker;
  },

  removePatientMarker() { if(this.patientMarker){ this.map.removeLayer(this.patientMarker); this.patientMarker=null; } },

  // ── Route Line ───────────────────────────────────────────────
  async drawRoute(from, to) {
    this.clearRoute();
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok') throw new Error('OSRM mapping failed');
      
      const latlngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const duration = Math.round(data.routes[0].duration); // exact seconds from OSRM
      
      this.routeLine = L.polyline(latlngs, { color:'#00b4d8', weight:4, dashArray:'8,6', opacity:0.85 }).addTo(this.map);
      this.map.fitBounds(L.latLngBounds(latlngs).pad(0.05));
      return { path: latlngs, duration };
    } catch(e) {
      console.error(e);
      // Fallback to straight line
      this.routeLine = L.polyline([from, to], { color:'#00b4d8', weight:4, dashArray:'8,6', opacity:0.85 }).addTo(this.map);
      this.map.fitBounds(L.latLngBounds([from,to]).pad(0.25));
      const dur = Math.round(DB.distKm(from[0],from[1],to[0],to[1]) / 60 * 3600);
      return { path: [from, to], duration: dur };
    }
  },

  clearRoute() { if(this.routeLine){ this.map.removeLayer(this.routeLine); this.routeLine=null; } },

  // ── Utilities ─────────────────────────────────────────────────
  panTo(lat, lng, zoom) { this.map.setView([lat,lng], zoom||15); },

  getUserLocation(requireExact = false) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        if (requireExact) reject(new Error('Geolocation not supported'));
        else resolve({ lat: 3.1412, lng: 101.6865 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        err => {
          if (requireExact) reject(err);
          else resolve({ lat: 3.1412, lng: 101.6865 });
        },
        requireExact ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } : undefined
      );
    });
  },

  invalidate() { if(this.map) setTimeout(()=>this.map.invalidateSize(),200); },

  async getNearestHospital(lat, lng) {
    const hospitals = (await DB.getHospitals()).filter(h=>h.erStatus!=='full' && h.availableBeds>0);
    if (!hospitals.length) return null;
    return hospitals.reduce((best,h) => {
      const d = DB.distKm(lat, lng, h.lat, h.lng);
      return (!best || d < best.dist) ? {...h, dist:d} : best;
    }, null);
  },

  async getNearestAvailableAmbulance(lat, lng) {
    const ambs = (await DB.getAmbulances()).filter(a=>a.status==='available');
    if (!ambs.length) return null;
    return ambs.reduce((best,a) => {
      const d = DB.distKm(lat, lng, a.lat, a.lng);
      return (!best || d < best.dist) ? {...a, dist:d} : best;
    }, null);
  }

};
