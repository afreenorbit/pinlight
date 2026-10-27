// Spoken explanation rounds. Each concept has the key points a good answer covers, a model
// answer, and three pre-written bot answers that were graded once when they were written,
// so a bot's score never depends on a model call.
const bot = (text, accuracy, clarity, covered) => ({ text, accuracy, clarity, covered });

export const concepts = [
  {
    id: 'resistor', topic: 'Resistors', prompt: 'Explain what a resistor does in a circuit and how Ohm’s law describes it.',
    points: [
      { id: 'limits', text: 'It opposes or limits the flow of current', keywords: ['limit', 'oppose', 'restrict', 'reduce current', 'resist'] },
      { id: 'ohms', text: 'V = I × R: voltage equals current times resistance', keywords: ['v = ir', 'v=ir', 'ohm', 'voltage equals current', 'current times resistance', 'i = v/r'] },
      { id: 'heat', text: 'It turns the dropped voltage into heat, so it has a power rating', keywords: ['heat', 'power rating', 'watt', 'dissipat'] },
      { id: 'uses', text: 'Typical uses: current limiting, dividing voltage, pull-ups', keywords: ['led', 'divider', 'pull-up', 'pull up', 'pulldown', 'pull-down'] },
    ],
    reference: 'A resistor opposes current. Ohm’s law says V = I × R, so for a given voltage a bigger resistance means less current. The voltage it drops becomes heat, which is why resistors have power ratings. You use them to limit current to an LED, to build voltage dividers and as pull-up or pull-down resistors.',
    bots: {
      strong: bot('A resistor limits current. Ohm’s law, V equals I times R, tells you the current for a given voltage. The energy it drops turns into heat, so you pick one with a big enough power rating. Common uses are LED current limiting and voltage dividers.', 9, 8, ['limits', 'ohms', 'heat', 'uses']),
      partial: bot('It slows down the electricity so things do not get too much. Bigger resistor, less current, that is Ohm’s law basically.', 5, 5, ['limits', 'ohms']),
      weak: bot('A resistor stores energy and releases it later, kind of like a small battery.', 1, 6, []),
    },
  },
  {
    id: 'led-resistor', topic: 'LEDs', prompt: 'Why does an LED need a series resistor, and how do you choose its value?',
    points: [
      { id: 'diode', text: 'An LED is a diode: above its forward voltage current rises very steeply', keywords: ['diode', 'forward voltage', 'steep', 'exponential', 'not self-limiting'] },
      { id: 'damage', text: 'Without a resistor the current is too high and it burns out', keywords: ['burn', 'damage', 'destroy', 'too much current', 'blow'] },
      { id: 'formula', text: 'R = (supply − LED forward voltage) ÷ desired current', keywords: ['minus', 'subtract', 'supply voltage', 'divided by', '(v', 'r ='] },
      { id: 'typical', text: 'Typical targets are 5–20 mA, e.g. about 150 Ω from 5 V at 20 mA', keywords: ['20 milliamp', '20 ma', '10 ma', '220', '330', '150'] },
    ],
    reference: 'An LED is a diode, so once you pass its forward voltage the current rises very steeply and nothing inside limits it. A series resistor sets the current. Choose R = (supply voltage − LED forward voltage) ÷ the current you want, typically 5–20 mA. From 5 V with a 2 V LED at 20 mA that is 150 Ω.',
    bots: {
      strong: bot('LEDs are diodes, so above the forward voltage the current shoots up and the LED burns out. The resistor sets the current: R equals supply minus forward voltage, divided by the current. Five volts, two volt LED, twenty milliamps gives a hundred and fifty ohms.', 10, 9, ['diode', 'damage', 'formula', 'typical']),
      partial: bot('Otherwise the LED gets too much current and burns. I usually just use a 220 ohm one.', 5, 7, ['damage', 'typical']),
      weak: bot('The resistor makes the LED brighter by boosting the voltage.', 0, 6, []),
    },
  },
  {
    id: 'pullup', topic: 'Pull-up resistors', prompt: 'What is a pull-up resistor and why would a button input need one?',
    points: [
      { id: 'floating', text: 'An unconnected input floats and reads random values', keywords: ['float', 'random', 'undefined', 'noise', 'picks up'] },
      { id: 'default', text: 'The pull-up holds the input HIGH by default', keywords: ['high', 'default', 'pulls it up', 'to vcc', 'to 3.3', 'to 5'] },
      { id: 'press', text: 'Pressing the button connects to ground and reads LOW', keywords: ['ground', 'low', 'pressed', 'press'] },
      { id: 'internal', text: 'Many microcontrollers have internal pull-ups you can enable', keywords: ['internal', 'input_pullup', 'built-in', 'built in', 'pull_up'] },
    ],
    reference: 'A digital input that is not connected to anything floats and reads random highs and lows. A pull-up resistor connects it to the supply so it reads HIGH by default; the button connects the pin to ground, so pressing it reads LOW. Arduino and Raspberry Pi pins have internal pull-ups you can enable instead of a separate resistor.',
    bots: {
      strong: bot('Without one the input floats and reads noise. The pull-up ties the pin to the supply so it sits HIGH, and the button shorts it to ground so a press reads LOW. On Arduino you can just use INPUT_PULLUP.', 10, 9, ['floating', 'default', 'press', 'internal']),
      partial: bot('It keeps the pin high so the reading is stable. When you press the button it goes low.', 6, 7, ['default', 'press']),
      weak: bot('A pull-up resistor pulls more current into the button so it clicks harder.', 0, 5, []),
    },
  },
  {
    id: 'pwm', topic: 'PWM', prompt: 'Explain PWM and how it lets a digital pin dim an LED or slow a motor.',
    points: [
      { id: 'switching', text: 'The pin switches fully on and off very fast', keywords: ['on and off', 'switch', 'square wave', 'pulse', 'toggl'] },
      { id: 'duty', text: 'Duty cycle is the fraction of time it is on', keywords: ['duty', 'percent', 'fraction of time', 'how long it'] },
      { id: 'average', text: 'The average power or voltage follows the duty cycle', keywords: ['average', 'effective', 'mean'] },
      { id: 'frequency', text: 'It is fast enough that eyes or the motor see a smooth level', keywords: ['fast', 'frequency', 'hz', 'flicker', 'smooth', 'can’t see', 'cannot see'] },
    ],
    reference: 'Pulse-width modulation switches a pin fully on and off many times a second. The duty cycle is the percentage of each period it is on. Because it switches fast, an LED looks dimmer and a motor runs slower, responding to the average power, which is proportional to the duty cycle.',
    bots: {
      strong: bot('PWM flips the pin fully on and off really fast. The duty cycle, the percentage of time it is on, sets the average power, so fifty percent duty looks like half brightness. It is fast enough that you see a steady glow.', 10, 9, ['switching', 'duty', 'average', 'frequency']),
      partial: bot('Pulse width modulation. You change the duty cycle to change the brightness.', 5, 6, ['duty']),
      weak: bot('PWM lowers the actual voltage on the pin, like a tiny regulator.', 2, 6, ['average']),
    },
  },
  {
    id: 'divider', topic: 'Voltage dividers', prompt: 'How does a voltage divider work, and where would you use one?',
    points: [
      { id: 'series', text: 'Two resistors in series across a voltage, output taken from the middle', keywords: ['two resistors', 'series', 'middle', 'between'] },
      { id: 'formula', text: 'Vout = Vin × R2 ÷ (R1 + R2)', keywords: ['r2', 'ratio', 'r1 + r2', 'proportion', 'divided by the total'] },
      { id: 'use', text: 'Used to scale a voltage down, e.g. 5 V to 3.3 V logic or reading a sensor', keywords: ['level', '3.3', 'scale', 'sensor', 'ldr', 'potentiometer', 'battery'] },
      { id: 'load', text: 'Not a power supply: a load changes the output', keywords: ['load', 'not a regulator', 'cannot power', 'current draw', 'regulator'] },
    ],
    reference: 'Put two resistors in series across a voltage and take the output from the junction. Vout = Vin × R2 ÷ (R1 + R2). Dividers scale a voltage down, for example a 5 V signal to 3.3 V logic, or turn a variable resistor like an LDR into a readable voltage. They are not power supplies, because a load changes the ratio.',
    bots: {
      strong: bot('Two resistors in series, output from the middle. The output is Vin times R2 over R1 plus R2. I would use it to bring a five volt signal down to three point three, but not to power anything, because the load drags it down.', 10, 9, ['series', 'formula', 'use', 'load']),
      partial: bot('Two resistors split the voltage. Equal resistors give you half.', 5, 7, ['series']),
      weak: bot('A voltage divider splits current between two LEDs equally.', 1, 6, []),
    },
  },
  {
    id: 'decoupling', topic: 'Capacitors', prompt: 'Why do circuits put small capacitors next to chips’ power pins?',
    points: [
      { id: 'local', text: 'They store charge right next to the chip as a local reservoir', keywords: ['store', 'reservoir', 'charge', 'local', 'close to'] },
      { id: 'spikes', text: 'They supply sudden current demands and smooth dips or spikes', keywords: ['spike', 'dip', 'sudden', 'transient', 'smooth', 'ripple'] },
      { id: 'noise', text: 'They shunt high-frequency noise to ground', keywords: ['noise', 'high frequency', 'filter', 'shunt'] },
      { id: 'value', text: 'Typically 100 nF ceramic, placed as close as possible', keywords: ['100 nf', '0.1', 'ceramic', '100n'] },
    ],
    reference: 'These are decoupling or bypass capacitors. They act as a small local reservoir of charge, supplying quick bursts of current when the chip switches, so the supply does not dip or spike, and they shunt high-frequency noise to ground. A 100 nF ceramic placed as close to the pin as possible is typical.',
    bots: {
      strong: bot('Those are decoupling caps. They are a tiny local charge reservoir, so when the chip suddenly draws current the voltage does not dip, and they short high frequency noise to ground. Usually a hundred nanofarad ceramic right at the pin.', 10, 9, ['local', 'spikes', 'noise', 'value']),
      partial: bot('They filter noise on the power line so the chip is stable.', 5, 7, ['noise']),
      weak: bot('They are there in case the main battery runs out, as backup power.', 2, 6, ['local']),
    },
  },
  {
    id: 'i2c', topic: 'I²C', prompt: 'Explain how I²C lets several sensors share the same two wires.',
    points: [
      { id: 'lines', text: 'Two lines: SDA for data and SCL for clock', keywords: ['sda', 'scl', 'data line', 'clock'] },
      { id: 'address', text: 'Each device has an address; the controller calls one at a time', keywords: ['address', '0x', 'unique'] },
      { id: 'controller', text: 'A controller (master) drives the clock and starts transfers', keywords: ['controller', 'master', 'initiat', 'start'] },
      { id: 'pullups', text: 'The lines are open-drain and need pull-up resistors', keywords: ['pull-up', 'pull up', 'open drain', 'open-drain'] },
    ],
    reference: 'I²C uses two shared lines, SDA for data and SCL for the clock. A controller generates the clock and starts each transfer by sending a device address, so only the device with that address answers. Devices only pull the lines low (open drain), so both lines need pull-up resistors.',
    bots: {
      strong: bot('I squared C uses SDA for data and SCL for clock. The controller drives the clock and sends an address first, so only the sensor with that address replies. The lines are open drain, so you need pull-up resistors.', 10, 9, ['lines', 'address', 'controller', 'pullups']),
      partial: bot('It uses SDA and SCL, and every sensor has its own address.', 6, 7, ['lines', 'address']),
      weak: bot('Every sensor gets its own pair of wires, and they take turns using the voltage.', 1, 5, []),
    },
  },
  {
    id: 'transistor', topic: 'Transistors', prompt: 'How can a transistor let a microcontroller pin switch a motor or a bright LED strip?',
    points: [
      { id: 'current', text: 'A GPIO pin can only supply a few milliamps', keywords: ['few milliamp', 'small current', 'limited current', 'cannot supply', 'not enough current', '20 ma', '16 ma'] },
      { id: 'switch', text: 'A small base/gate signal switches a much larger current', keywords: ['small', 'larger current', 'switch', 'amplif', 'control'] },
      { id: 'terminals', text: 'Base/gate from the pin; load between supply and collector/drain', keywords: ['base', 'gate', 'collector', 'drain', 'emitter', 'source'] },
      { id: 'parts', text: 'Use a base resistor (BJT) or logic-level MOSFET, and a flyback diode for motors', keywords: ['base resistor', 'logic level', 'mosfet', 'flyback', 'diode'] },
    ],
    reference: 'A GPIO pin can only supply a few milliamps, far too little for a motor. A transistor acts as a switch: a small current into the base (or a voltage on a MOSFET gate) lets a much larger current flow from the supply through the load. Use a base resistor for a BJT or a logic-level MOSFET, share grounds, and add a flyback diode for motors.',
    bots: {
      strong: bot('The pin only gives a few milliamps, so it drives the transistor instead. A small current into the base, or voltage on a MOSFET gate, lets a big current flow through the motor from its own supply. Add a base resistor, and a flyback diode across the motor.', 10, 8, ['current', 'switch', 'terminals', 'parts']),
      partial: bot('The transistor acts like a switch that the pin controls, so the motor gets more power.', 5, 7, ['switch']),
      weak: bot('The transistor boosts the pin to twelve volts so it can run the motor directly.', 2, 6, []),
    },
  },
  {
    id: 'flyback', topic: 'Flyback diodes', prompt: 'Why do we put a diode across a motor or relay coil?',
    points: [
      { id: 'inductor', text: 'Coils are inductors and resist changes in current', keywords: ['inductor', 'inductive', 'coil', 'magnetic field'] },
      { id: 'spike', text: 'Switching off causes a large voltage spike', keywords: ['spike', 'kick', 'back emf', 'back-emf', 'high voltage'] },
      { id: 'path', text: 'The diode gives that current a safe path to circulate', keywords: ['path', 'circulate', 'loop', 'dissipate', 'safe'] },
      { id: 'orientation', text: 'It is reverse-biased in normal operation (cathode to positive)', keywords: ['reverse', 'cathode', 'backwards', 'stripe'] },
    ],
    reference: 'Motor and relay coils are inductors: they resist sudden changes in current. When the transistor switches off, the collapsing field produces a large voltage spike that can destroy the transistor. A flyback diode, placed reverse-biased with its cathode to the positive supply, gives that current a safe path to circulate until it dies away.',
    bots: {
      strong: bot('Coils are inductors, so when you cut the current the magnetic field collapses and kicks out a big voltage spike. The diode, fitted backwards with the stripe to positive, gives that current a loop to die away in, so the transistor survives.', 10, 9, ['inductor', 'spike', 'path', 'orientation']),
      partial: bot('It protects the transistor from the voltage spike when the motor turns off.', 6, 8, ['spike']),
      weak: bot('The diode makes the motor only spin in one direction.', 1, 7, []),
    },
  },
  {
    id: 'adc', topic: 'Analog-to-digital', prompt: 'What does an ADC do, and what do resolution and reference voltage mean?',
    points: [
      { id: 'convert', text: 'It turns an analogue voltage into a number', keywords: ['convert', 'number', 'digital value', 'analog to digital', 'analogue to digital'] },
      { id: 'resolution', text: 'Resolution is the number of steps, e.g. 10-bit = 0–1023', keywords: ['bit', '1023', '1024', 'steps', 'resolution', '4095'] },
      { id: 'reference', text: 'The reference voltage is the full-scale value', keywords: ['reference', 'full scale', 'maximum voltage', 'vref'] },
      { id: 'pi', text: 'The Raspberry Pi has no built-in ADC; the Uno does on A0–A5', keywords: ['raspberry pi', 'no adc', 'a0', 'external adc', 'mcp3008', 'ads1115'] },
    ],
    reference: 'An analogue-to-digital converter turns a voltage into a number. Resolution is how many steps it has: a 10-bit ADC gives 0–1023. The reference voltage is the voltage that reads as the maximum, so each step is Vref ÷ 1024. The Uno has a 10-bit ADC on A0–A5; the Raspberry Pi has none, so you add one such as an ADS1115.',
    bots: {
      strong: bot('An ADC converts a voltage into a number. Resolution is the number of steps, ten bits gives zero to ten twenty three. The reference voltage is what reads as the top value. The Uno has one on A0 to A5, the Pi needs an external chip.', 10, 9, ['convert', 'resolution', 'reference', 'pi']),
      partial: bot('It reads analog sensors and gives you a value from 0 to 1023.', 5, 7, ['convert', 'resolution']),
      weak: bot('An ADC adds extra digital pins when you run out.', 1, 6, []),
    },
  },
  {
    id: 'logic-levels', topic: 'Logic levels', prompt: 'Why can’t you connect a 5 V sensor output straight to a Raspberry Pi GPIO pin?',
    points: [
      { id: 'pi33', text: 'Pi GPIO pins are 3.3 V and not 5 V tolerant', keywords: ['3.3', 'three point three', 'not 5 v tolerant', 'not tolerant'] },
      { id: 'damage', text: '5 V on a pin can damage it or the processor', keywords: ['damage', 'fry', 'kill', 'destroy', 'break'] },
      { id: 'fix', text: 'Use a level shifter or a voltage divider', keywords: ['level shift', 'divider', 'logic level converter', 'shifter'] },
      { id: 'direction', text: 'Going 3.3 V → 5 V input often works, the risk is 5 V → Pi', keywords: ['other way', 'into the pi', 'direction', 'input to the pi', 'often reads'] },
    ],
    reference: 'Raspberry Pi GPIO runs at 3.3 V and is not 5 V tolerant, so a 5 V signal can permanently damage the pin or the processor. Drop it with a voltage divider or a level shifter. The risky direction is 5 V into the Pi; a 3.3 V output often reads fine as HIGH on a 5 V input.',
    bots: {
      strong: bot('The Pi’s GPIO is three point three volts and not five volt tolerant, so five volts can fry the pin. Put a level shifter or a resistor divider in between. The other direction, the Pi driving a five volt input, usually works.', 10, 9, ['pi33', 'damage', 'fix', 'direction']),
      partial: bot('The Pi is 3.3 volt, so 5 volts could damage it.', 6, 8, ['pi33', 'damage']),
      weak: bot('It is fine as long as you add a capacitor to the pin.', 0, 6, []),
    },
  },
  {
    id: 'ground', topic: 'Common ground', prompt: 'Why must a separate motor battery share ground with your Arduino?',
    points: [
      { id: 'reference', text: 'Voltage is measured relative to a reference point', keywords: ['reference', 'relative', 'compared to', 'measured'] },
      { id: 'signal', text: 'The control signal needs a return path to mean anything', keywords: ['return path', 'complete', 'circuit', 'loop'] },
      { id: 'symptom', text: 'Without it the driver behaves erratically or not at all', keywords: ['erratic', 'random', 'not work', "doesn't work", 'unreliable', 'twitch'] },
      { id: 'power', text: 'Share ground only; keep the motor’s supply separate', keywords: ['only ground', 'separate supply', 'not the positive', 'keep the supply'] },
    ],
    reference: 'Voltages are only meaningful relative to a reference. The Arduino’s 5 V signal is 5 V above its own ground; if the motor driver’s ground is separate, that signal has no defined level or return path, so the driver behaves erratically. Connect the grounds together, but keep the motor supply’s positive separate.',
    bots: {
      strong: bot('Voltage is always measured against something. The Arduino’s signal is five volts above its ground, so the driver needs the same ground to read it, otherwise there is no return path and things twitch randomly. Join only the grounds, keep the motor battery’s positive separate.', 10, 9, ['reference', 'signal', 'symptom', 'power']),
      partial: bot('So the circuit is complete, otherwise the motor does not work.', 5, 6, ['signal', 'symptom']),
      weak: bot('So the Arduino can charge from the motor battery.', 0, 6, []),
    },
  },
  {
    id: 'debounce', topic: 'Debouncing', prompt: 'What is switch bounce and how do you deal with it?',
    points: [
      { id: 'bounce', text: 'Contacts physically bounce, making and breaking several times', keywords: ['bounce', 'chatter', 'several times', 'multiple', 'contacts'] },
      { id: 'effect', text: 'One press is read as multiple presses', keywords: ['multiple presses', 'counts twice', 'many presses', 'false', 'double'] },
      { id: 'software', text: 'Software: wait 10–50 ms and check again', keywords: ['delay', 'millis', 'wait', 'ms', 'ignore'] },
      { id: 'hardware', text: 'Hardware: an RC filter or Schmitt trigger', keywords: ['capacitor', 'rc', 'schmitt', 'filter'] },
    ],
    reference: 'Mechanical contacts bounce, connecting and disconnecting several times over a few milliseconds, so a microcontroller can count one press as many. Debounce in software by ignoring changes for 10–50 ms after the first one, or in hardware with an RC filter and a Schmitt trigger.',
    bots: {
      strong: bot('The metal contacts bounce for a few milliseconds, so one press looks like several. In code you ignore changes for about twenty milliseconds after the first edge, or in hardware you add an RC filter with a Schmitt trigger.', 10, 9, ['bounce', 'effect', 'software', 'hardware']),
      partial: bot('Buttons can register twice, so you add a small delay in the code.', 6, 7, ['effect', 'software']),
      weak: bot('Bounce is when the button is too stiff, so you need a softer button.', 0, 6, []),
    },
  },
  {
    id: 'servo', topic: 'Servos', prompt: 'How do you control a hobby servo’s angle?',
    points: [
      { id: 'pulse', text: 'Send a pulse about every 20 ms (50 Hz)', keywords: ['20 ms', '50 hz', 'every 20', 'fifty hertz'] },
      { id: 'width', text: 'Pulse width sets the angle: ~1 ms to ~2 ms', keywords: ['1 ms', '2 ms', 'pulse width', '1.5', 'one to two'] },
      { id: 'feedback', text: 'Inside, a potentiometer gives position feedback', keywords: ['potentiometer', 'feedback', 'closed loop', 'internal'] },
      { id: 'power', text: 'Power it separately; it can draw too much from the board', keywords: ['separate', 'external power', 'current', 'brown', 'draw'] },
    ],
    reference: 'A hobby servo reads a pulse sent about every 20 ms. The pulse width sets the angle: roughly 1 ms for one end, 1.5 ms for the middle and 2 ms for the other end. Inside, a potentiometer gives feedback so the motor holds that position. Servos can draw large current spikes, so power them separately and share ground.',
    bots: {
      strong: bot('You send a pulse every twenty milliseconds, and its width sets the angle: around one millisecond for zero degrees, two for one eighty. A pot inside gives feedback so it holds position. Power it from its own supply.', 10, 9, ['pulse', 'width', 'feedback', 'power']),
      partial: bot('You use the Servo library and write an angle between 0 and 180.', 4, 7, []),
      weak: bot('You change the voltage, more volts means a bigger angle.', 1, 7, []),
    },
  },
  {
    id: 'ultrasonic', topic: 'Ultrasonic sensors', prompt: 'How does an HC-SR04 ultrasonic sensor measure distance?',
    points: [
      { id: 'pulse', text: 'It sends an ultrasonic burst when triggered', keywords: ['trigger', 'burst', 'ping', 'sends', 'sound'] },
      { id: 'echo', text: 'The echo pin stays high for the round-trip time', keywords: ['echo', 'high', 'round trip', 'time'] },
      { id: 'formula', text: 'Distance = time × speed of sound ÷ 2', keywords: ['speed of sound', '343', 'divide by 2', 'divided by two', 'half'] },
      { id: 'level', text: 'Its echo output is 5 V, so divide it for a Pi', keywords: ['5 v', 'divider', 'raspberry pi', '3.3', 'level'] },
    ],
    reference: 'You pulse TRIG and the HC-SR04 sends a burst of ultrasound. ECHO goes high until the reflection returns, so its length is the round-trip time. Distance = time × speed of sound (about 343 m/s) ÷ 2. Its ECHO output is 5 V, so use a divider before a Raspberry Pi pin.',
    bots: {
      strong: bot('You trigger it and it fires a burst of ultrasound. The echo pin stays high for the round trip. Multiply that time by the speed of sound, about three forty three metres a second, and divide by two. On a Pi, divide the five volt echo down first.', 10, 9, ['pulse', 'echo', 'formula', 'level']),
      partial: bot('It bounces sound off things and times how long it takes to come back.', 5, 7, ['pulse', 'echo']),
      weak: bot('It uses an infrared camera to see how far things are.', 0, 6, []),
    },
  },
  {
    id: 'h-bridge', topic: 'Motor drivers', prompt: 'What does an H-bridge motor driver do, and why can’t you drive a motor straight from a pin?',
    points: [
      { id: 'current', text: 'Motors need far more current than a pin can give', keywords: ['current', 'amps', 'too much', 'few milliamp', 'not enough'] },
      { id: 'direction', text: 'Four switches reverse the polarity, so the motor can run both ways', keywords: ['direction', 'reverse', 'polarity', 'both ways', 'forward and back', 'four switches'] },
      { id: 'speed', text: 'PWM on the enable pin sets the speed', keywords: ['pwm', 'speed', 'enable'] },
      { id: 'protection', text: 'It also isolates the pin from motor noise and spikes', keywords: ['protect', 'spike', 'noise', 'isolat', 'flyback', 'diode'] },
    ],
    reference: 'A motor draws far more current than a GPIO pin can supply, and its switching spikes can damage the microcontroller. An H-bridge uses four switches arranged in an H so it can apply the supply either way round, reversing direction, while PWM on its enable input controls speed. Drivers such as the L298N or TB6612 include protection diodes.',
    bots: {
      strong: bot('A pin gives milliamps, a motor wants amps, and its spikes would wreck the pin. An H-bridge has four switches that can flip the polarity, so the motor runs forwards or backwards, and you PWM the enable pin for speed. Good drivers include flyback diodes.', 10, 9, ['current', 'direction', 'speed', 'protection']),
      partial: bot('It lets the motor go forward and backward, and the Arduino tells it which way.', 5, 7, ['direction']),
      weak: bot('An H-bridge converts AC to DC for the motor.', 0, 6, []),
    },
  },
];
export const conceptById = id => concepts.find(c => c.id === id);
