(function(){
'use strict';

// ── CONFIG ──
var API_URL = 'https://vtc-website-alpha.vercel.app/api/chat';
var MAX_MESSAGES = 20; // Max conversation history to send

// ── SYSTEM PROMPT ──
var SYSTEM_PROMPT = `You are the AI trade assistant for Vector Trade Capital (VTC), a US-registered commodity trading company headquartered in Houston, Texas with offices in Miami and Dubai.

## Your Role
You help Caribbean and Latin American importers understand VTC's products, services, and processes. You qualify leads and guide them toward submitting a trade inquiry.

## Language
Respond in whichever language the user writes in. VTC operates in English and Spanish.

## Company Overview
VTC sources and delivers bulk commodities to importers across the Caribbean and Latin America. The company finances every transaction with its own capital — no brokers, no intermediaries, no third-party funding delays. Quote turnaround is 48 hours.

Leadership: Amber Lynn Hamby (Chairwoman), Cole Kutschinski (President), Kevin Kutschinski (Partner).
Offices: Houston TX (HQ), Miami FL, Dubai UAE.
Contact: info@vectortradecapital.com

## Products

### Food Commodities
- Rice: Long grain white, parboiled. Grades: 5%, 15%, 25% broken. Packaging: 25kg, 50kg bags, bulk. Origins: USA, Guyana, Thailand, India.
- Sugar: ICUMSA 45, Raw VHP, Brown. Packaging: 50kg bags, bulk, 1MT totes. Origins: Brazil, Guatemala, Colombia.
- Wheat Flour: All-purpose, Bread, Pastry. Packaging: 25kg, 50kg bags. Origins: USA, Canada, Argentina.
- Cooking Oil: Soybean, Palm, Sunflower. Packaging: Flexitanks, drums, 1-5L bottles. Origins: Brazil, Argentina, Malaysia.
- Dried Legumes: Pinto, Black, Red kidney, Lentils, Pigeon pea. Packaging: 25kg, 50kg bags. Origins: USA, Canada, Myanmar.
- Frozen Poultry: Leg quarters, MDM, Wings. Packaging: 40lb cases, reefer containers. Origins: USA, Brazil.
- Frozen Pork: Ribs, Shoulders, Loins, Trim. Packaging: 40lb cases, reefer containers. Origins: USA.
More info: https://vectortradecapital.com/food.html

### Fuel & Energy
- Diesel (ULSD): Grades: ULSD 15ppm, EN590, D2. Delivery: tanker, ISO tanks. Origins: US Gulf, USVI, Panama.
- Gasoline: ULG 87, 89, 93 octane. Delivery: tanker, ISO tanks. Origins: US Gulf Coast.
- Jet Fuel: Jet A-1, ASTM D1655 spec. Delivery: tanker, pipeline. Origins: US Gulf, East Coast.
- LPG: Propane, Butane, Mix. Delivery: pressurized tankers, cylinders. Origins: US Gulf, Trinidad.
- Heavy Fuel Oil: IFO 180, IFO 380, HFO. Delivery: tanker, barge. Origins: US Gulf, Panama.
- Marine Gas Oil: 0.5% sulfur, IMO 2020 compliant. Delivery: barge, tanker. Origins: US Gulf, Panama.
More info: https://vectortradecapital.com/fuel.html

### Vehicles & Equipment
- Used & New Vehicles: Sedans, SUVs, Pickups. US domestic sourced.
- Fleet Units: Trucks, Vans, Buses, Equipment. Fleet-maintained.
- Parts & Accessories: OEM, Aftermarket, Tires.
- Shipping: RoRo and container. Full export documentation (title, bill of sale, export declarations, bills of lading).
More info: https://vectortradecapital.com/vehicles.html

## Delivery Terms
- CIF (Cost, Insurance, Freight): VTC covers product cost, marine cargo insurance, and ocean freight to the buyer's named port. Buyer receives a landed price with no hidden costs.
- FOB (Free on Board): Available especially for vehicles.
- Minimum orders: From single container loads (~25 metric tons) up to full vessel quantities.
- Documentation: Commercial invoices, packing lists, bills of lading, certificates of origin, phytosanitary certificates, veterinary health certificates (meat), quality certificates (fuel).

## Markets Served
Primary: Jamaica (Kingston), Trinidad & Tobago (Port of Spain), Dominican Republic (Caucedo), Haiti, Barbados, Bahamas (Nassau), Guyana (Georgetown).
Secondary: Wider Caribbean and Latin America.
Transit from US Gulf Coast to Kingston: 4-7 days.

## Process
1. Buyer submits requirements (product, specs, volume, destination port)
2. VTC responds with firm CIF quote within 48 hours
3. VTC sources from supplier network, arranges quality inspection
4. VTC handles freight, marine insurance, all export documentation
5. Product arrives at buyer's port ready for customs clearance

## Resources to Reference
- Import Playbook (free guide): https://vectortradecapital.com/playbook/
- Blog articles on CIF delivery, rice importing, fuel supply chain, sugar importing, letters of credit, port infrastructure, cooking oil, frozen poultry, diesel importing at https://vectortradecapital.com/blog.html

## Rules
1. NEVER quote specific prices. Prices are market-dependent and change daily. Direct pricing inquiries to the trade desk.
2. NEVER make contractual commitments or guarantees on delivery timelines beyond general ranges.
3. NEVER discuss competitors, internal margins, or proprietary business information.
4. When a user seems ready to buy or wants pricing, guide them to: email info@vectortradecapital.com or the contact form at https://vectortradecapital.com/#contact
5. Ask qualifying questions: What product? What volume? What destination port? What timeline?
6. Keep responses concise and professional. You represent a commodity trading company, not a chatbot startup.
7. If asked something outside VTC's scope, politely redirect to what VTC does offer.
8. Reference specific blog articles or the playbook when relevant to the user's question.
9. NEVER use emojis, markdown headings (#), or horizontal rules. Use only **bold**, [links](url), and plain line breaks for formatting. Keep it clean and corporate.
10. Keep responses short — 2-4 short paragraphs max. Do not write walls of text.`;

// ── STATE ──
var messages = [];
var isOpen = false;
var isLoading = false;
var sessionId = 'vtc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// ── BUILD UI ──
function init() {
  var style = document.createElement('style');
  style.textContent = [
    ':root{--vtc-ink:#0E1A14;--vtc-ink-mid:#1C3326;--vtc-cream:#F5F0E8;--vtc-gold:#B8963E;--vtc-gold-light:#D4AE5A;--vtc-teal:#1A7A5E;--vtc-teal-bright:#22A07C;}',
    '#vtc-chat-btn{position:fixed;bottom:24px;right:24px;z-index:9998;width:56px;height:56px;border-radius:50%;background:var(--vtc-teal);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(26,122,94,0.4);transition:all .3s cubic-bezier(.4,0,.2,1);display:flex;align-items:center;justify-content:center}',
    '#vtc-chat-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(26,122,94,0.5);background:var(--vtc-teal-bright)}',
    '#vtc-chat-btn svg{width:26px;height:26px;fill:white;transition:transform .3s}',
    '#vtc-chat-btn.open svg{transform:rotate(90deg)}',
    '#vtc-chat-panel{position:fixed;bottom:92px;right:24px;z-index:9999;width:380px;max-height:520px;background:var(--vtc-cream);border:1px solid rgba(184,150,62,0.2);box-shadow:0 16px 56px rgba(14,26,20,0.2),0 4px 16px rgba(14,26,20,0.1);display:flex;flex-direction:column;opacity:0;transform:translateY(12px) scale(.96);pointer-events:none;transition:all .3s cubic-bezier(.4,0,.2,1);overflow:hidden}',
    '#vtc-chat-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}',
    '#vtc-chat-header{background:var(--vtc-ink);padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(184,150,62,0.15)}',
    '#vtc-chat-header .vtc-avatar{width:32px;height:32px;border-radius:50%;background:var(--vtc-teal);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#vtc-chat-header .vtc-avatar svg{width:18px;height:18px;fill:white}',
    '#vtc-chat-header .vtc-hdr-text{flex:1}',
    '#vtc-chat-header .vtc-hdr-name{font-family:"DM Mono",monospace;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--vtc-cream)}',
    '#vtc-chat-header .vtc-hdr-status{font-size:11px;color:rgba(245,240,232,0.45);margin-top:2px}',
    '#vtc-chat-close{background:none;border:none;color:rgba(245,240,232,0.4);cursor:pointer;padding:4px;transition:color .2s}',
    '#vtc-chat-close:hover{color:var(--vtc-gold-light)}',
    '#vtc-chat-close svg{width:18px;height:18px;fill:currentColor}',
    '#vtc-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;min-height:280px;max-height:340px}',
    '#vtc-chat-messages::-webkit-scrollbar{width:4px}',
    '#vtc-chat-messages::-webkit-scrollbar-track{background:transparent}',
    '#vtc-chat-messages::-webkit-scrollbar-thumb{background:rgba(184,150,62,0.2);border-radius:2px}',
    '.vtc-msg{max-width:85%;padding:10px 14px;font-family:"DM Sans",sans-serif;font-size:13.5px;line-height:1.65;word-wrap:break-word}',
    '.vtc-msg a{color:var(--vtc-teal);text-decoration:underline;text-underline-offset:2px}',
    '.vtc-msg-assistant{align-self:flex-start;background:var(--vtc-ink);color:var(--vtc-cream);border-radius:2px 12px 12px 12px}',
    '.vtc-msg-user{align-self:flex-end;background:var(--vtc-teal);color:white;border-radius:12px 2px 12px 12px}',
    '.vtc-msg-assistant strong{color:var(--vtc-gold-light);font-weight:500}',
    '.vtc-typing{align-self:flex-start;padding:12px 16px;background:var(--vtc-ink);border-radius:2px 12px 12px 12px;display:flex;gap:5px;align-items:center}',
    '.vtc-typing span{width:6px;height:6px;border-radius:50%;background:rgba(245,240,232,0.35);animation:vtcBounce 1.4s ease infinite}',
    '.vtc-typing span:nth-child(2){animation-delay:.15s}',
    '.vtc-typing span:nth-child(3){animation-delay:.3s}',
    '@keyframes vtcBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
    '#vtc-chat-input-wrap{padding:12px;border-top:1px solid rgba(184,150,62,0.12);display:flex;gap:8px;background:var(--vtc-cream)}',
    '#vtc-chat-input{flex:1;border:1px solid rgba(184,150,62,0.2);background:white;padding:10px 14px;font-family:"DM Sans",sans-serif;font-size:13.5px;color:var(--vtc-ink);outline:none;resize:none;min-height:40px;max-height:80px;line-height:1.5;border-radius:4px;transition:border-color .2s}',
    '#vtc-chat-input:focus{border-color:var(--vtc-teal)}',
    '#vtc-chat-input::placeholder{color:rgba(14,26,20,0.3)}',
    '#vtc-chat-send{width:40px;height:40px;border-radius:4px;background:var(--vtc-teal);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}',
    '#vtc-chat-send:hover{background:var(--vtc-teal-bright)}',
    '#vtc-chat-send:disabled{background:rgba(26,122,94,0.3);cursor:default}',
    '#vtc-chat-send svg{width:18px;height:18px;fill:white}',
    '@media(max-width:600px){#vtc-chat-panel{right:0;left:0;bottom:0;top:0;width:100%;max-height:none;border:none;border-radius:0}#vtc-chat-panel.open~#vtc-chat-btn{display:none}#vtc-chat-btn{bottom:16px;right:16px;width:50px;height:50px}#vtc-chat-btn svg{width:22px;height:22px}#vtc-chat-messages{min-height:0;flex:1;max-height:none}#vtc-chat-header{padding:14px 16px;padding-top:max(14px,env(safe-area-inset-top))}#vtc-chat-input-wrap{padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom))}}'
  ].join('\n');
  document.head.appendChild(style);

  // Chat button
  var btn = document.createElement('button');
  btn.id = 'vtc-chat-btn';
  btn.setAttribute('aria-label', 'Open trade assistant chat');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  btn.onclick = toggleChat;
  document.body.appendChild(btn);

  // Chat panel
  var panel = document.createElement('div');
  panel.id = 'vtc-chat-panel';
  panel.innerHTML = [
    '<div id="vtc-chat-header">',
    '  <div class="vtc-avatar"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></div>',
    '  <div class="vtc-hdr-text">',
    '    <div class="vtc-hdr-name">VTC Trade Assistant</div>',
    '    <div class="vtc-hdr-status">Powered by AI</div>',
    '  </div>',
    '  <button id="vtc-chat-close" aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>',
    '</div>',
    '<div id="vtc-chat-messages"></div>',
    '<div id="vtc-chat-input-wrap">',
    '  <textarea id="vtc-chat-input" placeholder="Ask about our products, delivery, or markets..." rows="1"></textarea>',
    '  <button id="vtc-chat-send" aria-label="Send message"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);

  // Events
  document.getElementById('vtc-chat-close').onclick = toggleChat;
  document.getElementById('vtc-chat-send').onclick = sendMessage;
  var input = document.getElementById('vtc-chat-input');
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // Welcome message
  addMessage('assistant', 'Hello! I\'m the Vector Trade Capital trade assistant. I can help you with questions about our **food, fuel, and vehicle** supply to the Caribbean.\n\nWhat are you looking to import?');
}

function toggleChat() {
  isOpen = !isOpen;
  document.getElementById('vtc-chat-panel').classList.toggle('open', isOpen);
  document.getElementById('vtc-chat-btn').classList.toggle('open', isOpen);
  if (isOpen) {
    setTimeout(function() {
      document.getElementById('vtc-chat-input').focus();
    }, 300);
  }
}

function addMessage(role, content) {
  var container = document.getElementById('vtc-chat-messages');
  var div = document.createElement('div');
  div.className = 'vtc-msg vtc-msg-' + role;
  // Markdown parsing: headings, bold, links, lists
  var html = content
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^[-–•]\s+/gm, '&bull; ')
    .replace(/\n/g, '<br>');
  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  var container = document.getElementById('vtc-chat-messages');
  var div = document.createElement('div');
  div.className = 'vtc-typing';
  div.id = 'vtc-typing-indicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  var el = document.getElementById('vtc-typing-indicator');
  if (el) el.remove();
}

function sendMessage() {
  if (isLoading) return;
  var input = document.getElementById('vtc-chat-input');
  var text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  addMessage('user', text);
  messages.push({ role: 'user', content: text });

  isLoading = true;
  document.getElementById('vtc-chat-send').disabled = true;
  showTyping();

  // Trim conversation history
  var sendMessages = messages.slice(-MAX_MESSAGES);

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      messages: sendMessages,
      sessionId: sessionId,
      pageUrl: window.location.href
    })
  })
  .then(function(res) {
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  })
  .then(function(data) {
    hideTyping();
    var reply = data.content || data.reply || 'I apologize, I had trouble processing that. Please try again.';
    addMessage('assistant', reply);
    messages.push({ role: 'assistant', content: reply });
  })
  .catch(function(err) {
    hideTyping();
    addMessage('assistant', 'I\'m having trouble connecting right now. Please email **info@vectortradecapital.com** or use our [contact form](https://vectortradecapital.com/#contact) and our trade desk will respond within 48 hours.');
    console.error('VTC Chat Error:', err);
  })
  .finally(function() {
    isLoading = false;
    document.getElementById('vtc-chat-send').disabled = false;
    document.getElementById('vtc-chat-input').focus();
  });
}

// Init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
