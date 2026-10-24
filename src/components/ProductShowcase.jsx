import { useState } from 'react';
import ScrollReveal from './ScrollReveal.jsx';
import Icon from './Icon.jsx';

export default function ProductShowcase() {
  const [view, setView] = useState('inspection');
  const inspection = view === 'inspection';
  return <section id="product-preview" className="product-showcase section-wrap" aria-label="A look inside Tracepoint">
    <ScrollReveal className="showcase-intro"><div><div className="eyebrow"><span className="status-dot" /> FROM THE WORKING APP</div><h2>A little less explaining.<br /><em>A lot more context.</em></h2></div><p>Your drawing, the exact reference,<br />and the words you don’t want to lose.</p></ScrollReveal>
    <ScrollReveal className="showcase-reveal" delay={80}>
      <div className="showcase-stage">
        <div className="showcase-window">
          <div className="showcase-toolbar"><span className="window-dots" aria-hidden="true"><i/><i/><i/></span><span>tracepoint / {inspection ? 'inspection desk' : 'voice companion'}</span><span className="capture-label">REAL DEMO CAPTURE</span></div>
          <div className="showcase-image"><img src={inspection ? '/images/inspection-workspace.png' : '/images/voice-workspace.png'} alt={inspection ? 'Actual Tracepoint workspace displaying the Arduino schematic with a selected C9 reference and an inspection observation.' : 'Actual Tracepoint Bolna panel showing English and Hindi voice controls for the selected C9 reference.'} width="1500" height="800" loading="eager" decoding="async" /></div>
          <div className="showcase-bottom"><span><span className="status-dot"/>{inspection ? 'Keep every observation close to its source.' : 'Talk it through. Keep the final say.'}</span><a href="/workspace">Try the workspace <Icon name="diagonal" size={15}/></a></div>
        </div>
        <div className="showcase-margin-note" aria-hidden="true"><span>↳</span> {inspection ? 'The detail stays attached.' : 'A conversation, with context.'}</div>
      </div>
      <div className="showcase-navigation"><div role="group" aria-label="Choose a product screenshot"><button aria-pressed={inspection} onClick={()=>setView('inspection')}><Icon name="target" size={16}/>Inspection desk</button><button aria-pressed={!inspection} onClick={()=>setView('voice')}><Icon name="mic" size={16}/>Voice companion</button></div><p>Captured during local testing. Demo observations are illustrative.</p></div>
    </ScrollReveal>
  </section>;
}
