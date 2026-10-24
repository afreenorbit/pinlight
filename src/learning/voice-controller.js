// Turn-taking voice control. Dependencies are injectable for lifecycle tests;
// only a user gesture in VoiceControl starts the real microphone.
export function createVoiceController({Recognition,speech,Utterance,onCommand,onState,onTranscript,onError,language='en-IN',schedule=setTimeout,cancel=clearTimeout}){
 let enabled=false,busy=false,recognizer=null,timer=null,version=0,restarts=0;
 const state=s=>onState?.(s);
 const stop=()=>{enabled=false;busy=false;version++;cancel(timer);timer=null;if(recognizer){recognizer.onend=null;recognizer.onresult=null;recognizer.onerror=null;recognizer.abort();recognizer=null;}speech?.cancel();state('idle');};
 const listen=()=>{if(!enabled||busy)return;cancel(timer);const token=version;const r=new Recognition();recognizer=r;r.lang=language;r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
 r.onstart=()=>{if(enabled&&token===version)state('listening');};
 r.onresult=async e=>{if(!enabled||token!==version||busy)return;const item=e.results[e.results.length-1],text=item[0].transcript.trim();onTranscript?.(text);if(!item.isFinal)return;restarts=0;busy=true;r.onend=null;r.onresult=null;r.stop();
 if(/^(stop listening|end voice|end session|microphone off|आवाज़ बंद|सुनना बंद करो)[.!?]?$/i.test(text)){stop();return;}
 state('thinking');try{const message=await onCommand(text);if(!enabled||token!==version)return;
 if(message&&speech&&Utterance){state('speaking');const u=new Utterance(message);u.lang=language;u.rate=.98;const finish=()=>{if(enabled&&token===version){busy=false;timer=schedule(listen,350);}};u.onend=finish;u.onerror=finish;speech.cancel();speech.speak(u);}else{busy=false;timer=schedule(listen,250);}
 }catch{if(enabled&&token===version){busy=false;onError?.('That request could not finish. Please try again.');timer=schedule(listen,400);}}};
 r.onerror=e=>{if(!enabled||token!==version)return;if(['no-speech','aborted'].includes(e.error))return;onError?.(e.error==='not-allowed'?'Microphone access was denied. Allow it in the browser, then start again.':'Speech recognition is unavailable. Check the connection or use typed commands.');stop();};
 r.onend=()=>{if(enabled&&!busy&&token===version){restarts++;if(restarts>12){onError?.('Voice control paused after a long quiet period. Start again when ready.');stop();return;}timer=schedule(listen,600);}};
 try{state('starting');r.start();}catch{onError?.('This browser could not start speech recognition. Try Edge or Chrome.');stop();}};
 return {start(){if(enabled)return;enabled=true;version++;restarts=0;listen();},stop,isActive:()=>enabled};
}
