// chatbot.js — Gemini AI Medical Assistant
const Chatbot = {
  isOpen: false,
  isTyping: false,
  messages: [],
  user: null,
  emergencyCtx: null,

  init(user, emergencyCtx) {
    this.user = user;
    this.emergencyCtx = emergencyCtx || null;
    this._injectUI();
    this._bindEvents();
    this._greet();
  },

  updateContext(ctx) { this.emergencyCtx = ctx; },

  _systemPrompt() {
    const roleDesc = { patient:'a patient or bystander at an emergency scene in Malaysia', hospital:'a hospital authority / medical professional at a Malaysian hospital', ambulance:'an ambulance paramedic/driver responding to an emergency in Malaysia' };
    const roleChips = { patient:['CPR steps','Signs of stroke','Choking relief','Stop bleeding','Burns first aid'], hospital:['Triage protocol','Mass casualty','Sepsis signs','Cardiac arrest protocol','Drug overdose'], ambulance:['Spinal injury care','Severe bleeding','Unconscious patient','Breathing difficulty','Shock management'] };
    const ctx = this.emergencyCtx ? `\nCurrent emergency context: ${this.emergencyCtx}` : '';
    return `You are MediBot, an emergency medical assistant for the Malaysia Hospital & Ambulance Tracker app. You are helping ${roleDesc[this.user.role]}.${ctx}
Location: Malaysia. Always respond in clear, actionable steps.
IMPORTANT: At the END of EVERY response, you MUST include a YouTube search link in this exact format:
🎬 **Watch Tutorial**: [Search for "[relevant search query]" on YouTube](https://www.youtube.com/results?search_query=QUERY_HERE)
Replace QUERY_HERE with URL-encoded search terms most relevant to the question (e.g., "cpr+first+aid+tutorial"). Make the query highly specific.
Keep responses concise, clear, and life-saving. Use numbered steps where relevant.`;
  },

  _quickChips() {
    const chips = { patient:['CPR steps','Signs of stroke','Choking relief','Stop bleeding','Burns first aid'], hospital:['Triage protocol','Mass casualty event','Sepsis management','Cardiac arrest','Drug overdose'], ambulance:['Spinal injury care','Severe bleeding','Unconscious patient','Breathing difficulty','Shock management'] };
    return chips[this.user.role] || chips.patient;
  },

  _greet() {
    const greetings = { patient:"👋 Hello! I'm **MediBot**, your emergency medical assistant. I can guide you through first aid, help you understand symptoms, or answer medical questions. What do you need help with?", hospital:"👋 Hello, Dr/Staff! I'm **MediBot**, your clinical assistant. I can help with triage protocols, drug dosages, emergency procedures, and more.", ambulance:"👋 Hello, Paramedic! I'm **MediBot**, your en-route medical assistant. Ask me about patient care, emergency protocols, or any situation you're handling." };
    this._addMessage('bot', greetings[this.user.role] || greetings.patient);
  },

  async sendMessage(text) {
    if (!text.trim() || this.isTyping) return;
    this.isTyping = true;
    this._addMessage('user', text);
    this._showTyping();
    try {
      // Build contents: only user/bot messages, must always start with a 'user' turn
      const allMsgs = this.messages.filter(m => m.role === 'user' || m.role === 'bot');
      const contents = [];
      let lastRole = null;
      for (const m of allMsgs) {
        const role = m.role === 'user' ? 'user' : 'model';
        if (role === lastRole && contents.length > 0) {
          contents[contents.length - 1].parts[0].text += '\n\n' + m.text;
        } else {
          contents.push({ role, parts: [{ text: m.text }] });
          lastRole = role;
        }
      }
      
      // Ensure it starts with user
      while(contents.length > 0 && contents[0].role !== 'user') contents.shift();

      const payload = {
        systemInstruction: { parts: [{ text: this._systemPrompt() }] },
        contents
      };

      // Retry up to 3 times with exponential backoff for 429 errors
      let response, lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const wait = Math.pow(2, attempt) * 1500; // 3s, 6s
          await new Promise(r => setTimeout(r, wait));
        }
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (response.status !== 429) break;
        lastError = 429;
      }

      const data = await response.json();
      this._hideTyping();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        this._addMessage('bot', data.candidates[0].content.parts[0].text);
      } else if (response.status === 429 || data.error?.code === 429) {
        this._addMessage('bot',
          '⏳ The AI is temporarily rate-limited. Please wait a moment and try again.\n\n' +
          '💡 *Tip: The free Gemini API allows ~15 requests per minute.*'
        );
      } else {
        const errMsg = data.error?.message || 'Unknown error';
        console.error('Gemini API error:', data);
        this._addMessage('bot', `⚠️ API Error: ${errMsg}`);
      }
    } catch(e) {
      this._hideTyping();
      console.error('Chatbot fetch error:', e);
      this._addMessage('bot', '⚠️ Connection error. Please check your internet and try again.');
    } finally {
      this.isTyping = false;
    }
  },

  _addMessage(role, text) {
    const msg = { id:Date.now(), role, text, time: new Date().toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit'}) };
    this.messages.push(msg);
    this._renderMessage(msg);
    const body = document.getElementById('chatbot-body');
    if (body) body.scrollTop = body.scrollHeight;
  },

  _showTyping() {
    const body = document.getElementById('chatbot-body');
    if (!body) return;
    const el = document.createElement('div');
    el.className = 'chat-msg bot typing-indicator'; el.id = 'typing-indicator';
    el.innerHTML = `<div class="chat-bubble"><span></span><span></span><span></span></div>`;
    body.appendChild(el); body.scrollTop = body.scrollHeight;
  },

  _hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  _renderMessage(msg) {
    const body = document.getElementById('chatbot-body');
    if (!body) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.role}`;
    // Parse markdown-ish links
    let html = msg.text
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,'<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g,'<br>');
    div.innerHTML = `<div class="chat-bubble">${html}</div><div class="chat-time">${msg.time}</div>`;
    body.appendChild(div);
  },

  _injectUI() {
    if (document.getElementById('chatbot-widget')) return;
    const widget = document.createElement('div');
    widget.id = 'chatbot-widget';
    widget.innerHTML = `
      <button id="chatbot-toggle" title="Medical AI Assistant">
        <span class="chat-icon">🤖</span>
        <span class="chat-badge pulse"></span>
      </button>
      <div id="chatbot-panel" class="chatbot-hidden">
        <div id="chatbot-header">
          <div class="chat-header-info">
            <span class="chat-avatar">🤖</span>
            <div><div class="chat-name">MediBot</div><div class="chat-status">Powered by Gemini AI</div></div>
          </div>
          <button id="chatbot-close" title="Close">✕</button>
        </div>
        <div id="chatbot-body"></div>
        <div id="chatbot-chips">
          ${this._quickChips().map(c=>`<button class="chip" onclick="Chatbot.sendMessage('${c}')">${c}</button>`).join('')}
        </div>
        <div id="chatbot-input-row">
          <input id="chatbot-input" type="text" placeholder="Ask a medical question…" autocomplete="off"/>
          <button id="chatbot-send">➤</button>
        </div>
      </div>`;
    document.body.appendChild(widget);
  },

  _bindEvents() {
    document.getElementById('chatbot-toggle').onclick = () => this.toggle();
    document.getElementById('chatbot-close').onclick  = () => this.close();
    document.getElementById('chatbot-send').onclick   = () => this._submit();
    document.getElementById('chatbot-input').addEventListener('keydown', e => { if (e.key==='Enter') this._submit(); });
  },

  _submit() {
    const inp = document.getElementById('chatbot-input');
    const val = inp.value.trim();
    if (!val) return;
    inp.value = '';
    this.sendMessage(val);
  },

  toggle() { this.isOpen ? this.close() : this.open(); },
  open()  { this.isOpen=true;  document.getElementById('chatbot-panel').classList.remove('chatbot-hidden'); document.getElementById('chatbot-panel').classList.add('chatbot-open'); const b=document.getElementById('chatbot-body'); if(b) b.scrollTop=b.scrollHeight; },
  close() { this.isOpen=false; document.getElementById('chatbot-panel').classList.remove('chatbot-open');   document.getElementById('chatbot-panel').classList.add('chatbot-hidden'); }
};
