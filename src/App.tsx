export default function App() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0d121c',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      padding: '24px'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
        Get Shit Done
      </h1>

      <p style={{ opacity: 0.8, marginBottom: '24px' }}>
        Functional rebuild in progress.
      </p>

      <section style={{
        background: '#161d2b',
        borderRadius: '12px',
        padding: '20px',
        maxWidth: '700px'
      }}>
        <h2>Current Goals</h2>
        <ul>
          <li>Task creation</li>
          <li>Calendar integration</li>
          <li>Persistent storage</li>
          <li>Cleaner UI</li>
          <li>Working mobile layout</li>
        </ul>
      </section>
    </main>
  );
}
