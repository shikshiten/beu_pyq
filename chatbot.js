/**
 * BEU ECE 4th Sem AI Study Assistant Chatbot
 * Powered by NVIDIA Nemotron 3.5 Super VL via OpenRouter
 * Pure Monochrome Nothing Tech Design (Zero emojis, Zero lucid icons)
 */

(function () {
  'use strict';

  // --- Configuration ---
  const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  const DEFAULT_MODEL = 'nvidia/nemotron-3.5-super-vl';
  const DEFAULT_KEY_B64 = 'c2stb3ItdjEtYTk0YTFlNThmM2QwN2YyMmE0MzlmMWEwZDA4NTdiYjgyYzE5MGQwNTVkYTBiZTQwMTU3Y2UyYjYxYjMzNjcyYw==';

  function getApiKey() {
    try {
      return localStorage.getItem('beu_openrouter_key') || atob(DEFAULT_KEY_B64);
    } catch (e) {
      return atob(DEFAULT_KEY_B64);
    }
  }

  // Portal Master Knowledge Base
  const PORTAL_KNOWLEDGE = {
    examRoutine: [
      { subject: 'Analog Communication', code: '104402', date: 'Wednesday, 28 Oct 2026' },
      { subject: 'Analog Electronics & Integrated Circuits', code: '104401 / 110401', date: 'Saturday, 31 Oct 2026' },
      { subject: 'Digital Circuits & Electronics', code: '104403 / 100403 / 105301', date: 'Tuesday, 03 Nov 2026' },
      { subject: 'Electromagnetic Field Theory (EMFT)', code: '104404 / 100308', date: 'Thursday, 05 Nov 2026' },
      { subject: 'Electronics Materials & Instrumentation', code: '104405 / 104604 / 110601 / 102404', date: 'Saturday, 07 Nov 2026' }
    ],
    notes: [
      { subject: 'Analog Communication (104402)', url: 'https://files.catbox.moe/xiy2ks.pdf', size: '4.5 MB' },
      { subject: 'Analog Electronics & IC (104401)', url: 'https://files.catbox.moe/hzi2q3.pdf', size: '13.8 MB' },
      { subject: 'Digital Circuits (104403)', url: 'https://u.pone.rs/wvfjwvlb.pdf', size: '5.9 MB' },
      { subject: 'Electromagnetic Field Theory (104404)', url: 'https://files.catbox.moe/edrmjs.pdf', size: '5.9 MB' },
      { subject: 'Electronic Materials & Instrumentation (104405)', url: 'https://files.catbox.moe/ldgf6w.pdf', size: '6.9 MB' }
    ],
    vviQuestions: [
      { subject: 'Analog Communication (25 VVI Q&A)', url: 'https://files.catbox.moe/gqx7rp.pdf' },
      { subject: 'Analog Electronics & IC (25 VVI Q&A)', url: 'https://files.catbox.moe/nvpkfq.pdf' },
      { subject: 'EMFT (25 VVI Q&A)', url: 'https://files.catbox.moe/azn68d.pdf' },
      { subject: 'Electronic Materials & Instruments (25 VVI Q&A)', url: 'https://files.catbox.moe/shsj9m.pdf' }
    ],
    masterPdfs: [
      { name: 'Master PDF 1 (All Subjects Compilation)', url: 'https://files.catbox.moe/o9v4eo.pdf' },
      { name: 'Master PDF 2 (ECE-4th-SEM-PYQs.pdf)', url: 'https://files.catbox.moe/fqdvdz.pdf' }
    ]
  };

  // State
  let conversationHistory = [];
  let isGenerating = false;
  let abortController = null;

  // --- Page Scanner ---
  function scanPage() {
    const pageTitle = document.title || 'BEU ECE Portal';
    const currentUrl = window.location.pathname;
    
    // Check if on paper page
    const paperCards = document.querySelectorAll('.nt-paper-card, .paper-header, header.paper-header');
    const questionBlocks = document.querySelectorAll('.question-block');
    
    if (questionBlocks.length > 0) {
      let paperInfo = '';
      if (paperCards.length > 0) {
        paperInfo = paperCards[0].innerText.replace(/\s+/g, ' ').trim();
      }
      
      const questions = [];
      questionBlocks.forEach((qb, idx) => {
        const title = qb.querySelector('.question-title span, .question-title')?.innerText?.replace(/COPY SOLUTION PROMPT/g, '')?.trim() || `Question ${idx + 1}`;
        const body = qb.querySelector('.question-body')?.innerText?.trim() || '';
        questions.push(`[${title}]\n${body}`);
      });
      
      return {
        type: 'question_paper',
        title: pageTitle,
        url: currentUrl,
        paperInfo: paperInfo,
        totalQuestions: questions.length,
        questions: questions
      };
    }
    
    // Check if on index / hub page
    const subjectItems = document.querySelectorAll('.subject-item, .vvi-card, .routine-card');
    if (subjectItems.length > 0) {
      const detected = [];
      subjectItems.forEach(el => {
        const txt = el.innerText.replace(/\s+/g, ' ').trim();
        if (txt) detected.push(txt);
      });
      return {
        type: 'portal_index',
        title: pageTitle,
        url: currentUrl,
        subjectsCount: subjectItems.length,
        summary: detected.slice(0, 15).join('\n---\n')
      };
    }

    return {
      type: 'general',
      title: pageTitle,
      url: currentUrl,
      bodyText: document.body.innerText.slice(0, 3000)
    };
  }

  // Build System Prompt
  function buildSystemPrompt() {
    const scan = scanPage();
    let scanContext = '';

    if (scan.type === 'question_paper') {
      scanContext = `\n\n--- CURRENT SCANNED PAGE (QUESTION PAPER) ---
Page Title: ${scan.title}
Paper Metadata: ${scan.paperInfo}
Total Questions Found: ${scan.totalQuestions}
Questions on this page:
${scan.questions.slice(0, 20).join('\n\n')}`;
    } else if (scan.type === 'portal_index') {
      scanContext = `\n\n--- CURRENT SCANNED PAGE (PORTAL INDEX) ---
Page Title: ${scan.title}
Cards Found on Page:
${scan.summary}`;
    } else {
      scanContext = `\n\n--- CURRENT SCANNED PAGE ---
Page Title: ${scan.title}
Page Snippet:
${scan.bodyText}`;
    }

    const prompt = `You are the official AI Study Assistant for Bihar Engineering University (BEU) Patna B.Tech ECE 4th Semester students on the Apna BEU PYQ Portal.
You are powered by NVIDIA Nemotron 3.5 Super VL.

YOUR CAPABILITIES & KNOWLEDGE:
1. You have direct, real-time access to the scanned page content provided below.
2. When answering or solving questions:
   - Provide rigorous, step-by-step solutions with clear derivations, circuit operation, truth tables, and final formulas.
   - Format all mathematical equations with standard LaTeX notation: inline with \\( ... \\) and display blocks with \\[ ... \\].
   - If solving an objective or MCQ question, state the correct option clearly and provide the exact mathematical or conceptual justification.
3. You have full knowledge of the BEU ECE 4th Sem syllabus, subject codes, routine, and official portal resources:
   - Routine:
     * Analog Comm (104402): 28 Oct 2026
     * Analog Electronics & IC (104401 / 110401): 31 Oct 2026
     * Digital Circuits & Electronics (104403 / 100403 / 105301): 03 Nov 2026
     * EMFT (104404 / 100308): 05 Nov 2026
     * Electronic Materials & Instrumentation (104405 / 104604 / 110601 / 102404): 07 Nov 2026
   - Notes PDF Links:
     * Analog Comm: https://files.catbox.moe/xiy2ks.pdf
     * Analog Electronics & IC: https://files.catbox.moe/hzi2q3.pdf
     * Digital Circuits: https://u.pone.rs/wvfjwvlb.pdf
     * EMFT: https://files.catbox.moe/edrmjs.pdf
     * Electronic Materials & Instrumentation: https://files.catbox.moe/ldgf6w.pdf
   - 25 VVI Packs:
     * Analog Comm: https://files.catbox.moe/gqx7rp.pdf
     * Analog Electronics & IC: https://files.catbox.moe/nvpkfq.pdf
     * EMFT: https://files.catbox.moe/azn68d.pdf
     * Materials & Instrumentation: https://files.catbox.moe/shsj9m.pdf
   - Master PDFs:
     * Master Compilation 1: https://files.catbox.moe/o9v4eo.pdf
     * Master Compilation 2: https://files.catbox.moe/fqdvdz.pdf
4. TONE & STYLE:
   - Pure academic, engineering-level precision, concise, and structured.
   - Do NOT use emojis. Maintain the clean monochrome Nothing Tech ethos.
   - Structure long explanations with clear markdown headings, bold points, and numbered steps.

${scanContext}`;

    return prompt;
  }

  // --- Lightweight Markdown Formatter ---
  function formatMarkdown(text) {
    if (!text) return '';
    
    // Preserve LaTeX blocks during parsing
    const latexMath = [];
    text = text.replace(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^\$\n]+\$)/g, (match) => {
      latexMath.push(match);
      return `___LATEX_MATH_${latexMath.length - 1}___`;
    });

    // Escape basic HTML
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    out = out.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="nt-chat-pre"><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code class="nt-chat-code">$1</code>');

    // Bold & Italics
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers
    out = out.replace(/^### (.*$)/gim, '<h4 class="nt-chat-h4">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 class="nt-chat-h3">$1</h3>');
    out = out.replace(/^# (.*$)/gim, '<h2 class="nt-chat-h2">$1</h2>');

    // Lists
    out = out.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="nt-chat-li">$1</li>');
    out = out.replace(/(<li class="nt-chat-li">[\s\S]*?<\/li>)+/g, '<ul class="nt-chat-ul">$&</ul>');
    
    out = out.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="nt-chat-oli">$2</li>');
    out = out.replace(/(<li class="nt-chat-oli">[\s\S]*?<\/li>)+/g, '<ol class="nt-chat-ol">$&</ol>');

    // Paragraphs
    out = out.replace(/\n{2,}/g, '</p><p class="nt-chat-p">');
    out = '<p class="nt-chat-p">' + out + '</p>';
    out = out.replace(/<p class="nt-chat-p"><\/(ul|ol|pre|h2|h3|h4)>/g, '</$1>');
    out = out.replace(/<(ul|ol|pre|h2|h3|h4)><\/p>/g, '<$1>');
    out = out.replace(/\n/g, '<br>');

    // Restore LaTeX blocks
    out = out.replace(/___LATEX_MATH_(\d+)___/g, (match, idx) => {
      return latexMath[parseInt(idx, 10)] || '';
    });

    return out;
  }

  // Trigger MathJax re-render
  function triggerMathJax(elem) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([elem]).catch(() => {});
    }
  }

  // --- Inject CSS & DOM ---
  function injectStylesAndUI() {
    if (document.getElementById('beuChatbotRoot')) return;

    const style = document.createElement('style');
    style.id = 'beuChatbotStyles';
    style.textContent = `
/* --- BEU AI Chatbot (Nothing Tech Monochrome Aesthetic) --- */
:root {
  --nt-bot-bg: #0c0c0c;
  --nt-bot-card: #141414;
  --nt-bot-border: #242424;
  --nt-bot-border-light: #333333;
  --nt-bot-text: #f5f5f5;
  --nt-bot-text-muted: #888888;
  --nt-bot-red: #d71921;
}

body.light-mode {
  --nt-bot-bg: #ffffff;
  --nt-bot-card: #f5f5f7;
  --nt-bot-border: #dcdce0;
  --nt-bot-border-light: #c0c0c5;
  --nt-bot-text: #111111;
  --nt-bot-text-muted: #666666;
}

/* Floating Trigger Button */
.nt-bot-trigger {
  position: fixed;
  bottom: 24px;
  right: 76px;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nt-bot-bg);
  border: 1px solid var(--nt-bot-border-light);
  padding: 10px 14px;
  border-radius: 24px;
  color: var(--nt-bot-text);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.nt-bot-trigger:hover {
  border-color: var(--nt-bot-text);
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
}

.nt-bot-red-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nt-bot-red);
  box-shadow: 0 0 6px var(--nt-bot-red);
  animation: nt-bot-pulse 2s infinite;
}

@keyframes nt-bot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.85); }
}

/* Chat Container Window */
.nt-bot-window {
  position: fixed;
  bottom: 76px;
  right: 24px;
  width: 440px;
  max-width: calc(100vw - 32px);
  height: 640px;
  max-height: calc(100vh - 100px);
  background: var(--nt-bot-bg);
  border: 1px solid var(--nt-bot-border);
  border-radius: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  transform: translateY(20px) scale(0.96);
  opacity: 0;
  pointer-events: none;
}

.nt-bot-window.open {
  transform: translateY(0) scale(1);
  opacity: 1;
  pointer-events: auto;
}

/* Header */
.nt-bot-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--nt-bot-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--nt-bot-card);
}

.nt-bot-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nt-bot-title-group h3 {
  font-family: 'Space Grotesk', -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--nt-bot-text);
  margin: 0;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.nt-bot-subtitle {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px;
  color: var(--nt-bot-text-muted);
  letter-spacing: 0.4px;
}

.nt-bot-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nt-bot-btn-icon {
  background: transparent;
  border: 1px solid var(--nt-bot-border);
  border-radius: 6px;
  color: var(--nt-bot-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.nt-bot-btn-icon:hover {
  color: var(--nt-bot-text);
  border-color: var(--nt-bot-text);
}

/* Scanner Context Bar */
.nt-bot-scan-bar {
  padding: 8px 14px;
  background: var(--nt-bot-bg);
  border-bottom: 1px dashed var(--nt-bot-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--nt-bot-text-muted);
}

.nt-bot-scan-status {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nt-bot-scan-btn {
  background: var(--nt-bot-card);
  border: 1px solid var(--nt-bot-border);
  color: var(--nt-bot-text);
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  font-weight: 600;
  transition: all 0.15s;
  flex-shrink: 0;
}

.nt-bot-scan-btn:hover {
  border-color: var(--nt-bot-text);
}

/* Quick Action Chips */
.nt-bot-chips {
  padding: 8px 12px;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid var(--nt-bot-border);
  scrollbar-width: none;
  background: var(--nt-bot-bg);
}

.nt-bot-chips::-webkit-scrollbar {
  display: none;
}

.nt-bot-chip {
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--nt-bot-border);
  background: var(--nt-bot-card);
  color: var(--nt-bot-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.nt-bot-chip:hover {
  border-color: var(--nt-bot-text);
  background: var(--nt-bot-border-light);
}

/* Chat Messages */
.nt-bot-messages {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--nt-bot-bg);
  scroll-behavior: smooth;
}

.nt-bot-msg {
  display: flex;
  flex-direction: column;
  max-width: 90%;
  animation: nt-msg-fade 0.2s ease;
}

@keyframes nt-msg-fade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.nt-bot-msg.user {
  align-self: flex-end;
}

.nt-bot-msg.bot {
  align-self: flex-start;
  max-width: 95%;
}

.nt-bot-msg-role {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  color: var(--nt-bot-text-muted);
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nt-bot-msg.user .nt-bot-msg-role {
  text-align: right;
}

.nt-bot-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-family: 'Space Grotesk', -apple-system, sans-serif;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--nt-bot-text);
  word-break: break-word;
}

.nt-bot-msg.user .nt-bot-bubble {
  background: var(--nt-bot-card);
  border: 1px solid var(--nt-bot-border-light);
  border-bottom-right-radius: 2px;
}

.nt-bot-msg.bot .nt-bot-bubble {
  background: var(--nt-bot-card);
  border: 1px solid var(--nt-bot-border);
  border-bottom-left-radius: 2px;
}

/* Markdown inside bubble */
.nt-chat-p { margin: 0 0 8px 0; }
.nt-chat-p:last-child { margin-bottom: 0; }
.nt-chat-h2, .nt-chat-h3, .nt-chat-h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  margin: 10px 0 4px 0;
  color: var(--nt-bot-text);
}
.nt-chat-h2 { font-size: 14px; }
.nt-chat-h3 { font-size: 13px; }
.nt-chat-h4 { font-size: 12px; }

.nt-chat-ul, .nt-chat-ol {
  margin: 4px 0 8px 18px;
  padding: 0;
}
.nt-chat-li, .nt-chat-oli {
  margin-bottom: 3px;
}
.nt-chat-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  background: rgba(125, 125, 125, 0.15);
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid var(--nt-bot-border);
}
.nt-chat-pre {
  background: #000;
  border: 1px solid var(--nt-bot-border);
  border-radius: 8px;
  padding: 10px;
  margin: 8px 0;
  overflow-x: auto;
}
.nt-chat-pre code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #eee;
}

/* Bubble Actions */
.nt-bot-msg-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.nt-bot-copy-btn {
  background: transparent;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--nt-bot-text-muted);
  cursor: pointer;
  padding: 2px 4px;
}

.nt-bot-copy-btn:hover {
  color: var(--nt-bot-text);
}

/* Typing Indicator */
.nt-bot-typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 12px;
}

.nt-bot-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nt-bot-text-muted);
  animation: nt-bot-bounce 1.4s infinite ease-in-out both;
}

.nt-bot-dot:nth-child(1) { animation-delay: -0.32s; }
.nt-bot-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes nt-bot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Input Area */
.nt-bot-input-area {
  padding: 10px 14px;
  background: var(--nt-bot-card);
  border-top: 1px solid var(--nt-bot-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nt-bot-input-box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--nt-bot-bg);
  border: 1px solid var(--nt-bot-border);
  border-radius: 10px;
  padding: 6px 10px;
}

.nt-bot-input-box:focus-within {
  border-color: var(--nt-bot-border-light);
}

.nt-bot-textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--nt-bot-text);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12.5px;
  resize: none;
  outline: none;
  max-height: 100px;
  line-height: 1.4;
  padding: 4px 0;
}

.nt-bot-textarea::placeholder {
  color: var(--nt-bot-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.nt-bot-send-btn {
  background: var(--nt-bot-text);
  color: var(--nt-bot-bg);
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 6px 12px;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.nt-bot-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nt-bot-footer-note {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--nt-bot-text-muted);
  text-align: center;
  letter-spacing: 0.3px;
}

@media (max-width: 600px) {
  .nt-bot-window {
    right: 12px;
    left: 12px;
    bottom: 74px;
    width: auto;
    max-width: none;
    height: 75vh;
  }
  .nt-bot-trigger {
    right: 68px;
    bottom: 20px;
    padding: 8px 12px;
  }
}
`;
    document.head.appendChild(style);

    // Create UI container
    const root = document.createElement('div');
    root.id = 'beuChatbotRoot';
    root.innerHTML = `
      <!-- Launcher Button -->
      <button id="ntBotTrigger" class="nt-bot-trigger" title="Open AI Study Assistant">
        <span class="nt-bot-red-pulse"></span>
        <span>AI ASSISTANT</span>
      </button>

      <!-- Chat Drawer Window -->
      <div id="ntBotWindow" class="nt-bot-window" role="dialog" aria-modal="true" aria-label="BEU AI Chatbot">
        <!-- Header -->
        <div class="nt-bot-header">
          <div class="nt-bot-header-left">
            <span class="nt-bot-red-pulse"></span>
            <div class="nt-bot-title-group">
              <h3>BEU AI ASSISTANT</h3>
              <div class="nt-bot-subtitle">NVIDIA NEMOTRON 3.5 &bull; LIVE SCANNER</div>
            </div>
          </div>
          <div class="nt-bot-header-actions">
            <button id="ntBotClearBtn" class="nt-bot-btn-icon" title="Clear Chat History">CLEAR</button>
            <button id="ntBotCloseBtn" class="nt-bot-btn-icon" title="Close Chatbot">&times;</button>
          </div>
        </div>

        <!-- Live Scanner Status Bar -->
        <div class="nt-bot-scan-bar">
          <div id="ntBotScanStatus" class="nt-bot-scan-status">
            <span>&bull;</span>
            <span id="ntBotScanLabel">Scanning page content...</span>
          </div>
          <button id="ntBotRescanBtn" class="nt-bot-scan-btn">RE-SCAN</button>
        </div>

        <!-- Quick Action Chips -->
        <div class="nt-bot-chips">
          <button class="nt-bot-chip" data-query="Scan this page and give me a full summary of questions and topics covered.">Scan This Page</button>
          <button class="nt-bot-chip" data-query="Solve Question 1 (compulsory questions) from this paper step-by-step.">Solve Compulsory Q1</button>
          <button class="nt-bot-chip" data-query="Show me the exam routine, dates, and subject codes for BEU ECE 4th Sem.">Exam Routine</button>
          <button class="nt-bot-chip" data-query="Provide the direct PDF notes links for all 5 ECE 4th semester subjects.">Subject Notes</button>
          <button class="nt-bot-chip" data-query="Where can I find 25 VVI Questions for 4th Sem ECE?">VVI Questions</button>
        </div>

        <!-- Messages Area -->
        <div id="ntBotMessages" class="nt-bot-messages">
          <div class="nt-bot-msg bot">
            <span class="nt-bot-msg-role">NVIDIA Nemotron 3.5 Super VL</span>
            <div class="nt-bot-bubble">
              Hello! I am your <strong>BEU ECE 4th Sem AI Study Assistant</strong>, powered by NVIDIA Nemotron 3.5 Super VL.
              <br><br>
              I can scan this page, solve any question with derivations and circuits, find notes links, and answer syllabus queries.
              <br><br>
              Click a chip above or type your question below!
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="nt-bot-input-area">
          <div class="nt-bot-input-box">
            <textarea id="ntBotTextarea" class="nt-bot-textarea" placeholder="Ask about this paper, solve questions, or search..." rows="1"></textarea>
            <button id="ntBotSendBtn" class="nt-bot-send-btn">SEND</button>
          </div>
          <div class="nt-bot-footer-note">
            Press Enter to send &bull; Shift+Enter for new line
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Initial scanner status update
    updateScannerStatus();
    attachEventListeners();
  }

  // Update Scanner status label
  function updateScannerStatus() {
    const label = document.getElementById('ntBotScanLabel');
    if (!label) return;
    const scan = scanPage();
    if (scan.type === 'question_paper') {
      label.innerText = `Scanned: ${scan.totalQuestions} Questions from ${scan.title}`;
    } else if (scan.type === 'portal_index') {
      label.innerText = `Scanned: Portal Index (${scan.subjectsCount} Subjects & Packs)`;
    } else {
      label.innerText = `Scanned: ${scan.title}`;
    }
  }

  // Append message to UI
  function appendMessage(role, rawContent) {
    const container = document.getElementById('ntBotMessages');
    if (!container) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `nt-bot-msg ${role}`;

    const roleSpan = document.createElement('span');
    roleSpan.className = 'nt-bot-msg-role';
    roleSpan.innerText = role === 'user' ? 'YOU' : 'NVIDIA Nemotron 3.5';

    const bubble = document.createElement('div');
    bubble.className = 'nt-bot-bubble';
    bubble.innerHTML = role === 'user' ? rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : formatMarkdown(rawContent);

    msgDiv.appendChild(roleSpan);
    msgDiv.appendChild(bubble);

    if (role === 'bot') {
      const actions = document.createElement('div');
      actions.className = 'nt-bot-msg-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'nt-bot-copy-btn';
      copyBtn.innerText = 'COPY';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(rawContent).then(() => {
          copyBtn.innerText = 'COPIED!';
          setTimeout(() => { copyBtn.innerText = 'COPY'; }, 2000);
        });
      };
      actions.appendChild(copyBtn);
      msgDiv.appendChild(actions);

      // Trigger MathJax typesetting
      triggerMathJax(bubble);
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  // Show typing indicator
  function showTypingIndicator() {
    const container = document.getElementById('ntBotMessages');
    const indicator = document.createElement('div');
    indicator.id = 'ntBotTyping';
    indicator.className = 'nt-bot-msg bot';
    indicator.innerHTML = `
      <span class="nt-bot-msg-role">NVIDIA Nemotron 3.5 Super VL</span>
      <div class="nt-bot-bubble nt-bot-typing">
        <span class="nt-bot-dot"></span>
        <span class="nt-bot-dot"></span>
        <span class="nt-bot-dot"></span>
      </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('ntBotTyping');
    if (indicator) indicator.remove();
  }

  // --- API Call via OpenRouter ---
  async function sendToOpenRouter(userPrompt) {
    if (isGenerating) return;
    isGenerating = true;

    const sendBtn = document.getElementById('ntBotSendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerText = '...';
    }

    appendMessage('user', userPrompt);
    conversationHistory.push({ role: 'user', content: userPrompt });

    showTypingIndicator();

    try {
      const systemPrompt = buildSystemPrompt();
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6) // Send recent context
      ];

      abortController = new AbortController();

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://stutosed.vercel.app',
          'X-Title': 'BEU ECE PYQ Portal'
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: messages,
          stream: false // Non-streaming ensures solid completion without truncation of reasoning tokens
        }),
        signal: abortController.signal
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status}: Failed to generate response`;
        appendMessage('bot', `**Error from AI service:** ${errMsg}`);
        return;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'No response returned from model.';

      appendMessage('bot', reply);
      conversationHistory.push({ role: 'assistant', content: reply });

    } catch (err) {
      removeTypingIndicator();
      if (err.name === 'AbortError') {
        appendMessage('bot', 'Generation stopped.');
      } else {
        appendMessage('bot', `**Network Error:** Could not connect to OpenRouter (${err.message}). Check your internet connection.`);
      }
    } finally {
      isGenerating = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerText = 'SEND';
      }
      const textarea = document.getElementById('ntBotTextarea');
      if (textarea) textarea.focus();
    }
  }

  // --- Event Listeners ---
  function attachEventListeners() {
    const trigger = document.getElementById('ntBotTrigger');
    const win = document.getElementById('ntBotWindow');
    const closeBtn = document.getElementById('ntBotCloseBtn');
    const clearBtn = document.getElementById('ntBotClearBtn');
    const rescanBtn = document.getElementById('ntBotRescanBtn');
    const textarea = document.getElementById('ntBotTextarea');
    const sendBtn = document.getElementById('ntBotSendBtn');

    function toggleChat(open) {
      if (open === undefined) open = !win.classList.contains('open');
      if (open) {
        win.classList.add('open');
        updateScannerStatus();
        setTimeout(() => textarea.focus(), 150);
      } else {
        win.classList.remove('open');
      }
    }

    trigger.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));

    clearBtn.addEventListener('click', () => {
      conversationHistory = [];
      const container = document.getElementById('ntBotMessages');
      container.innerHTML = `
        <div class="nt-bot-msg bot">
          <span class="nt-bot-msg-role">NVIDIA Nemotron 3.5 Super VL</span>
          <div class="nt-bot-bubble">
            Chat cleared! How can I assist you with BEU ECE 4th Sem PYQs?
          </div>
        </div>
      `;
    });

    rescanBtn.addEventListener('click', () => {
      updateScannerStatus();
      appendMessage('bot', `Page re-scanned! I have updated my knowledge with the latest content on this page.`);
    });

    function handleSend() {
      const text = textarea.value.trim();
      if (!text || isGenerating) return;
      textarea.value = '';
      textarea.style.height = 'auto';
      sendToOpenRouter(text);
    }

    sendBtn.addEventListener('click', handleSend);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    });

    // Quick Action Chips
    document.querySelectorAll('.nt-bot-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query) {
          if (!win.classList.contains('open')) toggleChat(true);
          sendToOpenRouter(query);
        }
      });
    });

    // Keyboard Shortcut (Alt + C or Ctrl + Space)
    window.addEventListener('keydown', (e) => {
      if ((e.altKey && e.key.toLowerCase() === 'c') || (e.ctrlKey && e.code === 'Space')) {
        e.preventDefault();
        toggleChat();
      }
      if (e.key === 'Escape' && win.classList.contains('open')) {
        toggleChat(false);
      }
    });
  }

  // Global API Hook so question modal can trigger it directly
  window.BEUChatbot = {
    openAndAsk: function (promptText) {
      const win = document.getElementById('ntBotWindow');
      if (win && !win.classList.contains('open')) {
        win.classList.add('open');
      }
      updateScannerStatus();
      sendToOpenRouter(promptText);
    },
    toggle: function () {
      const trigger = document.getElementById('ntBotTrigger');
      if (trigger) trigger.click();
    }
  };

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStylesAndUI);
  } else {
    injectStylesAndUI();
  }
})();
