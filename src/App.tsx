import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

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

  const stats = useMemo(() => {
    return {
      open: tasks.filter((task) => task.status === 'open').length,
      done: tasks.filter((task) => task.status === 'done').length,
      urgent: tasks.filter((task) => task.status === 'open' && task.priority === 'urgent').length,
      dueToday: tasks.filter((task) => task.status === 'open' && task.dueDate === today).length
    };
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
        const text = `${task.title} ${task.notes} ${task.category} ${task.priority}`.toLowerCase();
        return text.includes(query.toLowerCase());
      });
  }, [tasks, filter, query, today]);

  async function addTask() {
    if (!title.trim()) return;

    const localTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim(),
      category: category.trim() || 'General',
      priority,
      dueDate,
      attachmentName: attachmentName || undefined,
      status: 'open',
      createdAt: new Date().toISOString()
    };

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
      } else {
        console.error(error);
        const updated = [localTask, ...tasks];
        setTasks(updated);
        saveLocalTasks(updated);
        setBackendStatus('Supabase save failed — saved locally');
      }
    } else {
      const updated = [localTask, ...tasks];
      setTasks(updated);
      saveLocalTasks(updated);
    }

    setTitle('');
    setNotes('');
    setCategory('General');
    setPriority('normal');
    setDueDate('');
    setAttachmentName('');
  }

  async function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const nextStatus: Status = task.status === 'open' ? 'done' : 'open';

    setTasks((current) =>
      current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );

    if (supabase) {
      await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
    }
  }

  async function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));

    if (supabase) {
      await supabase.from('tasks').delete().eq('id', id);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{backendStatus}</p>
          <h1>Get Shit Done</h1>
          <p className="subhead">Cloud-backed task system with local fallback.</p>
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />

          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          <input
            type="file"
            onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes, links, next steps"
          />
        </div>

        <button className="primary" onClick={addTask}>Add task</button>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>Tasks</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        </div>

        <div className="filters">
          {(['open', 'today', 'all', 'done'] as const).map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="task-list">
          {filteredTasks.map((task) => (
            <article key={task.id} className={`task-card ${task.status}`}>
              <div>
                <div className="task-topline">
                  <span className={`badge ${task.priority}`}>{task.priority}</span>
                  <span>{task.category}</span>
                  {task.dueDate && <span>Due {task.dueDate}</span>}
                </div>

                <h3>{task.title}</h3>
                {task.notes && <p>{task.notes}</p>}
                {task.attachmentName && <p className="attachment-note">File: {task.attachmentName}</p>}
              </div>

              <div className="task-actions">
                <button onClick={() => toggleTask(task.id)}>
                  {task.status === 'open' ? 'Done' : 'Reopen'}
                </button>
                <button className="danger" onClick={() => deleteTask(task.id)}>Delete</button>
              </div>
            </article>
          ))}
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
