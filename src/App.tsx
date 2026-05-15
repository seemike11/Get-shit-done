import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Status = 'open' | 'done';
type Tab = 'dashboard' | 'tasks' | 'projects' | 'money' | 'calendar' | 'capture' | 'settings';
type Frequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly';

type Task = {
  id: string;
  title: string;
  notes: string;
  category: string;
  priority: Priority;
  dueDate: string;
  status: Status;
  attachmentName?: string;
  createdAt: string;
};

type Project = {
  name: string;
  description: string;
  nextStep: string;
  tasks: string[];
};

type RecurringPayment = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  frequency: Frequency;
  category: string;
  autopay: boolean;
  notes: string;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
};

const STORAGE_KEY = 'gsd_tasks_v1';
const BILLS_KEY = 'gsd_money_bills_v1';
const TRANSACTIONS_KEY = 'gsd_money_transactions_v1';

const projectTemplates: Project[] = [
  { name: 'Truck', description: 'F-250 repairs, parts, diagnostics, fluids, wiring, plow prep.', nextStep: 'Log the next repair, part number, photo, or symptom.', tasks: ['Transmission cooler line/fitting', 'Power steering leak check', 'Exhaust/Y-pipe leak', 'Ground strap/electrical issue'] },
  { name: 'Property', description: 'Driveway, patio, permits, RTK requests, valuation, home projects.', nextStep: 'Add the next township/property action with due date.', tasks: ['Driveway ownership/easement records', 'Patio design/build plan', 'Home appraisal notes', 'Permit/RTK tracking'] },
  { name: 'Shopping', description: 'Parts, tools, inventory checks, deals, flights, product watchlists.', nextStep: 'Add item, target price, store, and deadline.', tasks: ['Truck parts', 'Tools', 'Flights', 'Electronics/open-box deals'] },
  { name: 'App Build', description: 'Get Shit Done features, deployment, backend, storage, design.', nextStep: 'Track bugs and feature requests here.', tasks: ['Supabase storage', 'Uploads', 'Calendar', 'Notifications', 'AI task planner'] }
];

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLocalTasks(): Task[] { return readStored<Task[]>(STORAGE_KEY, []); }
function saveLocalTasks(tasks: Task[]) { writeStored(STORAGE_KEY, tasks); }

function fromDb(task: any): Task {
  return { id: task.id, title: task.title, notes: task.notes || '', category: task.category || 'General', priority: task.priority || 'normal', dueDate: task.due_date || '', status: task.status || 'open', attachmentName: task.attachment_name || '', createdAt: task.created_at };
}

function categorize(description: string) {
  const text = description.toLowerCase();
  if (/peco|electric|water|sewer|gas|utility/.test(text)) return 'Utilities';
  if (/verizon|xfinity|comcast|phone|internet/.test(text)) return 'Phone/Internet';
  if (/insurance|geico|progressive|state farm/.test(text)) return 'Insurance';
  if (/rent|mortgage/.test(text)) return 'Housing';
  if (/wawa|shell|sunoco|exxon|gas/.test(text)) return 'Gas';
  if (/grocery|giant|aldi|walmart|target|costco/.test(text)) return 'Groceries';
  if (/amazon|home depot|harbor freight|auto zone|autozone|advance auto/.test(text)) return 'Shopping/Parts';
  if (/mcdonald|restaurant|pizza|doordash|uber eats|postmates/.test(text)) return 'Food';
  if (/deposit|payroll|transfer in|credit/.test(text)) return 'Income';
  return 'Other';
}

function parseTransactions(text: string): Transaction[] {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.includes(',') ? line.split(',').map((p) => p.trim()) : line.split(/\s{2,}/).map((p) => p.trim());
    const amountText = parts.find((p) => /-?\$?\d+[,.]?\d*\.\d{2}/.test(p)) || '';
    const amount = Number(amountText.replace(/[$,]/g, '')) || 0;
    const date = parts.find((p) => /\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?/.test(p)) || '';
    const description = parts.filter((p) => p !== amountText && p !== date).join(' ') || line;
    return { id: crypto.randomUUID(), date, description, amount, category: categorize(description) };
  }).filter((tx) => tx.amount !== 0);
}

function detectRecurring(transactions: Transaction[]) {
  const groups = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.description.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\d+/g, '').slice(0, 28).trim();
    if (!key) return acc;
    acc[key] = [...(acc[key] || []), tx];
    return acc;
  }, {});
  return Object.values(groups).filter((items) => items.length >= 2).map((items) => ({ name: items[0].description, count: items.length, avg: items.reduce((sum, item) => sum + Math.abs(item.amount), 0) / items.length }));
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [quickCapture, setQuickCapture] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'today'>('open');
  const [backendStatus, setBackendStatus] = useState('Checking backend...');
  const [bills, setBills] = useState<RecurringPayment[]>(() => readStored(BILLS_KEY, []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => readStored(TRANSACTIONS_KEY, []));

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { writeStored(BILLS_KEY, bills); }, [bills]);
  useEffect(() => { writeStored(TRANSACTIONS_KEY, transactions); }, [transactions]);

  async function loadTasks() {
    if (!supabase) { setTasks(loadLocalTasks()); setBackendStatus('Local mode'); return; }
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); setTasks(loadLocalTasks()); setBackendStatus('Supabase error — using local backup'); return; }
    setTasks((data || []).map(fromDb)); setBackendStatus('Supabase connected');
  }

  const stats = useMemo(() => ({ open: tasks.filter((task) => task.status === 'open').length, done: tasks.filter((task) => task.status === 'done').length, urgent: tasks.filter((task) => task.status === 'open' && task.priority === 'urgent').length, dueToday: tasks.filter((task) => task.status === 'open' && task.dueDate === today).length, overdue: tasks.filter((task) => task.status === 'open' && task.dueDate && task.dueDate < today).length }), [tasks, today]);
  const filteredTasks = useMemo(() => tasks.filter((task) => filter === 'open' ? task.status === 'open' : filter === 'done' ? task.status === 'done' : filter === 'today' ? task.dueDate === today && task.status === 'open' : true).filter((task) => `${task.title} ${task.notes} ${task.category} ${task.priority}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => ({ urgent: 0, high: 1, normal: 2, low: 3 }[a.priority]) - ({ urgent: 0, high: 1, normal: 2, low: 3 }[b.priority]) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [tasks, filter, query, today]);
  const upcomingTasks = tasks.filter((task) => task.status === 'open' && task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);

  async function persistTask(localTask: Task) {
    if (supabase) {
      const { data, error } = await supabase.from('tasks').insert({ title: localTask.title, notes: localTask.notes, category: localTask.category, priority: localTask.priority, due_date: localTask.dueDate || null, status: localTask.status, attachment_name: localTask.attachmentName || null }).select().single();
      if (!error && data) { setTasks((current) => [fromDb(data), ...current]); return; }
      console.error(error); setBackendStatus('Supabase save failed — saved locally');
    }
    const updated = [localTask, ...tasks]; setTasks(updated); saveLocalTasks(updated);
  }

  async function addTask() { if (!title.trim()) return; await persistTask({ id: crypto.randomUUID(), title: title.trim(), notes: notes.trim(), category: category.trim() || 'General', priority, dueDate, attachmentName: attachmentName || undefined, status: 'open', createdAt: new Date().toISOString() }); setTitle(''); setNotes(''); setCategory('General'); setPriority('normal'); setDueDate(''); setAttachmentName(''); }
  async function quickAdd() { if (!quickCapture.trim()) return; await persistTask({ id: crypto.randomUUID(), title: quickCapture.trim(), notes: 'Quick captured item. Expand later.', category: 'Inbox', priority: 'normal', dueDate: '', status: 'open', createdAt: new Date().toISOString() }); setQuickCapture(''); }
  async function addTemplateTask(categoryName: string, taskTitle: string) { await persistTask({ id: crypto.randomUUID(), title: taskTitle, notes: `Project: ${categoryName}`, category: categoryName, priority: 'normal', dueDate: '', status: 'open', createdAt: new Date().toISOString() }); }
  async function toggleTask(id: string) { const task = tasks.find((item) => item.id === id); if (!task) return; const nextStatus: Status = task.status === 'open' ? 'done' : 'open'; setTasks((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))); if (supabase) await supabase.from('tasks').update({ status: nextStatus }).eq('id', id); }
  async function deleteTask(id: string) { setTasks((current) => current.filter((task) => task.id !== id)); if (supabase) await supabase.from('tasks').delete().eq('id', id); }

  return (
    <main className="app-shell">
      <header className="hero"><div><p className="eyebrow">{backendStatus}</p><h1>Get Shit Done</h1><p className="subhead">Tasks, money, projects, reminders, uploads, and action tracking in one place.</p></div><div className="logo-mark">GSD</div></header>
      <nav className="tabs">{(['dashboard', 'tasks', 'projects', 'money', 'calendar', 'capture', 'settings'] as Tab[]).map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
      {activeTab === 'dashboard' && <><section className="stats-grid"><Stat label="Open" value={stats.open} /><Stat label="Due today" value={stats.dueToday} /><Stat label="Urgent" value={stats.urgent} /><Stat label="Monthly bills" value={bills.reduce((sum, bill) => sum + bill.amount, 0)} money /></section><section className="panel split-panel"><div><h2>Quick capture</h2><p className="muted">Dump it fast. Sort it later.</p><div className="inline-form"><input value={quickCapture} onChange={(e) => setQuickCapture(e.target.value)} placeholder="What needs to get done?" /><button className="primary" onClick={quickAdd}>Capture</button></div></div><div><h2>Next up</h2><TaskMiniList tasks={filteredTasks.slice(0, 5)} onToggle={toggleTask} /></div></section></>}
      {activeTab === 'tasks' && <><TaskForm title={title} setTitle={setTitle} notes={notes} setNotes={setNotes} category={category} setCategory={setCategory} priority={priority} setPriority={setPriority} dueDate={dueDate} setDueDate={setDueDate} setAttachmentName={setAttachmentName} addTask={addTask} /><TaskBoard query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} tasks={filteredTasks} toggleTask={toggleTask} deleteTask={deleteTask} /></>}
      {activeTab === 'projects' && <section className="project-grid">{projectTemplates.map((project) => <article className="panel project-card" key={project.name}><h2>{project.name}</h2><p className="muted">{project.description}</p><p><strong>Next step:</strong> {project.nextStep}</p><div className="template-list">{project.tasks.map((item) => <button key={item} onClick={() => addTemplateTask(project.name, item)}>+ {item}</button>)}</div></article>)}</section>}
      {activeTab === 'money' && <MoneyPanel bills={bills} setBills={setBills} transactions={transactions} setTransactions={setTransactions} />}
      {activeTab === 'calendar' && <section className="panel"><h2>Calendar</h2><p className="muted">Tasks with due dates appear here. Full Google Calendar sync comes next.</p><TaskMiniList tasks={upcomingTasks} onToggle={toggleTask} /></section>}
      {activeTab === 'capture' && <section className="panel"><h2>Inbox capture</h2><p className="muted">Use this for fast notes, photos, part numbers, links, and ideas.</p><textarea value={quickCapture} onChange={(e) => setQuickCapture(e.target.value)} placeholder="Paste or type anything here..." /><button className="primary" onClick={quickAdd}>Save to inbox</button></section>}
      {activeTab === 'settings' && <section className="panel"><h2>Settings</h2><div className="settings-list"><p><strong>Backend:</strong> {backendStatus}</p><p><strong>Storage:</strong> Supabase cloud with local fallback for tasks. Money data currently saves locally.</p><p><strong>Upcoming:</strong> login, real file uploads, notifications, AI planner, Google Calendar sync.</p></div></section>}
    </main>
  );
}

function MoneyPanel({ bills, setBills, transactions, setTransactions }: any) {
  const [bill, setBill] = useState({ name: '', amount: '', dueDay: '1', frequency: 'monthly', category: 'Bills', autopay: true, notes: '' });
  const [statementText, setStatementText] = useState('');
  const expenses = transactions.filter((tx: Transaction) => tx.amount < 0).reduce((sum: number, tx: Transaction) => sum + Math.abs(tx.amount), 0);
  const income = transactions.filter((tx: Transaction) => tx.amount > 0).reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
  const recurring = detectRecurring(transactions);
  const byCategory = transactions.reduce<Record<string, number>>((acc, tx: Transaction) => { acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount); return acc; }, {});
  function addBill() { if (!bill.name || !bill.amount) return; setBills((current: RecurringPayment[]) => [{ id: crypto.randomUUID(), name: bill.name, amount: Number(bill.amount), dueDay: Number(bill.dueDay), frequency: bill.frequency as Frequency, category: bill.category, autopay: bill.autopay, notes: bill.notes }, ...current]); setBill({ name: '', amount: '', dueDay: '1', frequency: 'monthly', category: 'Bills', autopay: true, notes: '' }); }
  function analyze(text: string) { const parsed = parseTransactions(text); setTransactions((current: Transaction[]) => [...parsed, ...current]); }
  return <section className="money-layout"><div className="panel"><h2>Money overview</h2><section className="stats-grid compact"><Stat label="Income" value={income} money /><Stat label="Spending" value={expenses} money /><Stat label="Net" value={income - expenses} money /><Stat label="Recurring" value={bills.reduce((sum: number, item: RecurringPayment) => sum + item.amount, 0)} money /></section></div><div className="panel"><h2>Monthly recurring payments</h2><div className="form-grid"><input value={bill.name} onChange={(e) => setBill({ ...bill, name: e.target.value })} placeholder="Bill name" /><input type="number" value={bill.amount} onChange={(e) => setBill({ ...bill, amount: e.target.value })} placeholder="Amount" /><input type="number" min="1" max="31" value={bill.dueDay} onChange={(e) => setBill({ ...bill, dueDay: e.target.value })} placeholder="Due day" /><select value={bill.frequency} onChange={(e) => setBill({ ...bill, frequency: e.target.value })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="yearly">Yearly</option></select><input value={bill.category} onChange={(e) => setBill({ ...bill, category: e.target.value })} placeholder="Category" /><label className="check-row"><input type="checkbox" checked={bill.autopay} onChange={(e) => setBill({ ...bill, autopay: e.target.checked })} /> Autopay</label><textarea value={bill.notes} onChange={(e) => setBill({ ...bill, notes: e.target.value })} placeholder="Notes" /></div><button className="primary" onClick={addBill}>Add recurring payment</button><div className="mini-list">{bills.map((item: RecurringPayment) => <button key={item.id} onClick={() => setBills((current: RecurringPayment[]) => current.filter((b) => b.id !== item.id))}><span>{item.name} — ${item.amount.toFixed(2)}</span><small>Due day {item.dueDay} • {item.frequency} • {item.category} • {item.autopay ? 'autopay' : 'manual'}</small></button>)}</div></div><div className="panel"><h2>Upload/analyze bank statement</h2><p className="muted">Use CSV or copied statement rows. Format can be date, description, amount.</p><input type="file" accept=".csv,.txt" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; file.text().then(analyze); }} /><textarea value={statementText} onChange={(e) => setStatementText(e.target.value)} placeholder="Paste transactions here..." /><button className="primary" onClick={() => analyze(statementText)}>Analyze pasted transactions</button></div><div className="panel split-panel"><div><h2>Category summary</h2><div className="mini-list">{Object.entries(byCategory).map(([name, value]) => <button key={name}><span>{name}</span><small>${Number(value).toFixed(2)}</small></button>)}</div></div><div><h2>Detected recurring</h2><div className="mini-list">{recurring.map((item) => <button key={item.name}><span>{item.name}</span><small>{item.count} hits • avg ${item.avg.toFixed(2)}</small></button>)}</div></div></div><div className="panel"><h2>Transactions</h2><div className="task-list">{transactions.slice(0, 50).map((tx: Transaction) => <article className="task-card" key={tx.id}><div><div className="task-topline"><span>{tx.date || 'No date'}</span><span>{tx.category}</span><span>${tx.amount.toFixed(2)}</span></div><h3>{tx.description}</h3></div></article>)}</div></div></section>;
}

function TaskForm(props: any) { return <section className="panel create-panel"><h2>Create task</h2><div className="form-grid"><input value={props.title} onChange={(e) => props.setTitle(e.target.value)} placeholder="Task title" /><input value={props.category} onChange={(e) => props.setCategory(e.target.value)} placeholder="Category" /><select value={props.priority} onChange={(e) => props.setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input type="date" value={props.dueDate} onChange={(e) => props.setDueDate(e.target.value)} /><input type="file" onChange={(e) => props.setAttachmentName(e.target.files?.[0]?.name || '')} /><textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder="Notes, parts, links, reminders, next steps" /></div><button className="primary" onClick={props.addTask}>Add task</button></section>; }
function TaskBoard(props: any) { return <section className="panel"><div className="toolbar"><h2>Tasks</h2><input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search" /></div><div className="filters">{(['open', 'today', 'all', 'done'] as const).map((item) => <button key={item} className={props.filter === item ? 'active' : ''} onClick={() => props.setFilter(item)}>{item}</button>)}</div><div className="task-list">{props.tasks.map((task: Task) => <TaskCard key={task.id} task={task} toggleTask={props.toggleTask} deleteTask={props.deleteTask} />)}</div></section>; }
function TaskCard({ task, toggleTask, deleteTask }: any) { return <article className={`task-card ${task.status}`}><div><div className="task-topline"><span className={`badge ${task.priority}`}>{task.priority}</span><span>{task.category}</span>{task.dueDate && <span>Due {task.dueDate}</span>}</div><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}{task.attachmentName && <p className="attachment-note">File: {task.attachmentName}</p>}</div><div className="task-actions"><button onClick={() => toggleTask(task.id)}>{task.status === 'open' ? 'Done' : 'Reopen'}</button><button className="danger" onClick={() => deleteTask(task.id)}>Delete</button></div></article>; }
function TaskMiniList({ tasks, onToggle }: any) { if (!tasks.length) return <p className="empty">Nothing queued.</p>; return <div className="mini-list">{tasks.map((task: Task) => <button key={task.id} onClick={() => onToggle(task.id)}><span>{task.title}</span><small>{task.category}{task.dueDate ? ` • ${task.dueDate}` : ''}</small></button>)}</div>; }
function Stat({ label, value, money }: { label: string; value: number; money?: boolean }) { return <div className="stat-card"><span>{label}</span><strong>{money ? `$${value.toFixed(2)}` : value}</strong></div>; }
