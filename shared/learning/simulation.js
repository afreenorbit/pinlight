export function simulationCode(boardId,lesson,{period=1000,rgb=[.7,.2,1],angle=90,pitch=440,sweep=false}={}){
 let code=lesson.code;
 if(boardId==='raspberry-pi-5'){
  if(lesson.kind==='led')code=code.replace('on_time=1, off_time=1',`on_time=${period/1000}, off_time=${period/1000}`);
  if(lesson.kind==='rgb')code=code.replace('(0.7, 0.2, 1)',`(${rgb.map(v=>+v.toFixed(2)).join(', ')})`);
  if(lesson.kind==='servo')code=code.replace('servo.angle = 90\n    sleep(1)',sweep?`while True:\n        for target in (20, 90, 160, 90):\n            servo.angle = target\n            sleep(${period/1000})`:`servo.angle = ${angle}\n    sleep(1)`);
  if(lesson.kind==='buzzer')code=`from gpiozero import TonalBuzzer\nfrom gpiozero.tones import Tone\nfrom time import sleep\n\nbuzzer = TonalBuzzer(${lesson.gpio}, octaves=3)\ntry:\n    while True:\n        buzzer.play(Tone(frequency=${pitch}))\n        sleep(${period/1000})\n        buzzer.stop()\n        sleep(${period/1000})\nfinally:\n    buzzer.close()`;
 }else{
  if(lesson.kind==='led'||lesson.kind==='buzzer')code=code.replaceAll('delay(1000)',`delay(${period})`);
  if(lesson.kind==='rgb')[9,10,11].forEach((pin,i)=>{code=code.replace(new RegExp(`analogWrite\\(${pin}, \\d+\\)`),`analogWrite(${pin}, ${Math.round(rgb[i]*255)})`);});
  if(lesson.kind==='buzzer')code=code.replace('tone(8, 440)',`tone(8, ${pitch})`);
  if(lesson.kind==='servo')code=sweep?`#include <Servo.h>\nServo motor;\nvoid setup() { motor.attach(9); }\nvoid loop() {\n  const int targets[] = {20, 90, 160, 90};\n  for (int target : targets) {\n    motor.write(target); delay(${period});\n  }\n}`:code.replace('motor.write(90)',`motor.write(${angle})`);
 }
 return code;
}
export function describeSimulation(kind,{running,lit,pressed,angle,pitch,rgb}){
 if(!running)return 'Preview paused.';
 return kind==='button'?(pressed?'Switch closed → input LOW → pressed event.':'Switch open → pull-up holds input HIGH.'):kind==='rgb'?`Red ${Math.round(rgb[0]*100)}%, green ${Math.round(rgb[1]*100)}%, blue ${Math.round(rgb[2]*100)}% combine in the LED lens.`:kind==='servo'?`Control pulses request ${angle}°. The horn moves to the target; the external supply powers the motor.`:kind==='buzzer'?(lit?`Alternating signal → piezo vibrates at ${pitch} Hz. The rings show the sound pulse.`:'Signal paused → piezo is silent.'):(lit?'GPIO HIGH → current through resistor → LED emits light.':'GPIO LOW → no forward current → LED is off.');
}
