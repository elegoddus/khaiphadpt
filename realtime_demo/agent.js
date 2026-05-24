const API_URL = "http://localhost:8000/recommend";
const WS_URL = "ws://localhost:8000/ws/agent";

const wsStatus = document.getElementById('ws-status');
const customerList = document.getElementById('customer-list');
const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const aiAssistBtn = document.getElementById('ai-assist-btn');
const currentCustomerName = document.getElementById('current-customer-name');

let ws;
let currentCustomerId = null;
let chatHistory = {}; // Store messages for each customer

function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        wsStatus.innerText = "Connected";
        wsStatus.style.color = "#10b981";
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const sender = data.sender;
        const text = data.text;
        const timestamp = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (!chatHistory[sender]) {
            chatHistory[sender] = [];
            addCustomerToList(sender);
        }

        chatHistory[sender].push({ sender: 'customer', text, timestamp });

        if (currentCustomerId === sender) {
            appendMessage(text, 'customer', timestamp);
            analyzeAI(text); // Auto analyze incoming message
        } else {
            // Update badge if not current chat
            const badgeId = `badge-${sender}`;
            const badge = document.getElementById(badgeId);
            if (badge) {
                badge.style.display = 'inline-block';
                badge.innerText = parseInt(badge.innerText || "0") + 1;
            }
        }
    };

    ws.onclose = () => {
        wsStatus.innerText = "Disconnected";
        wsStatus.style.color = "#ef4444";
        setTimeout(connectWebSocket, 3000); // Reconnect
    };
}

function addCustomerToList(customerId) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.id = `customer-${customerId}`;
    div.innerHTML = `
        <img src="https://i.pravatar.cc/150?u=${customerId}" alt="Avatar">
        <div class="chat-info">
            <h4>${customerId}</h4>
            <p>Khách hàng mới...</p>
        </div>
        <span class="badge" id="badge-${customerId}" style="display: none">0</span>
    `;
    div.onclick = () => selectCustomer(customerId, div);
    customerList.appendChild(div);

    if (!currentCustomerId) {
        selectCustomer(customerId, div);
    }
}

function selectCustomer(customerId, element) {
    currentCustomerId = customerId;
    currentCustomerName.innerText = customerId;
    
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    const badge = document.getElementById(`badge-${customerId}`);
    if (badge) {
        badge.style.display = 'none';
        badge.innerText = '0';
    }

    // Load chat history
    messagesContainer.innerHTML = '';
    const msgs = chatHistory[customerId] || [];
    msgs.forEach(m => appendMessage(m.text, m.sender, m.timestamp));
    
    // Auto analyze last customer message if any
    const lastMsg = [...msgs].reverse().find(m => m.sender === 'customer');
    if (lastMsg) {
        analyzeAI(lastMsg.text);
    } else {
        resetAI();
    }
}

function appendMessage(text, sender, time) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    
    let avatarHtml = '';
    if (sender === 'customer') {
        avatarHtml = `<img src="https://i.pravatar.cc/150?u=${currentCustomerId}" class="msg-avatar" alt="User">`;
    }
    
    wrapper.innerHTML = `
        ${avatarHtml}
        <div class="message-group">
            <div class="message ${sender}">${text}</div>
            <span class="msg-time">${time}</span>
        </div>
    `;
    
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text && currentCustomerId && ws && ws.readyState === WebSocket.OPEN) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Send to websocket
        ws.send(JSON.stringify({
            to: currentCustomerId,
            text: text,
            timestamp: time
        }));
        
        // Save to history & render
        chatHistory[currentCustomerId].push({ sender: 'agent', text, timestamp: time });
        appendMessage(text, 'agent', time);
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

// AI Analyze logic
async function analyzeAI(text) {
    if (!text) return;
    
    const aiInstruction = document.querySelector('.ai-instruction');
    const aiLoading = document.getElementById('ai-loading');
    const aiResults = document.getElementById('ai-results');
    const suggestionsList = document.getElementById('suggestions-list');
    
    aiInstruction.classList.add('hidden');
    aiResults.classList.add('hidden');
    aiLoading.classList.remove('hidden');
    
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });
        
        if (!res.ok) throw new Error("API Error");
        
        const data = await res.json();
        
        aiLoading.classList.add('hidden');
        aiResults.classList.remove('hidden');
        
        document.getElementById('ai-topic').innerText = data.topic;
        const sentimentEl = document.getElementById('ai-sentiment');
        if (data.predicted_satisfaction === 'unsatisfied' || data.predicted_satisfaction === 'False') {
            sentimentEl.innerText = "Tiêu cực";
            sentimentEl.className = "value sentiment bad";
        } else {
            sentimentEl.innerText = "Tích cực";
            sentimentEl.className = "value sentiment good";
        }
        
        suggestionsList.innerHTML = '';
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach((sug, index) => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                card.style.animationDelay = `${index * 0.1}s`;
                card.innerHTML = `
                    <p>${sug.response}</p>
                    <div class="card-footer">
                        <span class="similarity"><i class="fa-solid fa-bullseye"></i> Khớp ${(sug.similarity * 100).toFixed(0)}%</span>
                        <button class="btn-use">Sử dụng</button>
                    </div>
                `;
                card.querySelector('.btn-use').addEventListener('click', () => {
                    chatInput.value = sug.response;
                    chatInput.focus();
                });
                suggestionsList.appendChild(card);
            });
        } else {
            suggestionsList.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted); text-align: center; padding: 20px 0;">Không tìm thấy câu trả lời phù hợp.</p>`;
        }
    } catch (error) {
        resetAI();
        console.error(error);
    }
}

function resetAI() {
    document.querySelector('.ai-instruction').classList.remove('hidden');
    document.getElementById('ai-loading').classList.add('hidden');
    document.getElementById('ai-results').classList.add('hidden');
}

aiAssistBtn.addEventListener('click', () => {
    let text = chatInput.value.trim();
    if (!text && currentCustomerId) {
        const msgs = chatHistory[currentCustomerId] || [];
        const lastMsg = [...msgs].reverse().find(m => m.sender === 'customer');
        if (lastMsg) text = lastMsg.text;
    }
    analyzeAI(text);
});

// Start WS
connectWebSocket();
