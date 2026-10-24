// Selectable add-on parts used by the guided experiments. IDs match the 3D groups in src/learning/model.js.
export const kitParts={
 breadboard:{name:'Breadboard',detail:'Each short row of five holes is joined underneath, so parts in the same row are connected. The centre gap splits the two halves; the long side rails carry power and ground.'},
 'kit-led':{name:'LED',detail:'A light-emitting diode only conducts one way. The longer leg (anode, +) goes toward the GPIO side; the shorter leg by the flat edge (cathode, −) goes to ground.'},
 'kit-rgb':{name:'RGB LED',detail:'Three LEDs (red, green, blue) share one lens and one common leg. Mixing their brightness with PWM makes other colours.'},
 resistor:{name:'Series resistor',detail:'Limits the current so neither the LED nor the GPIO pin is overloaded. The colour bands encode the value: orange-orange-brown is 330 Ω.'},
 buzzer:{name:'Passive piezo buzzer',detail:'A thin ceramic disc flexes every time the voltage changes. Switching it on and off hundreds of times a second makes a tone; the switching frequency is the pitch.'},
 'kit-button':{name:'Push button',detail:'Closes the circuit only while held. A pull-up keeps the input HIGH; pressing joins it to ground, so the pin reads LOW.'},
 servo:{name:'Servo motor',detail:'A small motor with its own position control. The width of each control pulse sets the horn angle, from 0° to 180°.'},
 supply:{name:'External 5 V supply',detail:'A servo can draw more current than the board should provide. Power it separately and connect the grounds together so the signal has a shared reference.'},
 'wire-signal':{name:'Signal wire',detail:'Carries the output from the board pin into the circuit. This is the wire your code controls.'},
 'wire-ground':{name:'Ground wire',detail:'The return path to 0 V. Current only flows around a complete loop, so every circuit needs one.'},
 'wire-link':{name:'Link wire',detail:'Joins two breadboard rows so the current can continue to the next part.'},
 'wire-power':{name:'Power wire',detail:'Brings the external supply to the part that needs more current than a GPIO pin can give.'}
};

// Prefixed where a board already uses the plain id (Pi power button, Uno onboard LED).
const outputs={led:'kit-led',rgb:'kit-rgb',buzzer:'buzzer',button:'kit-button',servo:'servo'};
export function kitPartIds(kind){
 const base=['breadboard',outputs[kind]||'kit-led'];
 if(kind==='led'||kind==='rgb'||kind==='buzzer')base.push('resistor');
 if(kind==='servo')base.push('supply','wire-power');
 base.push('wire-signal','wire-ground');
 if(kind==='led'||kind==='rgb'||kind==='buzzer')base.push('wire-link');
 return base;
}

// Which parts each of the four lesson steps should spotlight.
export function stepHighlight(kind,stepId){
 const output=outputs[kind]||'kit-led';
 if(stepId==='parts')return kitPartIds(kind).filter(id=>!id.startsWith('wire'));
 if(stepId==='signal')return ['gpio','wire-signal',...(kind==='servo'||kind==='button'?[]:['resistor','wire-link']),output];
 if(stepId==='return')return ['gpio','wire-ground',output,...(kind==='servo'?['supply','wire-power']:[])];
 return null;
}

// Matches a question to a part in the current circuit, so answers can spotlight it.
const aliases=[['supply',/\b(external|separate|own) (power|supply)|power supply|battery\b/],['servo',/\bservo|motor|horn\b/],['resistor',/\bresistor|ohm|Ω/],['buzzer',/\bbuzzer|piezo|tone|sound\b/],['kit-button',/\bbutton|switch|pull.?up\b/],['kit-rgb',/\brgb|colou?r\b/],['kit-led',/\bled|light|diode|anode|cathode\b/],['breadboard',/\bbreadboard|rows?|rails?\b/],['wire-ground',/\bground|gnd|return\b/],['wire-signal',/\bsignal|jumper|wire\b/]];
export function findKitPart(text,kind){const ids=kitPartIds(kind),q=String(text).toLowerCase();return aliases.find(([id,re])=>ids.includes(id)&&re.test(q))?.[0]||null;}
