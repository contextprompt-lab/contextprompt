import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */const N=18,C=12;class g{constructor(e,n={}){this.el=e,this.charDelay=n.charDelay??N,this.variance=n.variance??C,this.aborted=!1}abort(){this.aborted=!0}sleep(e){return new Promise(n=>{const o=setTimeout(()=>{clearInterval(d),n()},e),d=setInterval(()=>{this.aborted&&(clearTimeout(o),clearInterval(d),n())},50)})}async type(e,{className:n="",html:o=!1}={}){if(this.aborted)return;const d=document.createElement("span");if(n&&(d.className=n),this.el.appendChild(d),o)d.innerHTML=e,await this.sleep(50);else for(let s=0;s<e.length;s++){if(this.aborted){d.textContent=e;break}d.textContent+=e[s],this.el.scrollTop=this.el.scrollHeight;const i=this.charDelay+(Math.random()-.5)*this.variance;await this.sleep(Math.max(5,i))}return this.el.scrollTop=this.el.scrollHeight,d}appendLine(e,{className:n=""}={}){const o=document.createElement("div");return n&&(o.className=n),o.textContent=e,this.el.appendChild(o),this.el.scrollTop=this.el.scrollHeight,o}appendHTML(e,{className:n=""}={}){const o=document.createElement("div");return n&&(o.className=n),o.innerHTML=e,this.el.appendChild(o),this.el.scrollTop=this.el.scrollHeight,o}async pause(e){await this.sleep(e)}clear(){this.el.innerHTML=""}}const T={participants:[{name:"Sarah",role:"PM",color:"#58a6ff"},{name:"Alex",role:"Engineer",color:"#bc8cff"}],transcript:[{time:"00:03",speaker:0,text:"Okay, so for the todo app — the main thing users keep asking for is due dates."},{time:"00:08",speaker:0,text:"Each todo should have an optional due date, and we should show it next to the title."},{time:"00:14",speaker:1,text:"Makes sense. I'll add a date picker to TodoItem and a dueDate field on the API."},{time:"00:19",speaker:0,text:"Perfect. And the other thing — there's no way to delete a todo right now."},{time:"00:24",speaker:1,text:"Right, we need a delete button on each item and a DELETE endpoint."},{time:"00:28",speaker:0,text:"Yeah. And can we also add priority levels? Like high, medium, low."},{time:"00:33",speaker:1,text:"Sure — a dropdown on each todo. Color coded would be nice."},{time:"00:38",speaker:0,text:"Exactly. Color-coded badges. High is red, medium is yellow, low is green."},{time:"00:43",speaker:0,text:"And sort by priority by default — high priority first."},{time:"00:48",speaker:1,text:"Got it. Three things then — due dates, delete, and priorities."}]},h={"TodoApp.tsx":`import { useState, useEffect } from 'react';
import { TodoItem } from './TodoItem';

export function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    fetch('/api/todos')
      .then(r => r.json())
      .then(setTodos);
  }, []);

  const addTodo = async () => {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input }),
    });
    const todo = await res.json();
    setTodos([...todos, todo]);
    setInput('');
  };

  return (
    <div className="todo-app">
      <h1>My Todos</h1>
      <div className="todo-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul className="todo-list">
        {todos.map(t => (
          <TodoItem key={t.id} todo={t} />
        ))}
      </ul>
    </div>
  );
}`,"TodoItem.tsx":`export function TodoItem({ todo }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
    </li>
  );
}`,"todos.ts":`import { Router } from 'express';

const router = Router();
let todos: any[] = [];
let nextId = 1;

router.get('/api/todos', (req, res) => {
  res.json(todos);
});

router.post('/api/todos', (req, res) => {
  const todo = {
    id: nextId++,
    title: req.body.title,
    done: false,
  };
  todos.push(todo);
  res.json(todo);
});

export default router;`},p={decisions:["Add optional due date field to each todo with date picker UI","Add delete button on each todo item with DELETE API endpoint","Add color-coded priority levels (high/medium/low) with sorting"],tasks:[{id:"T1",title:"Add due date field to todos",status:"ready",confidence:"high",confidence_reason:"Both speakers explicitly discussed adding a due date field with date picker UI. File targets are clear.",why:"Users have been requesting due dates — it was the top feedback item mentioned.",proposed_change:"Add a dueDate field to the todo data model, render a date input in TodoItem, and accept dueDate in the POST endpoint.",evidence:'"Each todo should have an optional due date, and we should show it next to the title."',high_confidence_files:[{path:"src/components/TodoItem.tsx",reason:"Renders each todo — needs date picker added"},{path:"src/api/todos.ts",reason:"POST handler must accept and store dueDate field"}],possible_related_files:[{path:"src/components/TodoApp.tsx",reason:"Parent component — may need to pass date-related props"}],ambiguities:["Date format not specified — assuming ISO date string"],assumptions:["Due date is optional and nullable"],dependencies:[],agent_steps:["Add dueDate?: string to the todo type in todos.ts","Update POST handler to read req.body.dueDate",'Add <input type="date"> to TodoItem next to the title',"Style the date input to match existing design"]},{id:"T2",title:"Add delete functionality",status:"ready",confidence:"high",confidence_reason:'Explicitly requested: "we need a delete button on each item and a DELETE endpoint." Clear scope.',why:"There is currently no way for users to remove todos once created.",proposed_change:"Add a DELETE /api/todos/:id endpoint and a delete button in TodoItem that calls it.",evidence:`"There's no way to delete a todo right now... we need a delete button on each item and a DELETE endpoint."`,high_confidence_files:[{path:"src/components/TodoItem.tsx",reason:"Needs delete button added to each item"},{path:"src/api/todos.ts",reason:"Needs DELETE /api/todos/:id route"}],possible_related_files:[{path:"src/components/TodoApp.tsx",reason:"Needs onDelete callback to update state after deletion"}],ambiguities:["No confirmation dialog mentioned — assuming immediate delete"],assumptions:["Delete is a hard delete, not soft delete"],dependencies:[],agent_steps:["Add DELETE /api/todos/:id route that removes the todo from the array","Add a delete button (x) to TodoItem component","Wire button to fetch DELETE and call onDelete prop","Update TodoApp to pass onDelete and filter state"]},{id:"T3",title:"Add color-coded priority levels",status:"ready",confidence:"high",confidence_reason:"Colors explicitly defined: red=high, yellow=medium, green=low. Sort order specified.",why:"Team wants visual priority indicators to help users focus on important tasks.",proposed_change:"Add a priority field (high/medium/low) to todos, render colored badges, and sort by priority.",evidence:'"Color-coded badges. High is red, medium is yellow, low is green. And sort by priority by default."',high_confidence_files:[{path:"src/components/TodoItem.tsx",reason:"Render priority badge with color coding"},{path:"src/components/TodoApp.tsx",reason:"Sort todos by priority before rendering"},{path:"src/api/todos.ts",reason:"Accept and store priority field"}],possible_related_files:[],ambiguities:['Default priority for new todos not specified — assuming "medium"'],assumptions:["Priority is required on creation, defaults to medium"],dependencies:[],agent_steps:['Add priority field to todo type in todos.ts (default: "medium")',"Update POST handler to accept priority","Add priority dropdown to TodoApp creation form","Render colored badge in TodoItem (red/yellow/green)","Sort todos by priority in TodoApp (high → medium → low)"]}]},q={T1:[{file:"TodoItem.tsx",hunks:[{type:"context",text:"export function TodoItem({ todo }) {"},{type:"context",text:"  return ("},{type:"context",text:'    <li className="todo-item">'},{type:"context",text:'      <input type="checkbox" checked={todo.done} />'},{type:"context",text:'      <span className="todo-title">{todo.title}</span>'},{type:"add",text:"      {todo.dueDate && ("},{type:"add",text:'        <span className="todo-date">{todo.dueDate}</span>'},{type:"add",text:"      )}"},{type:"context",text:"    </li>"},{type:"context",text:"  );"},{type:"context",text:"}"}]},{file:"todos.ts",hunks:[{type:"context",text:"router.post('/api/todos', (req, res) => {"},{type:"context",text:"  const todo = {"},{type:"context",text:"    id: nextId++,"},{type:"context",text:"    title: req.body.title,"},{type:"context",text:"    done: false,"},{type:"add",text:"    dueDate: req.body.dueDate || null,"},{type:"context",text:"  };"}]}],T2:[{file:"TodoItem.tsx",hunks:[{type:"remove",text:"export function TodoItem({ todo }) {"},{type:"add",text:"export function TodoItem({ todo, onDelete }) {"},{type:"context",text:"  return ("},{type:"context",text:'    <li className="todo-item">'},{type:"context",text:'      <input type="checkbox" checked={todo.done} />'},{type:"context",text:'      <span className="todo-title">{todo.title}</span>'},{type:"add",text:'      <button className="todo-delete" onClick={() => onDelete(todo.id)}>'},{type:"add",text:"        ×"},{type:"add",text:"      </button>"},{type:"context",text:"    </li>"}]},{file:"todos.ts",hunks:[{type:"context",text:"export default router;"},{type:"add",text:""},{type:"add",text:"router.delete('/api/todos/:id', (req, res) => {"},{type:"add",text:"  const id = parseInt(req.params.id);"},{type:"add",text:"  todos = todos.filter(t => t.id !== id);"},{type:"add",text:"  res.status(204).end();"},{type:"add",text:"});"}]}],T3:[{file:"TodoItem.tsx",hunks:[{type:"context",text:'      <span className="todo-title">{todo.title}</span>'},{type:"add",text:"      <span className={`todo-priority priority-${todo.priority}`}>"},{type:"add",text:"        {todo.priority}"},{type:"add",text:"      </span>"},{type:"context",text:"    </li>"}]},{file:"TodoApp.tsx",hunks:[{type:"remove",text:"      body: JSON.stringify({ title: input }),"},{type:"add",text:"      body: JSON.stringify({ title: input, priority: 'medium' }),"},{type:"context",text:"    });"},{type:"context",text:"    const todo = await res.json();"},{type:"context",text:"    setTodos([...todos, todo]);"}]},{file:"todos.ts",hunks:[{type:"context",text:"  const todo = {"},{type:"context",text:"    id: nextId++,"},{type:"context",text:"    title: req.body.title,"},{type:"context",text:"    done: false,"},{type:"add",text:"    priority: req.body.priority || 'medium',"},{type:"context",text:"  };"}]}]},$={T1:[{type:"thinking",text:"> Reading TodoItem.tsx..."},{type:"edit",text:"> Adding dueDate display after title span"},{type:"thinking",text:"> Reading todos.ts..."},{type:"edit",text:"> Adding dueDate field to POST handler"},{type:"success",text:"✓ T1 complete — due date field added to 2 files"}],T2:[{type:"thinking",text:"> Reading TodoItem.tsx..."},{type:"edit",text:"> Adding onDelete prop and delete button"},{type:"thinking",text:"> Reading todos.ts..."},{type:"edit",text:"> Adding DELETE /api/todos/:id endpoint"},{type:"success",text:"✓ T2 complete — delete functionality added to 2 files"}],T3:[{type:"thinking",text:"> Reading TodoItem.tsx..."},{type:"edit",text:"> Adding priority badge with color classes"},{type:"thinking",text:"> Reading TodoApp.tsx..."},{type:"edit",text:"> Setting default priority on new todos"},{type:"thinking",text:"> Reading todos.ts..."},{type:"edit",text:"> Adding priority field to POST handler"},{type:"success",text:"✓ T3 complete — priority levels added to 3 files"}]},w={T1:{"TodoApp.tsx":h["TodoApp.tsx"],"TodoItem.tsx":`export function TodoItem({ todo }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
      {todo.dueDate && (
        <span className="todo-date">{todo.dueDate}</span>
      )}
    </li>
  );
}`,"todos.ts":`import { Router } from 'express';

const router = Router();
let todos: any[] = [];
let nextId = 1;

router.get('/api/todos', (req, res) => {
  res.json(todos);
});

router.post('/api/todos', (req, res) => {
  const todo = {
    id: nextId++,
    title: req.body.title,
    done: false,
    dueDate: req.body.dueDate || null,
  };
  todos.push(todo);
  res.json(todo);
});

export default router;`},T2:{"TodoApp.tsx":h["TodoApp.tsx"],"TodoItem.tsx":`export function TodoItem({ todo, onDelete }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
      {todo.dueDate && (
        <span className="todo-date">{todo.dueDate}</span>
      )}
      <button className="todo-delete" onClick={() => onDelete(todo.id)}>
        ×
      </button>
    </li>
  );
}`,"todos.ts":`import { Router } from 'express';

const router = Router();
let todos: any[] = [];
let nextId = 1;

router.get('/api/todos', (req, res) => {
  res.json(todos);
});

router.post('/api/todos', (req, res) => {
  const todo = {
    id: nextId++,
    title: req.body.title,
    done: false,
    dueDate: req.body.dueDate || null,
  };
  todos.push(todo);
  res.json(todo);
});

router.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  todos = todos.filter(t => t.id !== id);
  res.status(204).end();
});

export default router;`},T3:{"TodoApp.tsx":`import { useState, useEffect } from 'react';
import { TodoItem } from './TodoItem';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    fetch('/api/todos')
      .then(r => r.json())
      .then(setTodos);
  }, []);

  const addTodo = async () => {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input, priority: 'medium' }),
    });
    const todo = await res.json();
    setTodos([...todos, todo]);
    setInput('');
  };

  const sorted = [...todos].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <div className="todo-app">
      <h1>My Todos</h1>
      <div className="todo-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul className="todo-list">
        {sorted.map(t => (
          <TodoItem key={t.id} todo={t} />
        ))}
      </ul>
    </div>
  );
}`,"TodoItem.tsx":`export function TodoItem({ todo, onDelete }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
      {todo.dueDate && (
        <span className="todo-date">{todo.dueDate}</span>
      )}
      <span className={\`todo-priority priority-\${todo.priority}\`}>
        {todo.priority}
      </span>
      <button className="todo-delete" onClick={() => onDelete(todo.id)}>
        ×
      </button>
    </li>
  );
}`,"todos.ts":`import { Router } from 'express';

const router = Router();
let todos: any[] = [];
let nextId = 1;

router.get('/api/todos', (req, res) => {
  res.json(todos);
});

router.post('/api/todos', (req, res) => {
  const todo = {
    id: nextId++,
    title: req.body.title,
    done: false,
    dueDate: req.body.dueDate || null,
    priority: req.body.priority || 'medium',
  };
  todos.push(todo);
  res.json(todo);
});

router.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  todos = todos.filter(t => t.id !== id);
  res.status(204).end();
});

export default router;`}},R=[{text:"Scanning repos...",detail:"3 files, 1,200 tokens",duration:1200},{text:"Processing transcript...",detail:"10 utterances, 2 speakers",duration:800},{text:"Extracting tasks with Claude...",detail:"",duration:2e3},{text:"contextprompt-2026-03-12.md",detail:"3 tasks, all high confidence",duration:0,success:!0}];let r,f,b=0;async function H(t){const e=document.getElementById("meeting-transcript"),n=document.getElementById("meeting-timer"),o=document.getElementById("meeting-skip");e.innerHTML="",b=0,A(n),r=new g(e,{charDelay:16,variance:10}),f=setInterval(()=>{b++,A(n)},1e3);const d=()=>{r.abort(),clearInterval(f),o.removeEventListener("click",d),I(e,t)};o.addEventListener("click",d);for(const s of T.transcript){if(r.aborted)break;const i=T.participants[s.speaker];M(s.speaker);const a=document.createElement("div");a.className="transcript-line",e.appendChild(a);const c=document.createElement("span");c.className="transcript-ts",c.textContent=`[${s.time}] `,a.appendChild(c);const l=document.createElement("span");l.className=`transcript-speaker speaker-${s.speaker}`,l.textContent=`${i.name}: `,a.appendChild(l);const u=document.createElement("span");u.className="transcript-text",a.appendChild(u);const m=new g(u,{charDelay:16,variance:10});m.aborted=r.aborted;const S=r.abort.bind(r);r.abort=()=>{S(),m.abort()},await m.type(s.text),e.scrollTop=e.scrollHeight,await r.pause(500)}r.aborted||(clearInterval(f),o.removeEventListener("click",d),await r.pause(800),I(e,t))}function I(t,e){if(r.aborted){t.innerHTML="";for(const n of T.transcript){const o=T.participants[n.speaker],d=document.createElement("div");d.className="transcript-line",d.innerHTML=`<span class="transcript-ts">[${n.time}] </span><span class="transcript-speaker speaker-${n.speaker}">${o.name}: </span><span class="transcript-text">${n.text}</span>`,t.appendChild(d)}}_(),e()}function A(t){const e=String(Math.floor(b/60)).padStart(2,"0"),n=String(b%60).padStart(2,"0");t.textContent=`${e}:${n}`}function M(t){document.querySelectorAll(".participant").forEach(e=>{e.classList.toggle("active",parseInt(e.dataset.idx)===t)})}function _(){document.querySelectorAll(".participant").forEach(t=>t.classList.remove("active"))}function P(){r&&r.abort(),clearInterval(f)}async function O(t){const e=document.getElementById("extraction-steps"),n=document.getElementById("extraction-plan");e.innerHTML="",n.innerHTML="",n.classList.remove("visible");for(const o of R){const d=document.createElement("div");d.className="extraction-step",o.success?(d.innerHTML=`<span class="extraction-check">✓</span> <span class="extraction-success">${o.text}</span>`,o.detail&&(d.innerHTML+=` <span class="extraction-detail">${o.detail}</span>`)):(d.innerHTML=`<span class="extraction-spinner"></span> ${o.text}`,o.detail&&(d.innerHTML+=` <span class="extraction-detail">${o.detail}</span>`)),e.appendChild(d),o.duration>0?await v(o.duration):await v(100);const s=d.querySelector(".extraction-spinner");s&&(s.outerHTML='<span class="extraction-check">✓</span>')}await v(400),j(n),n.classList.add("visible"),t()}function j(t){t.innerHTML=`
    <div class="plan-header">
      <h3>Execution Plan</h3>
      <p class="plan-meta">${p.tasks.length} tasks · 2 speakers · 1m meeting</p>
    </div>

    <div class="plan-decisions">
      <h4>Decisions</h4>
      <ol>${p.decisions.map(e=>`<li>${e}</li>`).join("")}</ol>
    </div>

    <table class="plan-table">
      <thead><tr><th>ID</th><th>Task</th><th>Confidence</th><th>Files</th></tr></thead>
      <tbody>
        ${p.tasks.map(e=>`
          <tr>
            <td>${e.id}</td>
            <td>${e.title}</td>
            <td><span class="badge badge--high">${e.confidence}</span></td>
            <td>${e.high_confidence_files.length+e.possible_related_files.length}</td>
          </tr>`).join("")}
      </tbody>
    </table>

    <div class="plan-task-detail">
      <h4>${p.tasks[0].id}: ${p.tasks[0].title}</h4>
      <p class="plan-confidence"><span class="badge badge--high">high</span> — ${p.tasks[0].confidence_reason}</p>
      <div class="plan-evidence">
        <span class="plan-evidence-label">Evidence</span>
        <blockquote>${p.tasks[0].evidence}</blockquote>
      </div>
      <div class="plan-files">
        <p class="plan-files-label">Files</p>
        <ul>${p.tasks[0].high_confidence_files.map(e=>`<li><code>${e.path}</code> — ${e.reason}</li>`).join("")}</ul>
      </div>
    </div>
  `}function v(t){return new Promise(e=>setTimeout(e,t))}const B=[{pattern:/(\/\/.*$)/gm,cls:"syn-comment"},{pattern:/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g,cls:"syn-string"},{pattern:/(&lt;\/?[A-Za-z][A-Za-z0-9.]*)/g,cls:"syn-tag"},{pattern:/\b(import|export|from|const|let|var|function|return|async|await|default|if|else|new|typeof|class|extends)\b/g,cls:"syn-keyword"},{pattern:/\b(useState|useEffect|Router|any|string|number|boolean|void)\b/g,cls:"syn-type"},{pattern:/\b(\d+)\b/g,cls:"syn-number"},{pattern:/\b(true|false|null|undefined)\b/g,cls:"syn-bool"}];function U(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function D(t){let e=U(t);const n=[];for(const o of B)e=e.replace(o.pattern,d=>{const s=n.length;return n.push(`<span class="${o.cls}">${d}</span>`),`\0${s}\0`});for(let o=0;o<n.length;o++)e=e.replace(`\0${o}\0`,n[o]);return e}function k(t,e){t.innerHTML=D(e)}async function Y(t,e,{animate:n=!0,delay:o=80}={}){t.innerHTML="";for(const d of e){const s=document.createElement("div");s.className=`diff-line diff-${d.type}`;const i=document.createElement("span");i.className="diff-prefix",i.textContent=d.type==="add"?"+":d.type==="remove"?"-":" ";const a=document.createElement("span");a.className="diff-code",a.innerHTML=D(d.text),s.appendChild(i),s.appendChild(a),n&&(s.style.opacity="0",s.style.transform="translateY(4px)"),t.appendChild(s),n&&(await J(o),s.style.transition="opacity 0.2s, transform 0.2s",s.style.opacity="1",s.style.transform="translateY(0)")}}async function F(t,e,n={}){t.innerHTML="";for(let o=0;o<e.length;o++){const d=e[o],s=document.createElement("div");s.className="diff-file-header",s.textContent=d.file,t.appendChild(s);const i=document.createElement("div");if(i.className="diff-file-body",t.appendChild(i),await Y(i,d.hunks,n),o<e.length-1){const a=document.createElement("div");a.className="diff-spacer",t.appendChild(a)}}}function J(t){return new Promise(e=>setTimeout(e,t))}let x=null,y=null;function z(){Z();const t=document.querySelector(".exec-task-btn");t&&t.click()}function Z(){const t=document.getElementById("exec-tasks");t.innerHTML=p.tasks.map(e=>`
    <button class="exec-task-btn" data-task="${e.id}">
      <span class="exec-task-id">${e.id}</span>
      ${e.title}
    </button>
  `).join(""),t.querySelectorAll(".exec-task-btn").forEach(e=>{e.addEventListener("click",()=>{t.querySelectorAll(".exec-task-btn").forEach(n=>n.classList.remove("active")),e.classList.add("active"),G(e.dataset.task)})})}async function G(t){y&&y.abort(),x=t;const e=document.getElementById("exec-terminal-body"),n=document.getElementById("exec-diff");e.innerHTML="",n.innerHTML="";const o=document.createElement("div");o.className="exec-terminal-header-line",o.innerHTML=`<span class="exec-prompt">claude</span> Implement task ${t} from contextprompt-2026-03-12.md`,e.appendChild(o);const d=document.createElement("div");d.className="exec-terminal-sep",e.appendChild(d);const s=new g(e,{charDelay:12,variance:8});y=s;const i=$[t]||[];for(const a of i){if(s.aborted||x!==t)break;const c=document.createElement("div");c.className=`exec-agent-line exec-agent-${a.type}`,e.appendChild(c);const l=new g(c,{charDelay:12,variance:8});s.aborted&&l.abort();const u=s.abort.bind(s);s.abort=()=>{u(),l.abort()},await l.type(a.text),await s.pause(350)}if(x===t){const a=q[t]||[];await F(n,a,{animate:!s.aborted,delay:50}),V(t),W(t)}}function V(t){const e=document.getElementById("preview-app"),o=["T1","T2","T3"].indexOf(t);e.classList.remove("show-dates","show-delete","show-priority");const d=["show-dates","show-delete","show-priority"];for(let s=0;s<=o;s++)e.classList.add(d[s])}function W(t){const e=w[t];if(!e)return;const n=document.getElementById("code-panel-body");if(!n)return;const o=document.querySelector(".code-tab.active"),d=o==null?void 0:o.dataset.file;d&&e[d]&&(k(n,e[d]),n.classList.add("code-updated"),setTimeout(()=>n.classList.remove("code-updated"),600)),document.querySelectorAll(".code-tab").forEach(s=>{const i=()=>{var u;document.querySelectorAll(".code-tab").forEach(m=>m.classList.remove("active")),s.classList.add("active");const c=s.dataset.file,l=e[c]||((u=w[t])==null?void 0:u[c]);l&&k(n,l)},a=s.cloneNode(!0);a.addEventListener("click",i),s.parentNode.replaceChild(a,s)})}function K(){y&&y.abort(),x=null;const t=document.getElementById("preview-app");t&&t.classList.remove("show-dates","show-delete","show-priority")}function E(t){const e=document.getElementById("hiw");e.dataset.step=t,document.querySelectorAll(".step-tab").forEach(n=>{const o=parseInt(n.dataset.step);n.classList.toggle("active",o===t),n.classList.toggle("done",o<t)})}async function L(){E(1),await new Promise(t=>H(t)),await ee(500),E(2),await new Promise(t=>O(t))}function Q(){E(3),z()}function X(){P(),K(),L()}function ee(t){return new Promise(e=>setTimeout(e,t))}document.addEventListener("DOMContentLoaded",()=>{var e,n;(e=document.getElementById("replay-btn"))==null||e.addEventListener("click",X),(n=document.getElementById("to-step-3"))==null||n.addEventListener("click",Q);const t=document.getElementById("code-panel-body");if(t){const o=Object.keys(h);k(t,h[o[0]]),document.querySelectorAll(".code-tab").forEach(d=>{d.addEventListener("click",()=>{document.querySelectorAll(".code-tab").forEach(s=>s.classList.remove("active")),d.classList.add("active"),k(t,h[d.dataset.file])})})}L()});
