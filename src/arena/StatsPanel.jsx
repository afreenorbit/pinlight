import Icon from '../components/Icon.jsx';
import './progress.css';
import './arena.css';

const label = { strong: 'Strong', improving: 'Getting there', revise: 'Needs revision', new: 'Not tried' };

// Strengths and weaknesses from past games. Each topic row starts a practice on that topic.
export default function StatsPanel({ stats, note, onPractice, onSkillCheck, onShare }) {
  const tried = stats.topics.filter(t => t.attempts), untried = stats.topics.filter(t => !t.attempts);
  const ordered = [...tried].sort((a, b) => a.mastery - b.mastery);
  return <div className="stats-panel">
    <div className="stats-tiles">
      {[['Battles', stats.games], ['Wins', stats.wins], ['Practice sessions', stats.practices], ['Day streak', stats.streak], ['Average', stats.average ?? '–']].map(([k, v]) => <div key={k}><strong>{v}</strong><span>{k}</span></div>)}
    </div>
    <div className="stats-actions">
      <button className="arena-button big" onClick={onSkillCheck}><Icon name="target" size={18} /> Personalised skill check</button>
      {ordered[0] && ordered[0].mastery < 7 && <button className="arena-button" onClick={() => onPractice([ordered[0].id])}>Practise {ordered[0].topic}</button>}
      {onShare && <button className="arena-button ghost" onClick={onShare}><Icon name="download" size={16} /> Stats card</button>}
    </div>
    {note && <p className="stats-note">{note}</p>}
    <div className="stats-columns">
      <section>
        <h3>Your topics</h3>
        {tried.length ? <ul className="topic-bars">{ordered.map(t => <li key={t.id}>
          <button onClick={() => onPractice([t.id])} title={`Practise ${t.topic}`}>
            <span className="topic-name">{t.topic}</span>
            <span className={`topic-status s-${t.status}`}>{label[t.status]}</span>
            <span className="topic-track"><span style={{ width: `${t.mastery * 10}%` }} className={`s-${t.status}`} /></span>
            <b>{t.mastery}/10</b>
            {t.trend !== 0 && <small className={t.trend > 0 ? 'up' : 'down'}>{t.trend > 0 ? '▲' : '▼'} {Math.abs(t.trend)}</small>}
          </button>
        </li>)}</ul> : <p className="stats-empty">Play a battle or a practice round and your topics show up here.</p>}
        {untried.length > 0 && <div className="untried"><span>Not tried yet:</span>{untried.map(t => <button key={t.id} onClick={() => onPractice([t.id])}>{t.topic}</button>)}</div>}
      </section>
      <section>
        <h3>Key points you keep missing</h3>
        {stats.missed.length ? <ol className="missed-list">{stats.missed.map((m, i) => <li key={i}><span className="kind-chip">{m.topic}</span><p>{m.point}</p><small>missed {m.count}×</small></li>)}</ol> : <p className="stats-empty">Nothing yet. The points you leave out of your explanations are collected here.</p>}
      </section>
    </div>
  </div>;
}
