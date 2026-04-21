// data.js — Central data store (Firebase Firestore)
const GEMINI_API_KEY = window.CONFIG?.GEMINI_API_KEY || '';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNZyxbGhtg9IVS_COT62aMeNmsz0KH_80",
  authDomain: "meditrack-malaysia.firebaseapp.com",
  projectId: "meditrack-malaysia",
  storageBucket: "meditrack-malaysia.firebasestorage.app",
  messagingSenderId: "937921025720",
  appId: "1:937921025720:web:d90a1cfde21e966db8c64d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DB = {
  K: { USERS:'users', HOSPITALS:'hospitals', AMBULANCES:'ambulances', EMERGENCIES:'emergencies', SESSION:'hmt_session' },

  async init() {
    // Check if hospitals exist, if not seed them
    const hSnap = await db.collection(this.K.HOSPITALS).limit(1).get();
    if (hSnap.empty) {
      console.log('Seeding hospitals to Firebase...');
      for (const h of SEED_HOSPITALS) await db.collection(this.K.HOSPITALS).doc(h.id).set(h);
    }
    
    // Check if ambulances exist, if not seed them
    const aSnap = await db.collection(this.K.AMBULANCES).limit(1).get();
    if (aSnap.empty) {
      console.log('Seeding ambulances to Firebase...');
      for (const a of SEED_AMBULANCES) await db.collection(this.K.AMBULANCES).doc(a.id).set(a);
    }

    // users and emergencies are typically seeded as needed
    const uSnap = await db.collection(this.K.USERS).limit(1).get();
    if (uSnap.empty) {
      console.log('Seeding demo users to Firebase...');
      for (const u of SEED_USERS) await db.collection(this.K.USERS).doc(u.id).set(u);
    }
  },

  // ── Generic Wrapper ──────────────────────────────────────────
  _getLocal(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  _setLocal(k, v) { localStorage.setItem(k, JSON.stringify(v)); },

  // ── User Methods ─────────────────────────────────────────────
  async getUsers() {
    const snap = await db.collection(this.K.USERS).get();
    return snap.docs.map(d => d.data());
  },
  async getUserByEmail(email) {
    const snap = await db.collection(this.K.USERS).where('email', '==', email.toLowerCase()).get();
    return snap.empty ? null : snap.docs[0].data();
  },
  async getUserById(id) {
    const doc = await db.collection(this.K.USERS).doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async addUser(u) {
    await db.collection(this.K.USERS).doc(u.id).set(u);
  },
  async updateUser(id, upd) {
    await db.collection(this.K.USERS).doc(id).update(upd);
    return this.getUserById(id);
  },

  // ── Hospital Methods ─────────────────────────────────────────
  async getHospitals() {
    const snap = await db.collection(this.K.HOSPITALS).get();
    return snap.docs.map(d => d.data());
  },
  async getHospitalById(id) {
    const doc = await db.collection(this.K.HOSPITALS).doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async updateHospital(id, upd) {
    await db.collection(this.K.HOSPITALS).doc(id).update(upd);
    return this.getHospitalById(id);
  },

  // ── Ambulance Methods ────────────────────────────────────────
  async getAmbulances() {
    const snap = await db.collection(this.K.AMBULANCES).get();
    return snap.docs.map(d => d.data());
  },
  async getAmbulanceById(id) {
    const doc = await db.collection(this.K.AMBULANCES).doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async getAmbulanceByDriver(dId) {
    const snap = await db.collection(this.K.AMBULANCES).where('driverId', '==', dId).get();
    return snap.empty ? null : snap.docs[0].data();
  },
  async updateAmbulance(id, upd) {
    await db.collection(this.K.AMBULANCES).doc(id).update(upd);
    return this.getAmbulanceById(id);
  },
  async addAmbulance(a) {
    await db.collection(this.K.AMBULANCES).doc(a.id).set(a);
  },

  // ── Emergency Methods ────────────────────────────────────────
  async getEmergencies() {
    const snap = await db.collection(this.K.EMERGENCIES).get();
    return snap.docs.map(d => d.data());
  },
  async getEmergencyById(id) {
    const doc = await db.collection(this.K.EMERGENCIES).doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async addEmergency(e) {
    await db.collection(this.K.EMERGENCIES).doc(e.id).set(e);
    return e;
  },
  async updateEmergency(id, upd) {
    await db.collection(this.K.EMERGENCIES).doc(id).update(upd);
    return this.getEmergencyById(id);
  },
  async getActiveByPatient(pId) {
    const snap = await db.collection(this.K.EMERGENCIES)
      .where('patientId', '==', pId)
      .where('status', 'in', ['pending','dispatched','arrived','en_route'])
      .get();
    return snap.empty ? null : snap.docs[0].data();
  },
  async getActiveByAmbulance(aId) {
    const snap = await db.collection(this.K.EMERGENCIES)
      .where('ambulanceId', '==', aId)
      .where('status', 'in', ['pending','dispatched','arrived','en_route'])
      .get();
    return snap.empty ? null : snap.docs[0].data();
  },

  // ── Session (Stays in LocalStorage for persistence) ──────────
  getSession()   { return this._getLocal(this.K.SESSION); },
  setSession(u)  { this._setLocal(this.K.SESSION, u); },
  clearSession() { localStorage.removeItem(this.K.SESSION); },

  genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); },

  distKm(lat1,lng1,lat2,lng2) {
    const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
};

const SEED_HOSPITALS = [
  { id:'h1',  name:'Hospital Kuala Lumpur (HKL)',        shortName:'HKL',           lat:3.1712,  lng:101.6946, totalBeds:150, availableBeds:45, erStatus:'open',     address:'Jalan Pahang, 50586 Kuala Lumpur',                  phone:'03-2615 5555', city:'Kuala Lumpur',      type:'public'  },
  { id:'h2',  name:'Pantai Hospital Kuala Lumpur',       shortName:'Pantai KL',     lat:3.1065,  lng:101.6693, totalBeds:100, availableBeds:31, erStatus:'open',     address:'8 Jalan Bukit Pantai, 59100 Kuala Lumpur',          phone:'03-2296 0888', city:'Kuala Lumpur',      type:'private' },
  { id:'h3',  name:'Gleneagles Hospital KL',             shortName:'Gleneagles KL', lat:3.1568,  lng:101.7165, totalBeds:120, availableBeds:12, erStatus:'limited',  address:'286 Jalan Ampang, 50450 Kuala Lumpur',              phone:'03-4141 3000', city:'Kuala Lumpur',      type:'private' },
  { id:'h4',  name:'Prince Court Medical Centre',        shortName:'Prince Court',  lat:3.1438,  lng:101.7179, totalBeds:80,  availableBeds:0,  erStatus:'full',     address:'39 Jalan Kia Peng, 50450 Kuala Lumpur',             phone:'03-2160 0000', city:'Kuala Lumpur',      type:'private' },
  { id:'h5',  name:'Hospital Tengku Ampuan Rahimah',     shortName:'HTAR Klang',    lat:3.0449,  lng:101.4437, totalBeds:200, availableBeds:67, erStatus:'open',     address:'Jalan Langat, 41200 Klang, Selangor',               phone:'03-3375 6100', city:'Klang',             type:'public'  },
  { id:'h6',  name:'Sunway Medical Centre',              shortName:'Sunway',        lat:3.0681,  lng:101.6037, totalBeds:110, availableBeds:38, erStatus:'open',     address:'5 Jalan Lagoon Selatan, 47500 Subang Jaya',         phone:'03-7491 9191', city:'Subang Jaya',       type:'private' },
  { id:'h7',  name:'Hospital Pulau Pinang',              shortName:'HPP Penang',    lat:5.4159,  lng:100.3308, totalBeds:175, availableBeds:54, erStatus:'open',     address:'Jalan Residensi, Georgetown, Penang',               phone:'04-222 5333',  city:'Georgetown, Penang',type:'public'  },
  { id:'h8',  name:'Gleneagles Hospital Penang',         shortName:'Gleneagles PNG',lat:5.4219,  lng:100.3148, totalBeds:90,  availableBeds:23, erStatus:'open',     address:'1 Jalan Pangkor, Georgetown, Penang',               phone:'04-222 9111',  city:'Georgetown, Penang',type:'private' },
  { id:'h9',  name:'Hospital Sultanah Aminah',           shortName:'HSA JB',        lat:1.4655,  lng:103.7578, totalBeds:185, availableBeds:43, erStatus:'open',     address:'Jalan Skudai, 80100 Johor Bahru',                   phone:'07-225 8000',  city:'Johor Bahru',       type:'public'  },
  { id:'h10', name:'KPJ Johor Specialist Hospital',      shortName:'KPJ Johor',     lat:1.4806,  lng:103.7559, totalBeds:75,  availableBeds:18, erStatus:'limited',  address:'Jalan Abdul Samad, 80100 Johor Bahru',              phone:'07-225 3000',  city:'Johor Bahru',       type:'private' },
  { id:'h11', name:'Hospital Melaka',                    shortName:'H. Melaka',     lat:2.1907,  lng:102.2468, totalBeds:140, availableBeds:51, erStatus:'open',     address:'Jalan Mufti Haji Khalil, 75400 Melaka',             phone:'06-285 2344',  city:'Melaka',            type:'public'  },
  { id:'h12', name:'Hospital Queen Elizabeth',           shortName:'HQE KK',        lat:5.9788,  lng:116.0637, totalBeds:160, availableBeds:37, erStatus:'open',     address:'Jalan Penampang, Kota Kinabalu, Sabah',             phone:'088-517 555',  city:'Kota Kinabalu',     type:'public'  },
  { id:'h13', name:'Hospital Umum Sarawak',              shortName:'HUS Kuching',   lat:1.5493,  lng:110.3475, totalBeds:155, availableBeds:40, erStatus:'open',     address:'Jalan Hospital, 93586 Kuching, Sarawak',            phone:'082-276 666',  city:'Kuching',           type:'public'  },
  { id:'h14', name:'Hospital Raja Permaisuri Bainun',    shortName:'HRPB Ipoh',     lat:4.5925,  lng:101.0837, totalBeds:130, availableBeds:28, erStatus:'open',     address:'Jalan Raja Ashman Shah, 30450 Ipoh, Perak',         phone:'05-208 5000',  city:'Ipoh',              type:'public'  },
  { id:'h15', name:"Hospital Tuanku Ja'afar",            shortName:'HTJ Seremban',  lat:2.7158,  lng:101.9439, totalBeds:120, availableBeds:44, erStatus:'open',     address:'Jalan Rasah, 70300 Seremban',                       phone:'06-768 0222',  city:'Seremban',          type:'public'  },
  { id:'h16', name:'Mahkota Medical Centre',             shortName:'Mahkota Melaka',lat:2.2028,  lng:102.2529, totalBeds:70,  availableBeds:5,  erStatus:'limited',  address:'3 Mahkota Melaka, Jalan Merdeka, 75000 Melaka',     phone:'06-285 2999',  city:'Melaka',            type:'private' },
  { id:'h17', name:'Columbia Asia Hospital Shah Alam',   shortName:'Columbia SA',   lat:3.0833,  lng:101.5333, totalBeds:85,  availableBeds:29, erStatus:'open',     address:'No 1 Jalan Masjid, Seksyen 1, Shah Alam',          phone:'03-5522 9000', city:'Shah Alam',         type:'private' },
  { id:'h18', name:'KPJ Ampang Puteri Specialist',       shortName:'KPJ Ampang',    lat:3.1537,  lng:101.7583, totalBeds:95,  availableBeds:33, erStatus:'open',     address:'Jalan Mamanda 9, Ampang Point, Selangor',           phone:'03-4270 2500', city:'Ampang',            type:'private' },
  { id:'h19', name:'Hospital Shah Alam',                 shortName:'HSA Shah Alam', lat:3.0738,  lng:101.5183, totalBeds:140, availableBeds:62, erStatus:'open',     address:'Persiaran Kayangan, Seksyen 7, Shah Alam',          phone:'03-5544 2000', city:'Shah Alam',         type:'public'  },
  { id:'h20', name:'Normah Medical Specialist Centre',   shortName:'Normah Kuching',lat:1.5601,  lng:110.3534, totalBeds:65,  availableBeds:21, erStatus:'open',     address:'Jalan Tun Abdul Razak, 93050 Kuching, Sarawak',     phone:'082-440 055',  city:'Kuching',           type:'private' }
];

const SEED_AMBULANCES = [
  { id:'a1', driverId:'demo_ambulance', vehicleNo:'WB 1234 K', name:'KL Unit 01',      status:'available', lat:3.1612,  lng:101.7046,  currentEmergencyId:null },
  { id:'a2', driverId:null,             vehicleNo:'WB 5678 K', name:'KL Unit 02',      status:'available', lat:3.1450,  lng:101.6850,  currentEmergencyId:null },
  { id:'a3', driverId:null,             vehicleNo:'WB 9012 K', name:'KL Unit 03',      status:'off_duty',  lat:3.0981,  lng:101.7123,  currentEmergencyId:null },
  { id:'a4', driverId:null,             vehicleNo:'PGA 3456',  name:'Penang Unit 01',  status:'available', lat:5.4100,  lng:100.3350,  currentEmergencyId:null },
  { id:'a5', driverId:null,             vehicleNo:'JPC 7890',  name:'JB Unit 01',      status:'available', lat:1.4700,  lng:103.7600,  currentEmergencyId:null }
];

const SEED_USERS = [
  { id:'demo_patient',   name:'Ahmad Razif (Demo)',          email:'patient@demo.com',   password:'demo123', role:'patient',    createdAt:Date.now() },
  { id:'demo_hospital',  name:'Dr. Lim Wei Jian (Demo)',     email:'hospital@demo.com',  password:'demo123', role:'hospital',   hospitalId:'h1', createdAt:Date.now() },
  { id:'demo_ambulance', name:'Rajan Saminathan (Demo)',     email:'ambulance@demo.com', password:'demo123', role:'ambulance',  ambulanceId:'a1', createdAt:Date.now() }
];

