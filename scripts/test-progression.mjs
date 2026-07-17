import assert from "node:assert/strict";
import "../progression-engine.js";
import "../audio-manager.js";
import "../engagement-engine.js";
import "../hud-core.js";

const core=globalThis.OptimizerHudCore;
const {AudioManager}=globalThis.OptimizerAudio;
const tests=[];
const test=(name,run)=>tests.push({name,run});
const copy=value=>JSON.parse(JSON.stringify(value));
const ids=prefix=>{let n=0;return()=>`${prefix}-${++n}`};

function legacy(missions){
 return{
  player:{level:27,xp:4250,xpGoal:7500},
  top:{Energy:42,Clarity:68,Momentum:53,Alignment:44},
  character:[["E","Execution Consistency",52],["H","Environment Alignment",44],["I","Income Stability",40]],
  resources:[],skills:[["Fitness",68],["Optimization",92],["Sales / Persuasion",82]],
  missions:missions||[{name:"Restore Home Base",tasks:[["First",false],["Final",false]]}],
  quest:{title:"Quest",stages:[]},bottleneck:{title:"B",items:[]},buffs:[],activeDebuffs:[],
  daily:{date:"2026-07-17",night:[],morning:[],priorities:[]},habits:{week:"2026-07-13",names:[],values:[]},
  base:[],party:[],money:{balance:0,range:"30",history:[{id:"opening",ts:"2026-07-17T10:00:00.000Z",delta:0,balance:0,note:"Opening",type:"set"}]}
 }
}
function migrated(prefix="id",missions){
 const source=legacy(missions);
 return core.migrateState(source,source,{idFactory:ids(prefix),now:"2026-07-17T12:00:00.000Z"})
}
function complete(state,missionIndex=0,prefix="claim",now="2026-07-17T13:00:00.000Z"){
 const mission=state.missions[missionIndex];mission.tasks.forEach(task=>task.completed=true);
 return core.completeMission(state,mission.id,{idFactory:ids(prefix),now})
}

test("44 XP plus 65 XP gains one level with 9 XP remaining",()=>{
 const track={id:"alignment",name:"Alignment",type:"coreStat",level:4,xp:44,xpRequired:100};
 const result=core.applyProgressionXp(track,65);
 assert.deepEqual([result.levelsGained,track.level,track.xp],[1,5,9])
});
test("80 XP plus 240 XP gains three levels with 20 XP remaining",()=>{
 const track={level:4,xp:80,xpRequired:100};
 const result=core.applyProgressionXp(track,240);
 assert.deepEqual([result.previousLevel,result.previousXp,result.levelsGained,result.newLevel,result.newXp],[4,80,3,7,20])
});
test("exact 100 XP boundary levels cleanly",()=>{
 const track={level:2,xp:40};core.applyProgressionXp(track,60);assert.deepEqual([track.level,track.xp],[3,0])
});
test("zero XP is a valid no-op",()=>{
 const track={level:2,xp:40};const result=core.applyProgressionXp(track,0);assert.deepEqual([result.levelsGained,track.level,track.xp],[0,2,40])
});
test("negative XP is rejected",()=>assert.throws(()=>core.applyProgressionXp({level:1,xp:0},-1),/Progression XP/));
test("very large rewards use bounded checkpoints and preserve overflow",()=>{
 const track={level:1,xp:99};const result=core.applyProgressionXp(track,1000000000);assert.equal(track.level,10000001);assert.equal(track.xp,99);assert.ok(result.checkpoints.length<=101)
});
test("old percentages migrate to level one XP without losing condition values",()=>{
 const state=migrated();assert.deepEqual([state.progression.tracks.alignment.level,state.progression.tracks.alignment.xp,state.top.find(x=>x.name==="Alignment").value],[1,44,44])
});
test("legacy player level is preserved and old goal becomes a percentage",()=>{
 const state=migrated();assert.deepEqual([state.player.level,state.player.xp,state.player.xpRequired],[27,57,100])
});
test("schema v4 migration is idempotent",()=>{
 const first=migrated("first"),second=core.migrateState(copy(first),legacy(),{idFactory:ids("second"),now:"2026-07-17T12:30:00.000Z"});
 assert.deepEqual(second.progression,first.progression);assert.equal(second.player.xp,57);assert.equal(second.missions[0].id,first.missions[0].id)
});
test("malformed optional progression data falls back safely",()=>{
 const input=legacy();input.progression={tracks:{alignment:{level:"bad",xp:-500}}};input.rewardTransactions=[null,{id:"broken"}];
 const state=core.migrateState(input,input,{idFactory:ids("malformed"),now:"2026-07-17T12:00:00.000Z"});assert.equal(state.progression.tracks.alignment.level,1);assert.equal(state.progression.tracks.alignment.xp,0)
});
test("legacy reward text becomes structured without crashing",()=>{
 const state=migrated("legacy",[{name:"Custom Mission",reward:"Confidence",tasks:[["One",false]]}]);assert.equal(state.missions[0].rewards.playerXp,25);assert.equal(state.missions[0].rewards.legacyLabel,"Confidence")
});
test("base missions receive the requested structured defaults",()=>{
 const state=migrated();const rewards=state.missions[0].rewards;assert.equal(rewards.playerXp,50);assert.deepEqual(rewards.progression.map(x=>[x.targetId,x.amount]),[["alignment",65],["clarity",40],["environment-alignment",55]])
});
test("an incomplete mission cannot claim rewards",()=>{
 const state=migrated();const result=core.completeMission(state,state.missions[0].id,{idFactory:ids("incomplete")});assert.equal(result.applied,false);assert.equal(state.rewardTransactions.length,0);assert.equal(state.events.filter(event=>event.type==="mission-completed").length,0)
});
test("the final completion claims once and creates one achievement",()=>{
 const state=migrated();const result=complete(state);assert.equal(result.applied,true);assert.equal(state.rewardTransactions.length,1);assert.equal(state.earnedAchievements.length,1);assert.ok(result.transaction.mission);assert.equal(result.transaction.status,"applied")
});
test("refresh migration never reapplies a completed mission",()=>{
 const state=migrated();complete(state);const loaded=core.migrateState(copy(state),legacy(),{idFactory:ids("reload"),now:"2026-07-17T14:00:00.000Z"});assert.equal(loaded.rewardTransactions.length,1);assert.equal(loaded.earnedAchievements.length,1)
});
test("uncheck and recheck cannot farm XP",()=>{
 const state=migrated(),mission=state.missions[0];complete(state);const after=copy(state.player);mission.tasks[0].completed=false;mission.status="active";mission.tasks[0].completed=true;const result=core.completeMission(state,mission.id,{idFactory:ids("again"),now:"2026-07-17T14:00:00.000Z"});assert.equal(result.applied,false);assert.deepEqual(state.player,after);assert.equal(state.rewardTransactions.length,1)
});
test("replay is read-only and returns the recorded transaction",()=>{
 const state=migrated();complete(state);const before=JSON.stringify(state),transaction=core.replayMission(state,state.missions[0].id);assert.equal(transaction.type,"mission-completion");assert.equal(JSON.stringify(state),before)
});
test("an imported legacy-completed mission is treated as already claimed",()=>{
 const state=migrated("imported",[{name:"Restore Home Base",tasks:[["One",true]]}]),mission=state.missions[0];const result=core.completeMission(state,mission.id,{idFactory:ids("no-award")});assert.equal(result.applied,false);assert.equal(state.rewardTransactions.length,0);assert.ok(mission.rewardClaimedAt)
});
test("an invalid target is skipped while valid rewards still apply",()=>{
 const state=migrated("targets",[{name:"Mixed",rewards:{playerXp:10,progression:[{targetType:"coreStat",targetId:"alignment",amount:5},{targetType:"skill",targetId:"missing",amount:10}]},tasks:[["One",false]]}]);const result=complete(state,0,"mixed");assert.equal(result.applied,true);assert.equal(result.diagnostics.length,1);assert.equal(state.player.xp,67);assert.equal(state.progression.tracks.alignment.xp,49)
});
test("different mission instances each grant rewards",()=>{
 const state=migrated("different",[{name:"A",rewards:{playerXp:10,progression:[]},tasks:[["One",false]]},{name:"B",rewards:{playerXp:20,progression:[]},tasks:[["One",false]]}]);complete(state,0,"a","2026-07-17T13:00:00Z");complete(state,1,"b","2026-07-17T13:01:00Z");assert.equal(state.rewardTransactions.length,2);assert.equal(state.earnedAchievements.length,2);assert.equal(state.player.xp,87)
});
test("duplicate device claims merge to one canonical transaction",()=>{
 const base=migrated("cloud"),local=copy(base),remote=copy(base);complete(local,0,"local","2026-07-17T13:00:00Z");complete(remote,0,"remote","2026-07-17T13:00:01Z");local.meta.updatedAt="2026-07-17T13:00:02Z";remote.meta.updatedAt="2026-07-17T13:00:03Z";const merged=core.mergeCloudState(local,remote);assert.equal(merged.rewardTransactions.length,1);assert.equal(merged.earnedAchievements.length,1);assert.deepEqual([merged.progression.tracks.alignment.level,merged.progression.tracks.alignment.xp],[2,9])
});
test("manual and AI-style adjustments use transaction idempotency",()=>{
 const state=migrated(),adjustment={id:"adjust-1",idempotencyKey:"ai:update-1:op-1",sourceType:"ai-update",sourceId:"update-1",sourceName:"Review",progression:[{targetType:"coreStat",targetId:"momentum",amount:15}]};const first=core.createManualAdjustment(state,adjustment),second=core.createManualAdjustment(state,adjustment);assert.equal(first.applied,true);assert.equal(second.applied,false);assert.equal(state.rewardTransactions.length,1);assert.equal(state.progression.tracks.momentum.xp,68)
});
test("AI update validation accepts additive progression and mission reward edits",()=>{
 const state=migrated();state.meta.lastHandoffId="handoff-1";const patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"progression-update",baseExportId:"handoff-1",operations:[{id:"xp",operation:"add",entityType:"progression",entityId:"alignment",value:{amount:10}},{id:"reward",operation:"update",entityType:"missionReward",entityId:state.missions[0].id,value:{playerXp:60,progression:[]}}]};const validation=core.validateAiUpdate(state,patch);assert.equal(validation.valid.length,2);core.applyAiUpdate(state,validation);assert.equal(state.progression.tracks.alignment.xp,54);assert.equal(state.missions[0].rewards.playerXp,60)
});
test("AI progression validation rejects fractional and oversized XP",()=>{
 const state=migrated();state.meta.lastHandoffId="handoff-1";const patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"bad-xp",baseExportId:"handoff-1",operations:[{id:"fraction",operation:"add",entityType:"progression",entityId:"alignment",value:{amount:1.5}},{id:"huge",operation:"add",entityType:"progression",entityId:"alignment",value:{amount:1000000001}}]};const validation=core.validateAiUpdate(state,patch);assert.equal(validation.valid.length,0);assert.equal(validation.unresolved.length,2)
});
test("AI-created missions receive complete progression metadata",()=>{
 const state=migrated();state.meta.lastHandoffId="handoff-1";const patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"new-mission",baseExportId:"handoff-1",operations:[{id:"mission",operation:"add",entityType:"mission",entityId:"ai-mission",value:{id:"ai-mission",name:"AI Mission",tasks:[{id:"ai-task",name:"Finish it"}],rewards:{playerXp:15,progression:[]}}}]};const validation=core.validateAiUpdate(state,patch);core.applyAiUpdate(state,validation,undefined,{idFactory:ids("ai-mission"),now:"2026-07-17T15:00:00Z"});const mission=state.missions.find(item=>item.id==="ai-mission");assert.equal(mission.classification,"General");assert.equal(mission.impact,"Standard");assert.equal(mission.rewardVersion,1);assert.equal(mission.tasks[0].completed,false)
});
test("AI final-task completion grants mission rewards exactly once",()=>{
 const state=migrated("ai-claim",[{name:"AI Claim",rewards:{playerXp:10,progression:[]},tasks:[["Final",false]]}]);state.meta.lastHandoffId="handoff-1";const mission=state.missions[0],operation={id:"finish",operation:"complete",entityType:"missionTask",entityId:mission.tasks[0].id};for(const updateId of ["finish-one","finish-two"]){const patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId,baseExportId:"handoff-1",operations:[operation]};core.applyAiUpdate(state,core.validateAiUpdate(state,patch),undefined,{idFactory:ids(updateId),now:"2026-07-17T16:00:00Z"})}assert.equal(state.rewardTransactions.length,1);assert.equal(state.player.xp,67);assert.equal(mission.status,"completed");assert.equal(state.events.find(event=>event.type==="mission-completed").source,"ai");assert.equal(state.events.filter(event=>event.type==="mission-completed").length,1)
});test("presentation queue serializes simultaneous completions",async()=>{
 const order=[],queue=new core.PresentationQueue(async value=>{order.push(`start-${value}`);await Promise.resolve();order.push(`end-${value}`)});await Promise.all([queue.enqueue(1),queue.enqueue(2),queue.enqueue(3)]);assert.deepEqual(order,["start-1","end-1","start-2","end-2","start-3","end-3"]);assert.equal(queue.size,0)
});
test("disabled sound creates no audio context",async()=>{
 let contexts=0;class Context{constructor(){contexts++}}const manager=new AudioManager({AudioContextClass:Context,AudioClass:null,getSettings:()=>({enabled:false,volume:1}),now:()=>1000});assert.equal(await manager.play("levelUp",{force:true}),false);assert.equal(contexts,0)
});
test("missing custom audio falls back to synthesized audio",async()=>{
 let oscillators=0;class MissingAudio{play(){return Promise.reject(new Error("missing"))}}class Param{setValueAtTime(){} exponentialRampToValueAtTime(){}}class Node{constructor(){this.frequency=new Param();this.gain=new Param()}connect(){}start(){}stop(){}}class Context{constructor(){this.state="running";this.currentTime=0;this.destination={};this.sampleRate=1000}createOscillator(){oscillators++;return new Node()}createGain(){return new Node()}createBuffer(){return{getChannelData:()=>new Float32Array(1000)}}createBufferSource(){return new Node()}createBiquadFilter(){const node=new Node();node.frequency=new Param();return node}resume(){return Promise.resolve()}}const manager=new AudioManager({AudioContextClass:Context,AudioClass:MissingAudio,getSettings:()=>({enabled:true,volume:.2}),now:()=>1000});assert.equal(await manager.play("rewardReveal",{force:true}),"synth");assert.ok(oscillators>=2)
});
test("audio failure never interrupts application flow",async()=>{
 class BrokenContext{constructor(){throw new Error("blocked")}}const manager=new AudioManager({AudioContextClass:BrokenContext,AudioClass:null,getSettings:()=>({enabled:true,volume:.2}),now:()=>1000});assert.equal(await manager.play("missionComplete",{force:true}),false)
});

let passed=0;
for(const{name,run}of tests){try{await run();passed++;console.log(`PASS ${name}`)}catch(error){console.error(`FAIL ${name}`);throw error}}
console.log(`Progression tests passed: ${passed}/${tests.length}.`);
