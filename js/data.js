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
  onSnapshot 
} from "firebase/firestore";

const GEMINI_API_KEY = window.CONFIG?.GEMINI_API_KEY || '';

const firebaseConfig = {
  apiKey: "AIzaSyCNZyxbGhtg9IVS_COT62aMeNmsz0KH_80",
  authDomain: "exercise002.firebaseapp.com",
  projectId: "exercise002",
  storageBucket: "exercise002.firebasestorage.app",
  messagingSenderId: "937921025720",
  appId: "1:937921025720:web:d90a1cfde21e966db8c64d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let db;

async function connectToDatabase() {
  const dbIds = ['(default)', 'final-test', 'meditest0001'];
  for (const id of dbIds) {
    try {
      console.log(`Attempting connection to database: ${id}...`);
      const testDb = getFirestore(app, id);
      const testRef = collection(testDb, DB.K.HOSPITALS);
      await getDocs(query(testRef, limit(1)));
      console.log(`✅ Success! Connected to database: ${id}`);
      return testDb;
    } catch (e) {
      console.warn(`❌ Failed to connect to database: ${id}`, e.message);
    }
  }
  throw new Error('Could not connect to any available Firestore database.');
}

// Global DB wrapper initialization
const DB = {
  K: { USERS:'users', HOSPITALS:'hospitals', AMBULANCES:'ambulances', EMERGENCIES:'emergencies', SESSION:'hmt_session' },

  async init() {
    try {
      console.log('--- Firebase Health Check ---');
      db = await connectToDatabase();
      
      // Auto-seed hospitals if empty
      const hRef = collection(db, this.K.HOSPITALS);
      const hSnap = await getDocs(query(hRef, limit(1)));
      
      if (hSnap.empty) {
        console.log('Database connected but HOSPITALS collection is empty. Seeding...');
        for (const h of SEED_HOSPITALS) await setDoc(doc(db, this.K.HOSPITALS, h.id), h);
      } else {
        console.log('Database connected successfully. Hospitals found.');
      }
      
      // Auto-seed ambulances if empty
      const aRef = collection(db, this.K.AMBULANCES);
      const aSnap = await getDocs(query(aRef, limit(1)));
      if (aSnap.empty) {
        console.log('Seeding ambulances...');
        for (const a of SEED_AMBULANCES) await setDoc(doc(db, this.K.AMBULANCES, a.id), a);
      }
      
    } catch (err) {
      console.error('--- FIREBASE CONNECTION FATAL ERROR ---');
      console.error('Code:', err.code);
      console.error('Message:', err.message);
      
      if (err.code === 'not-found') {
        alert('CRITICAL ERROR: Firestore database "(default)" not found in project exercise002. Please ensure Firestore is enabled in Native Mode.');
      } else if (err.code === 'permission-denied') {
        alert('PERMISSION DENIED: Firestore security rules are blocking access. Please check your rules in the Firebase Console.');
      } else {
        alert('DATABSE ERROR: ' + err.message);
      }
      throw err;
    }
  },

  // Auth & Session
  getSession() {
    try { return JSON.parse(localStorage.getItem(this.K.SESSION)); } catch(e) { return null; }
  },

  setSession(user) { localStorage.setItem(this.K.SESSION, JSON.stringify(user)); },

  clearSession() { localStorage.removeItem(this.K.SESSION); },

  async getSessionUser() {
    const s = this.getSession();
    if (!s) return null;
    const userDoc = await getDoc(doc(db, this.K.USERS, s.id));
    return userDoc.exists() ? userDoc.data() : null;
  },

  async login(email, password) {
    const q = query(collection(db, this.K.USERS), where('email','==',email), where('password','==',password), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid email or password');
    const user = snap.docs[0].data();
    localStorage.setItem(this.K.SESSION, user.id);
    return user;
  },

  async register(user) {
    await setDoc(doc(db, this.K.USERS, user.id), user);
    localStorage.setItem(this.K.SESSION, user.id);
    return user;
  },

  logout() { localStorage.removeItem(this.K.SESSION); },

  // Data Getters
  async getHospitals() {
    const snap = await getDocs(collection(db, this.K.HOSPITALS));
    return snap.docs.map(d => d.data());
  },

  async getAmbulances() {
    const snap = await getDocs(collection(db, this.K.AMBULANCES));
    return snap.docs.map(d => d.data());
  },

  // State Updates
  async updateHospital(id, updates) {
    await updateDoc(doc(db, this.K.HOSPITALS, id), updates);
  },

  async updateAmbulance(id, updates) {
    await updateDoc(doc(db, this.K.AMBULANCES, id), updates);
  },

  // Emergency Management
  async createEmergency(data) {
    const docRef = await addDoc(collection(db, this.K.EMERGENCIES), {
      ...data,
      status: 'pending',
      createdAt: Date.now()
    });
    // Add the generated ID to the document
    await updateDoc(docRef, { id: docRef.id });
    return docRef.id;
  },

  async getEmergency(id) {
    const d = await getDoc(doc(db, this.K.EMERGENCIES, id));
    return d.exists() ? d.data() : null;
  },

  async updateEmergency(id, updates) {
    await updateDoc(doc(db, this.K.EMERGENCIES, id), updates);
  },

  async getEmergencies() {
    const snap = await getDocs(collection(db, this.K.EMERGENCIES));
    return snap.docs.map(d => d.data());
  },

  async getHospitalById(id) {
    const d = await getDoc(doc(db, this.K.HOSPITALS, id));
    return d.exists() ? d.data() : null;
  },

  async getAmbulanceById(id) {
    const d = await getDoc(doc(db, this.K.AMBULANCES, id));
    return d.exists() ? d.data() : null;
  },

  async getAmbulanceByDriver(driverId) {
    const q = query(collection(db, this.K.AMBULANCES), where('driverId','==',driverId), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  async getUserById(id) {
    const d = await getDoc(doc(db, this.K.USERS, id));
    return d.exists() ? d.data() : null;
  },

  async addUser(user) {
    await setDoc(doc(db, this.K.USERS, user.id), user);
  },

  async getUserByEmail(email) {
    const q = query(collection(db, this.K.USERS), where('email','==',email.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  async addAmbulance(a) {
    await setDoc(doc(db, this.K.AMBULANCES, a.id), a);
  },

  async addEmergency(e) {
    await setDoc(doc(db, this.K.EMERGENCIES, e.id), e);
  },

  async getEmergencyById(id) { return this.getEmergency(id); },

  async getActiveByAmbulance(ambulanceId) {
    const q = query(
      collection(db, this.K.EMERGENCIES), 
      where('ambulanceId','==',ambulanceId), 
      where('status','not-in',['completed','cancelled']),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },
  async getActiveByPatient(patientId) {
    const q = query(
      collection(db, this.K.EMERGENCIES), 
      where('patientId','==',patientId), 
      where('status','not-in',['completed','cancelled']),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  // Real-time Listeners (Exposed via the global DB object)
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
      where('hospitalId','==',hospitalId),
      where('status','in',['dispatched','arrived','transporting'])
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data()));
    });
  },

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

// Seed Data
const SEED_HOSPITALS = [
  { id: 'hkl', name: 'Hospital Kuala Lumpur (HKL)', lat: 3.1714, lng: 101.7018, beds: 15, totalBeds: 50, status: 'Open', contact: '+60 3-2615 5555', address: 'Jalan Pahang, 50586 Kuala Lumpur' },
  { id: 'hselayang', name: 'Hospital Selayang', lat: 3.2424, lng: 101.6508, beds: 8, totalBeds: 40, status: 'Open', contact: '+60 3-6126 3333', address: 'Lebuhraya Selayang-Kepong, 68100 Batu Caves' },
  { id: 'hsglh', name: 'Hospital Sungai Buloh', lat: 3.2201, lng: 101.5833, beds: 2, totalBeds: 60, status: 'Limited', contact: '+60 3-6145 4333', address: 'Jalan Hospital, 47000 Sungai Buloh' },
  { id: 'hpj', name: 'University Malaya Medical Centre (PPUM)', lat: 3.1147, lng: 101.6521, beds: 0, totalBeds: 45, status: 'Full', contact: '+60 3-7949 4422', address: 'Lembah Pantai, 59100 Kuala Lumpur' },
  { id: 'hserdang', name: 'Hospital Serdang', lat: 2.9774, lng: 101.7186, beds: 12, totalBeds: 40, status: 'Open', contact: '+60 3-8947 5555', address: 'Jalan Puchong-Dengkil, 43000 Kajang' },
  { id: 'hputrajaya', name: 'Hospital Putrajaya', lat: 2.9298, lng: 101.6744, beds: 5, totalBeds: 35, status: 'Open', contact: '+60 3-8312 4200', address: 'Pusat Pentadbiran Kerajaan Persekutuan, Presint 7, 62250' },
  { id: 'hampang', name: 'Hospital Ampang', lat: 3.1283, lng: 101.7643, beds: 7, totalBeds: 30, status: 'Open', contact: '+60 3-4289 6000', address: 'Jalan Mewah Utara, Pandan Mewah, 68000 Ampang' },
  { id: 'hkajang', name: 'Hospital Kajang', lat: 2.9934, lng: 101.7909, beds: 3, totalBeds: 25, status: 'Open', contact: '+60 3-8736 3333', address: 'Jalan Semenyih, 43000 Kajang' },
  { id: 'htps', name: 'Hospital Tengku Ampuan Rahimah', lat: 3.0333, lng: 101.4423, beds: 9, totalBeds: 50, status: 'Open', contact: '+60 3-3323 1333', address: 'Jalan Langat, 41200 Klang' },
  { id: 'hshahalam', name: 'Hospital Shah Alam', lat: 3.0711, lng: 101.4886, beds: 6, totalBeds: 40, status: 'Open', contact: '+60 3-5526 3000', address: 'Persiaran Kayangan, Seksyen 7, 40000 Shah Alam' },
  { id: 'hpenang', name: 'Penang General Hospital', lat: 5.4171, lng: 100.3114, beds: 10, totalBeds: 55, status: 'Open', contact: '+60 4-222 5333', address: 'Jalan Residensi, 10990 George Town' },
  { id: 'hjb', name: 'Hospital Sultanah Aminah', lat: 1.4597, lng: 103.7461, beds: 4, totalBeds: 70, status: 'Open', contact: '+60 7-223 1666', address: 'Jalan Persiaran Abu Bakar Sultan, 80100 Johor Bahru' },
  { id: 'hkm', name: 'Melaka General Hospital', lat: 2.2217, lng: 102.2619, beds: 8, totalBeds: 45, status: 'Open', contact: '+60 6-270 7070', address: 'Jalan Mufti Haji Khalil, 75400 Melaka' },
  { id: 'hipoh', name: 'Hospital Raja Permaisuri Bainun', lat: 4.6033, lng: 101.0908, beds: 11, totalBeds: 60, status: 'Open', contact: '+60 5-208 5000', address: 'Jalan Hospital, 30450 Ipoh' },
  { id: 'hkuching', name: 'Sarawak General Hospital', lat: 1.5436, lng: 110.3375, beds: 14, totalBeds: 65, status: 'Open', contact: '+60 82-276 666', address: 'Jalan Hospital, 93586 Kuching' },
  { id: 'hkk', name: 'Queen Elizabeth Hospital', lat: 5.9492, lng: 116.0717, beds: 6, totalBeds: 50, status: 'Open', contact: '+60 88-517 555', address: 'Jalan Penampang, 88200 Kota Kinabalu' },
  { id: 'hgenting', name: 'Genting Highlands Medical Clinic', lat: 3.4239, lng: 101.7911, beds: 2, totalBeds: 10, status: 'Open', contact: '+60 3-6101 1118', address: 'Genting Highlands, 69000' },
  { id: 'sunway', name: 'Sunway Medical Centre', lat: 3.0645, lng: 101.6074, beds: 20, totalBeds: 100, status: 'Open', contact: '+60 3-7491 9191', address: 'Jalan Lagoon Selatan, Bandar Sunway, 47500 Petaling Jaya' },
  { id: 'gleneagles', name: 'Gleneagles Kuala Lumpur', lat: 3.1594, lng: 101.7346, beds: 12, totalBeds: 80, status: 'Open', contact: '+60 3-4141 3000', address: 'Jalan Ampang, 50450 Kuala Lumpur' },
  { id: 'pantai', name: 'Pantai Hospital Kuala Lumpur', lat: 3.1189, lng: 101.6745, beds: 5, totalBeds: 70, status: 'Open', contact: '+60 3-2296 0888', address: 'Jalan Bukit Pantai, 59100 Kuala Lumpur' }
];

const SEED_AMBULANCES = [
  { id: 'amb-kl-1', name: 'Unit 101 (KL)', lat: 3.1714, lng: 101.7018, status: 'available', driver: 'Ahmad' },
  { id: 'amb-kl-2', name: 'Unit 102 (KL)', lat: 3.1500, lng: 101.7100, status: 'available', driver: 'Raj' },
  { id: 'amb-pj-1', name: 'Unit 201 (PJ)', lat: 3.1147, lng: 101.6521, status: 'available', driver: 'Tan' }
];

// Export to window for non-module scripts
window.DB = DB;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.firebaseConfig = firebaseConfig;
window.CONFIG = window.CONFIG || { GEMINI_API_KEY: '' };
