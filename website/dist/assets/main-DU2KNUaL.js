import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */function x(){const e=document.querySelectorAll("[data-reveal]");if(!e.length)return;const i=new IntersectionObserver(t=>{for(const n of t)n.isIntersecting&&(n.target.classList.add("revealed"),i.unobserve(n.target))},{threshold:.12});for(const t of e)i.observe(t)}function C(){document.addEventListener("click",async n=>{const s=n.target.closest(".copy-trigger");if(!s)return;const o=s.dataset.copy;if(o)try{await navigator.clipboard.writeText(o),k(s,"Copied!")}catch{const a=document.createElement("textarea");a.value=o,a.style.position="fixed",a.style.opacity="0",document.body.appendChild(a),a.select(),document.execCommand("copy"),document.body.removeChild(a),k(s,"Copied!")}});const e=document.querySelectorAll(".toggle-btn"),i=document.getElementById("showcase-rendered"),t=document.getElementById("showcase-raw");if(e.length&&i&&t)for(const n of e)n.addEventListener("click",()=>{const s=n.dataset.view;for(const o of e)o.classList.remove("active");n.classList.add("active"),s==="rendered"?(i.classList.add("active"),t.classList.remove("active")):(t.classList.add("active"),i.classList.remove("active"))})}function k(e,i){const t=e.querySelector(".copy-tooltip");t&&t.remove();const n=document.createElement("span");n.className="copy-tooltip",n.textContent=i,e.style.position=e.style.position||"relative",e.appendChild(n),setTimeout(()=>n.remove(),1200)}const T=120,M=400,A=4e3,E=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:z},{id:"notes",label:"Reviewing notes — 20 min",start:30,end:50,render:O},{id:"organize",label:"Organizing & triaging — 15 min",start:50,end:65,render:W},{id:"tickets",label:"Creating tickets — 20 min",start:65,end:85,render:q},{id:"files",label:"Searching codebase — 15 min",start:85,end:100,render:J},{id:"prompts",label:"Writing prompts — 20 min",start:100,end:120,render:N}],H=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:P},{id:"notes",label:"Extracting tasks...",start:30,end:32,render:R},{id:"done",label:"",start:32,end:120,render:$}];let d=0,m,v,u,p,h,y,b,g=null,f=null,r=!1,c=null,l=null;const w={clock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',file:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',folder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',check:'<svg class="demo-done-check" viewBox="0 0 48 48" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><polyline points="14 24 22 32 34 18"/></svg>'};function B(e){const i=Math.floor(e/60),t=e%60;return i===0?`${t}m`:`${i}h ${String(t).padStart(2,"0")}m`}function L(e,i,t,n){const s=e.querySelector(".demo-phase");s&&(s.classList.add("demo-phase--exiting"),setTimeout(()=>s.remove(),250));const o=document.createElement("div");o.className="demo-phase demo-phase--entering",i.render(o),e.appendChild(o),i.id==="done"?(t.className="demo-panel-status demo-panel-status--done",t.innerHTML="&#10003; Complete"):(t.className="demo-panel-status",t.innerHTML=`&#9654; ${i.label}`),requestAnimationFrame(()=>{requestAnimationFrame(()=>{o.classList.remove("demo-phase--entering")})})}function I(){if(!r)return;m.textContent=B(d);const e=d/T*100;y.style.width=`${e}%`;const i=E.find(n=>d>=n.start&&d<n.end);i&&i.id!==g&&(L(v,i,p),g=i.id);const t=H.find(n=>d>=n.start&&d<n.end);if(t&&t.id!==f&&(L(u,t,h),f=t.id,t.id==="done"&&b.classList.add("demo-panel--done")),d++,d>T){c=setTimeout(S,A);return}c=setTimeout(I,M)}function S(){l&&(clearInterval(l),l=null),d=0,g=null,f=null,v.innerHTML="",u.innerHTML="",p.className="demo-panel-status",p.innerHTML="",h.className="demo-panel-status",h.innerHTML="",m.textContent="0m",y.style.width="0%",b.classList.remove("demo-panel--done"),I()}function z(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles">
        <div class="demo-bubble demo-bubble--1" style="animation-delay: 0.1s">The auth middleware needs to move to JWT...</div>
        <div class="demo-bubble demo-bubble--2" style="animation-delay: 0.3s">Which files are we talking about?</div>
        <div class="demo-bubble demo-bubble--3" style="animation-delay: 0.5s">Also add a refresh endpoint</div>
      </div>
      <div class="demo-recording-pill demo-recording-pill--off">
        <span class="demo-recording-dot demo-recording-dot--off"></span>
        No recording
      </div>
    </div>
  `}function O(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Meeting Notes</div>
      <div class="demo-note-line" style="animation-delay: 0.1s">- auth thing... JWT maybe?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.3s">- Bob said something about sessions</div>
      <div class="demo-note-line" style="animation-delay: 0.5s">- which files??? auth.ts?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.7s">- refresh endpoint (where?)</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.9s">- TODO: figure out file paths...</div>
    </div>
  `}function W(e){e.innerHTML=`
    <div>
      <div class="demo-organize-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>
        Reorganizing...
      </div>
      <div class="demo-organize-item demo-organize-item--struck">- Bob said something about sessions</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.2s">- JWT migration for auth middleware</div>
      <div class="demo-organize-item" style="transition-delay: 0.3s">- refresh endpoint needed</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.4s">- figure out which files to change</div>
      <div class="demo-organize-item demo-organize-item--struck" style="transition-delay: 0.5s">- auth thing... JWT maybe?</div>
    </div>
  `,setTimeout(()=>{e.querySelectorAll(".demo-organize-item:not(.demo-organize-item--struck):not(.demo-organize-item--moving)").forEach(t=>t.classList.add("demo-organize-item--moving"))},400)}function q(e){e.innerHTML=`
    <div class="demo-tickets">
      <div class="demo-ticket" style="animation-delay: 0.1s">
        <div class="demo-ticket-title">AUTH-142: Migrate to JWT</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.3s">Replace session-based auth with JWT tokens...</div>
      </div>
      <div class="demo-ticket" style="animation-delay: 0.4s">
        <div class="demo-ticket-title">AUTH-143: Add refresh endpoint</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.6s">Create POST /auth/refresh for token renewal...</div>
      </div>
      <div class="demo-ticket" style="animation-delay: 0.7s">
        <div class="demo-ticket-title">AUTH-144: Update session types</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.9s">Remove old session interfaces, add JWT types...</div>
      </div>
    </div>
  `}function J(e){const i=[{icon:"folder",name:"src/",indent:0},{icon:"folder",name:"middleware/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"cors.ts",indent:2},{icon:"folder",name:"routes/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"users.ts",indent:2},{icon:"folder",name:"types/",indent:1},{icon:"file",name:"session.ts",indent:2},{icon:"file",name:"auth.ts",indent:2}];e.innerHTML=`
    <div class="demo-file-search">
      <div class="demo-search-query"><span class="prompt">$</span> grep -r "session" src/</div>
      <div class="demo-file-list">
        ${i.map((s,o)=>`
          <div class="demo-file-item" data-scan-index="${o}" style="padding-left: ${8+s.indent*14}px">
            <span class="demo-file-icon">${w[s.icon]}</span>
            ${s.name}
          </div>
        `).join("")}
      </div>
      <div class="demo-thought-bubble">"Which files do I actually need to change?"</div>
    </div>
  `;let t=0;const n=e.querySelectorAll(".demo-file-item");l&&clearInterval(l),l=setInterval(()=>{n.forEach(s=>s.classList.remove("demo-file-item--scanning")),t<n.length?(n[t].classList.add("demo-file-item--scanning"),t++):t=0},300)}function N(e){e.innerHTML=`
    <div class="demo-prompt-editor">
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0s">claude "migrate auth to JWT in src/auth.ts"</div>
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0.3s">claude "change the session middleware to use...</div>
      <div class="demo-prompt-line" style="animation-delay: 0.6s">claude "In src/middleware/auth.ts, replace the</div>
      <div class="demo-prompt-line" style="animation-delay: 0.8s">  express-session based auth with JWT. Also</div>
      <div class="demo-prompt-line" style="animation-delay: 1.0s">  update src/types/session.ts and add a</div>
      <div class="demo-prompt-line" style="animation-delay: 1.2s">  refresh endpoint in src/routes/auth.ts..."</div>
      <span class="demo-prompt-cursor"></span>
    </div>
  `}function P(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles">
        <div class="demo-bubble demo-bubble--1" style="animation-delay: 0.1s">The auth middleware needs to move to JWT...</div>
        <div class="demo-bubble demo-bubble--2" style="animation-delay: 0.3s">Which files are we talking about?</div>
        <div class="demo-bubble demo-bubble--3" style="animation-delay: 0.5s">Also add a refresh endpoint</div>
      </div>
      <div class="demo-recording-pill demo-recording-pill--on">
        <span class="demo-recording-dot demo-recording-dot--on"></span>
        contextprompt recording
      </div>
    </div>
  `}function R(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Extracting tasks...</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.1s"><span class="demo-note-check">&#10003;</span> Scanning repos &amp; transcription</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.3s"><span class="demo-note-check">&#10003;</span> Matching to file paths</div>
    </div>
  `}function $(e){e.innerHTML=`
    <div class="demo-done">
      ${w.check}
      <div class="demo-done-time">Done in 32 minutes</div>
      <div class="demo-done-summary">
        <div>3 tasks extracted &middot; real file paths &middot; ready for Claude Code</div>
        <div class="demo-done-tasks">
          <span class="demo-done-task">T1: JWT migration</span>
          <span class="demo-done-task">T2: Refresh endpoint</span>
          <span class="demo-done-task">T3: Update types</span>
        </div>
      </div>
      <div class="demo-time-saved">Time saved: ~1.5 hours</div>
    </div>
  `}function D(){if(m=document.getElementById("demo-timer"),v=document.getElementById("demo-left"),u=document.getElementById("demo-right"),p=document.getElementById("demo-left-status"),h=document.getElementById("demo-right-status"),y=document.getElementById("demo-progress-bar"),document.querySelector(".demo-panel--left"),b=document.querySelector(".demo-panel--right"),!m||!v||!u)return;new IntersectionObserver(([i])=>{const t=r;r=i.isIntersecting,r&&!t&&S(),!r&&t&&c&&(clearTimeout(c),c=null)},{threshold:.2}).observe(document.getElementById("split-demo"))}function U(){document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",i=>{const t=document.querySelector(e.getAttribute("href"));t&&(i.preventDefault(),t.scrollIntoView({behavior:"smooth"}))})})}document.addEventListener("DOMContentLoaded",()=>{x(),C(),U(),D()});
