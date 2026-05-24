const API_URL = "http://localhost:8000/recommend";

let isInitialized = false;

function initSidebar() {
  if (document.getElementById("cs-sidebar")) return;

  const sidebar = document.createElement("div");
  sidebar.id = "cs-sidebar";
  sidebar.innerHTML = `
    <div id="cs-resizer" title="Kéo để thay đổi kích thước"></div>
    <div id="cs-sidebar-content">
      <div class="cs-header">
        <h3>🤖 CS Assistant</h3>
        <button id="cs-close-btn">&times;</button>
      </div>
      <div class="cs-body">
        <div id="cs-input-section">
          <p style="font-size: 14px; color: #64748b; margin-bottom: 12px; font-weight: 500;">Phân tích tin nhắn của khách hàng:</p>
          <textarea id="cs-manual-input" placeholder="Dán tin nhắn của khách vào đây, hoặc bôi đen văn bản trên trang rồi nhấn nút 'Lấy vùng chọn'..."></textarea>
          <div class="cs-action-row">
              <button id="cs-get-selection-btn">📝 Lấy vùng chọn</button>
              <button id="cs-analyze-btn">✨ Phân tích</button>
          </div>
        </div>
        <div id="cs-loading" style="display: none;">Đang phân tích dữ liệu...</div>
        <div id="cs-results"></div>
      </div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(sidebar);

  // Remove old FAB if any
  const oldFab = document.getElementById("cs-suggest-fab");
  if (oldFab) oldFab.remove();
  const oldPanel = document.getElementById("cs-suggest-panel");
  if (oldPanel) oldPanel.remove();

  document.getElementById("cs-close-btn").addEventListener("click", () => {
    sidebar.classList.remove("active");
  });

  // Resize Logic
  const resizer = document.getElementById('cs-resizer');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'ew-resize';
    sidebar.style.transition = 'none'; // Disable transition during resize
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let newWidth = window.innerWidth - e.clientX;
    if (newWidth < 300) newWidth = 300; 
    if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8; 
    sidebar.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      sidebar.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  });

  // Get Selection
  document.getElementById("cs-get-selection-btn").addEventListener("click", () => {
      const selection = window.getSelection().toString().trim();
      if(selection) {
          document.getElementById("cs-manual-input").value = selection;
      } else {
          alert("⚠️ Bạn chưa bôi đen đoạn văn bản nào trên trang.");
      }
  });

  // Analyze Button Action
  document.getElementById("cs-analyze-btn").addEventListener("click", async () => {
    const text = document.getElementById("cs-manual-input").value.trim();
    if (!text) {
        alert("⚠️ Vui lòng nhập tin nhắn cần phân tích.");
        return;
    }

    const resultsDiv = document.getElementById("cs-results");
    const loadingDiv = document.getElementById("cs-loading");
    
    resultsDiv.innerHTML = "";
    loadingDiv.style.display = "block";

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });
      
      if (!res.ok) throw new Error("Network response was not ok");
      
      const data = await res.json();
      loadingDiv.style.display = "none";
      renderResults(data, resultsDiv);
    } catch (err) {
      loadingDiv.style.display = "none";
      resultsDiv.innerHTML = `<div class="cs-error">⚠️ Lỗi kết nối. Hãy chắc chắn API server đang chạy ở localhost:8000.</div>`;
    }
  });
  
  isInitialized = true;
  console.log("CS Sidebar Initialized!");
}

function renderResults(data, container) {
  let html = `<div class="cs-meta">
    <span class="cs-topic">${data.topic}</span>
    <span class="cs-sentiment ${data.predicted_satisfaction === 'unsatisfied' ? 'bad' : 'good'}" title="Mức độ hài lòng dự đoán">
      ${data.predicted_satisfaction === 'unsatisfied' ? '😠 Tiêu cực' : '😊 Tích cực'}
    </span>
  </div>`;

  if (data.suggestions && data.suggestions.length > 0) {
    html += `<div class="cs-suggestions-list">`;
    data.suggestions.forEach((sug, idx) => {
      html += `
        <div class="cs-suggestion-item">
          <p>${sug.response}</p>
          <div class="cs-sug-footer">
            <span class="cs-similarity">Độ khớp: ${(sug.similarity * 100).toFixed(1)}%</span>
            <button class="cs-copy-btn" data-text="${sug.response.replace(/"/g, '&quot;')}">Copy</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `<p style="font-size: 15px; color: #64748b; margin-top: 15px;">Không tìm thấy câu trả lời phù hợp.</p>`;
  }

  container.innerHTML = html;

  // Add copy listeners
  document.querySelectorAll(".cs-copy-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const text = e.target.getAttribute("data-text");
      navigator.clipboard.writeText(text);
      e.target.innerText = "Đã Copy! ✔";
      e.target.style.background = "#10b981";
      e.target.style.color = "white";
      
      setTimeout(() => {
        e.target.innerText = "Copy";
        e.target.style.background = "#f1f5f9";
        e.target.style.color = "#475569";
      }, 2000);
    });
  });
}

// Try to init immediately
if (document.body) {
  initSidebar();
} else {
  document.addEventListener("DOMContentLoaded", initSidebar);
}

// Listen for toggle from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TOGGLE_SIDEBAR") {
    let sidebar = document.getElementById("cs-sidebar");
    if (!sidebar) {
        isInitialized = false;
        initSidebar();
        sidebar = document.getElementById("cs-sidebar");
    }
    
    if (sidebar) {
        sidebar.classList.toggle("active");
        sendResponse({status: "ok"});
    }
  }
});
