// Wire colours shared by the 3D view and the wiring list: red power, dark ground, cream ribbon,
// and a rotating palette for signals.
const SIGNALS = ['#f2b705', '#1e88e5', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60', '#7cb342'];
export const wireColor = (wire, i) => wire.kind === 'power' ? '#e53935' : wire.kind === 'ground' ? '#263238' : wire.kind === 'ribbon' ? '#e8dcc0' : SIGNALS[i % SIGNALS.length];
