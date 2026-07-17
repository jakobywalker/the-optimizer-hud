(function(root){
"use strict";
const HABIT_STEP_FREQUENCIES=[311.13,349.23,392,466.16,523.25,622.25,783.99];
const CUSTOM_AUDIO_FILES={
 missionComplete:"assets/audio/mission-complete.wav",rewardReveal:"assets/audio/reward-reveal.wav",xpGain:"assets/audio/xp-gain.wav",levelUp:"assets/audio/level-up.wav",playerLevelUp:"assets/audio/player-level-up.wav",achievement:"assets/audio/achievement.wav",buttonConfirm:"assets/audio/confirm.wav",error:"assets/audio/error.wav",
 uiClick:"assets/audio/ui-click.wav",toggleOn:"assets/audio/toggle-on.wav",toggleOff:"assets/audio/toggle-off.wav",panelOpen:"assets/audio/panel-open.wav",panelClose:"assets/audio/panel-close.wav",taskComplete:"assets/audio/task-complete.wav",taskReopen:"assets/audio/task-reopen.wav",dailyComplete:"assets/audio/daily-complete.wav",habitStep:"assets/audio/habit-step.wav",habitDayComplete:"assets/audio/habit-day-complete.wav",questAdvance:"assets/audio/quest-advance.wav",bottleneckResolved:"assets/audio/bottleneck-resolved.wav",bottleneckReward:"assets/audio/bottleneck-reward.wav",
 gymModeEnter:"assets/audio/gym-mode-enter.wav",gymModeExit:"assets/audio/gym-mode-exit.wav",protocolMove:"assets/audio/protocol-move.wav",protocolSelected:"assets/audio/protocol-selected.wav",workoutBriefingOpen:"assets/audio/workout-briefing-open.wav",workoutStart:"assets/audio/workout-start.wav",gymSetComplete:"assets/audio/gym-set-complete.wav",gymSetEdit:"assets/audio/gym-set-edit.wav",
 restStart:"assets/audio/rest-start.wav",restThirtySeconds:"assets/audio/rest-30.wav",restTenSeconds:"assets/audio/rest-10.wav",restReady:"assets/audio/rest-ready.wav",restCancelled:"assets/audio/rest-cancelled.wav",gymExerciseComplete:"assets/audio/gym-exercise-complete.wav",exerciseSkipped:"assets/audio/exercise-skipped.wav",exerciseReordered:"assets/audio/exercise-reordered.wav",
 personalRecord:"assets/audio/personal-record.wav",scoreReveal:"assets/audio/score-reveal.wav",gradeReveal:"assets/audio/grade-reveal.wav",gymWorkoutComplete:"assets/audio/gym-workout-complete.wav",gymWorkoutAbandoned:"assets/audio/gym-workout-abandoned.wav",
 ...Object.fromEntries(Array.from({length:7},(_,index)=>[`habitStep${index+1}`,`assets/audio/habit-step-${index+1}.wav`]))
};
const SOUND_CATALOG={
 uiClick:{category:"ui",cooldown:30,duration:55},toggleOn:{category:"ui",cooldown:45,duration:95},toggleOff:{category:"ui",cooldown:45,duration:115},panelOpen:{category:"ui",cooldown:80,duration:170},panelClose:{category:"ui",cooldown:80,duration:170},buttonConfirm:{category:"ui",cooldown:45,duration:80},taskReopen:{category:"ui",cooldown:65,duration:170},error:{category:"ui",cooldown:120,duration:220},
 protocolMove:{category:"ui",cooldown:35,duration:70},gymSetEdit:{category:"ui",cooldown:80,duration:120},restCancelled:{category:"ui",cooldown:100,duration:140},exerciseSkipped:{category:"ui",cooldown:120,duration:190},exerciseReordered:{category:"ui",cooldown:80,duration:110},gymModeExit:{category:"ui",cooldown:250,duration:380},
 taskComplete:{category:"progress",cooldown:70,duration:240},dailyComplete:{category:"progress",cooldown:80,duration:300},habitStep:{category:"progress",cooldown:20,duration:280},habitDayComplete:{category:"progress",cooldown:500,duration:1050},rewardReveal:{category:"progress",cooldown:85,duration:250},xpGain:{category:"progress",cooldown:180,duration:600},questAdvance:{category:"progress",cooldown:180,duration:450},
 gymModeEnter:{category:"progress",cooldown:500,duration:700},protocolSelected:{category:"progress",cooldown:140,duration:280},workoutBriefingOpen:{category:"progress",cooldown:180,duration:420},workoutStart:{category:"progress",cooldown:500,duration:760},gymSetComplete:{category:"progress",cooldown:90,duration:220},restStart:{category:"progress",cooldown:120,duration:180},restThirtySeconds:{category:"progress",cooldown:900,duration:230},restTenSeconds:{category:"progress",cooldown:900,duration:260},restReady:{category:"progress",cooldown:500,duration:480},gymExerciseComplete:{category:"progress",cooldown:250,duration:520},personalRecord:{category:"progress",cooldown:350,duration:800},scoreReveal:{category:"progress",cooldown:350,duration:680},gymWorkoutAbandoned:{category:"progress",cooldown:600,duration:720},
 bottleneckResolved:{category:"cinematic",cooldown:1300,duration:2400},bottleneckReward:{category:"cinematic",cooldown:400,duration:800},missionComplete:{category:"cinematic",cooldown:1200,duration:2500},levelUp:{category:"cinematic",cooldown:600,duration:1500},playerLevelUp:{category:"cinematic",cooldown:900,duration:2000},achievement:{category:"cinematic",cooldown:600,duration:1400},gradeReveal:{category:"cinematic",cooldown:700,duration:1200},gymWorkoutComplete:{category:"cinematic",cooldown:1400,duration:2600}
};
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
class AudioManager{
 constructor(options={}){
  this.getSettings=options.getSettings||(()=>({enabled:true,volume:.22,uiVolume:.35,progressVolume:.65,cinematicVolume:1}));
  this.AudioContextClass=options.AudioContextClass||root.AudioContext||root.webkitAudioContext||null;
  this.AudioClass=Object.hasOwn(options,"AudioClass")?options.AudioClass:root.Audio;
  this.files={...CUSTOM_AUDIO_FILES,...(options.customFiles||{})};this.catalog={...SOUND_CATALOG,...(options.catalog||{})};
  this.context=null;this.failedFiles=new Set();this.lastPlayed=new Map();this.interactions=new Map();this.voices=[];this.maxPolyphony=Math.max(1,Number(options.maxPolyphony)||10);this.now=options.now||(()=>Date.now());
 }
 settings(){const value=this.getSettings?.()||{};return{enabled:value.enabled!==false,volume:clamp(Number.isFinite(Number(value.volume))?Number(value.volume):.22),uiVolume:clamp(Number.isFinite(Number(value.uiVolume))?Number(value.uiVolume):.35),progressVolume:clamp(Number.isFinite(Number(value.progressVolume))?Number(value.progressVolume):.65),cinematicVolume:clamp(Number.isFinite(Number(value.cinematicVolume))?Number(value.cinematicVolume):1)}}
 getContext(){if(!this.AudioContextClass)return null;if(!this.context)try{this.context=new this.AudioContextClass()}catch(error){return null}return this.context}
 async unlock(){const settings=this.settings();if(!settings.enabled)return false;const context=this.getContext();try{if(context?.state==="suspended")await context.resume();return Boolean(context)}catch(error){return false}}
 pruneVoices(now=this.now()){this.voices=this.voices.filter(end=>end>now)}
 claimVoice(duration){const now=this.now();this.pruneVoices(now);if(this.voices.length>=this.maxPolyphony)return false;this.voices.push(now+Math.max(40,Number(duration)||200));return true}
 categoryVolume(category,settings){return category==="ui"?settings.uiVolume:category==="progress"?settings.progressVolume:settings.cinematicVolume}
 async play(name,options={}){
  try{
   const definition=this.catalog[name];if(!definition)return false;
   const settings=this.settings();if(!settings.enabled||!settings.volume)return false;
   const now=this.now(),last=this.lastPlayed.get(name);if(!options.force&&last!=null&&now-last<(definition.cooldown||80))return false;
   if(options.interactionId){const handled=this.interactions.get(options.interactionId);if(handled!=null&&now-handled<400)return false;this.interactions.set(options.interactionId,now);if(this.interactions.size>100)for(const[key,time]of this.interactions)if(now-time>2000)this.interactions.delete(key)}
   if(!this.claimVoice(definition.duration))return false;this.lastPlayed.set(name,now);
   const volume=settings.volume*this.categoryVolume(definition.category,settings)*clamp(options.intensity==null?1:options.intensity);
   if(await this.playCustom(name,volume,options))return"custom";
   return await this.playSynth(name,volume,options);
  }catch(error){return false}
 }
 async tryCustom(path,key,volume,playbackRate){
  if(!path||!this.AudioClass||this.failedFiles.has(key))return false;
  try{const audio=new this.AudioClass(path);audio.preload="auto";audio.volume=clamp(volume);if(Number.isFinite(Number(playbackRate)))audio.playbackRate=clamp(playbackRate,.5,2);const cleanup=()=>{try{audio.pause?.();audio.removeAttribute?.("src");audio.load?.()}catch(error){}};audio.addEventListener?.("ended",cleanup,{once:true});audio.addEventListener?.("error",cleanup,{once:true});const result=audio.play();if(result?.then)await result;return true}catch(error){this.failedFiles.add(key);return false}
 }
 async playCustom(name,volume,options={}){
  if(name==="habitStep"){
   const step=Math.max(1,Math.min(7,Math.round(Number(options.step)||1))),specificKey=`habitStep${step}`;
   if(await this.tryCustom(this.files[specificKey],specificKey,volume,options.playbackRate))return true;
   const rate=Number(options.playbackRate)||HABIT_STEP_FREQUENCIES[step-1]/HABIT_STEP_FREQUENCIES[0];
   return this.tryCustom(this.files.habitStep,"habitStep",volume,rate)
  }
  return this.tryCustom(this.files[name],name,volume,options.playbackRate)
 }
 async playSynth(name,volume,options={}){const context=this.getContext();if(!context)return false;try{if(context.state==="suspended")await context.resume();const at=context.currentTime+.005;this.synthesize(name,at,volume,options);return"synth"}catch(error){return false}}
 tone(frequency,start,duration,type,volume,frequencyEnd){
  const context=this.context,oscillator=context.createOscillator(),gain=context.createGain(),end=start+duration;oscillator.type=type||"sine";oscillator.frequency.setValueAtTime(Math.max(20,frequency),start);if(frequencyEnd)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,frequencyEnd),end);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+Math.min(.03,duration*.25));gain.gain.exponentialRampToValueAtTime(.0001,end);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{oscillator.disconnect?.();gain.disconnect?.()};oscillator.start(start);oscillator.stop(end+.02)
 }
 noise(start,duration,volume,high=700,low=180){
  const context=this.context;if(!context.createBuffer||!context.createBufferSource)return;const length=Math.max(1,Math.floor(context.sampleRate*duration)),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type="lowpass";filter.frequency.setValueAtTime(high,start);filter.frequency.exponentialRampToValueAtTime(low,start+duration);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.05);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.onended=()=>{source.disconnect?.();filter.disconnect?.();gain.disconnect?.()};source.start(start);source.stop(start+duration+.02)
 }
 synthesize(name,at,volume,options={}){
  const v=Math.max(.0005,volume);
  if(name==="uiClick"){this.tone(430,at,.05,"triangle",v*.055,390);return}
  if(name==="buttonConfirm"){this.tone(520,at,.07,"sine",v*.11,610);return}
  if(name==="toggleOn"){this.tone(410,at,.09,"triangle",v*.075,610);return}
  if(name==="toggleOff"){this.tone(410,at,.11,"sine",v*.06,255);return}
  if(name==="panelOpen"){this.tone(260,at,.16,"sine",v*.055,480);return}
  if(name==="panelClose"){this.tone(470,at,.16,"sine",v*.05,245);return}
  if(name==="taskComplete"){this.tone(520,at,.11,"triangle",v*.1);this.tone(660,at+.095,.15,"sine",v*.11);return}
  if(name==="taskReopen"){this.tone(390,at,.16,"sine",v*.065,285);return}
  if(name==="dailyComplete"){this.tone(392,at,.16,"triangle",v*.08);this.tone(523.25,at+.1,.2,"sine",v*.1);return}
  if(name==="habitStep"){const step=Math.max(1,Math.min(7,Math.round(Number(options.step)||1))),frequency=Number(options.frequency)||HABIT_STEP_FREQUENCIES[step-1];this.tone(frequency,at,.24,step===7?"sine":"triangle",v*(step===7?.12:.085));return}
  if(name==="habitDayComplete"){[311.13,392,466.16,622.25].forEach((f,i)=>this.tone(f,at+i*.09,.58,"sine",v*(i===3?.12:.07)));this.noise(at+.1,.65,v*.012,1800,500);return}
  if(name==="questAdvance"){[220,330,440].forEach((f,i)=>this.tone(f,at+i*.1,.22,"triangle",v*.085,f*1.08));return}
  if(name==="rewardReveal"){this.tone(620,at,.1,"triangle",v*.12);this.tone(790,at+.095,.14,"triangle",v*.11);return}
  if(name==="xpGain"){[420,500,590,700].forEach((f,i)=>this.tone(f,at+i*.075,.13,"sine",v*.09));return}
  if(name==="bottleneckReward"){[247,330,415,554].forEach((f,i)=>this.tone(f,at+i*.12,.32,"triangle",v*(i===3?.14:.09)));return}
  if(name==="bottleneckResolved"){this.tone(58,at,.55,"sine",v*.2,78);this.noise(at+.08,.7,v*.04,950,120);[196,247,294,392].forEach((f,i)=>this.tone(f,at+.55+i*.18,i===3?.85:.4,i===3?"sine":"triangle",v*(i===3?.17:.1)));return}
  if(name==="levelUp"){[330,440,554,659].forEach((f,i)=>this.tone(f,at+i*.16,i===3?"sine":"triangle",v*(i===3?.19:.11),i===3?720:null));return}
  if(name==="playerLevelUp"){this.tone(82,at,.42,"sine",v*.21,110);[220,330,440,660].forEach((f,i)=>this.tone(f,at+.25+i*.2,i===3?.75:.3,i===3?"sine":"triangle",v*(i===3?.21:.11)));return}
  if(name==="achievement"){[494,622,740].forEach((f,i)=>this.tone(f,at+i*.22,i===2?.6:.26,"sine",v*(i===2?.17:.1)));return}
  if(["protocolMove","gymSetEdit","restCancelled","exerciseSkipped","exerciseReordered","gymModeExit"].includes(name)){const down=["restCancelled","exerciseSkipped","gymModeExit"].includes(name);this.tone(down?390:470,at,.12,"triangle",v*.07,down?220:610);return}
  if(["protocolSelected","workoutBriefingOpen","gymSetComplete","restStart","restThirtySeconds","restTenSeconds","restReady","gymExerciseComplete","personalRecord","scoreReveal","gymWorkoutAbandoned"].includes(name)){const index=["protocolSelected","workoutBriefingOpen","gymSetComplete","restStart","restThirtySeconds","restTenSeconds","restReady","gymExerciseComplete","personalRecord","scoreReveal","gymWorkoutAbandoned"].indexOf(name),base=260+index*24,down=name==="gymWorkoutAbandoned";this.tone(base,at,.15,"triangle",v*.09,down?150:base*1.28);if(["personalRecord","scoreReveal","gymExerciseComplete","restReady"].includes(name))this.tone(base*1.5,at+.1,.25,"sine",v*.1);return}
  if(name==="gymModeEnter"||name==="workoutStart"){this.tone(72,at,.45,"sine",v*.16,104);[220,330,440].forEach((f,i)=>this.tone(f,at+.18+i*.12,.32,"triangle",v*.09));return}
  if(name==="gradeReveal"){[330,440,554,740].forEach((f,i)=>this.tone(f,at+i*.16,i===3?.65:.24,"sine",v*(i===3?.18:.1)));return}
  if(name==="gymWorkoutComplete"){this.tone(62,at,1.1,"sine",v*.19,96);this.noise(at+.1,.7,v*.025,1200,160);[196,294,392,587].forEach((f,i)=>this.tone(f,at+.58+i*.19,i===3?.9:.4,i===3?"sine":"triangle",v*(i===3?.2:.1)));return}
  if(name==="error"){this.tone(135,at,.19,"square",v*.04,112);return}
  if(name==="missionComplete"){this.tone(68,at,1.2,"sine",v*.17,92);this.noise(at+.12,.8,v*.03);this.tone(196,at+.72,1.1,"triangle",v*.1);this.tone(247,at+.82,1.25,"sine",v*.11);this.tone(294,at+.94,1.35,"sine",v*.09)}
 }
}
root.OptimizerAudio={AudioManager,CUSTOM_AUDIO_FILES,SOUND_CATALOG,HABIT_STEP_FREQUENCIES};
})(typeof window!=="undefined"?window:globalThis);