import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => {
  const existing = localStorage.getItem("welfarebot_session_id");
  if (existing) return existing;
  const newId = "session-" + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("welfarebot_session_id", newId);
  return newId;
});
  const [userName, setUserName] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [showFormChoice, setShowFormChoice] = useState(false);
  const [showSparkle, setShowSparkle] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    occupation: '',
    caste_category: '',
    gender: '',
    age: '',
    income_bracket: '',
    aadhaar: '',
  });

  const messageListEndRef = useRef(null);

  // Helper to parse bot messages into formatted blocks
  const parseMessageContent = (text) => {
    let cleanText = text;
    let parsedChips = [];
    let linkUrl = "";
    let docCard = null;

    // 1. Extract CHIPS: ["..."]
    const chipsRegex = /CHIPS:\s*(\[.*?\])/s;
    const chipsMatch = cleanText.match(chipsRegex);
    if (chipsMatch) {
      try {
        let jsonStr = chipsMatch[1].replace(/'/g, '"');
        parsedChips = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse chips JSON:", e);
      }
      cleanText = cleanText.replace(chipsRegex, "").trim();
    }

    // 2. Extract LINK: url
    const linkRegex = /LINK:\s*([^\s\n]+)/;
    const linkMatch = cleanText.match(linkRegex);
    if (linkMatch) {
      linkUrl = linkMatch[1].trim();
      cleanText = cleanText.replace(linkRegex, "").trim();
    }

    // 3. Extract Documents Card
    const docCardRegex = /📄 Required Documents for (.*?):\n([\s\S]*?)(?=\n\n|\n[A-Z]|\n*$)/;
    const docMatch = cleanText.match(docCardRegex);
    if (docMatch) {
      const schemeName = docMatch[1].trim();
      const itemsRaw = docMatch[2].trim().split("\n");
      const items = [];
      let tip = "";

      itemsRaw.forEach(item => {
        const match = item.match(/^\d+\.\s*(.*)/);
        if (match) {
          items.push(match[1].trim());
        } else if (item.trim()) {
          tip = item.trim();
        }
      });

      docCard = { schemeName, items, tip };
      cleanText = cleanText.replace(docCardRegex, "").trim();
    }

    return { cleanText, parsedChips, linkUrl, docCard };
  };

  // Initiate a clean session
  const initiateNewSession = () => {
    // Session ID already established by useState initializer
    const welcomeText = "Welcome to WelfareBot! 🙏 I help Indian citizens discover government welfare schemes. Let's get started — what's your name?";
    setMessages([{ sender: "bot", text: welcomeText }]);
    setChips(["Start over"]);
  };

  // Mount session loading logic
  useEffect(() => {
    // Fetch session info from backend using the persistent sessionId
    fetch(`http://localhost:8001/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.is_returning) {
          // Treat returning user as new user – ask for name again
          setMessages([
            { sender: "bot", text: "Welcome to WelfareBot! 🙏 I help Indian citizens discover government welfare schemes. Let's get started — what's your name?" }
          ]);
          setChips(["Start over"]);
        } else {
          // New user – start fresh greeting
          setMessages([
            { sender: "bot", text: "Welcome to WelfareBot! 🙏 I help Indian citizens discover government welfare schemes. Let's get started — what's your name?" }
          ]);
          setChips(["Start over"]);
        }
      })
      .catch(() => {
        // In case of error, fall back to fresh session UI
        setMessages([
          { sender: "bot", text: "Welcome to WelfareBot! 🙏 I help Indian citizens discover government welfare schemes. Let's get started — what's your name?" }
        ]);
        setChips(["Start over"]);
      });
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (overrideMessage = null) => {
    const text = overrideMessage || input;
    if (!text.trim()) return;

    // Append user message
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsTyping(true);
    setShowFormChoice(false);
    setChips([]); // Clear suggestions while loading
    setPreInputOptions([]); // Clear pre‑input options while waiting for response

    try {
      const response = await fetch('http://localhost:8001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text })
      });
      const data = await response.json();
      let replyText = data.reply;

      if (data.clear_session) {
        localStorage.removeItem("welfarebot_session_id");
        localStorage.removeItem("welfarebot_user_name");
        initiateNewSession();
        setIsTyping(false);
        return;
      }

      if (data.show_form_choice) {
        setShowFormChoice(true);
      }

      const parsed = parseMessageContent(replyText);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: parsed.cleanText,
        linkUrl: parsed.linkUrl,
        docCard: parsed.docCard
      }]);

      if (parsed.parsedChips && parsed.parsedChips.length > 0) {
        setChips(parsed.parsedChips);
        setPreInputOptions(parsed.parsedChips);
      } else {
        const defaultOpts = ["📝 Fill Form", "💬 Chat instead", "Tell me more", "Apply now", "Change my details", "Start over"];
        setChips(defaultOpts);
        setPreInputOptions(defaultOpts);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Error contacting server. Please try again.' }]);
      setChips(["Try again", "Start over"]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/submit-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, ...formData })
      });
      const data = await response.json();

      localStorage.setItem("welfarebot_user_name", formData.name);
      setUserName(formData.name);

      // Trigger sparkle burst
      setShowSparkle(true);
      setTimeout(() => setShowSparkle(false), 2000);

      const parsed = parseMessageContent(data.reply);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: parsed.cleanText,
        linkUrl: parsed.linkUrl,
        docCard: parsed.docCard
      }]);

      if (parsed.parsedChips && parsed.parsedChips.length > 0) {
          setChips(parsed.parsedChips);
          setPreInputOptions(parsed.parsedChips);
        } else {
          const defaultOpts = ["📝 Fill Form", "💬 Chat instead", "Tell me more", "Apply now", "Change my details", "Start over"];
          setChips(defaultOpts);
          setPreInputOptions(defaultOpts);
        }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Error submitting profile' }]);
      setChips(["Try again", "Start over"]);
    }
    setShowForm(false);
    setShowFormChoice(false);
  };

  const handleChipClick = (chip) => {
    if (chip === "📝 Fill Form" || chip === "Update my details" || chip === "Change my details") {
      setShowForm(true);
      setShowFormChoice(false);
    } else if (chip === "💬 Chat instead" || chip === "Ask something new") {
      // Hide form choice UI and send trigger to backend chat collection flow
      setShowFormChoice(false);
      handleSend("chat instead");
    } else if (chip === "Start over") {
      handleSend("Start over");
    } else if (chip === "Show my schemes") {
      handleSend("show my schemes");
    } else {
      handleSend(chip);
    }
  };

  return (
    <div className="app-viewport">
      {/* Sparkle Burst Overlay */}
      {showSparkle && (
        <div className="sparkle-overlay">
          <div className="sparkle-burst">✨</div>
        </div>
      )}

      <div className="chat-glass-card">
        <header className="chat-header">
          <div className="bot-avatar">🤖</div>
          <div className="header-info">
            <h2>WelfareBot</h2>
            <p>Empathetic Welfare Officer AI</p>
          </div>
        </header>

        <div className="messages-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`bubble-row fade-in ${msg.sender === 'user' ? 'user-row' : 'bot-row'}`}>
              <div className={`bubble ${msg.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                {msg.text}

                {/* Styled Document Card */}
                {msg.docCard && (
                  <div className="styled-doc-card">
                    <h5>📄 Required Documents</h5>
                    <p className="scheme-title">{msg.docCard.schemeName}</p>
                    <ul className="doc-list">
                      {msg.docCard.items.map((item, i) => (
                        <li key={i}>
                          <span className="badge">{i + 1}</span>
                          <span className="doc-name">{item}</span>
                        </li>
                      ))}
                    </ul>
                    {msg.docCard.tip && <div className="doc-tip">💡 {msg.docCard.tip}</div>}
                  </div>
                )}

                {/* Styled Apply Link Button */}
                {msg.linkUrl && (
                  <div className="apply-btn-container">
                    <a href={msg.linkUrl} target="_blank" rel="noopener noreferrer" className="apply-button">
                      Apply Now →
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="bubble-row bot-row">
              <div className="bubble bot-bubble typing-bubble">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messageListEndRef} />
          {/* Pre‑input chat option bar */}
          {preInputOptions.length > 0 && (
             <div className="pre-input-options">
               {preInputOptions.map((opt, i) => (
                 <button key={i} className="chip-btn" onClick={() => handleChipClick(opt)}>
                   {opt}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Dynamic Suggestion Chips or Form Choice */}
          {showFormChoice ? (
            <div className="chips-container">
              <button className="chip-btn" onClick={() => handleChipClick("📝 Fill Form")}>
                📝 Fill Form
              </button>
              <button className="chip-btn" onClick={() => handleChipClick("💬 Chat instead")}>
                💬 Chat instead
              </button>
            </div>
          ) : (
            chips.length > 0 && (
              <div className="chips-container">
                {chips.map((chip, idx) => (
                  <button key={idx} className="chip-btn" onClick={() => handleChipClick(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )
          )}

        {/* Input Bar */}
        <div className="input-bar">
          <input
            type="text"
            placeholder={showForm ? "Please complete the form..." : "Type your query here..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            disabled={showForm}
          />
          <button className="send-btn" onClick={() => handleSend()} disabled={showForm || !input.trim()}>
            Send
          </button>
        </div>
      </div>

      {/* Glassmorphic Form Overlay Modal */}
      {showForm && (
        <div className="form-overlay-modal">
          <div className="form-glass-box">
            <h3>📝 Tell us about yourself</h3>
            <p className="form-subtitle">We use these details to check eligibility rules</p>
            <form onSubmit={handleFormSubmit}>
              <div className="form-row">
                <input
                  name="name"
                  placeholder="First name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                />
                <input
                  name="age"
                  type="number"
                  placeholder="Age"
                  value={formData.age}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-row">
                <select name="gender" value={formData.gender} onChange={handleFormChange} required>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  name="state"
                  placeholder="State (e.g. Telangana)"
                  value={formData.state}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-row">
                <select name="occupation" value={formData.occupation} onChange={handleFormChange} required>
                  <option value="">Select Occupation</option>
                  <option value="student">Student</option>
                  <option value="farmer">Farmer</option>
                  <option value="daily wage worker">Daily wage worker</option>
                  <option value="business">Business</option>
                  <option value="government employee">Government employee</option>
                  <option value="other">Other</option>
                </select>
                <select name="caste_category" value={formData.caste_category} onChange={handleFormChange} required>
                  <option value="">Caste Category</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="OBC">OBC</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="form-row">
                <input
                  name="income_bracket"
                  type="number"
                  placeholder="Annual family income (₹)"
                  value={formData.income_bracket}
                  onChange={handleFormChange}
                  required
                />
                <input
                  name="aadhaar"
                  type="text"
                  placeholder="Aadhaar Number (optional)"
                  value={formData.aadhaar}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="form-submit-btn">Search Schemes</button>
                <button type="button" className="form-cancel-btn" onClick={() => {
                  setShowForm(false);
                  handleSend("chat instead");
                }}>
                  💬 Chat instead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;