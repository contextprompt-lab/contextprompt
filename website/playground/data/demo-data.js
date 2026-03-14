// ============================================================
// Pre-computed demo data for the contextprompt playground
// ============================================================

// -- Meeting transcript (Sarah = PM, Alex = Engineer) --------
export const meeting = {
  title: 'Todo App — Sprint Planning',
  participants: [
    { name: 'Sarah', role: 'PM', color: '#58a6ff' },
    { name: 'Alex', role: 'Engineer', color: '#bc8cff' },
  ],
  // Each line appears via typewriter; ~30s total at default speed
  transcript: [
    { time: '00:03', speaker: 0, text: 'Okay, so for the todo app — the main thing users keep asking for is due dates.' },
    { time: '00:08', speaker: 0, text: 'Each todo should have an optional due date, and we should show it next to the title.' },
    { time: '00:14', speaker: 1, text: 'Makes sense. I\'ll add a date picker to TodoItem and a dueDate field on the API.' },
    { time: '00:19', speaker: 0, text: 'Perfect. And the other thing — there\'s no way to delete a todo right now.' },
    { time: '00:24', speaker: 1, text: 'Right, we need a delete button on each item and a DELETE endpoint.' },
    { time: '00:28', speaker: 0, text: 'Yeah. And can we also add priority levels? Like high, medium, low.' },
    { time: '00:33', speaker: 1, text: 'Sure — a dropdown on each todo. Color coded would be nice.' },
    { time: '00:38', speaker: 0, text: 'Exactly. Color-coded badges. High is red, medium is yellow, low is green.' },
    { time: '00:43', speaker: 0, text: 'And sort by priority by default — high priority first.' },
    { time: '00:48', speaker: 1, text: 'Got it. Three things then — due dates, delete, and priorities.' },
  ],
};

// -- Fake codebase (the "before" state) ----------------------
export const codebase = {
  'TodoApp.tsx': `import { useState, useEffect } from 'react';
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
}`,

  'TodoItem.tsx': `export function TodoItem({ todo }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
    </li>
  );
}`,

  'todos.ts': `import { Router } from 'express';

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

export default router;`,
};

// -- Extraction plan (mirrors ExtractedPlan) -----------------
export const plan = {
  decisions: [
    'Add optional due date field to each todo with date picker UI',
    'Add delete button on each todo item with DELETE API endpoint',
    'Add color-coded priority levels (high/medium/low) with sorting',
  ],
  execution_buckets: {
    ready_now: ['T1', 'T2', 'T3'],
    review_before_execution: [],
    needs_clarification: [],
  },
  tasks: [
    {
      id: 'T1',
      title: 'Add due date field to todos',
      status: 'ready',
      confidence: 'high',
      confidence_reason: 'Both speakers explicitly discussed adding a due date field with date picker UI. File targets are clear.',
      why: 'Users have been requesting due dates — it was the top feedback item mentioned.',
      proposed_change: 'Add a dueDate field to the todo data model, render a date input in TodoItem, and accept dueDate in the POST endpoint.',
      evidence: '"Each todo should have an optional due date, and we should show it next to the title."',
      high_confidence_files: [
        { path: 'src/components/TodoItem.tsx', reason: 'Renders each todo — needs date picker added' },
        { path: 'src/api/todos.ts', reason: 'POST handler must accept and store dueDate field' },
      ],
      possible_related_files: [
        { path: 'src/components/TodoApp.tsx', reason: 'Parent component — may need to pass date-related props' },
      ],
      ambiguities: ['Date format not specified — assuming ISO date string'],
      assumptions: ['Due date is optional and nullable'],
      dependencies: [],
      agent_steps: [
        'Add dueDate?: string to the todo type in todos.ts',
        'Update POST handler to read req.body.dueDate',
        'Add <input type="date"> to TodoItem next to the title',
        'Style the date input to match existing design',
      ],
    },
    {
      id: 'T2',
      title: 'Add delete functionality',
      status: 'ready',
      confidence: 'high',
      confidence_reason: 'Explicitly requested: "we need a delete button on each item and a DELETE endpoint." Clear scope.',
      why: 'There is currently no way for users to remove todos once created.',
      proposed_change: 'Add a DELETE /api/todos/:id endpoint and a delete button in TodoItem that calls it.',
      evidence: '"There\'s no way to delete a todo right now... we need a delete button on each item and a DELETE endpoint."',
      high_confidence_files: [
        { path: 'src/components/TodoItem.tsx', reason: 'Needs delete button added to each item' },
        { path: 'src/api/todos.ts', reason: 'Needs DELETE /api/todos/:id route' },
      ],
      possible_related_files: [
        { path: 'src/components/TodoApp.tsx', reason: 'Needs onDelete callback to update state after deletion' },
      ],
      ambiguities: ['No confirmation dialog mentioned — assuming immediate delete'],
      assumptions: ['Delete is a hard delete, not soft delete'],
      dependencies: [],
      agent_steps: [
        'Add DELETE /api/todos/:id route that removes the todo from the array',
        'Add a delete button (x) to TodoItem component',
        'Wire button to fetch DELETE and call onDelete prop',
        'Update TodoApp to pass onDelete and filter state',
      ],
    },
    {
      id: 'T3',
      title: 'Add color-coded priority levels',
      status: 'ready',
      confidence: 'high',
      confidence_reason: 'Colors explicitly defined: red=high, yellow=medium, green=low. Sort order specified.',
      why: 'Team wants visual priority indicators to help users focus on important tasks.',
      proposed_change: 'Add a priority field (high/medium/low) to todos, render colored badges, and sort by priority.',
      evidence: '"Color-coded badges. High is red, medium is yellow, low is green. And sort by priority by default."',
      high_confidence_files: [
        { path: 'src/components/TodoItem.tsx', reason: 'Render priority badge with color coding' },
        { path: 'src/components/TodoApp.tsx', reason: 'Sort todos by priority before rendering' },
        { path: 'src/api/todos.ts', reason: 'Accept and store priority field' },
      ],
      possible_related_files: [],
      ambiguities: ['Default priority for new todos not specified — assuming "medium"'],
      assumptions: ['Priority is required on creation, defaults to medium'],
      dependencies: [],
      agent_steps: [
        'Add priority field to todo type in todos.ts (default: "medium")',
        'Update POST handler to accept priority',
        'Add priority dropdown to TodoApp creation form',
        'Render colored badge in TodoItem (red/yellow/green)',
        'Sort todos by priority in TodoApp (high → medium → low)',
      ],
    },
  ],
};

// -- Code diffs per task (before/after with hunks) -----------
export const taskDiffs = {
  T1: [
    {
      file: 'TodoItem.tsx',
      hunks: [
        { type: 'context', text: 'export function TodoItem({ todo }) {' },
        { type: 'context', text: '  return (' },
        { type: 'context', text: '    <li className="todo-item">' },
        { type: 'context', text: '      <input type="checkbox" checked={todo.done} />' },
        { type: 'context', text: '      <span className="todo-title">{todo.title}</span>' },
        { type: 'add',     text: '      {todo.dueDate && (' },
        { type: 'add',     text: '        <span className="todo-date">{todo.dueDate}</span>' },
        { type: 'add',     text: '      )}' },
        { type: 'context', text: '    </li>' },
        { type: 'context', text: '  );' },
        { type: 'context', text: '}' },
      ],
    },
    {
      file: 'todos.ts',
      hunks: [
        { type: 'context', text: 'router.post(\'/api/todos\', (req, res) => {' },
        { type: 'context', text: '  const todo = {' },
        { type: 'context', text: '    id: nextId++,' },
        { type: 'context', text: '    title: req.body.title,' },
        { type: 'context', text: '    done: false,' },
        { type: 'add',     text: '    dueDate: req.body.dueDate || null,' },
        { type: 'context', text: '  };' },
      ],
    },
  ],
  T2: [
    {
      file: 'TodoItem.tsx',
      hunks: [
        { type: 'remove',  text: 'export function TodoItem({ todo }) {' },
        { type: 'add',     text: 'export function TodoItem({ todo, onDelete }) {' },
        { type: 'context', text: '  return (' },
        { type: 'context', text: '    <li className="todo-item">' },
        { type: 'context', text: '      <input type="checkbox" checked={todo.done} />' },
        { type: 'context', text: '      <span className="todo-title">{todo.title}</span>' },
        { type: 'add',     text: '      <button className="todo-delete" onClick={() => onDelete(todo.id)}>' },
        { type: 'add',     text: '        ×' },
        { type: 'add',     text: '      </button>' },
        { type: 'context', text: '    </li>' },
      ],
    },
    {
      file: 'todos.ts',
      hunks: [
        { type: 'context', text: 'export default router;' },
        { type: 'add',     text: '' },
        { type: 'add',     text: 'router.delete(\'/api/todos/:id\', (req, res) => {' },
        { type: 'add',     text: '  const id = parseInt(req.params.id);' },
        { type: 'add',     text: '  todos = todos.filter(t => t.id !== id);' },
        { type: 'add',     text: '  res.status(204).end();' },
        { type: 'add',     text: '});' },
      ],
    },
  ],
  T3: [
    {
      file: 'TodoItem.tsx',
      hunks: [
        { type: 'context', text: '      <span className="todo-title">{todo.title}</span>' },
        { type: 'add',     text: '      <span className={`todo-priority priority-${todo.priority}`}>' },
        { type: 'add',     text: '        {todo.priority}' },
        { type: 'add',     text: '      </span>' },
        { type: 'context', text: '    </li>' },
      ],
    },
    {
      file: 'TodoApp.tsx',
      hunks: [
        { type: 'remove',  text: '      body: JSON.stringify({ title: input }),' },
        { type: 'add',     text: '      body: JSON.stringify({ title: input, priority: \'medium\' }),' },
        { type: 'context', text: '    });' },
        { type: 'context', text: '    const todo = await res.json();' },
        { type: 'context', text: '    setTodos([...todos, todo]);' },
      ],
    },
    {
      file: 'todos.ts',
      hunks: [
        { type: 'context', text: '  const todo = {' },
        { type: 'context', text: '    id: nextId++,' },
        { type: 'context', text: '    title: req.body.title,' },
        { type: 'context', text: '    done: false,' },
        { type: 'add',     text: '    priority: req.body.priority || \'medium\',' },
        { type: 'context', text: '  };' },
      ],
    },
  ],
};

// -- Agent terminal lines per task ---------------------------
export const agentTerminal = {
  T1: [
    { type: 'thinking', text: '> Reading TodoItem.tsx...' },
    { type: 'edit',     text: '> Adding dueDate display after title span' },
    { type: 'thinking', text: '> Reading todos.ts...' },
    { type: 'edit',     text: '> Adding dueDate field to POST handler' },
    { type: 'success',  text: '✓ T1 complete — due date field added to 2 files' },
  ],
  T2: [
    { type: 'thinking', text: '> Reading TodoItem.tsx...' },
    { type: 'edit',     text: '> Adding onDelete prop and delete button' },
    { type: 'thinking', text: '> Reading todos.ts...' },
    { type: 'edit',     text: '> Adding DELETE /api/todos/:id endpoint' },
    { type: 'success',  text: '✓ T2 complete — delete functionality added to 2 files' },
  ],
  T3: [
    { type: 'thinking', text: '> Reading TodoItem.tsx...' },
    { type: 'edit',     text: '> Adding priority badge with color classes' },
    { type: 'thinking', text: '> Reading TodoApp.tsx...' },
    { type: 'edit',     text: '> Setting default priority on new todos' },
    { type: 'thinking', text: '> Reading todos.ts...' },
    { type: 'edit',     text: '> Adding priority field to POST handler' },
    { type: 'success',  text: '✓ T3 complete — priority levels added to 3 files' },
  ],
};

// -- Preview states for the fake UI --------------------------
// Each task adds CSS classes to the preview to reveal new elements
export const previewStates = {
  base: [
    { title: 'Design landing page', done: false },
    { title: 'Set up CI/CD pipeline', done: true },
    { title: 'Write API documentation', done: false },
  ],
  T1: 'show-dates',
  T2: 'show-delete',
  T3: 'show-priority',
};

// -- Code states after each task (cumulative) ----------------
// Each key maps to the full file content AFTER that task is applied
export const codeAfterTask = {
  T1: {
    'TodoApp.tsx': codebase['TodoApp.tsx'], // unchanged by T1
    'TodoItem.tsx': `export function TodoItem({ todo }) {
  return (
    <li className="todo-item">
      <input type="checkbox" checked={todo.done} />
      <span className="todo-title">{todo.title}</span>
      {todo.dueDate && (
        <span className="todo-date">{todo.dueDate}</span>
      )}
    </li>
  );
}`,
    'todos.ts': `import { Router } from 'express';

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

export default router;`,
  },

  T2: {
    'TodoApp.tsx': codebase['TodoApp.tsx'], // unchanged by T1+T2
    'TodoItem.tsx': `export function TodoItem({ todo, onDelete }) {
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
}`,
    'todos.ts': `import { Router } from 'express';

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

export default router;`,
  },

  T3: {
    'TodoApp.tsx': `import { useState, useEffect } from 'react';
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
}`,
    'TodoItem.tsx': `export function TodoItem({ todo, onDelete }) {
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
}`,
    'todos.ts': `import { Router } from 'express';

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

export default router;`,
  },
};

// -- Extraction processing steps -----------------------------
export const extractionSteps = [
  { text: 'Scanning repos...', detail: '3 files, 1,200 tokens', duration: 1200 },
  { text: 'Processing transcript...', detail: '10 utterances, 2 speakers', duration: 800 },
  { text: 'Extracting tasks with Claude...', detail: '', duration: 2000 },
  { text: 'contextprompt-2026-03-12.md', detail: '3 tasks, all high confidence', duration: 0, success: true },
];
