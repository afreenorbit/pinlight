import {deviceById,deviceReading} from './devices.js';

export const activityBoards=['raspberry-pi-5','arduino-uno-r3'];
const i2cParts={bmp280:['Adafruit BMP280 Library','adafruit-circuitpython-bmp280','adafruit_bmp280','Adafruit_BMP280','0x76'],sht31:['Adafruit SHT31 Library','adafruit-circuitpython-sht31d','adafruit_sht31d','Adafruit_SHT31','0x44'],mpu6050:['Adafruit MPU6050','adafruit-circuitpython-mpu6050','adafruit_mpu6050','Adafruit_MPU6050','0x68'],vl53l0x:['Adafruit VL53L0X','adafruit-circuitpython-vl53l0x','adafruit_vl53l0x','Adafruit_VL53L0X','0x29']};
const row=(from,to,note='')=>({from,to,note});
const spiWires=pi=>[
 row(pi?'3V3 · physical 1':'5V','MCP3008 VDD 16 + VREF 15'),row(pi?'GND · physical 6':'GND','MCP3008 AGND 14 + DGND 9'),
 row(pi?'GPIO11 · physical 23':'D13 / SCK','MCP3008 CLK 13'),row(pi?'GPIO10 · physical 19':'D11 / MOSI','MCP3008 DIN 11'),row(pi?'GPIO9 · physical 21':'D12 / MISO','MCP3008 DOUT 12'),row(pi?'GPIO8 · physical 24':'D10 / CS','MCP3008 CS 10')];
const adcPython=`import board, digitalio\nimport adafruit_mcp3xxx.mcp3008 as MCP\nfrom adafruit_mcp3xxx.analog_in import AnalogIn\nadc = MCP.MCP3008(board.SPI(), digitalio.DigitalInOut(board.D8))\nchannel = AnalogIn(adc, MCP.P0)`;
const loopPython=body=>`import time\n${body}\n`;
const sketch=(headers,setup,body)=>`${headers}\nvoid setup() {\n  Serial.begin(115200);\n${setup}\n}\nvoid loop() {\n${body}\n  delay(250);\n}\n`;

function i2cCode(id,pi){
 const [, ,module,klass,address]=i2cParts[id];
 if(pi){
  const create=id==='bmp280'?`sensor = ${module}.Adafruit_BMP280_I2C(board.I2C(), address=${address})`:id==='sht31'?`sensor = ${module}.SHT31D(board.I2C(), address=${address})`:id==='mpu6050'?`sensor = ${module}.MPU6050(board.I2C(), address=${address})`:`sensor = ${module}.VL53L0X(board.I2C(), io_timeout_s=1)`;
  const read={bmp280:'print("Pressure hPa:", sensor.pressure)',sht31:'print("Humidity %:", sensor.relative_humidity)',mpu6050:'print("Acceleration m/s²:", sensor.acceleration)',vl53l0x:'distance = sensor.range\n        print("Range mm:", distance, "STOP" if distance < 150 else "CLEAR")'}[id];
  return loopPython(`import board\nimport ${module}\n${create}\nwhile True:\n    try:\n        ${read}\n    except (OSError, RuntimeError) as error:\n        print("Read failed; check connection:", error)\n    time.sleep(0.25)`);
 }
 const read={bmp280:'  Serial.print("Pressure hPa: "); Serial.println(sensor.readPressure() / 100.0);',sht31:'  float humidity = sensor.readHumidity();\n  if (isnan(humidity)) { Serial.println("Read failed"); return; }\n  Serial.print("Humidity %: "); Serial.println(humidity);',mpu6050:'  sensors_event_t a, g, temperature;\n  sensor.getEvent(&a, &g, &temperature);\n  Serial.print("X acceleration m/s2: "); Serial.println(a.acceleration.x);',vl53l0x:'  VL53L0X_RangingMeasurementData_t m;\n  sensor.rangingTest(&m, false);\n  if (m.RangeStatus != 0) { Serial.println("Invalid range: STOP"); return; }\n  Serial.print(m.RangeMilliMeter); Serial.println(m.RangeMilliMeter < 150 ? " mm STOP" : " mm CLEAR");'}[id];
 return sketch(`#include <Wire.h>\n#include <${klass}.h>\n${klass} sensor;`,`  if (!sensor.begin(${id==='vl53l0x'?'':address})) {\n    Serial.println("Sensor not found; check address and wiring");\n    while (true) delay(100);\n  }`,read);
}

export function deviceActivity(id,boardId,value){
 const d=deviceById(id);if(!d||!activityBoards.includes(boardId))throw Error('Unknown device activity');
 deviceReading(id,value);const pi=boardId===activityBoards[0],supply=pi?'3V3 · physical 1':'5V',ground=pi?'GND · physical 6':'GND';
 const result={id,boardId,title:'',goal:'',wires:[],parts:[],setup:'',code:'',note:'Hardware examples have not been bench-tested. Power off before wiring; verify the exact package and breakout labels.',source:d.source};
 if(i2cParts[id]){
  const [library,pip]=i2cParts[id];
  result.title={bmp280:'Build a pressure monitor',sht31:'Build a humidity monitor',mpu6050:'Explore a tilt meter',vl53l0x:'Make a proximity alarm'}[id];
  result.goal={bmp280:'Change the air pressure and watch the compensated reading.',sht31:'Change humidity and compare the live reading.',mpu6050:'Tilt the sensor and observe the gravity component on X.',vl53l0x:'Move an obstacle across the 150 mm stop threshold.'}[id];
  result.parts=[`${d.name} 3.3 V-compatible breakout`,...(pi?[]:['Bidirectional I²C level shifter with 3.3 V and 5 V pull-ups'])];
  result.wires=pi?[row(supply,'Breakout VCC / 3V3'),row(ground,'Breakout GND'),row('GPIO2 · physical 3','SDA'),row('GPIO3 · physical 5','SCL')]:[row('3V3','Breakout VCC + shifter LV'),row('5V','Shifter HV'),row('GND','Breakout + shifter GND'),row('A4 / SDA','Shifter HV1 → LV1 → SDA'),row('A5 / SCL','Shifter HV2 → LV2 → SCL')];
  if(id==='bmp280')result.wires.push(row('Breakout 3V3','CSB'),row('Breakout GND','SDO · selects 0x76'));
  if(id==='mpu6050')result.wires.push(row('Breakout GND','AD0 · selects 0x68'));
  if(id==='vl53l0x')result.note+=' Use a breakout with regulated supply and onboard XSHUT pull-up; leave XSHUT unconnected. Do not wire the bare 2.8 V sensor as a module.';
  result.setup=pi?`Enable I²C in raspi-config. Create a Python virtual environment with --system-site-packages; install ${pip} and adafruit-blinka with pip. Run with Python 3. On Pi 5 use current Blinka support.`:`In Arduino IDE Library Manager install ${library} and its dependencies (Adafruit BusIO / Unified Sensor when requested). Select Uno and open Serial Monitor at 115200 baud.`;
  result.code=i2cCode(id,pi);return result;
 }
 switch(id){
 case 'tmp36':
  result.title='Build a thermometer';result.goal='Warm the virtual sensor and convert its voltage into degrees Celsius.';
  result.parts=['TMP36','100 nF supply bypass',...(pi?['MCP3008 ADC']:[])];
  result.wires=[row(pi?'3V3 · physical 1':'5V','TMP36 +VS · pin 1'),row(ground,'TMP36 GND · pin 3'),row('TMP36 VOUT · pin 2',pi?'MCP3008 CH0 · pin 1':'A0'),...(pi?spiWires(true):[])];
  result.setup=pi?'Enable SPI; install adafruit-blinka and adafruit-circuitpython-mcp3xxx in a Python venv with system site packages. MCP3008 VREF = 3.3 V.':'No extra library. Serial Monitor: 115200 baud. The calculation assumes a measured 5.00 V ADC reference; adjust it for your board.';
  result.code=pi?loopPython(`${adcPython}\nwhile True:\n    print("Temperature C:", (channel.voltage - 0.5) * 100)\n    time.sleep(0.25)`):sketch('', '', '  float voltage = analogRead(A0) * (5.0 / 1024.0);\n  Serial.print("Temperature C: "); Serial.println((voltage - 0.5) * 100.0);');break;
 case 'hcsr04':
  result.title='Measure an obstacle';result.goal='Move the obstacle and measure the sound round-trip time.';result.parts=['HC-SR04',...(pi?['1 kΩ + 2 kΩ echo divider']:[])];
  result.wires=[row(pi?'5V · physical 2':'5V','VCC'),row(ground,'GND'),row(pi?'GPIO23 · physical 16':'D9','TRIG'),row('ECHO',pi?'1 kΩ → GPIO24 · physical 18':'D10'),...(pi?[row('GPIO24 node','2 kΩ → GND · limits 5 V echo to ~3.3 V')]:[])];
  result.setup=pi?'Install gpiozero and lgpio; Pi 5 uses the lgpio pin factory. Never connect the 5 V ECHO directly to Pi GPIO.':'No extra library. Serial Monitor: 115200 baud.';
  result.code=pi?loopPython('from gpiozero import DistanceSensor\nfrom gpiozero.pins.lgpio import LGPIOFactory\nwith DistanceSensor(echo=24, trigger=23, max_distance=4, pin_factory=LGPIOFactory()) as sensor:\n    while True:\n        print("Distance cm:", sensor.distance * 100)\n        time.sleep(0.25)'):sketch('', '  pinMode(9, OUTPUT); pinMode(10, INPUT);','  digitalWrite(9, LOW); delayMicroseconds(2);\n  digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW);\n  unsigned long us = pulseIn(10, HIGH, 30000UL);\n  if (!us) Serial.println("No echo");\n  else { Serial.print("Distance cm: "); Serial.println(us * 0.0343 / 2.0); }');break;
 case 'ne555':
  result.title='Watch a timer oscillator';result.goal='Change RB with power off, then observe the output frequency.';result.parts=['NE555','RA 10 kΩ','RB 1–100 kΩ','10 µF timing capacitor','10 nF control bypass','100 nF supply bypass',...(pi?['5 V-tolerant 74LVC1G17 powered at 3.3 V']:[])];
  result.wires=[row(pi?'5V · physical 2':'5V','Pins 8 VCC + 4 RESET'),row(ground,'Pin 1 GND + capacitor negatives'),row('5V → RA 10 kΩ','Pin 7 DISCH'),row('Pin 7 → RB','Pins 2 TRIG + 6 THRES'),row('Pins 2 + 6','10 µF → GND'),row('Pin 5 CONT','10 nF → GND'),row('Pin 3 OUT',pi?'74LVC1G17 input → output → GPIO17 · physical 11':'D2')];
  result.setup=pi?'Install gpiozero and lgpio. Buffer VCC = 3.3 V, ground shared; use a specifically 5 V-tolerant 74LVC1G17 input, with 100 nF bypass. Do not use a 3.3 V-powered generic HC gate.':'No extra library. Serial Monitor: 115200 baud. Frequency measurement has a two-second pulse timeout.';
  result.code=pi?loopPython('from gpiozero import DigitalInputDevice\nfrom gpiozero.pins.lgpio import LGPIOFactory\nfrom threading import Event\nedge = Event()\nwith DigitalInputDevice(17, pull_up=False, pin_factory=LGPIOFactory()) as signal:\n    signal.when_activated = edge.set\n    previous = None\n    while True:\n        if not edge.wait(2):\n            print("No oscillator edge"); previous = None; continue\n        now = time.monotonic()\n        edge.clear()\n        if previous is not None:\n            print("Frequency Hz:", 1 / (now - previous))\n        previous = now'):sketch('', '  pinMode(2, INPUT);','  unsigned long highUs = pulseIn(2, HIGH, 2000000UL);\n  unsigned long lowUs = pulseIn(2, LOW, 2000000UL);\n  if (!highUs || !lowUs) Serial.println("No complete period");\n  else Serial.println(1000000.0 / (highUs + lowUs));');break;
 case 'lm358':
  result.title='Measure amplifier gain';result.goal='Change the feedback resistor and inspect the amplified 20 mV input.';result.parts=['LM358','20 mV low-impedance test source','Rin 1 kΩ','Rf 1–47 kΩ','100 nF bypass',...(pi?['MCP3008','Output divider: 10 kΩ + 10 kΩ']:[])];
  result.wires=[row(pi?'5V · physical 2':'5V','Pin 8 V+'),row(ground,'Pin 4 V− + signal ground'),row('20 mV source','Pin 3 IN+'),row('Pin 2 IN−','Rin 1 kΩ → GND'),row('Pin 1 OUT','Rf → pin 2 IN−'),row('Pin 5 unused IN+','GND'),row('Pin 6 unused IN−','Pin 7 unused OUT'),row('Pin 1 OUT',pi?'10 kΩ → MCP3008 CH0':'A0'),...(pi?[row('MCP3008 CH0','10 kΩ → GND · 2:1 divider'),...spiWires(true)]:[])];
  result.setup=pi?'Enable SPI. Install adafruit-blinka and adafruit-circuitpython-mcp3xxx. ADC reference = 3.3 V; the equal-resistor divider halves amplifier output.':'No extra library. Serial Monitor: 115200 baud. ADC reference assumed 5.00 V. A precision 20 mV source is external, not generated by this code.';
  result.code=pi?loopPython(`${adcPython}\nwhile True:\n    output = channel.voltage * 2\n    print("Output V:", output, "Measured gain:", output / 0.020)\n    time.sleep(0.25)`):sketch('', '', '  float output = analogRead(A0) * (5.0 / 1024.0);\n  Serial.print("Output V: "); Serial.println(output, 3);\n  Serial.print("Measured gain: "); Serial.println(output / 0.020);');break;
 case '74hc595':
  result.title='Control eight LEDs';result.goal='Change the byte to latch a different eight-LED pattern.';result.parts=['74HC595','8 LEDs + 8 × 2.2 kΩ resistors','100 nF bypass'];
  result.wires=[row(supply,'Pin 16 VCC + pin 10 SRCLR'),row(ground,'Pin 8 GND + pin 13 OE'),row(pi?'GPIO17 · physical 11':'D11','Pin 14 SER'),row(pi?'GPIO27 · physical 13':'D13','Pin 11 SRCLK'),row(pi?'GPIO22 · physical 15':'D10','Pin 12 RCLK'),row('QA…QH · pins 15,1…7','Each → 2.2 kΩ → LED anode; cathode → GND'),row('Pin 9 QH′','Leave unconnected')];
  result.setup=pi?'Install gpiozero and lgpio. Power the HC chip at 3.3 V to match Pi output levels.':'No extra library. Serial Monitor: 115200 baud. Set PATTERN in the sketch to change the byte.';
  result.code=pi?loopPython(`from gpiozero import DigitalOutputDevice\nfrom gpiozero.pins.lgpio import LGPIOFactory\nPATTERN = ${value}\nfactory = LGPIOFactory()\nwith DigitalOutputDevice(17, pin_factory=factory) as data, DigitalOutputDevice(27, pin_factory=factory) as clock, DigitalOutputDevice(22, pin_factory=factory) as latch:\n    latch.off()\n    for bit in range(7, -1, -1):\n        data.value = (PATTERN >> bit) & 1\n        clock.on(); time.sleep(0.001); clock.off()\n    latch.on()\n    input("Pattern latched. Enter to switch off LEDs. ")\n    latch.off()\n    for _ in range(8):\n        data.off(); clock.on(); time.sleep(0.001); clock.off()\n    latch.on()`):sketch(`const byte PATTERN = ${value};`, '  pinMode(11, OUTPUT); pinMode(13, OUTPUT); pinMode(10, OUTPUT);','  digitalWrite(10, LOW);\n  shiftOut(11, 13, MSBFIRST, PATTERN);\n  digitalWrite(10, HIGH);');break;
 case 'mcp3008':
  result.title='Read a potentiometer';result.goal='Turn the virtual potentiometer and watch the ADC count change.';result.parts=['MCP3008','10 kΩ potentiometer','100 nF bypass'];
  result.wires=[...spiWires(pi),row(pi?'3V3':'5V','Potentiometer outer terminal'),row('GND','Other outer terminal'),row('Potentiometer wiper','CH0 · pin 1')];
  result.setup=pi?'Enable SPI. Install adafruit-blinka and adafruit-circuitpython-mcp3xxx. Reference = 3.3 V.':'Built-in SPI library. ADC and VREF run at 5 V to match Uno SPI levels. Serial Monitor: 115200 baud.';
  result.code=pi?loopPython(`${adcPython}\nwhile True:\n    print("Voltage V:", channel.voltage, "Approx count:", round(channel.voltage / 3.3 * 1023))\n    time.sleep(0.25)`):sketch('#include <SPI.h>\nconst int CS = 10;','  pinMode(CS, OUTPUT); digitalWrite(CS, HIGH); SPI.begin();','  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));\n  digitalWrite(CS, LOW); SPI.transfer(1);\n  byte high = SPI.transfer(0x80); byte low = SPI.transfer(0);\n  digitalWrite(CS, HIGH); SPI.endTransaction();\n  int count = ((high & 3) << 8) | low;\n  Serial.print(count); Serial.print(" counts / V: "); Serial.println(count * 5.0 / 1024.0);');break;
 }
 if(!result.code)throw Error('Missing device activity');
 result.note+=' Add the listed 100 nF bypass directly across each IC supply pair.';
 return result;
}

// Outputs share the lesson's transfer functions. This is an ideal teaching model,
// not a circuit solver or a bridge to connected hardware.
export function activityReading(id,boardId,value){
 const reading=deviceReading(id,value);
 if(id==='lm358')return {value:(.02*(1+value)).toFixed(3),unit:'V output',detail:`Ideal gain ${1+value} × a 20 mV input.`};
 if(id==='mcp3008'&&boardId==='arduino-uno-r3')return {value:String(Math.min(1023,Math.floor(value/5*1024))),unit:'counts · 5 V reference',detail:'Uno activity powers the ADC and reference at 5 V. Input stays within 0–3.3 V in this exercise.'};
 if(id==='sht31')return {value:String(value),unit:'% RH',detail:'Humidity reported by the example driver.'};
 if(id==='tmp36')return {value:String(value),unit:'°C',detail:`Sensor output ${reading.value} V, converted by the host.`};
 return reading;
}

