const API_URL = "http://localhost:8000/recommend";

const chatInput = document.getElementById('chat-input');
const aiAssistBtn = document.getElementById('ai-assist-btn');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const aiInstruction = document.querySelector('.ai-instruction');
const aiLoading = document.getElementById('ai-loading');
const aiResults = document.getElementById('ai-results');
const suggestionsList = document.getElementById('suggestions-list');

// Send message logic
sendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text) {
        appendMessage(text, 'agent');
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

function appendMessage(text, sender) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    
    let avatarHtml = '';
    if (sender === 'customer') {
        avatarHtml = `<img src="https://i.pravatar.cc/150?img=1" class="msg-avatar" alt="User">`;
    }
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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

// AI Assist logic
aiAssistBtn.addEventListener('click', async () => {
    // Determine context: either text in input or the last customer message
    let textToAnalyze = chatInput.value.trim();
    
    if (!textToAnalyze) {
        // Find last customer message
        const customerMessages = document.querySelectorAll('.message.customer');
        if (customerMessages.length > 0) {
            textToAnalyze = customerMessages[customerMessages.length - 1].innerText;
            chatInput.value = textToAnalyze; // auto-fill for context
        }
    }
    
    if (!textToAnalyze) {
        alert("Vui lòng nhập văn bản hoặc chọn tin nhắn của khách để phân tích!");
        return;
    }
    
    // UI Transitions
    aiInstruction.classList.add('hidden');
    aiResults.classList.add('hidden');
    aiLoading.classList.remove('hidden');
    
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: textToAnalyze })
        });
        
        if (!res.ok) throw new Error("API Error");
        
        const data = await res.json();
        renderAiResults(data);
    } catch (error) {
        aiLoading.classList.add('hidden');
        aiInstruction.classList.remove('hidden');
        aiInstruction.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-danger)"></i><p style="color:var(--accent-danger)">Lỗi kết nối đến Server AI (localhost:8000). Hãy đảm bảo server đang chạy.</p>`;
    }
});

function renderAiResults(data) {
    aiLoading.classList.add('hidden');
    aiResults.classList.remove('hidden');
    
    // Update Meta
    document.getElementById('ai-topic').innerText = data.topic;
    
    const sentimentEl = document.getElementById('ai-sentiment');
    if (data.predicted_satisfaction === 'unsatisfied' || data.predicted_satisfaction === 'False') {
        sentimentEl.innerText = "Tiêu cực";
        sentimentEl.className = "value sentiment bad";
    } else {
        sentimentEl.innerText = "Tích cực";
        sentimentEl.className = "value sentiment good";
    }
    
    // Render Suggestions
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
            
            // Add click event for Use button
            card.querySelector('.btn-use').addEventListener('click', () => {
                chatInput.value = sug.response;
                chatInput.focus();
            });
            
            suggestionsList.appendChild(card);
        });
    } else {
        suggestionsList.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted); text-align: center; padding: 20px 0;">Không tìm thấy câu trả lời phù hợp.</p>`;
    }
}
