import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               *//* empty css                   */function R(){const e=document.querySelectorAll("[data-reveal]");if(!e.length)return;const n=new IntersectionObserver(t=>{for(const i of t)i.isIntersecting&&(i.target.classList.add("revealed"),n.unobserve(i.target))},{threshold:.12});for(const t of e)n.observe(t)}function P(){document.addEventListener("click",async i=>{const o=i.target.closest(".copy-trigger");if(!o)return;const s=o.dataset.copy;if(s)try{await navigator.clipboard.writeText(s),C(o,"Copied!")}catch{const a=document.createElement("textarea");a.value=s,a.style.position="fixed",a.style.opacity="0",document.body.appendChild(a),a.select(),document.execCommand("copy"),document.body.removeChild(a),C(o,"Copied!")}});const e=document.querySelectorAll(".toggle-btn"),n=document.getElementById("showcase-rendered"),t=document.getElementById("showcase-raw");if(e.length&&n&&t)for(const i of e)i.addEventListener("click",()=>{const o=i.dataset.view;for(const s of e)s.classList.remove("active");i.classList.add("active"),o==="rendered"?(n.classList.add("active"),t.classList.remove("active")):(t.classList.add("active"),n.classList.remove("active"))})}function C(e,n){const t=e.querySelector(".copy-tooltip");t&&t.remove();const i=document.createElement("span");i.className="copy-tooltip",i.textContent=n,e.style.position=e.style.position||"relative",e.appendChild(i),setTimeout(()=>i.remove(),1200)}const B=120,W=400,$=4e3,J=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:V},{id:"notes",label:"Reviewing notes — 20 min",start:30,end:50,render:U},{id:"organize",label:"Organizing & triaging — 15 min",start:50,end:65,render:_},{id:"tickets",label:"Creating tickets — 20 min",start:65,end:85,render:F},{id:"files",label:"Searching codebase — 15 min",start:85,end:100,render:G},{id:"prompts",label:"Writing prompts — 20 min",start:100,end:120,render:K}],D=[{id:"meeting",label:"In meeting — 30 min",start:0,end:30,render:Q},{id:"notes",label:"Extracting tasks...",start:30,end:32,render:X},{id:"done",label:"",start:32,end:120,render:Y}];let l=0,b,k,L,T,w,E,S,x=null,I=null,h=!1,y=null,u=null,p=null,f=null;const H={clock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',file:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',folder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',check:'<svg class="demo-done-check" viewBox="0 0 48 48" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><polyline points="14 24 22 32 34 18"/></svg>'};function j(e){const n=Math.floor(e/60),t=e%60;return n===0?`${t}m`:`${n}h ${String(t).padStart(2,"0")}m`}function A(e,n,t,i){const o=e.querySelector(".demo-phase");o&&(o.classList.add("demo-phase--exiting"),setTimeout(()=>o.remove(),250));const s=document.createElement("div");s.className="demo-phase demo-phase--entering",n.render(s),e.appendChild(s),n.id==="done"?(t.className="demo-panel-status demo-panel-status--done",t.innerHTML="&#10003; Complete"):(t.className="demo-panel-status",t.innerHTML=`&#9654; ${n.label}`),requestAnimationFrame(()=>{requestAnimationFrame(()=>{s.classList.remove("demo-phase--entering")})})}function N(){if(!h)return;b.textContent=j(l);const e=l/B*100;E.style.width=`${e}%`;const n=J.find(i=>l>=i.start&&l<i.end);n&&n.id!==x&&(A(k,n,T),x=n.id);const t=D.find(i=>l>=i.start&&l<i.end);if(t&&t.id!==I&&(A(L,t,w),I=t.id,t.id==="done"&&S.classList.add("demo-panel--done")),l++,l>B){y=setTimeout(z,$);return}y=setTimeout(N,W)}function z(){u&&(clearInterval(u),u=null),p&&(clearInterval(p),p=null),f&&(clearInterval(f),f=null),l=0,x=null,I=null,k.innerHTML="",L.innerHTML="",T.className="demo-panel-status",T.innerHTML="",w.className="demo-panel-status",w.innerHTML="",b.textContent="0m",E.style.width="0%",S.classList.remove("demo-panel--done"),N()}const M=[{speaker:1,text:"The auth middleware needs to move to JWT..."},{speaker:2,text:"Which files are we talking about?"},{speaker:1,text:"Mainly auth.ts and the session types"},{speaker:3,text:"Also add a refresh endpoint"},{speaker:2,text:"Should we deprecate the old sessions first?"},{speaker:1,text:"No, swap them in place. Less risk."},{speaker:3,text:"What about the mobile clients?"},{speaker:2,text:"They already use bearer tokens"},{speaker:1,text:"Perfect, so just the web side"},{speaker:3,text:"I can handle the token refresh logic"},{speaker:2,text:"Let's set a deadline for Friday"},{speaker:1,text:"Agreed. I'll take the middleware changes"}];function O(e,n,t){const i=e.querySelector(".demo-bubbles"),o=e.querySelectorAll(".demo-avatar");if(!i)return;let s=0;const a=3;function m(){const v=M[s%M.length];s++,o.forEach(r=>r.classList.remove("demo-avatar--speaking"));const d=e.querySelector(`.demo-avatar--${v.speaker}`);d&&d.classList.add("demo-avatar--speaking");const c=document.createElement("div");c.className=`demo-bubble demo-bubble--${v.speaker}`,c.textContent=v.text,i.appendChild(c),c.offsetHeight,c.classList.add("demo-bubble--visible");const g=i.querySelectorAll(".demo-bubble");if(g.length>a){const r=g[0];r.classList.add("demo-bubble--exiting"),setTimeout(()=>r.remove(),300)}}return m(),setInterval(m,2200)}function V(e){e.innerHTML=`
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
  `,p&&clearInterval(p),p=O(e)}function U(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Meeting Notes</div>
      <div class="demo-note-line" style="animation-delay: 0.1s">- auth thing... JWT maybe?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.3s">- Bob said something about sessions</div>
      <div class="demo-note-line" style="animation-delay: 0.5s">- which files??? auth.ts?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.7s">- refresh endpoint (where?)</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.9s">- TODO: figure out file paths...</div>
    </div>
  `}function _(e){e.innerHTML=`
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
  `,setTimeout(()=>{e.querySelectorAll(".demo-organize-item:not(.demo-organize-item--struck):not(.demo-organize-item--moving)").forEach(t=>t.classList.add("demo-organize-item--moving"))},400)}function F(e){e.innerHTML=`
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
  `}function G(e){const n=[{icon:"folder",name:"src/",indent:0},{icon:"folder",name:"middleware/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"cors.ts",indent:2},{icon:"folder",name:"routes/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"users.ts",indent:2},{icon:"folder",name:"types/",indent:1},{icon:"file",name:"session.ts",indent:2},{icon:"file",name:"auth.ts",indent:2}];e.innerHTML=`
    <div class="demo-file-search">
      <div class="demo-search-query"><span class="prompt">$</span> grep -r "session" src/</div>
      <div class="demo-file-list">
        ${n.map((o,s)=>`
          <div class="demo-file-item" data-scan-index="${s}" style="padding-left: ${8+o.indent*14}px">
            <span class="demo-file-icon">${H[o.icon]}</span>
            ${o.name}
          </div>
        `).join("")}
      </div>
      <div class="demo-thought-bubble">"Which files do I actually need to change?"</div>
    </div>
  `;let t=0;const i=e.querySelectorAll(".demo-file-item");u&&clearInterval(u),u=setInterval(()=>{i.forEach(o=>o.classList.remove("demo-file-item--scanning")),t<i.length?(i[t].classList.add("demo-file-item--scanning"),t++):t=0},300)}function K(e){e.innerHTML=`
    <div class="demo-prompt-editor">
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0s">claude "migrate auth to JWT in src/auth.ts"</div>
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0.3s">claude "change the session middleware to use...</div>
      <div class="demo-prompt-line" style="animation-delay: 0.6s">claude "In src/middleware/auth.ts, replace the</div>
      <div class="demo-prompt-line" style="animation-delay: 0.8s">  express-session based auth with JWT. Also</div>
      <div class="demo-prompt-line" style="animation-delay: 1.0s">  update src/types/session.ts and add a</div>
      <div class="demo-prompt-line" style="animation-delay: 1.2s">  refresh endpoint in src/routes/auth.ts..."</div>
      <span class="demo-prompt-cursor"></span>
    </div>
  `}function Q(e){e.innerHTML=`
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
  `,f&&clearInterval(f),f=O(e)}function X(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Extracting tasks...</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.1s"><span class="demo-note-check">&#10003;</span> Scanning repos &amp; transcription</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.3s"><span class="demo-note-check">&#10003;</span> Matching to file paths</div>
    </div>
  `}function Y(e){e.innerHTML=`
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
  `}function Z(){if(b=document.getElementById("demo-timer"),k=document.getElementById("demo-left"),L=document.getElementById("demo-right"),T=document.getElementById("demo-left-status"),w=document.getElementById("demo-right-status"),E=document.getElementById("demo-progress-bar"),document.querySelector(".demo-panel--left"),S=document.querySelector(".demo-panel--right"),!b||!k||!L)return;new IntersectionObserver(([n])=>{const t=h;h=n.isIntersecting,h&&!t&&z(),!h&&t&&y&&(clearTimeout(y),y=null)},{threshold:.2}).observe(document.getElementById("split-demo"))}function ee(){const e=document.getElementById("support-link"),n=document.getElementById("support-modal"),t=document.getElementById("support-modal-close"),i=document.getElementById("support-form"),o=document.getElementById("support-submit"),s=document.getElementById("support-feedback");if(!e||!n||!i)return;function a(d){d.preventDefault(),n.setAttribute("aria-hidden","false")}function m(){n.setAttribute("aria-hidden","true"),s.textContent="",s.className="support-feedback"}e.addEventListener("click",a);const v=document.getElementById("footer-support-link");v&&v.addEventListener("click",a),t.addEventListener("click",m),n.addEventListener("click",d=>{d.target===n&&m()}),document.addEventListener("keydown",d=>{d.key==="Escape"&&n.getAttribute("aria-hidden")==="false"&&m()}),i.addEventListener("submit",async d=>{d.preventDefault();const c=i.email.value.trim(),g=i.message.value.trim();if(!(!c||!g)){o.disabled=!0,o.textContent="Sending...",s.textContent="",s.className="support-feedback";try{const r=await fetch("/api/support/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:c,message:g})}),q=await r.json();if(!r.ok)throw new Error(q.error||"Request failed");s.textContent="Message sent! We'll get back to you soon.",s.className="support-feedback support-feedback--success",i.reset()}catch(r){s.textContent=r.message||"Something went wrong. Please try again.",s.className="support-feedback support-feedback--error"}finally{o.disabled=!1,o.textContent="Send message"}}})}function te(){document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",n=>{const t=document.querySelector(e.getAttribute("href"));t&&(n.preventDefault(),t.scrollIntoView({behavior:"smooth"}))})})}document.addEventListener("DOMContentLoaded",()=>{R(),P(),te(),Z(),ee()});
