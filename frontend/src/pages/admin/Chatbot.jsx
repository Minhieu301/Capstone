import React, { useState, useEffect } from "react";
import {
  Save,
  RotateCcw,
  MessageSquare,
  Database,
  Power,
} from "lucide-react";
import "../../styles/admin/chatbot.css";

export default function Chatbot() {
  // =====================
  // STATE
  // =====================
  const [settings, setSettings] = useState({
    enabled: true,
    welcomeMessage: "Xin chào! Tôi có thể giúp gì cho bạn?",
    responseDelay: 500,
    maxHistory: 50,
    dataSource: "all",
    temperature: 0.7,
    maxTokens: 500,
  });

  const [stats, setStats] = useState({
    totalConversations: 0,
    successfulResponses: 0,
    failedResponses: 0,
    averageResponseTime: "N/A",
  });

  const [chatHistory, setChatHistory] = useState([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [chatbotRunning, setChatbotRunning] = useState(false);

  // 🔽 TOGGLE HISTORY
  const [showHistory, setShowHistory] = useState(false);

  // =====================
  // LOAD SETTINGS
  // =====================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    fetch("http://localhost:8080/api/chatbot/admin/settings", { headers })
      .then((res) => res.ok ? res.json() : Promise.reject("API error"))
      .then((data) => {
        if (data && typeof data === "object") {
          setSettings((prev) => ({
            ...prev,
            ...data,
            // Ensure numeric fields have valid defaults
            responseDelay: data.responseDelay ?? prev.responseDelay ?? 500,
            maxHistory: data.maxHistory ?? prev.maxHistory ?? 50,
            temperature: data.temperature ?? prev.temperature ?? 0.7,
            maxTokens: data.maxTokens ?? prev.maxTokens ?? 500,
          }));
        }
      })
      .catch((err) => console.error("Load settings failed", err));
  }, []);

  // =====================
  // LOAD STATS
  // =====================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    fetch("http://localhost:8080/api/chatbot/admin/stats", { headers })
      .then((res) => res.ok ? res.json() : Promise.reject("API error"))
      .then((data) => {
        if (data && typeof data === "object") {
          setStats(data);
        }
      })
      .catch((err) => console.error("Load stats failed", err));
  }, []);

  // =====================
  // LOAD CHAT LOGS
  // =====================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    fetch("http://localhost:8080/api/chatbot/admin/logs", { headers })
      .then((res) => res.ok ? res.json() : Promise.reject("API error"))
      .then((data) => {
        if (Array.isArray(data)) {
          setChatHistory(data);
        }
      })
      .catch((err) => console.error("Load logs failed", err));
  }, []);

  // =====================
  // LOAD CHATBOT STATUS
  // =====================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    fetch("http://localhost:8080/api/admin/ai/status", { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setChatbotRunning(data?.isRunning || false))
      .catch((err) => {
        console.error("Load chatbot status failed", err);
        setChatbotRunning(false);
      });
  }, []);

  // =====================
  // TOGGLE ENABLE + START/STOP PROCESS
  // =====================
  const toggleChatbot = async () => {
    const newValue = !settings.enabled;
    setSavingToggle(true);

    setSettings((prev) => ({ ...prev, enabled: newValue }));

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      // 1. Save settings to DB
      await fetch("http://localhost:8080/api/chatbot/admin/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...settings, enabled: newValue }),
      });

      // 2. Start or stop AI process
      if (newValue) {
        const res = await fetch("http://localhost:8080/api/admin/ai/start", {
          method: "POST",
          headers,
        });
        const data = res.ok ? await res.json() : null;
        if (res.ok) {
          setChatbotRunning(true);
        } else {
          alert("❌ " + (data?.message || "Không thể khởi động Chatbot AI"));
          setSettings((prev) => ({ ...prev, enabled: false }));
        }
      } else {
        const res = await fetch("http://localhost:8080/api/admin/ai/stop", {
          method: "DELETE",
          headers,
        });
        const data = res.ok ? await res.json() : null;
        if (res.ok) {
          setChatbotRunning(false);
        } else {
          alert("❌ " + (data?.message || "Không thể dừng Chatbot AI"));
          setSettings((prev) => ({ ...prev, enabled: true }));
        }
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
      setSettings((prev) => ({ ...prev, enabled: !newValue }));
    } finally {
      setSavingToggle(false);
    }
  };

  // =====================
  // SAVE SETTINGS
  // =====================
  const handleSave = async () => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      await fetch("http://localhost:8080/api/chatbot/admin/settings", {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      });
      alert("Đã lưu cấu hình chatbot!");
    } catch (err) {
      alert("Lỗi khi lưu: " + err.message);
    }
  };

  // =====================
  // RESET
  // =====================
  const handleReset = () => {
    if (!window.confirm("Đặt lại toàn bộ cấu hình?")) return;

    setSettings({
      enabled: true,
      welcomeMessage: "Xin chào! Tôi có thể giúp gì cho bạn?",
      responseDelay: 500,
      maxHistory: 50,
      dataSource: "all",
      temperature: 0.7,
      maxTokens: 500,
    });
  };

  // =====================
  // REBUILD AI
  // =====================
  const handleRebuild = async () => {
    if (!window.confirm("Rebuild toàn bộ AI Engine? Thao tác này có thể mất vài phút.")) return;

    setRebuilding(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch("http://localhost:8080/api/admin/ai/rebuild", {
        method: "POST",
        headers,
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.message || `Rebuild AI thất bại (HTTP ${res.status})`);
      }

      alert(data?.message || "Đã kích hoạt rebuild AI!");
    } catch (err) {
      alert("Lỗi khi rebuild AI: " + err.message);
    } finally {
      setRebuilding(false);
    }
  };



  // =====================
  // RENDER
  // =====================
  return (
    <div className="chatbot-container">
      <header className="chatbot-page-header">
        <div>
          <p className="chatbot-kicker">Trợ lý pháp lý AI</p>
          <h1>Cấu hình Chatbot</h1>
          <p>Quản lý cấu hình và theo dõi hiệu suất phản hồi của hệ thống AI.</p>
        </div>
        <div className="chatbot-header-status">
          <span className={`status-pill ${settings.enabled ? "online" : "offline"}`}>
            <Power size={14} />
            {settings.enabled ? "Đang hoạt động" : "Đang tạm dừng"}
          </span>
        </div>
      </header>

      <div className="chatbot-status">
        <StatusBox
          label="Tổng hội thoại"
          value={stats.totalConversations}
          tone="primary"
          icon={<MessageSquare size={18} />}
        />
        <StatusBox
          label="Thành công"
          value={stats.successfulResponses}
          tone="success"
          icon={<Save size={18} />}
        />
        <StatusBox
          label="Lỗi"
          value={stats.failedResponses}
          tone="danger"
          icon={<RotateCcw size={18} />}
        />
        <StatusBox
          label="TG phản hồi TB"
          value={stats.averageResponseTime}
          tone="info"
          icon={<Database size={18} />}
        />
      </div>

      <div className="chatbot-section">
        <h3 className="chatbot-section-title">
          <MessageSquare size={18} /> Cài đặt chung
        </h3>

        <div className="chatbot-toggle-row">
          <button
            className={`toggle-btn ${settings.enabled ? "on" : "off"}`}
            onClick={toggleChatbot}
            disabled={savingToggle}
          >
            <Power size={16} />
            {settings.enabled ? "Chatbot ĐANG BẬT" : "Chatbot ĐANG TẮT"}
          </button>

          {savingToggle && (
            <span className="toggle-saving-state">Đang cập nhật...</span>
          )}
        </div>

        <div className="chatbot-settings">
          <div className="setting-item setting-item-full">
            <label className="setting-label">Tin nhắn chào mừng</label>
            <input
              className="setting-input"
              value={settings.welcomeMessage || ""}
              onChange={(e) =>
                setSettings({ ...settings, welcomeMessage: e.target.value })
              }
            />
          </div>

          <div className="setting-group">
            <Input
              label="Độ trễ (ms)"
              value={settings.responseDelay}
              onChange={(v) =>
                setSettings({ ...settings, responseDelay: v })
              }
            />
            <Input
              label="Lịch sử tối đa"
              value={settings.maxHistory}
              onChange={(v) =>
                setSettings({ ...settings, maxHistory: v })
              }
            />
          </div>
        </div>
      </div>

      {/* AI SETTINGS */}
      <div className="chatbot-section">
        <h3 className="chatbot-section-title">
          <Database size={18} /> Cài đặt AI
        </h3>

        <div className="chatbot-settings">
          <div className="setting-item setting-item-full">
            <label className="setting-label">Nguồn dữ liệu</label>
            <select
              className="setting-input"
              value={settings.dataSource || "all"}
              onChange={(e) =>
                setSettings({ ...settings, dataSource: e.target.value })
              }
            >
              <option value="all">Tất cả</option>
              <option value="laws">Văn bản pháp luật</option>
              <option value="content">Nội dung đơn giản hóa</option>
            </select>
          </div>

          <div className="setting-group">
            <Input
              label="Temperature"
              value={settings.temperature}
              onChange={(v) =>
                setSettings({ ...settings, temperature: v })
              }
            />
            <Input
              label="Max Tokens"
              value={settings.maxTokens}
              onChange={(v) =>
                setSettings({ ...settings, maxTokens: v })
              }
            />
          </div>
        </div>
      </div>

      <div className="chatbot-actions">
        <button className="action-btn save" onClick={handleSave}>
          <Save size={16} /> Lưu cấu hình
        </button>

        <button className="action-btn reset" onClick={handleReset}>
          <RotateCcw size={16} /> Đặt lại
        </button>

        <button
          className="action-btn rebuild"
          onClick={handleRebuild}
          disabled={rebuilding}
        >
          🔄 {rebuilding ? "Đang rebuild..." : "Rebuild AI"}
        </button>
      </div>

      <div className="chatbot-section chatbot-history-section">
        <div
          className="chatbot-history-head"
          onClick={() => setShowHistory(!showHistory)}
        >
          <span className="chatbot-history-title">
            <MessageSquare size={18} />
            Lịch sử hội thoại
          </span>

          <button type="button" className="chatbot-history-toggle">
            {showHistory ? "Ẩn ▲" : "Xem ▼"}
          </button>
        </div>

        {showHistory && (
          <div className="chatbot-history-body">
            {chatHistory.length === 0 ? (
              <div className="chatbot-history-empty">
                Chưa có dữ liệu hội thoại
              </div>
            ) : (
              <div className="chatbot-history-list">
                {chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className={`chat-log-item ${chat.status === "success" ? "success" : "failed"}`}
                  >
                    <div className="chat-log-header">
                      <strong>{chat.user}</strong>
                      <div className="chat-log-meta">
                        <span>{chat.timestamp}</span>
                        <span className={`chat-log-state ${chat.status === "success" ? "ok" : "error"}`}>
                          {chat.status === "success" ? "Thành công" : "Thất bại"}
                        </span>
                      </div>
                    </div>

                    <div className="chat-bubble chat-log-question">
                      <strong>❓ Câu hỏi:</strong>
                      <p>{chat.question}</p>
                    </div>

                    <div className="chat-bubble chat-log-answer">
                      <strong>🤖 Trả lời:</strong>
                      {chat.answer ? (
                        <p>{chat.answer}</p>
                      ) : (
                        <span className="chat-log-failed-text">Không thể phản hồi</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Helper components ===== */

function StatusBox({ label, value, tone = "primary", icon }) {
  return (
    <div className={`status-box tone-${tone}`}>
      <div className="status-box-head">
        <div className="status-label">{label}</div>
        <span className="status-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="status-value">
        {value}
      </div>
      <div className="status-caption">Cập nhật gần nhất: vừa xong</div>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div className="setting-item">
      <label className="setting-label">{label}</label>
      <input
        type="number"
        className="setting-input"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
