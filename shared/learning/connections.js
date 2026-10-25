import {getPackage} from './catalog.js';
// Coordinates are in the existing board model's local frame. All project routes
// use these same named sockets and header positions, never screen coordinates.
export const piCameraSockets={cam0:{origin:[.8,0,1.7],contact:[.92,.30,1.7]},cam1:{origin:[1.65,0,1.7],contact:[1.77,.30,1.7]}};
export function boardAnchor(boardId,name){
 if(boardId==='raspberry-pi-5'&&piCameraSockets[name])return [...piCameraSockets[name].contact];
 const pins=getPackage(boardId).pins;
 const pin=boardId==='raspberry-pi-5'?pins.find(p=>String(p.physical)===name.replace('pin:','')):pins.find(p=>String(p.physical)===name);
 if(!pin)throw Error(`Unknown ${boardId} anchor: ${name}`);
 return [...pin.position];
}
export const cameraSignals=[{pin:'D7',name:'CS',color:'#c59e49'},{pin:'D11',name:'MOSI',color:'#c56b4d'},{pin:'D12',name:'MISO',color:'#6598a4'},{pin:'D13',name:'SCK',color:'#9872ac'},{pin:'A4',name:'SDA',color:'#5e9b67'},{pin:'A5',name:'SCL',color:'#c6b26d'}];
export const roverSignals={
 'raspberry-pi-5':[{pin:'11',name:'AIN1'},{pin:'13',name:'AIN2'},{pin:'15',name:'PWMA'},{pin:'16',name:'BIN1'},{pin:'18',name:'BIN2'},{pin:'22',name:'PWMB'},{pin:'29',name:'STBY'},{pin:'1',name:'VCC'},{pin:'6',name:'GND'}],
 'arduino-uno-r3':[{pin:'D4',name:'AIN1'},{pin:'D3',name:'AIN2'},{pin:'D5',name:'PWMA'},{pin:'D7',name:'BIN1'},{pin:'D8',name:'BIN2'},{pin:'D6',name:'PWMB'},{pin:'D9',name:'STBY'},{pin:'5V',name:'VCC'},{pin:'GND',name:'GND'}]
};
