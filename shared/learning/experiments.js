// Closed-form ideal circuits. No device-specific behavior or wiring is inferred.
export function availableExperiments(nodes){
 const kinds=new Set(nodes.map(n=>n.kind));
 return [
  ...(kinds.has('resistor')?[{id:'divider',title:'Explore a voltage divider',description:'A separate ideal two-resistor circuit. Experiment values are examples, not extracted device limits.'}]:[]),
  ...(kinds.has('resistor')&&kinds.has('capacitor')?[{id:'rc',title:'Charge a capacitor',description:'A separate ideal resistor-capacitor circuit. This does not simulate the uploaded chip.'}]:[]),
 ];
}
export function simulateExperiment(id,{supply=3.3,r1=1000,r2=1000,capacitance=0.00001}={}){
 if(!['divider','rc'].includes(id))throw Error('Unsupported experiment.');
 if(!Number.isFinite(supply)||supply<0||supply>12||![r1,r2].every(r=>Number.isFinite(r)&&r>=100&&r<=1000000)||!Number.isFinite(capacitance)||capacitance<1e-9||capacitance>.01)throw Error('Experiment values are outside supported limits.');
 if(id==='divider')return {voltage:supply*r2/(r1+r2),current:supply/(r1+r2),power:supply*supply/(r1+r2),netlist:`V1 in 0 DC ${supply}\nR1 in out ${r1}\nR2 out 0 ${r2}`,engine:'ideal closed-form equations'};
 const tau=r1*capacitance;
 return {tau,samples:Array.from({length:101},(_,i)=>({time:i/20*tau,voltage:supply*(1-Math.exp(-i/20))})),netlist:`V1 in 0 DC ${supply}\nR1 in out ${r1}\nC1 out 0 ${capacitance} IC=0`,engine:'ideal closed-form equations'};
}
