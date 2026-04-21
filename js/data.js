import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  onSnapshot,
  getDocsFromServer
} from "firebase/firestore";

const GEMINI_API_KEY = window.CONFIG?.GEMINI_API_KEY || '';

const firebaseConfig = window.CONFIG?.FIREBASE_CONFIG || {
  apiKey: "MISSING_API_KEY",
  authDomain: "exercise002.firebaseapp.com",
  projectId: "exercise002",
  storageBucket: "exercise002.firebasestorage.app",
  messagingSenderId: "937921025720",
  appId: "1:937921025720:web:d90a1cfde21e966db8c64d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let db;

// Collection keys (defined before connectToDatabase so there's no TDZ issue)
const COLLECTIONS = {
  USERS: 'users_v2',
  HOSPITALS: 'hospitals_v2',
  AMBULANCES: 'ambulances_v2',
  EMERGENCIES: 'emergencies_v2',
  SESSION: 'hmt_session_v2'
};

async function connectToDatabase() {
  const dbIds = ['(default)', 'final-test', 'meditest0001'];
  for (const id of dbIds) {
    try {
      console.log(`[DB] Trying database: "${id}"...`);
      const testDb = getFirestore(app, id);
      await getDocsFromServer(query(collection(testDb, COLLECTIONS.HOSPITALS), limit(1)));
      console.log(`[DB] ✅ Connected to database: "${id}"`);
      return testDb;
    } catch (e) {
      console.warn(`[DB] ❌ "${id}" failed:`, e.code || e.message);
    }
  }
  throw new Error('Could not connect to any Firestore database.');
}

// ─── DB Object ──────────────────────────────────────────────────
const DB = {
  K: COLLECTIONS,

  async init() {
    try {
      console.log('[DB] --- Firebase Health Check ---');
      db = await connectToDatabase();
      
      // Auto-seed hospitals if empty
      const hSnap = await getDocs(query(collection(db, this.K.HOSPITALS), limit(1)));
      if (hSnap.empty) {
        console.log('[DB] Seeding hospitals...');
        for (const h of SEED_HOSPITALS) {
          await setDoc(doc(db, this.K.HOSPITALS, h.id), h);
        }
        console.log(`[DB] Seeded ${SEED_HOSPITALS.length} hospitals`);
      } else {
        console.log('[DB] Hospitals already seeded.');
      }
      
      // Auto-seed ambulances if empty
      const aSnap = await getDocs(query(collection(db, this.K.AMBULANCES), limit(1)));
      if (aSnap.empty) {
        console.log('[DB] Seeding ambulances...');
        for (const a of SEED_AMBULANCES) {
          await setDoc(doc(db, this.K.AMBULANCES, a.id), a);
        }
        console.log(`[DB] Seeded ${SEED_AMBULANCES.length} ambulances`);
      }
      
      console.log('[DB] ✅ Init complete');
    } catch (err) {
      console.error('[DB] FATAL:', err.code, err.message);
      alert('Database error: ' + err.message);
      throw err;
    }
  },

  // ─── Auth & Session ─────────────────────────────────────────
  getSession() {
    try { return JSON.parse(localStorage.getItem(this.K.SESSION)); } catch(e) { return null; }
  },
  setSession(user) { localStorage.setItem(this.K.SESSION, JSON.stringify(user)); },
  clearSession() { localStorage.removeItem(this.K.SESSION); },

  async getSessionUser() {
    const s = this.getSession();
    if (!s) return null;
    try {
      const userDoc = await getDoc(doc(db, this.K.USERS, s.id));
      return userDoc.exists() ? userDoc.data() : s; // fallback to session data
    } catch(e) {
      console.warn('[DB] getSessionUser failed, using cached session:', e.message);
      return s;
    }
  },

  // ─── Data Getters ───────────────────────────────────────────
  async getHospitals() {
    const snap = await getDocs(collection(db, this.K.HOSPITALS));
    return snap.docs.map(d => d.data());
  },

  async getAmbulances() {
    const snap = await getDocs(collection(db, this.K.AMBULANCES));
    return snap.docs.map(d => d.data());
  },

  async getHospitalById(id) {
    if (!id) return null;
    const d = await getDoc(doc(db, this.K.HOSPITALS, id));
    return d.exists() ? d.data() : null;
  },

  async getAmbulanceById(id) {
    if (!id) return null;
    const d = await getDoc(doc(db, this.K.AMBULANCES, id));
    return d.exists() ? d.data() : null;
  },

  async getAmbulanceByDriver(driverId) {
    const q = query(collection(db, this.K.AMBULANCES), where('driverId','==',driverId), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  async getUserById(id) {
    if (!id) return null;
    const d = await getDoc(doc(db, this.K.USERS, id));
    return d.exists() ? d.data() : null;
  },

  async getUserByEmail(email) {
    const q = query(collection(db, this.K.USERS), where('email','==',email.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  // ─── Data Mutations ─────────────────────────────────────────
  async addUser(user) {
    await setDoc(doc(db, this.K.USERS, user.id), user);
  },

  async addAmbulance(a) {
    await setDoc(doc(db, this.K.AMBULANCES, a.id), a);
  },

  async addEmergency(e) {
    await setDoc(doc(db, this.K.EMERGENCIES, e.id), e);
  },

  async updateHospital(id, updates) {
    await updateDoc(doc(db, this.K.HOSPITALS, id), updates);
  },

  async updateAmbulance(id, updates) {
    await updateDoc(doc(db, this.K.AMBULANCES, id), updates);
  },

  async updateEmergency(id, updates) {
    await updateDoc(doc(db, this.K.EMERGENCIES, id), updates);
  },

  async getEmergencies() {
    const snap = await getDocs(collection(db, this.K.EMERGENCIES));
    return snap.docs.map(d => d.data());
  },

  async getEmergency(id) {
    if (!id) return null;
    const d = await getDoc(doc(db, this.K.EMERGENCIES, id));
    return d.exists() ? d.data() : null;
  },

  async getEmergencyById(id) { return this.getEmergency(id); },

  async getActiveByAmbulance(ambulanceId) {
    const q = query(collection(db, this.K.EMERGENCIES), where('ambulanceId','==',ambulanceId));
    const snap = await getDocs(q);
    const active = snap.docs.map(d => d.data()).filter(e => !['completed','cancelled'].includes(e.status));
    return active.length ? active[0] : null;
  },

  async getActiveByPatient(patientId) {
    const q = query(collection(db, this.K.EMERGENCIES), where('patientId','==',patientId));
    const snap = await getDocs(q);
    const active = snap.docs.map(d => d.data()).filter(e => !['completed','cancelled'].includes(e.status));
    return active.length ? active[0] : null;
  },

  // ─── Real-time Listeners ────────────────────────────────────
  subscribe(colName, callback) {
    return onSnapshot(collection(db, colName), (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

  subscribeDoc(colName, id, callback) {
    return onSnapshot(doc(db, colName, id), (d) => {
      if (d.exists()) callback(d.data());
    });
  },

  subscribeIncoming(hospitalId, callback) {
    const q = query(
      collection(db, this.K.EMERGENCIES),
      where('hospitalId','==',hospitalId)
    );
    return onSnapshot(q, (snap) => {
      const active = snap.docs.map(d => d.data()).filter(e => ['dispatched','arrived','transporting','en_route'].includes(e.status));
      callback(active);
    });
  },

  // ─── Utilities ──────────────────────────────────────────────
  genId() { return Math.random().toString(36).substr(2, 9); },

  distKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
};

// ─── Seed Data ────────────────────────────────────────────────
const SEED_HOSPITALS = [
  // Kuala Lumpur
  { id: 'hkl', name: 'Hospital Kuala Lumpur', shortName: 'HKL', lat: 3.1714, lng: 101.7018, availableBeds: 45, totalBeds: 2300, erStatus: 'limited', phone: '+60 3-2615 5555', address: 'Jalan Pahang, 50586 Kuala Lumpur', city: 'Kuala Lumpur', type: 'public' },
  { id: 'ppum', name: 'Pusat Perubatan Universiti Malaya', shortName: 'PPUM', lat: 3.1121, lng: 101.6534, availableBeds: 22, totalBeds: 1600, erStatus: 'open', phone: '+60 3-7949 4422', address: 'Jalan Universiti, 59100 Kuala Lumpur', city: 'Kuala Lumpur', type: 'public' },
  { id: 'hctm', name: 'Hospital Canselor Tuanku Muhriz UKM', shortName: 'HCTM', lat: 3.1009, lng: 101.7208, availableBeds: 15, totalBeds: 1054, erStatus: 'open', phone: '+60 3-9145 5555', address: 'Jalan Yaacob Latif, 56000 Kuala Lumpur', city: 'Kuala Lumpur', type: 'public' },
  { id: 'gleneagles_kl', name: 'Gleneagles Kuala Lumpur', shortName: 'Gleneagles KL', lat: 3.1594, lng: 101.7346, availableBeds: 12, totalBeds: 330, erStatus: 'open', phone: '+60 3-4141 3000', address: 'Jalan Ampang, 50450 Kuala Lumpur', city: 'Kuala Lumpur', type: 'private' },
  { id: 'pantai_kl', name: 'Pantai Hospital Kuala Lumpur', shortName: 'Pantai KL', lat: 3.1189, lng: 101.6745, availableBeds: 5, totalBeds: 335, erStatus: 'open', phone: '+60 3-2296 0888', address: 'Jalan Bukit Pantai, 59100 Kuala Lumpur', city: 'Kuala Lumpur', type: 'private' },
  
  // Selangor
  { id: 'htar', name: 'Hospital Tengku Ampuan Rahimah', shortName: 'HTAR', lat: 3.0333, lng: 101.4447, availableBeds: 0, totalBeds: 1094, erStatus: 'full', phone: '+60 3-3323 9999', address: 'Jalan Langat, 41200 Klang, Selangor', city: 'Klang', type: 'public' },
  { id: 'hsgbuloh', name: 'Hospital Sungai Buloh', shortName: 'H. Sg Buloh', lat: 3.2185, lng: 101.5835, availableBeds: 34, totalBeds: 1300, erStatus: 'open', phone: '+60 3-6145 4333', address: 'Jalan Hospital, 47000 Sungai Buloh, Selangor', city: 'Sungai Buloh', type: 'public' },
  { id: 'hserdang', name: 'Hospital Serdang', shortName: 'H. Serdang', lat: 2.9754, lng: 101.7204, availableBeds: 18, totalBeds: 920, erStatus: 'limited', phone: '+60 3-8947 5200', address: 'Jalan Puchong, 43000 Serdang, Selangor', city: 'Serdang', type: 'public' },
  { id: 'hselayang', name: 'Hospital Selayang', shortName: 'H. Selayang', lat: 3.2458, lng: 101.6447, availableBeds: 21, totalBeds: 960, erStatus: 'open', phone: '+60 3-6120 3233', address: 'Lebuhraya Selayang-Kepong, 68100 Batu Caves, Selangor', city: 'Selayang', type: 'public' },
  { id: 'sunway_med', name: 'Sunway Medical Centre', shortName: 'Sunway Med', lat: 3.0645, lng: 101.6074, availableBeds: 25, totalBeds: 600, erStatus: 'open', phone: '+60 3-7491 9191', address: 'Jalan Lagoon Selatan, 47500 Petaling Jaya, Selangor', city: 'Petaling Jaya', type: 'private' },

  // Putrajaya
  { id: 'hputrajaya', name: 'Hospital Putrajaya', shortName: 'H. Putrajaya', lat: 2.9298, lng: 101.6742, availableBeds: 11, totalBeds: 369, erStatus: 'open', phone: '+60 3-8312 4200', address: 'Precinct 7, 62250 Putrajaya', city: 'Putrajaya', type: 'public' },

  // Penang
  { id: 'hpenang', name: 'Hospital Pulau Pinang', shortName: 'HPP', lat: 5.4172, lng: 100.3117, availableBeds: 40, totalBeds: 1100, erStatus: 'open', phone: '+60 4-222 5333', address: 'Jalan Residensi, 10990 George Town, Penang', city: 'George Town', type: 'public' },
  { id: 'hsejaya', name: 'Hospital Seberang Jaya', shortName: 'H. Sbj', lat: 5.3948, lng: 100.4046, availableBeds: 0, totalBeds: 393, erStatus: 'full', phone: '+60 4-382 7333', address: 'Jalan Tun Hussein Onn, 13700 Perai, Penang', city: 'Perai', type: 'public' },

  // Johor
  { id: 'hsa', name: 'Hospital Sultanah Aminah', shortName: 'HSA', lat: 1.4597, lng: 103.7461, availableBeds: 14, totalBeds: 1206, erStatus: 'limited', phone: '+60 7-223 1666', address: 'Jalan Persiaran Abu Bakar Sultan, 80100 Johor Bahru, Johor', city: 'Johor Bahru', type: 'public' },
  { id: 'hsi', name: 'Hospital Sultan Ismail', shortName: 'HSI', lat: 1.5475, lng: 103.7964, availableBeds: 23, totalBeds: 700, erStatus: 'open', phone: '+60 7-356 5000', address: 'Jalan Mutiara Emas Utama, 81100 Johor Bahru, Johor', city: 'Johor Bahru', type: 'public' },

  // Melaka
  { id: 'hmelaka', name: 'Hospital Melaka', shortName: 'H. Melaka', lat: 2.2217, lng: 102.2619, availableBeds: 8, totalBeds: 1000, erStatus: 'open', phone: '+60 6-270 7070', address: 'Jalan Mufti Haji Khalil, 75400 Melaka', city: 'Melaka', type: 'public' },

  // Negeri Sembilan
  { id: 'htj', name: 'Hospital Tuanku Ja\'afar', shortName: 'HTJ', lat: 2.7145, lng: 101.9427, availableBeds: 19, totalBeds: 800, erStatus: 'open', phone: '+60 6-768 4000', address: 'Jalan Rasah, 70300 Seremban, Negeri Sembilan', city: 'Seremban', type: 'public' },

  // Perak
  { id: 'hrpb', name: 'Hospital Raja Permaisuri Bainun', shortName: 'HRPB', lat: 4.6033, lng: 101.0908, availableBeds: 30, totalBeds: 990, erStatus: 'open', phone: '+60 5-208 5000', address: 'Jalan Hospital, 30450 Ipoh, Perak', city: 'Ipoh', type: 'public' },
  { id: 'htaiping', name: 'Hospital Taiping', shortName: 'H. Taiping', lat: 4.8558, lng: 100.7397, availableBeds: 16, totalBeds: 600, erStatus: 'open', phone: '+60 5-820 4000', address: 'Jalan Taming Sari, 34000 Taiping, Perak', city: 'Taiping', type: 'public' },

  // Kedah & Perlis
  { id: 'hsb', name: 'Hospital Sultanah Bahiyah', shortName: 'HSB', lat: 6.1481, lng: 100.4069, availableBeds: 21, totalBeds: 1100, erStatus: 'open', phone: '+60 4-740 6233', address: 'KM 6, Jalan Langgar, 05460 Alor Setar, Kedah', city: 'Alor Setar', type: 'public' },
  { id: 'htf', name: 'Hospital Tuanku Fauziah', shortName: 'HTF', lat: 6.4402, lng: 100.1916, availableBeds: 7, totalBeds: 400, erStatus: 'limited', phone: '+60 4-973 8000', address: 'Jalan Kolam, 01000 Kangar, Perlis', city: 'Kangar', type: 'public' },

  // Pahang & Terengganu & Kelantan
  { id: 'htaa', name: 'Hospital Tengku Ampuan Afzan', shortName: 'HTAA', lat: 3.8010, lng: 103.3210, availableBeds: 15, totalBeds: 850, erStatus: 'open', phone: '+60 9-513 3333', address: 'Jalan Tanah Putih, 25100 Kuantan, Pahang', city: 'Kuantan', type: 'public' },
  { id: 'hsnz', name: 'Hospital Sultanah Nur Zahirah', shortName: 'HSNZ', lat: 5.3242, lng: 103.1492, availableBeds: 20, totalBeds: 1000, erStatus: 'open', phone: '+60 9-621 2121', address: 'Jalan Sultan Mahmud, 20400 Kuala Terengganu, Terengganu', city: 'Kuala Terengganu', type: 'public' },
  { id: 'hrpz', name: 'Hospital Raja Perempuan Zainab II', shortName: 'HRPZ II', lat: 6.1245, lng: 102.2472, availableBeds: 5, totalBeds: 900, erStatus: 'limited', phone: '+60 9-745 2000', address: 'Jalan Hospital, 15586 Kota Bharu, Kelantan', city: 'Kota Bharu', type: 'public' },

  // Sabah & Sarawak
  { id: 'hqek', name: 'Hospital Queen Elizabeth', shortName: 'HQE', lat: 5.9492, lng: 116.0717, availableBeds: 12, totalBeds: 700, erStatus: 'open', phone: '+60 88-517 555', address: 'Jalan Penampang, 88200 Kota Kinabalu, Sabah', city: 'Kota Kinabalu', type: 'public' },
  { id: 'hsk', name: 'Hospital Umum Sarawak', shortName: 'SGH', lat: 1.5436, lng: 110.3375, availableBeds: 28, totalBeds: 1000, erStatus: 'open', phone: '+60 82-276 666', address: 'Jalan Hospital, 93586 Kuching, Sarawak', city: 'Kuching', type: 'public' },
  { id: 'hmiri', name: 'Hospital Miri', shortName: 'H. Miri', lat: 4.3855, lng: 113.9859, availableBeds: 9, totalBeds: 350, erStatus: 'limited', phone: '+60 85-420 033', address: 'Jalan Cahaya, 98000 Miri, Sarawak', city: 'Miri', type: 'public' }
];

const SEED_AMBULANCES = [
  { id: 'amb-db-1', name: 'Alpha Unit (Demo)', vehicleNo: 'WNM 1010', status: 'available', lat: 3.1714, lng: 101.7018, driverId: null, currentEmergencyId: null },
  { id: 'amb-db-2', name: 'Bravo Unit (Demo)', vehicleNo: 'VAA 2233', status: 'available', lat: 3.1500, lng: 101.7100, driverId: null, currentEmergencyId: null },
  { id: 'amb-db-3', name: 'Charlie Unit (Demo)', vehicleNo: 'BKP 505', status: 'available', lat: 3.1147, lng: 101.6521, driverId: null, currentEmergencyId: null }
];

// Export to window for non-module scripts
window.DB = DB;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.firebaseConfig = firebaseConfig;
window.CONFIG = window.CONFIG || { GEMINI_API_KEY: '' };
