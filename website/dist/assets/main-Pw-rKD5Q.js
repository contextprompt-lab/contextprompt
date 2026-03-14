import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */const P=[{name:"auth-refactor",input:[{text:`[02:14] Sarah: The auth middleware needs to move to JWT
         before the compliance deadline next month.`,speaker:1},{text:`[02:31] Mike:  Which files are we talking about? The session
         store is used in like three places.`,speaker:2},{text:`[02:45] Sarah: Yeah, the main auth.ts and whatever imports
         the session types. Let's also add a refresh
         endpoint while we're at it.`,speaker:1}],output:[{afterInput:1,html:`<span class="output-heading">T1: Replace session tokens with JWT</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/middleware/auth.ts
  src/types/session.ts
<span class="output-label">Steps:</span>
  1. Remove express-session dependency
  2. Install jsonwebtoken
  3. Replace session checks with JWT verify`},{afterInput:2,html:`<span class="output-heading">T2: Add token refresh endpoint</span>
<span class="output-meta"><span class="badge badge--med">medium</span> review <span class="output-dep">depends on T1</span></span>
<span class="output-label">Files:</span>
  src/routes/auth.ts
<span class="output-label">Steps:</span>
  1. Create POST /auth/refresh route
  2. Validate refresh token, issue new JWT`}]},{name:"ui-changes",input:[{text:`[00:12] Alex:  The calendar month has arrows — we should
         not need that. Just stay in the current month.`,speaker:1},{text:`[00:31] Alex:  And the AI chat modal doesn't have a way
         to close it. Add a close button top right.`,speaker:1},{text:`[01:05] Alex:  For the loading screen — the background
         image needs more blur. White blur, not
         dark blue.`,speaker:1}],output:[{afterInput:0,html:`<span class="output-heading">T1: Remove month navigation arrows</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/components/ui/Calendar.tsx
<span class="output-label">Steps:</span>
  1. Remove left/right arrow buttons from JSX
  2. Keep state initialized to current month`},{afterInput:1,html:`<span class="output-heading">T2: Add close button to AI chat modal</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/screens/profile/ChatScreen.tsx
  src/components/icons/CommonIcons.tsx
<span class="output-label">Steps:</span>
  1. Add XIcon button in top-right header
  2. Wire onPress to onClose() prop`},{afterInput:2,html:`<span class="output-heading">T3: Increase blur + white overlay</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/screens/logPhoto/AnalyzingScreen.tsx
<span class="output-label">Steps:</span>
  1. Increase blurRadius to 20
  2. Change overlay to rgba(255,255,255,0.5)`}]},{name:"api-design",input:[{text:`[05:22] Priya: The search endpoint is too slow. We need
         to paginate and add caching headers.`,speaker:1},{text:`[05:40] James: Should we also add rate limiting? We've
         been getting hammered by that one client.`,speaker:2},{text:`[05:55] Priya: Yeah, add rate limiting. And move the
         search logic into its own service file,
         the controller is getting too big.`,speaker:1}],output:[{afterInput:0,html:`<span class="output-heading">T1: Add pagination + caching to search</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/routes/search.ts
  src/services/search.ts
<span class="output-label">Steps:</span>
  1. Add limit/offset query params
  2. Set Cache-Control headers on response`},{afterInput:2,html:`<span class="output-heading">T2: Add rate limiting middleware</span>
<span class="output-meta"><span class="badge badge--med">medium</span> review</span>
<span class="output-label">Files:</span>
  src/middleware/rate-limit.ts
<span class="output-label">Steps:</span>
  1. Create sliding window rate limiter
  2. Apply to /search route (100 req/min)`},{afterInput:2,html:`<span class="output-heading">T3: Extract search service from controller</span>
<span class="output-meta"><span class="badge badge--high">high</span> ready</span>
<span class="output-label">Files:</span>
  src/services/search.ts (new)
  src/routes/search.ts
<span class="output-label">Steps:</span>
  1. Move query building + filtering to service
  2. Update route to call service methods`}]}],D=18,V=12,j=400,K=300,Y=3e3,x=600;let r,c,C=0,O=!0,W=!1;function G(){if(r=document.getElementById("demo-input"),c=document.getElementById("demo-output"),!r||!c)return;new IntersectionObserver(([n])=>{O=n.isIntersecting},{threshold:.1}).observe(document.getElementById("terminal-demo")),setTimeout(()=>Q(),800)}function p(e){return new Promise(n=>{setTimeout(()=>{clearInterval(t),n()},e);const t=setInterval(()=>{},100)})}async function $(){for(;!O;)await p(200)}async function Q(){if(!W)for(W=!0;;){const e=P[C];await X(e),C=(C+1)%P.length,await p(Y)}}async function X(e){r.style.transition=`opacity ${x}ms ease`,c.style.transition=`opacity ${x}ms ease`,r.style.opacity="0",c.style.opacity="0",await p(x),r.textContent="",c.innerHTML="";const n=e.output.map(t=>{const s=document.createElement("span");return s.className="output-block hidden",s.innerHTML=t.html,c.appendChild(s),{el:s,afterInput:t.afterInput}});r.style.opacity="1",c.style.opacity="1",await p(200);for(let t=0;t<e.input.length;t++){await $();const s=e.input[t],a=document.createElement("span");a.className="terminal-line",r.appendChild(a);const i=document.createElement("span");i.className="typing-cursor",a.appendChild(i);const d=s.text,b=`speaker-${s.speaker}`;let o=0;const h=d,u=h.match(/^(\[\d{2}:\d{2}\]) (\w+:)/),L=u?u[1].length:0,R=u?u[1].length+1+u[2].length:0;let m="";for(;o<h.length;){await $();const v=h[o];o<L?(o===0&&(m+='<span class="ts">'),m+=A(v),o===L-1&&(m+="</span>")):o<R?(o===L+1&&(m+=`<span class="speaker ${b}">`),m+=A(v),o===R-1&&(m+="</span>")):m+=A(v),a.innerHTML=m,a.appendChild(i),o++,r.scrollTop=r.scrollHeight;const q=D+(Math.random()-.5)*V;await p(Math.max(5,q))}i.remove(),await p(K);for(const v of n)v.afterInput===t&&(v.el.classList.remove("hidden"),c.scrollTop=c.scrollHeight,await p(150));t<e.input.length-1&&await p(j)}}function A(e){switch(e){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";default:return e}}function Z(){const e=document.querySelectorAll("[data-reveal]");if(!e.length)return;const n=new IntersectionObserver(t=>{for(const s of t)s.isIntersecting&&(s.target.classList.add("revealed"),n.unobserve(s.target))},{threshold:.12});for(const t of e)n.observe(t)}const ee=.26,te=.2,se=4.33;function ne(){const e=document.getElementById("hours-slider"),n=document.getElementById("slider-value"),t=document.getElementById("cost-deepgram"),s=document.getElementById("cost-claude"),a=document.getElementById("cost-total");if(!e)return;function i(){const d=parseInt(e.value,10),b=d*se,o=b*ee,h=b*te,u=o+h;n.textContent=`${d} hrs/wk`,t.textContent=`$${o.toFixed(2)}`,s.textContent=`$${h.toFixed(2)}`,a.textContent=`$${u.toFixed(2)}`}e.addEventListener("input",i),i()}function ae(){document.addEventListener("click",async s=>{const a=s.target.closest(".copy-trigger");if(!a)return;const i=a.dataset.copy;if(i)try{await navigator.clipboard.writeText(i),z(a,"Copied!")}catch{const d=document.createElement("textarea");d.value=i,d.style.position="fixed",d.style.opacity="0",document.body.appendChild(d),d.select(),document.execCommand("copy"),document.body.removeChild(d),z(a,"Copied!")}});const e=document.querySelectorAll(".toggle-btn"),n=document.getElementById("showcase-rendered"),t=document.getElementById("showcase-raw");if(e.length&&n&&t)for(const s of e)s.addEventListener("click",()=>{const a=s.dataset.view;for(const i of e)i.classList.remove("active");s.classList.add("active"),a==="rendered"?(n.classList.add("active"),t.classList.remove("active")):(t.classList.add("active"),n.classList.remove("active"))})}function z(e,n){const t=e.querySelector(".copy-tooltip");t&&t.remove();const s=document.createElement("span");s.className="copy-tooltip",s.textContent=n,e.style.position=e.style.position||"relative",e.appendChild(s),setTimeout(()=>s.remove(),1200)}const N=330,ie=25,oe=2e3,de=[{id:"meeting",label:"In meeting...",start:0,end:30,render:ce},{id:"notes",label:"Taking notes...",start:30,end:90,render:me},{id:"organize",label:"Organizing notes...",start:90,end:150,render:pe},{id:"tickets",label:"Creating tickets...",start:150,end:210,render:ue},{id:"files",label:"Searching files...",start:210,end:270,render:he},{id:"prompts",label:"Writing prompts...",start:270,end:330,render:ve}],le=[{id:"meeting",label:"In meeting...",start:0,end:30,render:ge},{id:"notes",label:"Quick notes...",start:30,end:60,render:fe},{id:"done",label:"",start:60,end:330,render:ye}];let l=0,k,w,T,I,E,H,B,S=null,M=null,f=!1,y=null,g=null;const F={clock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',file:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',folder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',check:'<svg class="demo-done-check" viewBox="0 0 48 48" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><polyline points="14 24 22 32 34 18"/></svg>'};function re(e){const n=Math.floor(e/60),t=e%60;return`${n}:${String(t).padStart(2,"0")}`}function J(e,n,t,s){const a=e.querySelector(".demo-phase");a&&(a.classList.add("demo-phase--exiting"),setTimeout(()=>a.remove(),250));const i=document.createElement("div");i.className="demo-phase demo-phase--entering",n.render(i),e.appendChild(i),n.id==="done"?(t.className="demo-panel-status demo-panel-status--done",t.innerHTML="&#10003; Complete"):(t.className="demo-panel-status",t.innerHTML=`&#9654; ${n.label}`),requestAnimationFrame(()=>{requestAnimationFrame(()=>{i.classList.remove("demo-phase--entering")})})}function _(){if(!f)return;k.textContent=re(l);const e=l/N*100;H.style.width=`${e}%`;const n=de.find(s=>l>=s.start&&l<s.end);n&&n.id!==S&&(J(w,n,I),S=n.id);const t=le.find(s=>l>=s.start&&l<s.end);if(t&&t.id!==M&&(J(T,t,E),M=t.id,t.id==="done"&&B.classList.add("demo-panel--done")),l++,l>N){y=setTimeout(U,oe);return}y=setTimeout(_,ie)}function U(){g&&(clearInterval(g),g=null),l=0,S=null,M=null,w.innerHTML="",T.innerHTML="",I.className="demo-panel-status",I.innerHTML="",E.className="demo-panel-status",E.innerHTML="",k.textContent="0:00",H.style.width="0%",B.classList.remove("demo-panel--done"),_()}function ce(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">SM</div>
        <div class="demo-avatar demo-avatar--2">MK</div>
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
  `}function me(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Meeting Notes</div>
      <div class="demo-note-line" style="animation-delay: 0.1s">- auth thing... JWT maybe?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.3s">- Mike said something about sessions</div>
      <div class="demo-note-line" style="animation-delay: 0.5s">- which files??? auth.ts?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.7s">- refresh endpoint (where?)</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.9s">- TODO: figure out file paths...</div>
    </div>
  `}function pe(e){e.innerHTML=`
    <div>
      <div class="demo-organize-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>
        Reorganizing...
      </div>
      <div class="demo-organize-item demo-organize-item--struck">- Mike said something about sessions</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.2s">- JWT migration for auth middleware</div>
      <div class="demo-organize-item" style="transition-delay: 0.3s">- refresh endpoint needed</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.4s">- figure out which files to change</div>
      <div class="demo-organize-item demo-organize-item--struck" style="transition-delay: 0.5s">- auth thing... JWT maybe?</div>
    </div>
  `,setTimeout(()=>{e.querySelectorAll(".demo-organize-item:not(.demo-organize-item--struck):not(.demo-organize-item--moving)").forEach(t=>t.classList.add("demo-organize-item--moving"))},400)}function ue(e){e.innerHTML=`
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
  `}function he(e){const n=[{icon:"folder",name:"src/",indent:0},{icon:"folder",name:"middleware/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"cors.ts",indent:2},{icon:"folder",name:"routes/",indent:1},{icon:"file",name:"auth.ts",indent:2},{icon:"file",name:"users.ts",indent:2},{icon:"folder",name:"types/",indent:1},{icon:"file",name:"session.ts",indent:2},{icon:"file",name:"auth.ts",indent:2}];e.innerHTML=`
    <div class="demo-file-search">
      <div class="demo-search-query"><span class="prompt">$</span> grep -r "session" src/</div>
      <div class="demo-file-list">
        ${n.map((a,i)=>`
          <div class="demo-file-item" data-scan-index="${i}" style="padding-left: ${8+a.indent*14}px">
            <span class="demo-file-icon">${F[a.icon]}</span>
            ${a.name}
          </div>
        `).join("")}
      </div>
      <div class="demo-thought-bubble">"Which files do I actually need to change?"</div>
    </div>
  `;let t=0;const s=e.querySelectorAll(".demo-file-item");g&&clearInterval(g),g=setInterval(()=>{s.forEach(a=>a.classList.remove("demo-file-item--scanning")),t<s.length?(s[t].classList.add("demo-file-item--scanning"),t++):t=0},150)}function ve(e){e.innerHTML=`
    <div class="demo-prompt-editor">
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0s">claude "migrate auth to JWT in src/auth.ts"</div>
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0.3s">claude "change the session middleware to use...</div>
      <div class="demo-prompt-line" style="animation-delay: 0.6s">claude "In src/middleware/auth.ts, replace the</div>
      <div class="demo-prompt-line" style="animation-delay: 0.8s">  express-session based auth with JWT. Also</div>
      <div class="demo-prompt-line" style="animation-delay: 1.0s">  update src/types/session.ts and add a</div>
      <div class="demo-prompt-line" style="animation-delay: 1.2s">  refresh endpoint in src/routes/auth.ts..."</div>
      <span class="demo-prompt-cursor"></span>
    </div>
  `}function ge(e){e.innerHTML=`
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">SM</div>
        <div class="demo-avatar demo-avatar--2">MK</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles">
        <div class="demo-bubble demo-bubble--1" style="animation-delay: 0.1s">The auth middleware needs to move to JWT...</div>
        <div class="demo-bubble demo-bubble--2" style="animation-delay: 0.3s">Which files are we talking about?</div>
        <div class="demo-bubble demo-bubble--3" style="animation-delay: 0.5s">Also add a refresh endpoint</div>
      </div>
      <div class="demo-recording-pill demo-recording-pill--on">
        <span class="demo-recording-dot demo-recording-dot--on"></span>
        meetcode running
      </div>
    </div>
  `}function fe(e){e.innerHTML=`
    <div class="demo-notepad">
      <div class="demo-notepad-title">Quick Notes</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.1s"><span class="demo-note-check">&#10003;</span> JWT migration - compliance deadline</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.3s"><span class="demo-note-check">&#10003;</span> Add refresh endpoint</div>
    </div>
  `}function ye(e){e.innerHTML=`
    <div class="demo-done">
      ${F.check}
      <div class="demo-done-time">Done in 1:00</div>
      <div class="demo-done-summary">
        <div>3 tasks extracted &middot; all high confidence</div>
        <div class="demo-done-tasks">
          <span class="demo-done-task">T1: JWT migration</span>
          <span class="demo-done-task">T2: Refresh endpoint</span>
          <span class="demo-done-task">T3: Update types</span>
        </div>
      </div>
      <div class="demo-time-saved">Time saved: 4:30</div>
    </div>
  `}function be(){if(k=document.getElementById("demo-timer"),w=document.getElementById("demo-left"),T=document.getElementById("demo-right"),I=document.getElementById("demo-left-status"),E=document.getElementById("demo-right-status"),H=document.getElementById("demo-progress-bar"),document.querySelector(".demo-panel--left"),B=document.querySelector(".demo-panel--right"),!k||!w||!T)return;new IntersectionObserver(([n])=>{const t=f;f=n.isIntersecting,f&&!t&&U(),!f&&t&&y&&(clearTimeout(y),y=null)},{threshold:.2}).observe(document.getElementById("split-demo"))}document.addEventListener("DOMContentLoaded",()=>{Z(),ne(),ae(),G(),be()});
