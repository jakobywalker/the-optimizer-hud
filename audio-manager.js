(function(root){
"use strict";
const CUSTOM_AUDIO_FILES={
 missionComplete:"assets/audio/mission-complete.wav",
 rewardReveal:"assets/audio/reward-reveal.wav",
 xpGain:"assets/audio/xp-gain.wav",
 levelUp:"assets/audio/level-up.wav",
 playerLevelUp:"assets/audio/player-level-up.wav",
 achievement:"assets/audio/achievement.wav",
 buttonConfirm:"assets/audio/confirm.wav",
 error:"assets/audio/error.wav"
};
const COOLDOWNS={missionComplete:1200,rewardReveal:90,xpGain:220,levelUp:600,playerLevelUp:900,achievement:600,buttonConfirm:45,error:120};
class AudioManager{
 constructor(options={}){
  this.getSettings=options.getSettings||(()=>({enabled:true,volume:.22}));
  this.AudioContextClass=options.AudioContextClass||root.AudioContext||root.webkitAudioContext||null;
  this.AudioClass=Object.hasOwn(options,"AudioClass")?options.AudioClass:root.Audio;
  this.files={...CUSTOM_AUDIO_FILES,...(options.customFiles||{})};
  this.context=null;this.failedFiles=new Set();this.lastPlayed=new Map();this.now=options.now||(()=>Date.now());
 }
 settings(){const value=this.getSettings?.()||{};return{enabled:value.enabled!==false,volume:Math.max(0,Math.min(1,Number.isFinite(Number(value.volume))?Number(value.volume):.22))}}
 getContext(){
  if(!this.AudioContextClass)return null;
  if(!this.context)try{this.context=new this.AudioContextClass()}catch(error){return null}
  return this.context;
 }
 async unlock(){const context=this.getContext();try{if(context?.state==="suspended")await context.resume();return Boolean(context)}catch(error){return false}}
 async play(name,options={}){
  try{
   const settings=this.settings();if(!settings.enabled||!settings.volume)return false;
   const now=this.now(),last=this.lastPlayed.get(name)||0;if(!options.force&&now-last<(COOLDOWNS[name]||80))return false;this.lastPlayed.set(name,now);
   const volume=settings.volume*Math.max(0,Math.min(1,Number(options.intensity)||1));
   if(await this.playCustom(name,volume))return"custom";
   return await this.playSynth(name,volume);
  }catch(error){return false}
 }
 async playCustom(name,volume){
  const path=this.files[name];if(!path||!this.AudioClass||this.failedFiles.has(name))return false;
  try{
   const audio=new this.AudioClass(path);audio.preload="auto";audio.volume=Math.max(0,Math.min(1,volume));const result=audio.play();if(result?.then)await result;return true
  }catch(error){this.failedFiles.add(name);return false}
 }
 async playSynth(name,volume){
  const context=this.getContext();if(!context)return false;
  try{if(context.state==="suspended")await context.resume();const at=context.currentTime+.005;this.synthesize(name,at,volume);return"synth"}catch(error){return false}
 }
 tone(frequency,start,duration,type,volume,frequencyEnd){
  const context=this.context,oscillator=context.createOscillator(),gain=context.createGain(),end=start+duration;
  oscillator.type=type||"sine";oscillator.frequency.setValueAtTime(Math.max(20,frequency),start);
  if(frequencyEnd)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,frequencyEnd),end);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+Math.min(.03,duration*.25));gain.gain.exponentialRampToValueAtTime(.0001,end);
  oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(end+.02);
 }
 noise(start,duration,volume){
  const context=this.context;if(!context.createBuffer||!context.createBufferSource)return;
  const length=Math.max(1,Math.floor(context.sampleRate*duration)),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type="lowpass";filter.frequency.setValueAtTime(700,start);filter.frequency.exponentialRampToValueAtTime(180,start+duration);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.08);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start(start);source.stop(start+duration+.02);
 }
 synthesize(name,at,volume){
  const v=Math.max(.0005,volume);
  if(name==="buttonConfirm"){this.tone(520,at,.065,"sine",v*.12,610);return}
  if(name==="rewardReveal"){this.tone(620,at,.1,"triangle",v*.13);this.tone(790,at+.095,.14,"triangle",v*.12);return}
  if(name==="xpGain"){[420,500,590,700].forEach((f,i)=>this.tone(f,at+i*.075,.13,"sine",v*.1));return}
  if(name==="levelUp"){[330,440,554,659].forEach((f,i)=>this.tone(f,at+i*.16,i===3?"sine":"triangle",v*(i===3?.2:.12),i===3?720:null));return}
  if(name==="playerLevelUp"){this.tone(82,at,.42,"sine",v*.22,110);[220,330,440,660].forEach((f,i)=>this.tone(f,at+.25+i*.2,i===3?.75:.3,i===3?"sine":"triangle",v*(i===3?.22:.12)));return}
  if(name==="achievement"){[494,622,740].forEach((f,i)=>this.tone(f,at+i*.22,i===2?.6:.26,"sine",v*(i===2?.18:.11)));return}
  if(name==="error"){this.tone(135,at,.19,"square",v*.045,112);return}
  this.tone(68,at,1.2,"sine",v*.18,92);this.noise(at+.12,.8,v*.035);this.tone(196,at+.72,1.1,"triangle",v*.11);this.tone(247,at+.82,1.25,"sine",v*.12);this.tone(294,at+.94,1.35,"sine",v*.1);
 }
}
root.OptimizerAudio={AudioManager,CUSTOM_AUDIO_FILES};
})(typeof window!=="undefined"?window:globalThis);
