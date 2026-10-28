import {HugeiconsIcon} from '@hugeicons/react';
// Subpath imports keep the complete free icon catalogue out of the dependency scan.
import ArrowRight from '@hugeicons/core-free-icons/ArrowRight02Icon';
import ArrowLeft from '@hugeicons/core-free-icons/ArrowLeft02Icon';
import ArrowUpRight from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import ArrowDown from '@hugeicons/core-free-icons/ArrowDown02Icon';
import File from '@hugeicons/core-free-icons/File01Icon';
import Mic from '@hugeicons/core-free-icons/Mic01Icon';
import Check from '@hugeicons/core-free-icons/Tick02Icon';
import Layers from '@hugeicons/core-free-icons/Layers01Icon';
import Target from '@hugeicons/core-free-icons/Target01Icon';
import Plus from '@hugeicons/core-free-icons/Add01Icon';
import Settings from '@hugeicons/core-free-icons/Settings01Icon';
import Close from '@hugeicons/core-free-icons/Cancel01Icon';
import Play from '@hugeicons/core-free-icons/PlayIcon';
import Pause from '@hugeicons/core-free-icons/PauseIcon';
import Code from '@hugeicons/core-free-icons/CodeIcon';
import Bulb from '@hugeicons/core-free-icons/BulbIcon';
import Button from '@hugeicons/core-free-icons/RadioButtonIcon';
import Colour from '@hugeicons/core-free-icons/ColorsIcon';
import Music from '@hugeicons/core-free-icons/MusicNote03Icon';
import Rotate from '@hugeicons/core-free-icons/RotateRight01Icon';
import Upload from '@hugeicons/core-free-icons/Upload04Icon';
import Search from '@hugeicons/core-free-icons/Search01Icon';

import Camera from '@hugeicons/core-free-icons/Camera01Icon';
import Chip from '@hugeicons/core-free-icons/CpuIcon';

import Robot from '@hugeicons/core-free-icons/Robot01Icon';
import ZoomIn from '@hugeicons/core-free-icons/ZoomInAreaIcon';
import ZoomOut from '@hugeicons/core-free-icons/ZoomOutAreaIcon';
import Download from '@hugeicons/core-free-icons/Download04Icon';
import SidebarLeft from '@hugeicons/core-free-icons/SidebarLeftIcon';
import Github from '@hugeicons/core-free-icons/Github01Icon';
const icons={github:Github,sidebar:SidebarLeft,rotate:Rotate,camera:Camera,chip:Chip,sensor:Target,rover:Robot,zoomIn:ZoomIn,zoomOut:ZoomOut,download:Download,arrow:ArrowRight,left:ArrowLeft,diagonal:ArrowUpRight,down:ArrowDown,file:File,mic:Mic,check:Check,layers:Layers,target:Target,plus:Plus,settings:Settings,close:Close,play:Play,pause:Pause,code:Code,led:Bulb,button:Button,rgb:Colour,buzzer:Music,servo:Rotate,upload:Upload,search:Search};
export default function Icon({name='arrow',size=20,className='',...props}){
 return <HugeiconsIcon icon={icons[name]||ArrowRight} size={size} color="currentColor" strokeWidth={1.6} aria-hidden="true" focusable="false" className={`ui-icon ${className}`.trim()} {...props}/>;
}
