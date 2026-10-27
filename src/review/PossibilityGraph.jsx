import Icon from '../components/Icon.jsx';
import {inventoryPossibilities} from '../../shared/review/ownership.js';
import './graph.css';

const UNKNOWN_WITHOUT='The effect of leaving this out has not been established. Confirm its role in your exact circuit.';

function Leaf({title,children,tone}){
 return <article className={`pg-leaf ${tone||''}`}><strong>{title}</strong>{children}</article>;
}
function Branch({id,number,title,hint,count,children,empty}){
 return <section className={`pg-branch pg-${id}`} aria-label={title}>
  <header><span className="pg-count">{count}</span><div><span className="pg-number">{number}</span><h3>{title}</h3><p>{hint}</p></div></header>
  <div className="pg-leaves">{count?children:<p className="pg-empty">{empty}</p>}</div>
 </section>;
}

// Your idea at the root, five branches below it: what you have, what you lack, what each
// missing part makes possible, what breaks without it, and candidate alternatives.
export default function PossibilityGraph({result}){
 const fallback=result.checks.nodes.filter(n=>n.id!=='standalone').map(n=>({name:n.name,relation:n.missing?'required':'have',reason:n.fact||n.role,alternatives:[]}));
 const parts=inventoryPossibilities(result.possibilities?.length?result.possibilities:fallback,result.narrative);
 const have=parts.filter(p=>p.relation==='have'),missing=parts.filter(p=>p.relation==='required'),extras=parts.filter(p=>!['have','required'].includes(p.relation));
 const swappable=parts.filter(p=>p.alternatives?.length);
 return <div className="pg" aria-label="Build possibilities and consequences">
  <div className="pg-root"><Icon name="layers" size={22}/><div><span>YOUR IDEA</span><strong>{result.narrative?.idea||result.input.goal}</strong></div><em>{have.length} owned · {missing.length} missing · {swappable.length} with alternatives</em></div>
  <div className="pg-branches">
   <Branch id="have" number="01" title="You have these" hint="What each part you own does in this build." count={have.length} empty="No owned parts were recognised. Name them exactly, for example “Arduino Uno, two DC motors”.">
    {have.map((p,i)=><Leaf key={i} title={p.name} tone="good"><p>{p.reason}</p></Leaf>)}
   </Branch>
   <Branch id="missing" number="02" title="You don’t have these yet" hint="Needed for the reviewed version of your idea." count={missing.length} empty="Nothing essential seems to be missing. Check the assumptions below.">
    {missing.map((p,i)=><Leaf key={i} title={p.name} tone="warn"><p>{p.relatedTo?<>Needed for <b>{p.relatedTo}</b>. </>:null}{p.reason}</p></Leaf>)}
   </Branch>
   <Branch id="with" number="03" title="If you add them" hint="What each missing part makes possible." count={missing.length+extras.length} empty="No additions were proposed.">
    {missing.map((p,i)=><Leaf key={i} title={`+ ${p.name}`} tone="good"><p>{p.reason}</p></Leaf>)}
    {extras.map((p,i)=><Leaf key={`x${i}`} title={`+ ${p.name}`}><span className="pg-tag">{p.relation==='optional'?'Optional':p.relation==='complements'?'Complements':'Another approach'}</span><p>{p.reason}</p></Leaf>)}
   </Branch>
   <Branch id="without" number="04" title="If you don’t" hint="What fails, or what you lose, without each one." count={missing.length} empty="No missing parts, so nothing breaks here.">
    {missing.map((p,i)=><Leaf key={i} title={`− ${p.name}`} tone="bad"><p>{p.without||UNKNOWN_WITHOUT}</p></Leaf>)}
   </Branch>
   <Branch id="alternatives" number="05" title="Alternatives you could use" hint="Candidates only. Check compatibility before buying." count={swappable.length} empty="No suitable substitutes were established. Ask for a source-backed replacement before changing a part.">
    {swappable.map((p,i)=><Leaf key={i} title={`Instead of ${p.name}`}>{p.alternatives.map((a,j)=><div className="pg-alt" key={j}><b>{a.name}</b><p>{a.tradeoff}</p><small>Check first: {a.checks}</small></div>)}</Leaf>)}
   </Branch>
  </div>
 </div>;
}
