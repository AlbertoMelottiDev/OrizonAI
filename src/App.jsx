import { useEffect, useRef, useState } from 'react';

const starters = [
  'Volo Milano–Tokyo, bagaglio 20 kg',
  'Treno Roma–Parigi con 12 kg di bagagli',
  'Auto da Bologna a Firenze, 2 persone e 15 kg'
];

function Bubble({ message }) {
  const result = message.result;
  return <article className={`message ${message.role}`}>
    <div className="avatar">{message.role === 'assistant' ? 'O' : 'TU'}</div>
    <div className="bubble">
      <p>{message.content}</p>
      {result && <section className="result-card" aria-label="Stima di impatto ambientale">
        <div><span>Emissioni stimate</span><strong>{Number(result.co2Kg).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg CO₂e</strong></div>
        <dl>
          <div><dt>Mezzo</dt><dd>{result.transportMode}</dd></div>
          <div><dt>Bagagli</dt><dd>{result.weightKg} kg</dd></div>
          <div><dt>Origine</dt><dd>{result.origin}</dd></div>
          <div><dt>Destinazione</dt><dd>{result.destination}</dd></div>
        </dl>
        <small>{result.distanceKm ? `${Math.round(result.distanceKm).toLocaleString('it-IT')} km · ` : ''}{result.methodology || 'Stima elaborata da Orizon'}</small>
      </section>}
    </div>
  </article>;
}

export default function App() {
  const [conversationId, setConversationId] = useState(() => localStorage.getItem('orizonConversationId') || crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottom = useRef(null);

  useEffect(() => { localStorage.setItem('orizonConversationId', conversationId); }, [conversationId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`).then(r => r.ok ? r.json() : []).then(setMessages).catch(() => {});
  }, [conversationId]);

  async function send(text = input) {
    const clean = text.trim(); if (!clean || loading) return;
    setInput(''); setLoading(true);
    const optimistic = { id: crypto.randomUUID(), role: 'user', content: clean };
    setMessages(previous => [...previous, optimistic]);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, message: clean }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Non riesco a rispondere in questo momento.');
      setMessages(previous => [...previous, data.message]);
    } catch (error) {
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', content: `C’è stato un problema: ${error.message}` }]);
    } finally { setLoading(false); }
  }
  function reset() { const id = crypto.randomUUID(); setConversationId(id); setMessages([]); }

  return <main className="shell">
    <header><a className="brand" href="#top" aria-label="Orizon home"><span>◒</span>ORIZON</a><button className="new-chat" onClick={reset}>＋ Nuova chat</button></header>
    <section className="chat" aria-live="polite">
      {messages.length === 0 && <div className="welcome"><div className="round-mark">◒</div><h2>Ciao, sono l’assistente Orizon</h2><p>Indicami mezzo di trasporto, partenza, arrivo e peso dei bagagli</p><div className="suggestions">{starters.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div></div>}
      {messages.map(message => <Bubble message={message} key={message.id} />)}
      {loading && <article className="message assistant"><div className="avatar">O</div><div className="bubble typing"><i/><i/><i/></div></article>}
      <div ref={bottom}/>
    </section>
    <form className="composer" onSubmit={event => { event.preventDefault(); send(); }}><textarea value={input} onChange={e => setInput(e.target.value)} rows="1" placeholder="Es. Vado in aereo da Milano a New York con 23 kg di bagagli…" aria-label="Descrivi il viaggio"/><button disabled={loading || !input.trim()} aria-label="Invia messaggio">↑</button></form>
    <p className="disclaimer">Le emissioni sono una stima indicativa basata su fattori GLEC/ISO 14083</p>
    <footer><span>Progetto per il corso AI e Agenti AI per il Business · Start2Impact</span><span>Realizzato da <a href="https://www.linkedin.com/in/albertomelotti/" target="_blank" rel="noreferrer">Alberto Melotti</a></span></footer>
  </main>;
}
