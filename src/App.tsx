import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Status = 'open' | 'done';
type Tab = 'dashboard' | 'tasks' | 'projects' | 'calendar' | 'capture' | 'settings';

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

const STORAGE_KEY = 'gsd_tasks_v1';

const projectTemplates: Project[] = [
  {
    name: 'Truck',
    description: 'F-250 repairs, parts, diagnostics, fluids, wiring, plow prep.',
    nextStep: 'Log the next repair, part number, photo, or symptom.',
    tasks: ['Transmission cooler line/fitting', 'Power steering leak check', 'Exhaust/Y-pipe leak', 'Ground strap/electrical issue']
  },
  {
    name: 'Property',
    description: 'Driveway, patio, permits, RTK requests, valuation, home projects.',
    nextStep: 'Add the next township/property action with due date.',
    tasks: ['Driveway ownership/easement records', 'Patio design/build plan', 'Home appraisal notes', 'Permit/RTK tracking']
  },
  {
    name: 'Shopping',
    description: 'Parts, tools, inventory checks, deals, flights, product watchlists.',
    nextStep: 'Add item, target price, store, and deadline.',
    tasks: ['Truck parts', 'Tools', 'Flights', 'Electronics/open-box deals']
  },
  {
    name: 'App Build',
    description: 'Get Shit Done features, deployment, backend, storage, design.',
    nextStep: 'Track bugs and feature requests here.',
    tasks: ['Supabase storage', 'Uploads', 'Calendar', 'Notifications', 'AI task planner']
  }
];

function loadLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function fromDb(task: any): Task {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes || '',
    category: task.category || 'General',
    priority: task.priority || 'normal',
    dueDate: task.due_date || '',
    status: task.status || 'open',
    attachmentName: task.attachment_name || '',
    createdAt: task.created_at
  };
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

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    if (!supabase) {
      setTasks(loadLocalTasks());
      setBackendStatus('Local mode');
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setTasks(loadLocalTasks());
      setBackendStatus('Supabase error — using local backup');
      return;
    }

    setTasks((data || []).map(fromDb));
    setBackendStatus('Supabase connected');
  }

  const stats = useMemo(() => ({
    open: tasks.filter((task) => task.status === 'open').length,
    done: tasks.filter((task) => task.status === 'done').length,
    urgent: tasks.filter((task) => task.status === 'open' && task.priority === 'urgent').length,
    dueToday: tasks.filter((task) => task.status === 'open' && task.dueDate === today).length,
    overdue: tasks.filter((task) => task.status === 'open' && task.dueDate && task.dueDate < today).length
  }), [tasks, today]);

  const filteredTasks = useMemo(() => tasks
    .filter((task) => {
      if (filter === 'open') return task.status === 'open';
      if (filter === 'done') return task.status === 'done';
      if (filter === 'today') return task.dueDate === today && task.status === 'open';
      return true;
    })
    .filter((task) => `${task.title} ${task.notes} ${task.category} ${task.priority}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const weight = { urgent: 0, high: 1, normal: 2, low: 3 };
      return weight[a.priority] - weight[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    }), [tasks, filter, query, today]);

  const upcomingTasks = tasks
    .filter((task) => task.status === 'open' && task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  async function persistTask(localTask: Task) {
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: localTask.title,
          notes: localTask.notes,
          category: localTask.category,
          priority: localTask.priority,
          due_date: localTask.dueDate || null,
          status: localTask.status,
          attachment_name: localTask.attachmentName || null
        })
        .select()
        .single();

      if (!error && data) {
        setTasks((current) => [fromDb(data), ...current]);
        return;
      }

      console.error(error);
      setBackendStatus('Supabase save failed — saved locally');
    }

    const updated = [localTask, ...tasks];
    setTasks(updated);
    saveLocalTasks(updated);
  }

  async function addTask() {
    if (!title.trim()) return;

    await persistTask({
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim(),
      category: category.trim() || 'General',
      priority,
      dueDate,
      attachmentName: attachmentName || undefined,
      status: 'open',
      createdAt: new Date().toISOString()
    });

    setTitle('');
    setNotes('');
    setCategory('General');
    setPriority('normal');
    setDueDate('');
    setAttachmentName('');
  }

  async function quickAdd() {
    if (!quickCapture.trim()) return;
    await persistTask({
      id: crypto.randomUUID(),
      title: quickCapture.trim(),
      notes: 'Quick captured item. Expand later.',
      category: 'Inbox',
      priority: 'normal',
      dueDate: '',
      status: 'open',
      createdAt: new Date().toISOString()
    });
    setQuickCapture('');
  }

  async function addTemplateTask(categoryName: string, taskTitle: string) {
    await persistTask({
      id: crypto.randomUUID(),
      title: taskTitle,
      notes: `Project: ${categoryName}`,
      category: categoryName,
      priority: 'normal',
      dueDate: '',
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  async function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const nextStatus: Status = task.status === 'open' ? 'done' : 'open';
    setTasks((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    if (supabase) await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
  }

  async function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
    if (supabase) await supabase.from('tasks').delete().eq('id', id);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{backendStatus}</p>
          <h1>Get Shit Done</h1>
          <p className="subhead">Tasks, projects, reminders, uploads, and action tracking in one place.</p>
        </div>
        <div className="logo-mark">GSD</div>
      </header>

      <nav className="tabs">
        {(['dashboard', 'tasks', 'projects', 'calendar', 'capture', 'settings'] as Tab[]).map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <section className="stats-grid">
            <Stat label="Open" value={stats.open} />
            <Stat label="Due today" value={stats.dueToday} />
            <Stat label="Urgent" value={stats.urgent} />
            <Stat label="Overdue" value={stats.overdue} />
          </section>
          <section className="panel split-panel">
            <div>
              <h2>Quick capture</h2>
              <p className="muted">Dump it fast. Sort it later.</p>
              <div className="inline-form">
                <input value={quickCapture} onChange={(e) => setQuickCapture(e.target.value)} placeholder="What needs to get done?" />
                <button className="primary" onClick={quickAdd}>Capture</button>
              </div>
            </div>
            <div>
              <h2>Next up</h2>
              <TaskMiniList tasks={filteredTasks.slice(0, 5)} onToggle={toggleTask} />
            </div>
          </section>
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          <TaskForm title={title} setTitle={setTitle} notes={notes} setNotes={setNotes} category={category} setCategory={setCategory} priority={priority} setPriority={setPriority} dueDate={dueDate} setDueDate={setDueDate} setAttachmentName={setAttachmentName} addTask={addTask} />
          <TaskBoard query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} tasks={filteredTasks} toggleTask={toggleTask} deleteTask={deleteTask} />
        </>
      )}

      {activeTab === 'projects' && (
        <section className="project-grid">
          {projectTemplates.map((project) => (
            <article className="panel project-card" key={project.name}>
              <h2>{project.name}</h2>
              <p className="muted">{project.description}</p>
              <p><strong>Next step:</strong> {project.nextStep}</p>
              <div className="template-list">
                {project.tasks.map((item) => <button key={item} onClick={() => addTemplateTask(project.name, item)}>+ {item}</button>)}
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'calendar' && (
        <section className="panel">
          <h2>Calendar</h2>
          <p className="muted">Tasks with due dates appear here. Full Google Calendar sync comes next.</p>
          <TaskMiniList tasks={upcomingTasks} onToggle={toggleTask} />
        </section>
      )}

      {activeTab === 'capture' && (
        <section className="panel">
          <h2>Inbox capture</h2>
          <p className="muted">Use this for fast notes, photos, part numbers, links, and ideas.</p>
          <textarea value={quickCapture} onChange={(e) => setQuickCapture(e.target.value)} placeholder="Paste or type anything here..." />
          <button className="primary" onClick={quickAdd}>Save to inbox</button>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="panel">
          <h2>Settings</h2>
          <div className="settings-list">
            <p><strong>Backend:</strong> {backendStatus}</p>
            <p><strong>Storage:</strong> Supabase cloud with local fallback.</p>
            <p><strong>Upcoming:</strong> login, real file uploads, notifications, AI planner, Google Calendar sync.</p>
          </div>
        </section>
      )}
    </main>
  );
}

function TaskForm(props: any) {
  return (
    <section className="panel create-panel">
      <h2>Create task</h2>
      <div className="form-grid">
        <input value={props.title} onChange={(e) => props.setTitle(e.target.value)} placeholder="Task title" />
        <input value={props.category} onChange={(e) => props.setCategory(e.target.value)} placeholder="Category" />
        <select value={props.priority} onChange={(e) => props.setPriority(e.target.value as Priority)}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
        </select>
        <input type="date" value={props.dueDate} onChange={(e) => props.setDueDate(e.target.value)} />
        <input type="file" onChange={(e) => props.setAttachmentName(e.target.files?.[0]?.name || '')} />
        <textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder="Notes, parts, links, reminders, next steps" />
      </div>
      <button className="primary" onClick={props.addTask}>Add task</button>
    </section>
  );
}

function TaskBoard(props: any) {
  return (
    <section className="panel">
      <div className="toolbar"><h2>Tasks</h2><input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search" /></div>
      <div className="filters">{(['open', 'today', 'all', 'done'] as const).map((item) => <button key={item} className={props.filter === item ? 'active' : ''} onClick={() => props.setFilter(item)}>{item}</button>)}</div>
      <div className="task-list">{props.tasks.map((task: Task) => <TaskCard key={task.id} task={task} toggleTask={props.toggleTask} deleteTask={props.deleteTask} />)}</div>
    </section>
  );
}

function TaskCard({ task, toggleTask, deleteTask }: any) {
  return (
    <article className={`task-card ${task.status}`}>
      <div>
        <div className="task-topline"><span className={`badge ${task.priority}`}>{task.priority}</span><span>{task.category}</span>{task.dueDate && <span>Due {task.dueDate}</span>}</div>
        <h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}{task.attachmentName && <p className="attachment-note">File: {task.attachmentName}</p>}
      </div>
      <div className="task-actions"><button onClick={() => toggleTask(task.id)}>{task.status === 'open' ? 'Done' : 'Reopen'}</button><button className="danger" onClick={() => deleteTask(task.id)}>Delete</button></div>
    </article>
  );
}

function TaskMiniList({ tasks, onToggle }: any) {
  if (!tasks.length) return <p className="empty">Nothing queued.</p>;
  return <div className="mini-list">{tasks.map((task: Task) => <button key={task.id} onClick={() => onToggle(task.id)}><span>{task.title}</span><small>{task.category}{task.dueDate ? ` • ${task.dueDate}` : ''}</small></button>)}</div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}
