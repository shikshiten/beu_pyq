/**
 * BEU ECE 4th Sem AI Study Assistant Chatbot
 * Powered by Google Gemini AI
 * Pure Monochrome Nothing Tech Design (Zero emojis, Zero lucid icons)
 */

(function () {
  'use strict';

  // --- Configuration ---
  const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  // Auto-fallback model list in priority order
  const CANDIDATE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];
  const DEFAULT_KEY_B64 = 'QVEuQWI4Uk42STY1SndmRGJsRDE3ajVleXpNQzhsS040dTNEZXZFZ0pCSFVhZDl5NHctT2c=';

  function getApiKey() {
    try {
      return localStorage.getItem('beu_gemini_key') || localStorage.getItem('beu_openrouter_key') || atob(DEFAULT_KEY_B64);
    } catch (e) {
      return atob(DEFAULT_KEY_B64);
    }
  }

  function getAvatarUrl() {
    const isSub = (typeof location !== 'undefined') && (location.pathname.indexOf('ECE_4th_Sem_PYQs') !== -1);
    return isSub ? '../ai_assistant_avatar.jpg' : 'ai_assistant_avatar.jpg';
  }

  // Portal Master Knowledge Base
  const PORTAL_KNOWLEDGE = {
    examRoutine: [
      { subject: 'Analog Communication', code: '104402', date: 'Wednesday, 28 Oct 2026' },
      { subject: 'Analog Electronics & Integrated Circuits', code: '104401 / 110401', date: 'Saturday, 31 Oct 2026' },
      { subject: 'Digital Circuits & Electronics', code: '104403 / 100403 / 105301 / 103401', date: 'Tuesday, 03 Nov 2026' },
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

  // Storage Key for Chat History
  const STORAGE_KEY = 'beu_ai_chat_history_v1';

  // State
  let conversationHistory = [];
  let isGenerating = false;
  let abortController = null;

  function loadChatHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveChatHistory(history) {
    try {
      const trimmed = history.slice(-40);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {}
  }

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
You are powered by Google Gemini AI.

CRITICAL FORMATTING INSTRUCTIONS:
1. Always format answers with clean, beautiful Markdown structure:
   - Use headings (### for major sections, #### for subheadings).
   - Use bullet points and numbered lists for steps.
   - For comparisons, truth tables, or parameter values, ALWAYS format them as Markdown tables with headers (| Col 1 | Col 2 |).
2. Mathematics and Equations (LaTeX):
   - Place display equations on their own lines using standard LaTeX delimiters: \\[ ... \\]
   - Use inline math notation with \\( ... \\)
   - Ensure clean equation formatting without clumping.
3. Solution Structure:
   - Step 1: Definition / Core Principle
   - Step 2: Circuit Description or Mathematical Formulation
   - Step 3: Derivation / Calculation
   - Step 4: Final Answer or Conclusion (highlight key formula in bold)
4. Do NOT use emojis. Maintain the clean monochrome Nothing Tech ethos.

PORTAL KNOWLEDGE & RESOURCES:
- Routine:
  * Analog Comm (104402): 28 Oct 2026
  * Analog Electronics & IC (104401 / 110401): 31 Oct 2026
  * Digital Circuits & Electronics (104403 / 100403 / 105301 / 103401): 03 Nov 2026
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

${scanContext}`;

    return prompt;
  }

  // --- Robust Markdown & LaTeX Formatter ---
  function formatMarkdown(md) {
    if (!md) return '';

    const mathBlocks = [];
    const codeBlocks = [];

    // 1. Protect Code Blocks
    let text = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      codeBlocks.push({ lang, code });
      return `\n\n___CODE_BLOCK_${codeBlocks.length - 1}___\n\n`;
    });

    // 2. Protect Display Math: \[ ... \] or $$ ... $$
    text = text.replace(/(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g, (match) => {
      mathBlocks.push(match);
      return `\n\n___MATH_BLOCK_${mathBlocks.length - 1}___\n\n`;
    });

    // 3. Protect Inline Math: \( ... \) or $ ... $
    text = text.replace(/(\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g, (match) => {
      mathBlocks.push(match);
      return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
    });

    // Helper for inline spans: bold, italic, code, links
    function formatInline(str) {
      let s = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Bold
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Italic
      s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // Inline code
      s = s.replace(/`([^`]+)`/g, '<code class="nt-chat-code">$1</code>');
      // Links
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="nt-chat-link">$1</a>');

      return s;
    }

    // Separate non-matching lines before transitions
    text = text.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');
    text = text.replace(/([^\n* -])\n([*-]\s+)/g, '$1\n\n$2');
    text = text.replace(/([^\n0-9 .])\n(\d+\.\s+)/g, '$1\n\n$2');
    text = text.replace(/([^\n|])\n(\|)/g, '$1\n\n$2');

    const rawBlocks = text.split(/\n{2,}/);
    const outBlocks = [];

    for (let raw of rawBlocks) {
      let block = raw.trim();
      if (!block) continue;

      // Code block placeholder
      if (/^___CODE_BLOCK_\d+___$/.test(block)) {
        outBlocks.push(block);
        continue;
      }

      // Display math block placeholder
      if (/^___MATH_BLOCK_\d+___$/.test(block)) {
        outBlocks.push(`<div class="nt-chat-math">${block}</div>`);
        continue;
      }

      // Headings: #, ##, ###, ####
      if (/^#{1,6}\s+/.test(block)) {
        const match = block.match(/^(#{1,6})\s+(.*)$/);
        const level = match[1].length;
        const hTag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
        outBlocks.push(`<${hTag} class="nt-chat-${hTag}">${formatInline(match[2])}</${hTag}>`);
        continue;
      }

      // Blockquote: > ...
      if (/^>\s+/.test(block)) {
        const qLines = block.split('\n').map(l => l.replace(/^>\s*/, ''));
        outBlocks.push(`<blockquote class="nt-chat-quote">${formatInline(qLines.join(' '))}</blockquote>`);
        continue;
      }

      // Markdown Table
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const isTable = lines.length >= 2 && lines.every(l => l.includes('|')) && /\|?\s*:?-+:?\s*\|/.test(lines[1]);
      if (isTable) {
        const parseRow = (rowStr) => {
          return rowStr.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        };
        const headerCols = parseRow(lines[0]);
        let tableHtml = '<div class="nt-chat-table-wrap"><table class="nt-chat-table"><thead><tr>';
        for (const h of headerCols) {
          tableHtml += `<th>${formatInline(h)}</th>`;
        }
        tableHtml += '</tr></thead><tbody>';

        for (let i = 2; i < lines.length; i++) {
          const rowCols = parseRow(lines[i]);
          tableHtml += '<tr>';
          for (const col of rowCols) {
            tableHtml += `<td>${formatInline(col)}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table></div>';
        outBlocks.push(tableHtml);
        continue;
      }

      // Unordered List
      const isUList = lines.length > 0 && lines.every(l => /^[*-]\s+/.test(l));
      if (isUList) {
        let listHtml = '<ul class="nt-chat-ul">';
        for (const line of lines) {
          const item = line.replace(/^[*-]\s+/, '');
          listHtml += `<li class="nt-chat-li">${formatInline(item)}</li>`;
        }
        listHtml += '</ul>';
        outBlocks.push(listHtml);
        continue;
      }

      // Ordered List
      const isOList = lines.length > 0 && lines.every(l => /^\d+\.\s+/.test(l));
      if (isOList) {
        let listHtml = '<ol class="nt-chat-ol">';
        for (const line of lines) {
          const item = line.replace(/^\d+\.\s+/, '');
          listHtml += `<li class="nt-chat-oli">${formatInline(item)}</li>`;
        }
        listHtml += '</ol>';
        outBlocks.push(listHtml);
        continue;
      }

      // Standard Paragraph with inline breaks
      const pLines = lines.map(l => formatInline(l)).join('<br>');
      outBlocks.push(`<p class="nt-chat-p">${pLines}</p>`);
    }

    // Merge adjacent <ul> and <ol> blocks
    let mergedBlocks = [];
    for (let b of outBlocks) {
      if (mergedBlocks.length > 0) {
        const prev = mergedBlocks[mergedBlocks.length - 1];
        if (prev.endsWith('</ul>') && b.startsWith('<ul class="nt-chat-ul">')) {
          mergedBlocks[mergedBlocks.length - 1] = prev.slice(0, -5) + b.replace(/^<ul class="nt-chat-ul">/, '');
          continue;
        }
        if (prev.endsWith('</ol>') && b.startsWith('<ol class="nt-chat-ol">')) {
          mergedBlocks[mergedBlocks.length - 1] = prev.slice(0, -5) + b.replace(/^<ol class="nt-chat-ol">/, '');
          continue;
        }
      }
      mergedBlocks.push(b);
    }

    let finalHtml = mergedBlocks.join('\n');

    // Restore Code Blocks
    finalHtml = finalHtml.replace(/___CODE_BLOCK_(\d+)___/g, (match, idx) => {
      const item = codeBlocks[parseInt(idx, 10)];
      if (!item) return '';
      const safeCode = item.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="nt-chat-pre"><code>${safeCode}</code></pre>`;
    });

    // Restore Math Blocks
    finalHtml = finalHtml.replace(/___MATH_BLOCK_(\d+)___/g, (match, idx) => {
      return mathBlocks[parseInt(idx, 10)] || '';
    });

    return finalHtml;
  }

  // Trigger MathJax re-render
  function triggerMathJax(elem) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([elem]).catch(() => {});
    } else {
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([elem]).catch(() => {});
        }
      }, 400);
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
  gap: 10px;
  background: var(--nt-bot-bg);
  border: 1px solid var(--nt-bot-border-light);
  padding: 8px 14px 8px 10px;
  border-radius: 28px;
  color: var(--nt-bot-text);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55), 0 0 15px rgba(215, 25, 33, 0.2);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.nt-bot-trigger:hover {
  border-color: var(--nt-bot-text);
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7), 0 0 25px rgba(215, 25, 33, 0.35);
}

/* AI Avatar Orb (Muse AI & ChatGPT Dot Aesthetic) */
.nt-bot-avatar-orb {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(215, 25, 33, 0.45), 0 0 16px rgba(120, 80, 255, 0.25);
  animation: nt-orb-breathe 3s ease-in-out infinite alternate;
}

.nt-bot-avatar-orb.header-orb {
  width: 32px;
  height: 32px;
  box-shadow: 0 0 14px rgba(215, 25, 33, 0.45), 0 0 22px rgba(120, 80, 255, 0.3);
}

.nt-bot-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.nt-bot-orb-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  animation: nt-orb-ripple 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  pointer-events: none;
}

@keyframes nt-orb-breathe {
  0% { transform: scale(0.95); box-shadow: 0 0 8px rgba(215, 25, 33, 0.3), 0 0 12px rgba(120, 80, 255, 0.2); }
  100% { transform: scale(1.05); box-shadow: 0 0 14px rgba(215, 25, 33, 0.6), 0 0 24px rgba(120, 80, 255, 0.4); }
}

@keyframes nt-orb-ripple {
  0% { transform: scale(0.9); opacity: 0.85; }
  60% { transform: scale(1.4); opacity: 0; }
  100% { transform: scale(1.4); opacity: 0; }
}

/* Inline Mini Avatar for Role and Messages */
.nt-bot-role-line {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}

.nt-bot-avatar-mini {
  position: relative;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(215, 25, 33, 0.35);
}

.nt-bot-avatar-img-mini {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 0.5px solid rgba(255, 255, 255, 0.35);
}

.nt-bot-avatar-mini.thinking-orb {
  animation: nt-orb-spin 5s linear infinite;
}

@keyframes nt-orb-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Welcome Card with Hero Orb */
.nt-bot-welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 14px 16px 14px;
  margin-bottom: 6px;
  background: radial-gradient(circle at 50% 25%, rgba(215, 25, 33, 0.08), rgba(20, 20, 20, 0.5) 75%);
  border: 1px solid var(--nt-bot-border);
  border-radius: 12px;
}

.nt-bot-welcome-orb-wrap {
  position: relative;
  width: 68px;
  height: 68px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nt-bot-welcome-orb {
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(215, 25, 33, 0.5), 0 0 32px rgba(120, 80, 255, 0.35);
  animation: nt-orb-breathe 3.5s ease-in-out infinite alternate;
}

.nt-bot-welcome-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
}

.nt-bot-welcome-pulse-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid rgba(215, 25, 33, 0.4);
  animation: nt-orb-ripple 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.nt-bot-welcome-text h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--nt-bot-text);
  margin: 0 0 5px 0;
  text-transform: uppercase;
}

.nt-bot-welcome-text p {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  color: var(--nt-bot-text-muted);
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
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
  height: 620px;
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
  padding: 13px 16px;
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
  max-width: 96%;
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
  line-height: 1.55;
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

/* Formatted Elements inside bubble */
.nt-chat-p {
  margin: 0 0 10px 0;
}
.nt-chat-p:last-child {
  margin-bottom: 0;
}

.nt-chat-h2, .nt-chat-h3, .nt-chat-h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  margin: 12px 0 6px 0;
  color: var(--nt-bot-text);
  line-height: 1.3;
}
.nt-chat-h2 { font-size: 14px; border-bottom: 1px solid var(--nt-bot-border); padding-bottom: 4px; }
.nt-chat-h3 { font-size: 13px; }
.nt-chat-h4 { font-size: 12px; }

.nt-chat-ul, .nt-chat-ol {
  margin: 6px 0 10px 18px;
  padding: 0;
}
.nt-chat-li, .nt-chat-oli {
  margin-bottom: 4px;
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
  padding: 10px 12px;
  margin: 10px 0;
  overflow-x: auto;
}
.nt-chat-pre code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #eee;
  display: block;
  white-space: pre;
}

/* Tables */
.nt-chat-table-wrap {
  overflow-x: auto;
  margin: 10px 0;
  border: 1px solid var(--nt-bot-border);
  border-radius: 8px;
  background: var(--nt-bot-bg);
}
.nt-chat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
  font-family: 'Space Grotesk', sans-serif;
}
.nt-chat-table th {
  background: rgba(125, 125, 125, 0.08);
  padding: 7px 10px;
  text-align: left;
  border-bottom: 1px solid var(--nt-bot-border);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: var(--nt-bot-text);
  white-space: nowrap;
}
.nt-chat-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--nt-bot-border);
  color: var(--nt-bot-text);
}
.nt-chat-table tr:last-child td {
  border-bottom: none;
}

/* Math block */
.nt-chat-math {
  margin: 8px 0;
  overflow-x: auto;
  padding: 4px 0;
}

/* Blockquote */
.nt-chat-quote {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 2px solid var(--nt-bot-red);
  background: rgba(125, 125, 125, 0.08);
  font-style: italic;
  font-size: 12px;
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

/* Thinking Indicator */
.nt-bot-thinking-bubble {
  background: var(--nt-bot-card);
  border: 1px solid var(--nt-bot-border);
  border-left: 3px solid var(--nt-bot-red);
  padding: 12px 14px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 240px;
}

.nt-thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--nt-bot-text);
  letter-spacing: 0.6px;
}

.nt-thinking-red-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nt-bot-red);
  box-shadow: 0 0 8px var(--nt-bot-red);
  animation: nt-bot-pulse 1.2s infinite ease-in-out;
}

.nt-thinking-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--nt-bot-text-muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.nt-thinking-subtext {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  color: var(--nt-bot-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.nt-thinking-wave {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.nt-thinking-wave-bar {
  width: 2px;
  height: 10px;
  background: var(--nt-bot-text-muted);
  border-radius: 1px;
  animation: nt-thinking-wave 1.2s infinite ease-in-out;
}
.nt-thinking-wave-bar:nth-child(2) { animation-delay: 0.2s; }
.nt-thinking-wave-bar:nth-child(3) { animation-delay: 0.4s; }

@keyframes nt-thinking-wave {
  0%, 100% { height: 6px; opacity: 0.4; }
  50% { height: 12px; opacity: 1; }
}

/* Thought Process Accordion */
.nt-chat-thought-box {
  margin-bottom: 12px;
  background: rgba(125, 125, 125, 0.05);
  border: 1px solid var(--nt-bot-border);
  border-radius: 8px;
  overflow: hidden;
}

.nt-chat-thought-summary {
  padding: 7px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--nt-bot-text-muted);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s, color 0.15s;
}

.nt-chat-thought-summary:hover {
  color: var(--nt-bot-text);
  background: rgba(125, 125, 125, 0.08);
}

.nt-chat-thought-summary .nt-red-dot-mini {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nt-bot-red);
}

.nt-chat-thought-body {
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--nt-bot-text-muted);
  border-top: 1px solid var(--nt-bot-border);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

/* Input Area */
.nt-bot-input-area {
  padding: 10px 14px;
  background: var(--nt-bot-card);
  border-top: 1px solid var(--nt-bot-border);
}

.nt-bot-input-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nt-bot-bg);
  border: 1px solid var(--nt-bot-border);
  border-radius: 8px;
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
  max-height: 90px;
  line-height: 1.4;
  padding: 3px 0;
}

.nt-bot-textarea::placeholder {
  color: var(--nt-bot-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
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
    const avatarSrc = getAvatarUrl();
    root.innerHTML = `
      <!-- Launcher Button -->
      <button id="ntBotTrigger" class="nt-bot-trigger" title="Open AI Study Assistant">
        <div class="nt-bot-avatar-orb">
          <img src="${avatarSrc}" alt="AI Orb" class="nt-bot-avatar-img" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
          <span class="nt-bot-orb-ring"></span>
        </div>
        <span>AI ASSISTANT</span>
      </button>

      <!-- Chat Drawer Window -->
      <div id="ntBotWindow" class="nt-bot-window" role="dialog" aria-modal="true" aria-label="BEU AI Chatbot">
        <!-- Header -->
        <div class="nt-bot-header">
          <div class="nt-bot-header-left">
            <div class="nt-bot-avatar-orb header-orb">
              <img src="${avatarSrc}" alt="AI Orb" class="nt-bot-avatar-img" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
              <span class="nt-bot-orb-ring"></span>
            </div>
            <div class="nt-bot-title-group">
              <h3>BEU AI ASSISTANT</h3>
              <div class="nt-bot-subtitle" id="ntBotScanLabel">GOOGLE GEMINI AI &bull; LIVE SCANNER</div>
            </div>
          </div>
          <div class="nt-bot-header-actions">
            <button id="ntBotClearBtn" class="nt-bot-btn-icon" title="Clear Chat History">CLEAR</button>
            <button id="ntBotCloseBtn" class="nt-bot-btn-icon" title="Close Chatbot">&times;</button>
          </div>
        </div>

        <!-- Messages Area -->
        <div id="ntBotMessages" class="nt-bot-messages">
          <div class="nt-bot-welcome-card">
            <div class="nt-bot-welcome-orb-wrap">
              <div class="nt-bot-welcome-orb">
                <img src="${avatarSrc}" alt="BEU AI Orb" class="nt-bot-welcome-img" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
                <div class="nt-bot-welcome-pulse-ring"></div>
              </div>
            </div>
            <div class="nt-bot-welcome-text">
              <h4>BEU AI STUDY ASSISTANT</h4>
              <p>Powered by Google Gemini with live syllabus & PYQ scanner. Ask any question, circuit derivation, or formula derivation.</p>
            </div>
          </div>
        </div>

        <!-- Input Area (Clean & Simple) -->
        <div class="nt-bot-input-area">
          <div class="nt-bot-input-box">
            <textarea id="ntBotTextarea" class="nt-bot-textarea" placeholder="Ask your query..." rows="1"></textarea>
            <button id="ntBotSendBtn" class="nt-bot-send-btn">SEND</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Initial scanner status update
    updateScannerStatus();
    attachEventListeners();
    restoreChatHistoryUI();
  }

  // Restore Chat History in UI
  function restoreChatHistoryUI() {
    const history = loadChatHistory();
    if (!history || history.length === 0) return;

    conversationHistory = history.map(item => ({
      role: item.role,
      content: item.content
    }));

    const container = document.getElementById('ntBotMessages');
    if (!container) return;

    // Clear default welcome message
    container.innerHTML = '';

    // Render all saved messages
    history.forEach(item => {
      const role = item.role === 'user' ? 'user' : 'bot';
      appendMessage(role, item.content, item.customHtml, false);
    });

    container.scrollTop = container.scrollHeight;
  }

  // Update Scanner status label
  function updateScannerStatus() {
    const label = document.getElementById('ntBotScanLabel');
    if (!label) return;
    const scan = scanPage();
    if (scan.type === 'question_paper') {
      label.innerText = `SCANNED: ${scan.totalQuestions} Questions from ${scan.title.replace('BEU ECE 4th Sem PYQ', '').replace(/[\-–|]/g, '').trim() || scan.title}`;
    } else if (scan.type === 'portal_index') {
      label.innerText = `SCANNED: Portal Hub (${scan.subjectsCount} Subjects & Packs)`;
    } else {
      label.innerText = `SCANNED: Current Page`;
    }
  }

  // Append message to UI
  function appendMessage(role, rawContent, customHtml, shouldSave = true) {
    const container = document.getElementById('ntBotMessages');
    if (!container) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `nt-bot-msg ${role}`;

    if (role === 'bot') {
      const roleLine = document.createElement('div');
      roleLine.className = 'nt-bot-role-line';
      roleLine.innerHTML = `
        <div class="nt-bot-avatar-mini">
          <img src="${getAvatarUrl()}" alt="AI" class="nt-bot-avatar-img-mini" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
        </div>
        <span class="nt-bot-msg-role">Google Gemini AI</span>
      `;
      msgDiv.appendChild(roleLine);
    } else {
      const roleSpan = document.createElement('span');
      roleSpan.className = 'nt-bot-msg-role';
      roleSpan.innerText = 'YOU';
      msgDiv.appendChild(roleSpan);
    }

    const bubble = document.createElement('div');
    bubble.className = 'nt-bot-bubble';
    if (role === 'user') {
      bubble.innerHTML = rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    } else {
      bubble.innerHTML = customHtml || formatMarkdown(rawContent);
    }

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

    if (shouldSave) {
      const stored = loadChatHistory();
      stored.push({
        role: role === 'user' ? 'user' : 'assistant',
        content: rawContent,
        customHtml: customHtml || '',
        timestamp: Date.now()
      });
      saveChatHistory(stored);
    }

    return bubble;
  }

  // Thinking Indicator state
  let thinkingInterval = null;
  let thinkingStartTime = 0;

  function showThinkingIndicator() {
    removeThinkingIndicator();
    const container = document.getElementById('ntBotMessages');
    const indicator = document.createElement('div');
    indicator.id = 'ntBotThinking';
    indicator.className = 'nt-bot-msg bot';
    indicator.innerHTML = `
      <div class="nt-bot-role-line">
        <div class="nt-bot-avatar-mini thinking-orb">
          <img src="${getAvatarUrl()}" alt="AI" class="nt-bot-avatar-img-mini" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
        </div>
        <span class="nt-bot-msg-role">Google Gemini AI</span>
      </div>
      <div class="nt-bot-bubble nt-bot-thinking-bubble">
        <div class="nt-thinking-header">
          <div class="nt-bot-avatar-mini">
            <img src="${getAvatarUrl()}" alt="AI" class="nt-bot-avatar-img-mini" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
          </div>
          <span>THINKING</span>
          <span class="nt-thinking-timer" id="ntThinkingTimer">0.0s</span>
        </div>
        <div class="nt-thinking-subtext">
          <span class="nt-thinking-wave">
            <span class="nt-thinking-wave-bar"></span>
            <span class="nt-thinking-wave-bar"></span>
            <span class="nt-thinking-wave-bar"></span>
          </span>
          <span id="ntThinkingStatusText">Analyzing query & scanning paper context...</span>
        </div>
      </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;

    thinkingStartTime = Date.now();
    thinkingInterval = setInterval(() => {
      const elapsedMs = Date.now() - thinkingStartTime;
      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      const timerEl = document.getElementById('ntThinkingTimer');
      const textEl = document.getElementById('ntThinkingStatusText');
      if (timerEl) timerEl.innerText = `${elapsedSec}s`;
      if (textEl) {
        if (elapsedMs > 5000) {
          textEl.innerText = 'Synthesizing derivations & formatting solution...';
        } else if (elapsedMs > 2500) {
          textEl.innerText = 'Evaluating circuit equations & BEU syllabus...';
        }
      }
    }, 100);
  }

  function removeThinkingIndicator() {
    if (thinkingInterval) {
      clearInterval(thinkingInterval);
      thinkingInterval = null;
    }
    const indicator = document.getElementById('ntBotThinking');
    if (indicator) indicator.remove();
  }

  // --- API Call via Google Gemini API ---
  async function sendToGemini(userPrompt) {
    if (isGenerating) return;
    isGenerating = true;

    const sendBtn = document.getElementById('ntBotSendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerText = '...';
    }

    appendMessage('user', userPrompt);
    conversationHistory.push({ role: 'user', content: userPrompt });

    showThinkingIndicator();

    try {
      const systemPrompt = buildSystemPrompt();

      // Format multi-turn conversation contents for Gemini API (roles must alternate: user -> model)
      const recentHistory = conversationHistory.slice(-8);
      const contents = [];
      for (const msg of recentHistory) {
        const geminiRole = (msg.role === 'user') ? 'user' : 'model';
        if (contents.length > 0 && contents[contents.length - 1].role === geminiRole) {
          contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
        } else {
          contents.push({
            role: geminiRole,
            parts: [{ text: msg.content }]
          });
        }
      }
      if (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
      }

      const payload = {
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.3
        }
      };

      abortController = new AbortController();
      const apiKey = getApiKey();

      let reply = null;
      let activeModel = null;
      let lastErrMsg = '';

      // Auto-fallback across available Gemini models
      for (const model of CANDIDATE_MODELS) {
        try {
          const endpoint = `${GEMINI_API_BASE}${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: abortController.signal
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            lastErrMsg = errJson?.error?.message || `HTTP ${response.status}`;
            // If high demand (503) or rate limit (429) or not found (404), fallback to next candidate model
            if (response.status === 503 || response.status === 429 || response.status === 404) {
              continue;
            }
            throw new Error(lastErrMsg);
          }

          const data = await response.json();
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            activeModel = model;
            break;
          }
        } catch (mErr) {
          if (mErr.name === 'AbortError') throw mErr;
          lastErrMsg = mErr.message;
        }
      }

      const elapsedSec = ((Date.now() - thinkingStartTime) / 1000).toFixed(1);
      removeThinkingIndicator();

      if (!reply) {
        appendMessage('bot', `**Error from AI service:** ${lastErrMsg || 'All Gemini models unavailable. Please try again shortly.'}`);
        return;
      }

      let fullHtml = `
        <details class="nt-chat-thought-box">
          <summary class="nt-chat-thought-summary">
            <span class="nt-red-dot-mini"></span>
            <span>Generated in ${elapsedSec}s &bull; ${activeModel}</span>
          </summary>
          <div class="nt-chat-thought-body">Engine: Google Gemini (${activeModel})<br>Status: Success (200 OK)</div>
        </details>
      `;
      fullHtml += formatMarkdown(reply);

      appendMessage('bot', reply, fullHtml);
      conversationHistory.push({ role: 'assistant', content: reply });

    } catch (err) {
      removeThinkingIndicator();
      if (err.name === 'AbortError') {
        appendMessage('bot', 'Generation stopped.');
      } else {
        appendMessage('bot', `**Network Error:** Could not connect to Gemini API (${err.message}). Check your internet connection.`);
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
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      const container = document.getElementById('ntBotMessages');
      const avatarSrc = getAvatarUrl();
      container.innerHTML = `
        <div class="nt-bot-welcome-card">
          <div class="nt-bot-welcome-orb-wrap">
            <div class="nt-bot-welcome-orb">
              <img src="${avatarSrc}" alt="BEU AI Orb" class="nt-bot-welcome-img" onerror="this.onerror=null;this.src='/ai_assistant_avatar.jpg';">
              <div class="nt-bot-welcome-pulse-ring"></div>
            </div>
          </div>
          <div class="nt-bot-welcome-text">
            <h4>BEU AI STUDY ASSISTANT</h4>
            <p>Chat cleared! Ready to solve BEU ECE 4th Sem PYQs, derivations & subject notes.</p>
          </div>
        </div>
      `;
    });

    function handleSend() {
      const text = textarea.value.trim();
      if (!text || isGenerating) return;
      textarea.value = '';
      textarea.style.height = 'auto';
      sendToGemini(text);
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
      textarea.style.height = Math.min(textarea.scrollHeight, 90) + 'px';
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
      sendToGemini(promptText);
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
