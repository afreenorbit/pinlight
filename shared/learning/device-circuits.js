// Electrical nets use physical package pins / named host headers. The renderer
// resolves these endpoints instead of drawing cables to arbitrary coordinates.
export function deviceCircuit(id,boardId){
 const pi=boardId==='raspberry-pi-5';if(!pi&&boardId!=='arduino-uno-r3')throw Error('Unknown host board');
 const nodes=[],nets=[];const b=p=>`board:${p}`,p=n=>`part:${n}`,add=(id,label,pins,kind='module')=>{nodes.push({id,label,pins,kind});return n=>`${id}:${n}`;},net=(a,c,label)=>nets.push({from:a,to:c,label});
 const ground=b(pi?'6':'GND'),v3=b(pi?'1':'3V3'),v5=b(pi?'2':'5V');
 const resistor=(id,label)=>add(id,label,['a','b'],'resistor'),cap=(id,label)=>add(id,label,['+','−'],'capacitor');
 const bypass=(power,gnd,name)=>{const c=cap(`bypass-${name}`,'100 nF supply bypass');net(power,c('+'),'Supply bypass');net(c('−'),gnd,'Bypass ground');};
 const adc=(part=false)=>{
  const a=part?p:add('adc','MCP3008 · 3.3 V ADC',Array.from({length:16},(_,i)=>String(i+1)),'dip');
  const supply=pi?v3:v5;net(supply,a(16),'ADC VDD');net(supply,a(15),'ADC VREF');net(ground,a(14),'ADC AGND');net(ground,a(9),'ADC DGND');
  for(const [pin,n,label] of [[pi?'23':'D13',13,'SPI clock'],[pi?'19':'D11',11,'SPI MOSI'],[pi?'21':'D12',12,'SPI MISO'],[pi?'24':'D10',10,'SPI CS']])net(b(pin),a(n),label);
  bypass(a(16),a(9),'adc');return a;
 };
 if(['bmp280','sht31','mpu6050','vl53l0x'].includes(id)){
  net(v3,p(1),'3.3 V breakout supply');net(ground,p(2),'Common ground');
  if(pi){net(b('3'),p(3),'GPIO2 SDA');net(b('5'),p(4),'GPIO3 SCL');}
  else{const s=add('level','Bidirectional I²C level shifter',['LV','HV','GND','LV1','HV1','LV2','HV2']);net(v3,s('LV'),'3.3 V logic side');net(v5,s('HV'),'5 V logic side');net(ground,s('GND'),'Shifter ground');net(b('A4'),s('HV1'),'Uno SDA · 5 V');net(s('LV1'),p(3),'Sensor SDA · 3.3 V');net(b('A5'),s('HV2'),'Uno SCL · 5 V');net(s('LV2'),p(4),'Sensor SCL · 3.3 V');}
  if(id==='bmp280'){const straps=add('straps','Breakout I²C configuration',['CSB','SDO']);net(v3,straps('CSB'),'CSB high · I²C mode');net(ground,straps('SDO'),'SDO low · address 0x76');}
  if(id==='mpu6050'){const strap=add('address','Breakout address strap',['AD0']);net(ground,strap('AD0'),'AD0 low · address 0x68');}
 }else if(id==='tmp36'){
  net(pi?v3:v5,p(1),'TMP36 supply');net(ground,p(3),'TMP36 ground');net(p(2),pi?adc()(1):b('A0'),'Temperature voltage');bypass(p(1),p(3),'tmp');
 }else if(id==='hcsr04'){
  net(v5,p(1),'5 V supply');net(ground,p(4),'Common ground');net(b(pi?'16':'D9'),p(2),'Trigger');
  if(pi){const r1=resistor('echo-r1','Echo divider · 1 kΩ'),r2=resistor('echo-r2','Echo divider · 2 kΩ');net(p(3),r1('a'),'Echo · 5 V');net(r1('b'),r2('a'),'Divider junction');net(r1('b'),b('18'),'GPIO24 · ~3.3 V echo');net(r2('b'),ground,'Divider ground');}else net(p(3),b('D10'),'Echo');
 }else if(id==='ne555'){
  net(v5,p(8),'5 V VCC');net(v5,p(4),'RESET high');net(ground,p(1),'Timer ground');const ra=resistor('ra','RA · 10 kΩ'),rb=resistor('rb','RB · adjustable'),c=cap('timing','Timing · 10 µF'),control=cap('control','Control · 10 nF');net(v5,ra('a'),'Charge supply');net(ra('b'),p(7),'DISCH');net(p(7),rb('a'),'RB input');net(rb('b'),p(2),'TRIG timing node');net(p(2),p(6),'TRIG / THRES junction');net(p(6),c('+'),'Timing capacitor');net(c('−'),ground,'Timing ground');net(p(5),control('+'),'CONT bypass');net(control('−'),ground,'Control ground');bypass(p(8),p(1),'timer');
  if(pi){const s=add('buffer','74LVC1G17 · 5 V-tolerant input',['VCC','GND','IN','OUT']);net(v3,s('VCC'),'Buffer supply 3.3 V');net(ground,s('GND'),'Buffer ground');net(p(3),s('IN'),'Timer output · 5 V domain');net(s('OUT'),b('11'),'GPIO17 · 3.3 V output');bypass(s('VCC'),s('GND'),'buffer');}else net(p(3),b('D2'),'Timer output');
 }else if(id==='lm358'){
  net(v5,p(8),'Amplifier V+');net(ground,p(4),'Amplifier V−');const source=add('source','External 20 mV test source',['OUT','GND']),rin=resistor('rin','Rin · 1 kΩ'),rf=resistor('rf','Rf · adjustable');net(source('OUT'),p(3),'Non-inverting input');net(source('GND'),ground,'Signal ground');net(p(2),rin('a'),'Feedback node');net(rin('b'),ground,'Gain resistor ground');net(p(1),rf('a'),'Output feedback');net(rf('b'),p(2),'Negative feedback');net(p(5),ground,'Unused amplifier IN+');net(p(6),p(7),'Unused amplifier follower');bypass(p(8),p(4),'amp');
  if(pi){const a=adc(),r1=resistor('out-r1','Output divider · 10 kΩ'),r2=resistor('out-r2','Output divider · 10 kΩ');net(p(1),r1('a'),'Amplifier output');net(r1('b'),a(1),'ADC CH0 · half output');net(r1('b'),r2('a'),'Divider junction');net(r2('b'),ground,'Divider ground');}else net(p(1),b('A0'),'Amplifier output → ADC');
 }else if(id==='74hc595'){
  net(pi?v3:v5,p(16),'Register VCC');net(pi?v3:v5,p(10),'SRCLR high');net(ground,p(8),'Register ground');net(ground,p(13),'OE active low');net(b(pi?'11':'D11'),p(14),'Serial data');net(b(pi?'13':'D13'),p(11),'Shift clock');net(b(pi?'15':'D10'),p(12),'Latch clock');
  const leds=add('leds','8 LEDs · each with 2.2 kΩ series resistor',['QA','QB','QC','QD','QE','QF','QG','QH','GND'],'leds');[15,1,2,3,4,5,6,7].forEach((n,i)=>net(p(n),leds(`Q${String.fromCharCode(65+i)}`),`Output Q${String.fromCharCode(65+i)} → resistor → LED`));net(leds('GND'),ground,'LED cathodes');bypass(p(16),p(8),'register');
 }else if(id==='mcp3008'){
  const a=adc(true),pot=add('pot','10 kΩ potentiometer',['VCC','WIPER','GND'],'pot');net(pi?v3:v5,pot('VCC'),'Pot supply');net(ground,pot('GND'),'Pot ground');net(pot('WIPER'),a(1),'Analogue input CH0');
 }else throw Error('Unknown device circuit');
 return {nodes,nets};
}
