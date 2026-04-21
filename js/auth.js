// auth.js — Authentication & Session Management
const Auth = {
  async login(email, password) {
    const user = await DB.getUserByEmail(email);
    if (!user) return { success:false, error:'No account found with this email.' };
    if (user.password !== password) return { success:false, error:'Incorrect password.' };
    DB.setSession(user);
    return { success:true, user };
  },

  async register({ name, email, password, role, hospitalId, vehicleNo }) {
    if (!name||!email||!password||!role) return { success:false, error:'Please fill in all required fields.' };
    const existing = await DB.getUserByEmail(email);
    if (existing) return { success:false, error:'This email is already registered.' };
    if (role==='hospital' && !hospitalId) return { success:false, error:'Please select your hospital.' };

    const user = { id:DB.genId(), name:name.trim(), email:email.trim().toLowerCase(), password, role, createdAt:Date.now() };

    if (role==='hospital') {
      user.hospitalId = hospitalId;
    }
    if (role==='ambulance') {
      const amb = {
        id:DB.genId(), driverId:user.id,
        vehicleNo:(vehicleNo||'Unknown').trim().toUpperCase(),
        name:`${name.trim()}'s Ambulance`,
        status:'off_duty', lat:3.1412, lng:101.6865, currentEmergencyId:null
      };
      await DB.addAmbulance(amb);
      user.ambulanceId = amb.id;
    }
    await DB.addUser(user);
    DB.setSession(user);
    return { success:true, user };
  },

  logout() { DB.clearSession(); window.location.href='index.html'; },

  async requireAuth() {
    const s = DB.getSession();
    if (!s) { window.location.href='index.html'; return null; }
    const user = await DB.getUserById(s.id);
    return user || s;
  },

  async getCurrentUser() {
    const s = DB.getSession();
    if (!s) return null;
    return await DB.getUserById(s.id) || s;
  }
};
