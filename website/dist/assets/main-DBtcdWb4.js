import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */const E=[{name:"auth-refactor",input:[{text:`[02:14] Sarah: The auth middleware needs to move to JWT
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
  2. Update route to call service methods`}]}],A=18,S=12,L=400,R=300,F=3e3,y=600;let r,c,b=0,T=!0,x=!1;function P(){if(r=document.getElementById("demo-input"),c=document.getElementById("demo-output"),!r||!c)return;new IntersectionObserver(([a])=>{T=a.isIntersecting},{threshold:.1}).observe(document.getElementById("terminal-demo")),setTimeout(()=>B(),800)}function d(e){return new Promise(a=>{setTimeout(()=>{clearInterval(s),a()},e);const s=setInterval(()=>{},100)})}async function I(){for(;!T;)await d(200)}async function B(){if(!x)for(x=!0;;){const e=E[b];await _(e),b=(b+1)%E.length,await d(F)}}async function _(e){r.style.transition=`opacity ${y}ms ease`,c.style.transition=`opacity ${y}ms ease`,r.style.opacity="0",c.style.opacity="0",await d(y),r.textContent="",c.innerHTML="";const a=e.output.map(s=>{const t=document.createElement("span");return t.className="output-block hidden",t.innerHTML=s.html,c.appendChild(t),{el:t,afterInput:s.afterInput}});r.style.opacity="1",c.style.opacity="1",await d(200);for(let s=0;s<e.input.length;s++){await I();const t=e.input[s],n=document.createElement("span");n.className="terminal-line",r.appendChild(n);const o=document.createElement("span");o.className="typing-cursor",n.appendChild(o);const i=t.text,g=`speaker-${t.speaker}`;let l=0;const h=i,u=h.match(/^(\[\d{2}:\d{2}\]) (\w+:)/),f=u?u[1].length:0,w=u?u[1].length+1+u[2].length:0;let p="";for(;l<h.length;){await I();const m=h[l];l<f?(l===0&&(p+='<span class="ts">'),p+=v(m),l===f-1&&(p+="</span>")):l<w?(l===f+1&&(p+=`<span class="speaker ${g}">`),p+=v(m),l===w-1&&(p+="</span>")):p+=v(m),n.innerHTML=p,n.appendChild(o),l++,r.scrollTop=r.scrollHeight;const k=A+(Math.random()-.5)*S;await d(Math.max(5,k))}o.remove(),await d(R);for(const m of a)m.afterInput===s&&(m.el.classList.remove("hidden"),c.scrollTop=c.scrollHeight,await d(150));s<e.input.length-1&&await d(L)}}function v(e){switch(e){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";default:return e}}function H(){const e=document.querySelectorAll("[data-reveal]");if(!e.length)return;const a=new IntersectionObserver(s=>{for(const t of s)t.isIntersecting&&(t.target.classList.add("revealed"),a.unobserve(t.target))},{threshold:.12});for(const s of e)a.observe(s)}const M=.26,$=.2,W=4.33;function D(){const e=document.getElementById("hours-slider"),a=document.getElementById("slider-value"),s=document.getElementById("cost-deepgram"),t=document.getElementById("cost-claude"),n=document.getElementById("cost-total");if(!e)return;function o(){const i=parseInt(e.value,10),g=i*W,l=g*M,h=g*$,u=l+h;a.textContent=`${i} hrs/wk`,s.textContent=`$${l.toFixed(2)}`,t.textContent=`$${h.toFixed(2)}`,n.textContent=`$${u.toFixed(2)}`}e.addEventListener("input",o),o()}function N(){document.addEventListener("click",async t=>{const n=t.target.closest(".copy-trigger");if(!n)return;const o=n.dataset.copy;if(o)try{await navigator.clipboard.writeText(o),C(n,"Copied!")}catch{const i=document.createElement("textarea");i.value=o,i.style.position="fixed",i.style.opacity="0",document.body.appendChild(i),i.select(),document.execCommand("copy"),document.body.removeChild(i),C(n,"Copied!")}});const e=document.querySelectorAll(".toggle-btn"),a=document.getElementById("showcase-rendered"),s=document.getElementById("showcase-raw");if(e.length&&a&&s)for(const t of e)t.addEventListener("click",()=>{const n=t.dataset.view;for(const o of e)o.classList.remove("active");t.classList.add("active"),n==="rendered"?(a.classList.add("active"),s.classList.remove("active")):(s.classList.add("active"),a.classList.remove("active"))})}function C(e,a){const s=e.querySelector(".copy-tooltip");s&&s.remove();const t=document.createElement("span");t.className="copy-tooltip",t.textContent=a,e.style.position=e.style.position||"relative",e.appendChild(t),setTimeout(()=>t.remove(),1200)}document.addEventListener("DOMContentLoaded",()=>{H(),D(),N(),P()});
