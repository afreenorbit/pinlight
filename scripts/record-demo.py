"""Local, explicitly requested Tracepoint demo recorder. Never captures microphone."""
import sys, pathlib, ctypes, ctypes.wintypes as w, time, threading, subprocess, wave, json
ROOT=pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.tools/recording'))
import mss, soundcard as sc, numpy as np, imageio_ffmpeg
u=ctypes.windll.user32
u.SetProcessDPIAware()
u.GetWindowTextLengthW.argtypes=[w.HWND];u.GetWindowTextLengthW.restype=ctypes.c_int
u.GetWindowTextW.argtypes=[w.HWND,w.LPWSTR,ctypes.c_int]
u.IsWindowVisible.argtypes=[w.HWND]
u.GetWindowRect.argtypes=[w.HWND,ctypes.POINTER(w.RECT)]
u.GetClassNameW.argtypes=[w.HWND,w.LPWSTR,ctypes.c_int]
u.GetForegroundWindow.restype=w.HWND
CB=ctypes.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
def title(hwnd):
    buf=ctypes.create_unicode_buffer(u.GetWindowTextLengthW(hwnd)+1);u.GetWindowTextW(hwnd,buf,len(buf));return buf.value
def rect(hwnd):
    r=w.RECT();u.GetWindowRect(hwnd,ctypes.byref(r));return r
windows=[]
@CB
def visit(hwnd,_):
    if u.IsWindowVisible(hwnd) and 'Tracepoint' in title(hwnd) and 'Edge' in title(hwnd):windows.append(hwnd)
    return True
u.EnumWindows.argtypes=[CB,w.LPARAM];u.EnumWindows(visit,0)
if not windows:raise SystemExit('Tracepoint is not the active Edge tab; no recording started.')
hwnd=windows[0];children=[]
@CB
def child(h,_):
    name=ctypes.create_unicode_buffer(256);u.GetClassNameW(h,name,256)
    if u.IsWindowVisible(h) and name.value=='Chrome_RenderWidgetHostHWND':children.append(h)
    return True
u.EnumChildWindows.argtypes=[w.HWND,CB,w.LPARAM];u.EnumChildWindows(hwnd,child,0)
if not children:raise SystemExit('Browser content region unavailable; no recording started.')
r=max((rect(h) for h in children),key=lambda r:(r.right-r.left)*(r.bottom-r.top))
region={'left':r.left,'top':r.top,'width':(r.right-r.left)//2*2,'height':(r.bottom-r.top)//2*2}
if '--check' in sys.argv:print(json.dumps(region));raise SystemExit()
out=ROOT/'output/demo';work=out/'intermediates';work.mkdir(parents=True,exist_ok=True)
stop=work/'stop';stop.unlink(missing_ok=True)
speaker=sc.default_speaker();loop=sc.get_microphone(id=speaker.id,include_loopback=True)
if not loop.isloopback:raise SystemExit('System loopback unavailable; microphone will not be used.')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();fps=15;audio=[];finished=threading.Event()
def record_audio():
    with loop.recorder(samplerate=48000,channels=2,blocksize=2400) as rec:
        while not finished.is_set():audio.append(rec.record(numframes=2400))
t=threading.Thread(target=record_audio);t.start()
p=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-pix_fmt','bgra','-s',f"{region['width']}x{region['height']}",'-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',str(work/'video.mp4')],stdin=subprocess.PIPE,stderr=(work/'encoder.log').open('w'))
start=time.perf_counter();frames=0;reason='completed'
print('Recording Tracepoint content and system playback only.',flush=True)
try:
    with mss.mss() as capture:
        while not stop.exists() and time.perf_counter()-start<180:
            if 'Tracepoint' not in title(hwnd) or u.GetForegroundWindow()!=hwnd:
                reason='Stopped because Tracepoint left the foreground';break
            p.stdin.write(capture.grab(region).bgra);frames+=1
            time.sleep(max(0,start+frames/fps-time.perf_counter()))
finally:
    finished.set();t.join(timeout=3);p.stdin.close();p.wait()
samples=np.concatenate(audio) if audio else np.zeros((1,2))
with wave.open(str(work/'audio.wav'),'wb') as wav:
    wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(48000);wav.writeframes((np.clip(samples,-1,1)*32767).astype('<i2').tobytes())
subprocess.run([ffmpeg,'-y','-i',str(work/'video.mp4'),'-i',str(work/'audio.wav'),'-c:v','copy','-c:a','aac','-shortest','-movflags','+faststart',str(out/'tracepoint-typed-demo.mp4')],stdout=subprocess.DEVNULL,stderr=(work/'mux.log').open('w'),check=True)
meta={'duration':frames/fps,'frames':frames,'audioRms':float(np.sqrt(np.mean(samples**2))),'reason':reason,'region':region,'audio':'system playback only; browser narration, not Bolna'}
(out/'recording-info.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta),flush=True)
