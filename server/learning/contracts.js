import {z} from 'zod';
import {deviceIds} from '../../shared/learning/devices.js';
import {packages,boardIds} from '../../shared/learning/catalog.js';
const componentIds=[...new Set(Object.values(packages).flatMap(p=>p.board.components.map(c=>c.id)))];
export const sceneAction=z.discriminatedUnion('type',[
 z.object({type:z.literal('activity'),operation:z.enum(['open','close','reset','connections']),boardId:z.enum(boardIds).optional()}).strict(),
 z.object({type:z.literal('device-value'),value:z.number().finite().min(-100000).max(100000)}).strict(),
 z.object({type:z.literal('device'),id:z.enum(deviceIds)}).strict(),
 z.object({type:z.literal('project'),id:z.enum(['camera-lab','rover-lab'])}).strict(),
 z.object({type:z.literal('capture')}).strict(),
 z.object({type:z.literal('drive'),direction:z.enum(['forward','backward','left','right','stop'])}).strict(),
 z.object({type:z.literal('focus'),component:z.enum(componentIds)}).strict(),
 z.object({type:z.enum(['next','previous','repeat'])}).strict(),
 z.object({type:z.literal('mode'),mode:z.enum(['walkthrough','experiment'])}).strict(),
 z.object({type:z.literal('experiment'),id:z.enum(packages['raspberry-pi-5'].experiments.map(e=>e.id)),run:z.boolean().optional()}).strict(),
 z.object({type:z.enum(['run','press','sound']),value:z.boolean()}).strict(),
 z.object({type:z.literal('speed'),direction:z.enum(['faster','slower'])}).strict(),
 z.object({type:z.literal('tab'),tab:z.enum(['overview','code','pinout'])}).strict(),
 z.object({type:z.literal('camera'),view:z.enum(['home','top','under','zoom-in','zoom-out'])}).strict(),
 z.object({type:z.literal('angle'),value:z.number().min(0).max(180)}).strict(),
 z.object({type:z.literal('pitch'),value:z.number().min(100).max(2000)}).strict(),
 z.object({type:z.literal('colour'),channel:z.enum(['red','green','blue']),value:z.number().min(0).max(1)}).strict(),
 z.object({type:z.literal('board'),boardId:z.enum(boardIds)}).strict()
]);
