import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */function O(){const e=document.querySelectorAll("[data-reveal]");if(!e.length)return;const n=new IntersectionObserver(t=>{for(const i of t)i.isIntersecting&&(i.target.classList.add("revealed"),n.unobserve(i.target))},{threshold:.12});for(const t of e)n.observe(t)}function R(){document.addEventListener("click",async i=>{const s=i.target.closest(".copy-trigger");if(!s)return;const o=s.dataset.copy;if(o)try{await navigator.clipboard.writeText(o),E(s,"Copied!")}catch{const d=document.createElement("textarea");d.value=o,d.style.position="fixed",d.style.opacity="0",document.body.appendChild(d),d.select(),document.execCommand("copy"),document.body.removeChild(d),E(s,"Copied!")}});const e=document.querySelectorAll(".toggle-btn"),n=document.getElementById("showcase-rendered"),t=document.getElementById("showcase-raw");if(e.length&&n&&t)for(const i of e)i.addEventListener("click",()=>{const s=i.dataset.view;for(const o of e)o.classList.remove("active");i.classList.add("active"),s==="rendered"?(n.classList.add("active"),t.classList.remove("active")):(t.classList.add("active"),n.classList.remove("active"))})}function E(e,n){const t=e.querySelector(".copy-tooltip");t&&t.remove();const i=document.createElement("span");i.className="copy-tooltip",i.textContent=n,e.style.position=e.style.position||"relative",e.appendChild(i),setTimeout(()=>i.remove(),1200)}const A=120,W=400,$=4e3,P=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:D},{id:"notes",label:"Reviewing notes — 20 min",start:30,end:50,render:U},{id:"organize",label:"Organizing & triaging — 15 min",start:50,end:65,render:j},{id:"tickets",label:"Creating tickets — 20 min",start:65,end:85,render:_},{id:"files",label:"Searching codebase — 15 min",start:85,end:100,render:F},{id:"prompts",label:"Writing prompts — 20 min",start:100,end:120,render:G}],J=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:K},{id:"notes",label:"Extracting tasks...",start:30,end:32,render:Q},{id:"done",label:"",start:32,end:120,render:X}];let a=0,h,g,f,y,b,w,x,T=null,L=null,v=!1,u=null,r=null,l=null,c=null;const H={clock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',file:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',folder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',check:'<svg class="demo-done-check" viewBox="0 0 48 48" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><polyline points="14 24 22 32 34 18"/></svg>'};function V(e){const n=Math.floor(e/60),t=e%60;return n===0?`${t}m`:`${n}h ${String(t).padStart(2,"0")}m`}function M(e,n,t,i){const s=e.querySelector(".demo-phase");s&&(s.classList.add("demo-phase--exiting"),setTimeout(()=>s.remove(),250));const o=document.createElement("div");o.className="demo-phase demo-phase--entering",n.render(o),e.appendChild(o),n.id==="done"?(t.className="demo-panel-status demo-panel-status--done",t.innerHTML="&#10003; Complete"):(t.className="demo-panel-status",t.innerHTML=`&#9654; ${n.label}`),requestAnimationFrame(()=>{requestAnimationFrame(()=>{o.classList.remove("demo-phase--entering")})})}function z(){if(!v)return;h.textContent=V(a);const e=a/A*100;w.style.width=`${e}%`;const n=P.find(i=>a>=i.start&&a<i.end);n&&n.id!==T&&(M(g,n,y),T=n.id);const t=J.find(i=>a>=i.start&&a<i.end);if(t&&t.id!==L&&(M(f,t,b),L=t.id,t.id==="done"&&x.classList.add("demo-panel--done")),a++,a>A){u=setTimeout(N,$);return}u=setTimeout(z,W)}function N(){r&&(clearInterval(r),r=null),l&&(clearInterval(l),l=null),c&&(clearInterval(c),c=null),a=0,T=null,L=null,g.innerHTML="",f.innerHTML="",y.className="demo-panel-status",y.innerHTML="",b.className="demo-panel-status",b.innerHTML="",h.textContent="0m",w.style.width="0%",x.classList.remove("demo-panel--done"),z()}const B=[{speaker:1,text:"The auth middleware needs to move to JWT..."},{speaker:2,text:"Which files are we talking about?"},{speaker:1,text:"Mainly auth.ts and the session types"},{speaker:3,text:"Also add a refresh endpoint"},{speaker:2,text:"Should we deprecate the old sessions first?"},{speaker:1,text:"No, swap them in place. Less risk."},{speaker:3,text:"What about the mobile clients?"},{speaker:2,text:"They already use bearer tokens"},{speaker:1,text:"Perfect, so just the web side"},{speaker:3,text:"I can handle the token refresh logic"},{speaker:2,text:"Let's set a deadline for Friday"},{speaker:1,text:"Agreed. I'll take the middleware changes"}];function q(e,n,t){const i=e.querySelector(".demo-bubbles"),s=e.querySelectorAll(".demo-avatar");if(!i)return;let o=0;const d=3;function I(){const k=B[o%B.length];o++,s.forEach(p=>p.classList.remove("demo-avatar--speaking"));const S=e.querySelector(`.demo-avatar--${k.speaker}`);S&&S.classList.add("demo-avatar--speaking");const m=document.createElement("div");m.className=`demo-bubble demo-bubble--${k.speaker}`,m.textContent=k.text,i.appendChild(m),m.offsetHeight,m.classList.add("demo-bubble--visible");const C=i.querySelectorAll(".demo-bubble");if(C.length>d){const p=C[0];p.classList.add("demo-bubble--exiting"),setTimeout(()=>p.remove(),300)}}return I(),setInterval(I,2200)}function D(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles"></div>
      <div class="demo-recording-pill demo-recording-pill--off">
        <span class="demo-recording-dot demo-recording-dot--off"></span>
        No recording
      </div>
    </div>
  `,l&&clearInterval(l),l=q(e)}function U(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Meeting Notes</div>
      <div class="demo-note-line" style="animation-delay: 0.1s">- auth thing... JWT maybe?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.3s">- Bob said something about sessions</div>
      <div class="demo-note-line" style="animation-delay: 0.5s">- which files??? auth.ts?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.7s">- refresh endpoint (where?)</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.9s">- TODO: figure out file paths...</div>
    </div>
  `}function j(e){e.innerHTML=`
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
  `,setTimeout(()=>{e.querySelectorAll(".demo-organize-item:not(.demo-organize-item--struck):not(.demo-organize-item--moving)").forEach(t=>t.classList.add("demo-organize-item--moving"))},400)}function _(e){e.innerHTML=`
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
  `}function F(e){const n=[{icon:"folder",name:"src/",indent:0},{icon:"folder",name:"middleware/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"cors.ts",indent:2},{icon:"folder",name:"routes/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"users.ts",indent:2},{icon:"folder",name:"types/",indent:1},{icon:"file",name:"session.ts",indent:2},{icon:"file",name:"auth.ts",indent:2}];e.innerHTML=`
    <div class="demo-file-search">
      <div class="demo-search-query"><span class="prompt">$</span> grep -r "session" src/</div>
      <div class="demo-file-list">
        ${n.map((s,o)=>`
          <div class="demo-file-item" data-scan-index="${o}" style="padding-left: ${8+s.indent*14}px">
            <span class="demo-file-icon">${H[s.icon]}</span>
            ${s.name}
          </div>
        `).join("")}
      </div>
      <div class="demo-thought-bubble">"Which files do I actually need to change?"</div>
    </div>
  `;let t=0;const i=e.querySelectorAll(".demo-file-item");r&&clearInterval(r),r=setInterval(()=>{i.forEach(s=>s.classList.remove("demo-file-item--scanning")),t<i.length?(i[t].classList.add("demo-file-item--scanning"),t++):t=0},300)}function G(e){e.innerHTML=`
    <div class="demo-prompt-editor">
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0s">claude "migrate auth to JWT in src/auth.ts"</div>
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0.3s">claude "change the session middleware to use...</div>
      <div class="demo-prompt-line" style="animation-delay: 0.6s">claude "In src/middleware/auth.ts, replace the</div>
      <div class="demo-prompt-line" style="animation-delay: 0.8s">  express-session based auth with JWT. Also</div>
      <div class="demo-prompt-line" style="animation-delay: 1.0s">  update src/types/session.ts and add a</div>
      <div class="demo-prompt-line" style="animation-delay: 1.2s">  refresh endpoint in src/routes/auth.ts..."</div>
      <span class="demo-prompt-cursor"></span>
    </div>
  `}function K(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles"></div>
      <div class="demo-recording-pill demo-recording-pill--on">
        <span class="demo-recording-dot demo-recording-dot--on"></span>
        contextprompt recording
      </div>
    </div>
  `,c&&clearInterval(c),c=q(e)}function Q(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Extracting tasks...</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.1s"><span class="demo-note-check">&#10003;</span> Scanning repos &amp; transcription</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.3s"><span class="demo-note-check">&#10003;</span> Matching to file paths</div>
    </div>
  `}function X(e){e.innerHTML=`
    <div class="demo-done">
      ${H.check}
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
  `}function Y(){if(h=document.getElementById("demo-timer"),g=document.getElementById("demo-left"),f=document.getElementById("demo-right"),y=document.getElementById("demo-left-status"),b=document.getElementById("demo-right-status"),w=document.getElementById("demo-progress-bar"),document.querySelector(".demo-panel--left"),x=document.querySelector(".demo-panel--right"),!h||!g||!f)return;new IntersectionObserver(([n])=>{const t=v;v=n.isIntersecting,v&&!t&&N(),!v&&t&&u&&(clearTimeout(u),u=null)},{threshold:.2}).observe(document.getElementById("split-demo"))}function Z(){document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",n=>{const t=document.querySelector(e.getAttribute("href"));t&&(n.preventDefault(),t.scrollIntoView({behavior:"smooth"}))})})}document.addEventListener("DOMContentLoaded",()=>{O(),R(),Z(),Y()});
