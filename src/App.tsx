import { useEffect, useMemo, useState } from 'react';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Status = 'open' | 'done';

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

const STORAGE_KEY = 'gsd_tasks_v1';

const starterTasks: Task[] = [
  {
    id: crypto.randomUUID(),
    title: 'Fix deployment and rebuild app foundation',
    notes: 'Core app now runs from a real React entrypoint. Continue building useful tools instead of placeholder screens.',
    category: 'App Build',
    priority: 'urgent',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'open',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    title: 'Add truck repair tracker',
    notes: 'Track F-250 parts, transmission cooler line work, power steering leak checks, and exhaust issues.',
    category: 'Truck',
    priority: 'high',
    dueDate: '',
    status: 'open',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    title: 'Add property/project checklist section',
    notes: 'Driveway, patio, valuation, permits, RTK requests, and house improvement notes.',
    category: 'Property',
    priority: 'normal',
    dueDate: '',
    status: 'open',
    createdAt: new Date().toISOString()
  }
];

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return starterTasks;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : starterTasks;
  } catch {
    return starterTasks;
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'today'>('open');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const open = tasks.filter((task) => task.status === 'open').length;
    const done = tasks.filter((task) => task.status === 'done').length;
    const urgent = tasks.filter((task) => task.status === 'open' && task.priority === 'urgent').length;
    const dueToday = tasks.filter((task) => task.status === 'open' && task.dueDate === today).length;
    return { open, done, urgent, dueToday };
  }, [tasks, today]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (filter === 'open') return task.status === 'open';
        if (filter === 'done') return task.status === 'done';
        if (filter === 'today') return task.dueDate === today && task.status === 'open';
        return true;
      })
      .filter((task) => {
        const haystack = `${task.title} ${task.notes} ${task.category} ${task.priority}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => {
        const weight = { urgent: 0, high: 1, normal: 2, low: 3 };
        return weight[a.priority] - weight[b.priority] || a.createdAt.localeCompare(b.createdAt);
      });
  }, [tasks, filter, query, today]);

  function addTask() {
    if (!title.trim()) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim(),
      category: category.trim() || 'General',
      priority,
      dueDate,
      attachmentName: attachmentName.trim() || undefined,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    setTasks((current) => [task, ...current]);
    setTitle('');
    setNotes('');
    setCategory('General');
    setPriority('normal');
    setDueDate('');
    setAttachmentName('');
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, status: task.status === 'open' ? 'done' : 'open' } : task
      )
    );
  }

  function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Personal command center</p>
          <h1>Get Shit Done</h1>
          <p className="subhead">Dump tasks, sort them, attach context, and finish the next thing.</p>
        </div>
        <div className="logo-mark">GSD</div>
      </header>

      <section className="stats-grid">
        <Stat label="Open" value={stats.open} />
        <Stat label="Due today" value={stats.dueToday} />
        <Stat label="Urgent" value={stats.urgent} />
        <Stat label="Done" value={stats.done} />
      </section>

      <section className="panel create-panel">
        <h2>Create task</h2>
        <div className="form-grid">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <input type="file" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name || '')} />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes, parts, links, reminders, next steps" />
        </div>
        {attachmentName && <p className="attachment-note">Attached reference: {attachmentName}</p>}
        <button className="primary" onClick={addTask}>Add task</button>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>Tasks</h2>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        </div>
        <div className="filters">
          {(['open', 'today', 'all', 'done'] as const).map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="empty">No matching tasks.</p>
          ) : (
            filteredTasks.map((task) => (
              <article key={task.id} className={`task-card ${task.status}`}>
                <div>
                  <div className="task-topline">
                    <span className={`badge ${task.priority}`}>{task.priority}</span>
                    <span>{task.category}</span>
                    {task.dueDate && <span>Due {task.dueDate}</span>}
                  </div>
                  <h3>{task.title}</h3>
                  {task.notes && <p>{task.notes}</p>}
                  {task.attachmentName && <p className="attachment-note">File reference: {task.attachmentName}</p>}
                </div>
                <div className="task-actions">
                  <button onClick={() => toggleTask(task.id)}>{task.status === 'open' ? 'Done' : 'Reopen'}</button>
                  <button className="danger" onClick={() => deleteTask(task.id)}>Delete</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
