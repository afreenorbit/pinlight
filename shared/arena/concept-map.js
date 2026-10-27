// The 16 Arena concepts arranged as four tracks, each in a suggested learning order: a concept
// leans on the ones before it in its track.
export const tracks = [
  { id: 'current', title: 'Current and voltage', concepts: ['resistor', 'led-resistor', 'divider', 'adc'] },
  { id: 'inputs', title: 'Digital inputs', concepts: ['pullup', 'debounce', 'logic-levels'] },
  { id: 'signals', title: 'Signals and sensors', concepts: ['pwm', 'servo', 'ultrasonic', 'i2c'] },
  { id: 'power', title: 'Power and motors', concepts: ['ground', 'decoupling', 'transistor', 'flyback', 'h-bridge'] },
];
export const trackOf = id => tracks.find(t => t.concepts.includes(id));
export const prerequisites = id => { const t = trackOf(id); return t ? t.concepts.slice(0, t.concepts.indexOf(id)) : []; };
