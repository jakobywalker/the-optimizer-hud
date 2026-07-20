import assert from "node:assert/strict";
import "../progression-engine.js";
import "../audio-manager.js";
import "../engagement-engine.js";
import "../gym-engine.js";
import "../grind-engine.js";
import "../hud-core.js";

const core=globalThis.OptimizerHudCore;
const engagement=globalThis.OptimizerEngagementEngine;
const {AudioManager,SOUND_CATALOG,HABIT_STEP_FREQUENCIES}=globalThis.OptimizerAudio;
const tests=[];
const test=(name,run)=>tests.push({name,run});
const copy=value=>JSON.parse(JSON.stringify(value));
const ids=prefix=>{let value=0;return()=>prefix+"-"+(++value)};

function legacy(options={}){
 const names=options.habitNames||core.HABIT_DEFINITIONS.map(item=>item.name);
 const values=options.habitValues||names.map(()=>Array(7).fill(false));
 return{
  player:{level:4,xp:20,xpGoal:100},
  top:{Energy:42,Clarity:68,Momentum:53,Alignment:44,Capacity:40,Leverage:30},
  character:[],resources:[],skills:[["Fitness",68],["Music Creation",88]],
  missions:[],quest:{title:"Quest",stages:[]},
  bottleneck:{title:"Current Bottleneck",sub:"Remove friction",items:options.bottlenecks||[["Broken workflow","Costs focus"]]},
  buffs:[],activeDebuffs:[],daily:{date:"2026-07-17",night:[],morning:[],priorities:[]},
  habits:{week:"2026-07-13",names,values},base:[],party:[],
  money:{balance:0,range:"30",history:[{id:"opening",ts:"2026-07-17T10:00:00.000Z",delta:0,balance:0,note:"Opening",type:"set"}]}
 }
}
function migrated(prefix="engagement",options={}){
 const source=legacy(options);return core.migrateState(source,source,{idFactory:ids(prefix),now:"2026-07-17T12:00:00.000Z"})
}
function checkHabit(state,id,column=0,prefix="habit"){
 const habit=state.habits.items.find(item=>item.id===id),before=habit.values[column];habit.values[column]=true;
 return core.completeHabit(state,id,column,{idFactory:ids(prefix),now:"2026-07-17T13:00:00.000Z",transitioned:!before,previousValue:before})
}

test("schema v6 installs the seven standard habits and preserves custom history",()=>{
 const names=["Gym / Train","My Custom Habit"],values=[[true,false,false,false,false,false,false],[false,true,false,false,false,false,false]],state=migrated("migration",{habitNames:names,habitValues:values});
 assert.deepEqual(state.habits.items.slice(0,7).map(item=>item.id),core.HABIT_IDS);
 assert.equal(state.habits.items.find(item=>item.name==="Gym / Train").values[0],true);
 assert.equal(state.habits.items.find(item=>item.name==="My Custom Habit").values[1],true);
 assert.equal(state.meta.schemaVersion,6)
});

test("standard habit rewards match the progression contract",()=>{
 const byId=Object.fromEntries(core.HABIT_DEFINITIONS.map(item=>[item.id,item.rewards]));
 assert.deepEqual(byId["gym-train"].progression.map(item=>[item.targetId,item.amount]),[["fitness",5],["energy",2]]);
 assert.deepEqual(byId["content-released"].progression.map(item=>[item.targetId,item.amount]),[["leverage",6],["music-creation",4],["momentum",2]])
});

test("legacy checked cells are marked without fabricated transactions",()=>{
 const values=core.HABIT_DEFINITIONS.map(()=>Array(7).fill(false));values[0][0]=true;const state=migrated("legacy-cell",{habitValues:values}),habit=state.habits.items.find(item=>item.id==="gym-train");
 assert.equal(state.rewardTransactions.length,0);assert.ok(state.rewardClaims.some(claim=>claim.idempotencyKey==="habit:gym-train:2026-07-13:reward-v1"));
 habit.values[0]=false;habit.values[0]=true;const result=core.completeHabit(state,habit.id,0,{transitioned:true,previousValue:false,idFactory:ids("legacy-recheck")});
 assert.equal(result.habitResult.applied,false);assert.equal(state.rewardTransactions.length,0)
});

test("a direct habit transition applies its structured reward once",()=>{
 const state=migrated("direct"),beforeFitness=state.progression.tracks.fitness.xp,beforeEnergy=state.progression.tracks.energy.xp,result=checkHabit(state,"gym-train");
 assert.equal(result.habitResult.applied,true);assert.equal(state.progression.tracks.fitness.xp,beforeFitness+5);assert.equal(state.progression.tracks.energy.xp,beforeEnergy+2);
 const habit=state.habits.items.find(item=>item.id==="gym-train");habit.values[0]=false;habit.values[0]=true;const again=core.completeHabit(state,habit.id,0,{transitioned:true,previousValue:false,idFactory:ids("again")});
 assert.equal(again.habitResult.applied,false);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-completion").length,1)
});

test("habit steps use the E-flat seven-note frequency language",()=>{
 assert.deepEqual(HABIT_STEP_FREQUENCIES,[311.13,349.23,392,466.16,523.25,622.25,783.99]);
 const state=migrated("steps");for(let index=0;index<7;index++){const result=checkHabit(state,core.HABIT_IDS[index],1,"step-"+index);assert.equal(result.step,index+1)}
});

test("seven standard habits trigger one daily clear reward",()=>{
 const state=migrated("clear"),beforePlayer=state.player.xp;let final;
 for(let index=0;index<7;index++)final=checkHabit(state,core.HABIT_IDS[index],2,"clear-"+index);
 assert.equal(final.dayComplete,true);assert.equal(final.dayClearResult.applied,true);assert.equal(final.dayClearResult.transaction.rewards.playerXp,10);
 assert.equal(state.player.xp,beforePlayer+10);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-day-clear").length,1);
 const last=state.habits.items.find(item=>item.id===core.HABIT_IDS[6]);last.values[2]=false;last.values[2]=true;const again=core.completeHabit(state,last.id,2,{transitioned:true,previousValue:false,idFactory:ids("clear-again")});assert.equal(again.dayClearResult.applied,false)
});

test("refresh migration and duplicate cloud claims never farm habit XP",()=>{
 const base=migrated("cloud"),local=copy(base),remote=copy(base);checkHabit(local,"gym-train",3,"local");checkHabit(remote,"gym-train",3,"remote");
 const merged=core.mergeCloudState(local,remote),key="habit:gym-train:2026-07-16:reward-v1";
 assert.equal(merged.rewardTransactions.filter(item=>item.idempotencyKey===key).length,1);assert.equal(merged.rewardClaims.filter(item=>item.idempotencyKey===key).length,1);
 const refreshed=core.migrateState(copy(merged),legacy(),{idFactory:ids("refresh"),now:"2026-07-18T12:00:00.000Z"});assert.equal(refreshed.rewardTransactions.filter(item=>item.idempotencyKey===key).length,1)
});

test("legacy bottleneck arrays migrate to stable active objects",()=>{
 const state=migrated("bottle-migrate"),item=state.bottleneck.items[0],again=core.migrateState(copy(state),legacy(),{idFactory:ids("later")});
 assert.equal(item.name,"Broken workflow");assert.equal(item.status,"active");assert.equal(item.severity,"high");assert.equal(again.bottleneck.items[0].id,item.id)
});

test("bottleneck resolution grants exact rewards and becomes immutable",()=>{
 const state=migrated("resolve"),item=state.bottleneck.items[0],result=core.resolveBottleneck(state,item.id,"Rebuilt the workflow",{idFactory:ids("reward"),now:"2026-07-17T15:00:00.000Z"});
 assert.equal(result.applied,true);assert.equal(item.status,"resolved");assert.equal(item.resolutionNote,"Rebuilt the workflow");assert.equal(result.transaction.rewards.playerXp,40);
 assert.deepEqual(result.transaction.rewards.progression.map(entry=>[entry.targetId,entry.amount]),[["alignment",35],["clarity",25],["momentum",20]]);
 assert.ok(state.earnedAchievements.some(entry=>entry.achievementId==="bottleneck-removed"&&entry.bottleneckId===item.id));
 assert.throws(()=>core.editBottleneck(state,item.id,{name:"Changed"}),/immutable/);
 const blocked=core.validateAiUpdate(state,{format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"resolved-edit",operations:[{id:"edit",operation:"update",entityType:"bottleneck",entityId:item.id,path:"name",value:"Changed"}]});assert.equal(blocked.unresolved.length,1);
 const before=JSON.stringify(state),replay=core.replayBottleneck(state,item.id);assert.equal(replay.type,"bottleneck-resolution");assert.equal(JSON.stringify(state),before);
 const duplicate=core.resolveBottleneck(state,item.id,"Try again",{idFactory:ids("duplicate")});assert.equal(duplicate.applied,false)
});

test("cloud merge preserves one canonical bottleneck resolution",()=>{
 const base=migrated("bottle-cloud"),local=copy(base),remote=copy(base),id=base.bottleneck.items[0].id;
 core.resolveBottleneck(local,id,"Local note",{idFactory:ids("left"),now:"2026-07-17T15:00:00.000Z"});
 core.resolveBottleneck(remote,id,"Remote note",{idFactory:ids("right"),now:"2026-07-17T15:01:00.000Z"});
 const merged=core.mergeCloudState(local,remote),item=merged.bottleneck.items.find(entry=>entry.id===id);
 assert.equal(merged.rewardTransactions.filter(entry=>entry.idempotencyKey===engagement.bottleneckClaimKey(id)).length,1);assert.equal(item.status,"resolved");assert.ok(item.rewardTransactionId)
});

test("legacy AI patches can still update the bottleneck panel copy",()=>{
 const state=migrated("panel-ai"),patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"panel-copy",operations:[{id:"title",operation:"update",entityType:"bottleneck",entityId:state.bottleneck.id,path:"title",previousValue:state.bottleneck.title,value:"New Current Bottleneck"}]};
 const validation=core.validateAiUpdate(state,patch);assert.equal(validation.valid.length,1);core.applyAiUpdate(state,validation,undefined,{idFactory:ids("panel-event")});assert.equal(state.bottleneck.title,"New Current Bottleneck")
});
test("AI patches can edit habit rewards and resolve bottlenecks through canonical transactions",()=>{
 const state=migrated("ai");state.meta.lastHandoffId="handoff-1";const habit=state.habits.items.find(item=>item.id==="gym-train"),bottleneck=state.bottleneck.items[0];
 const patch={format:"optimizer-ai-update",schemaVersion:"1.0",updateId:"engagement-ai",baseExportId:"handoff-1",operations:[
  {id:"habit-reward",operation:"update",entityType:"habitReward",entityId:habit.id,value:{playerXp:1,progression:[]}},
  {id:"resolve",operation:"complete",entityType:"bottleneck",entityId:bottleneck.id,value:{resolutionNote:"Resolved by AI"}}
 ]};
 const validation=core.validateAiUpdate(state,patch);assert.equal(validation.valid.length,2);core.applyAiUpdate(state,validation,undefined,{idFactory:ids("ai-op"),now:"2026-07-17T16:00:00.000Z"});
 assert.equal(habit.rewards.playerXp,1);assert.equal(bottleneck.status,"resolved");assert.equal(state.rewardTransactions.filter(item=>item.type==="bottleneck-resolution").length,1)
});

test("AI handoff and readable markdown include engagement history",()=>{
 const state=migrated("handoff"),item=state.bottleneck.items[0];checkHabit(state,"gym-train",4,"handoff-habit");core.resolveBottleneck(state,item.id,"Cleared",{idFactory:ids("handoff-bottle"),now:"2026-07-17T17:00:00.000Z"});
 const handoff=core.buildHandoff(state,{exportId:"engagement-export",exportedAt:"2026-07-17T18:00:00.000Z"}),markdown=core.handoffToMarkdown(handoff);
 assert.equal(handoff.engagement.habitCompletions.length,1);assert.equal(handoff.engagement.bottlenecksRemoved.length,1);assert.match(markdown,/Habit Progression/);assert.match(markdown,/Bottlenecks Removed/)
});

test("audio catalog is complete and unknown names are silent",async()=>{
 const expected=["missionComplete","rewardReveal","xpGain","levelUp","playerLevelUp","achievement","buttonConfirm","error","uiClick","toggleOn","toggleOff","panelOpen","panelClose","taskComplete","taskReopen","dailyComplete","habitStep","habitDayComplete","questAdvance","bottleneckResolved","bottleneckReward"];
 expected.forEach(name=>assert.ok(SOUND_CATALOG[name],name));let contexts=0;class Context{constructor(){contexts++}}
 const manager=new AudioManager({AudioContextClass:Context,AudioClass:null,getSettings:()=>({enabled:true,volume:1})});assert.equal(await manager.play("not-a-sound"),false);assert.equal(contexts,0)
});

test("master and category volumes multiply for custom audio",async()=>{
 const played=[];class CaptureAudio{constructor(path){this.path=path;played.push(this)}addEventListener(){}play(){return Promise.resolve()}}
 let now=1000;const manager=new AudioManager({AudioClass:CaptureAudio,AudioContextClass:null,getSettings:()=>({enabled:true,volume:.5,uiVolume:.2,progressVolume:.4,cinematicVolume:.8}),now:()=>now});
 assert.equal(await manager.play("uiClick"),"custom");assert.equal(played.at(-1).volume,.1);now+=1000;assert.equal(await manager.play("xpGain"),"custom");assert.equal(played.at(-1).volume,.2);now+=1000;assert.equal(await manager.play("missionComplete"),"custom");assert.equal(played.at(-1).volume,.4)
});

test("habit audio prefers the numbered override then rate-shifts the generic fallback",async()=>{
 const played=[];class SelectiveAudio{constructor(path){this.path=path;this.playbackRate=1;played.push(this)}addEventListener(){}play(){return this.path.endsWith("habit-step-4.wav")?Promise.reject(new Error("missing")):Promise.resolve()}}
 const manager=new AudioManager({AudioClass:SelectiveAudio,AudioContextClass:null,getSettings:()=>({enabled:true,volume:1,progressVolume:1}),now:()=>1000});
 assert.equal(await manager.play("habitStep",{step:4}),"custom");assert.ok(played[0].path.endsWith("habit-step-4.wav"));assert.ok(played[1].path.endsWith("habit-step.wav"));assert.equal(played[1].playbackRate,HABIT_STEP_FREQUENCIES[3]/HABIT_STEP_FREQUENCIES[0])
});

test("audio cooldown, interaction dedupe, and polyphony are bounded",async()=>{
 class Audio{addEventListener(){}play(){return Promise.resolve()}}let now=1000;const manager=new AudioManager({AudioClass:Audio,AudioContextClass:null,maxPolyphony:1,getSettings:()=>({enabled:true,volume:1}),now:()=>now});
 assert.equal(await manager.play("uiClick",{interactionId:"click-1"}),"custom");assert.equal(await manager.play("buttonConfirm",{interactionId:"click-1"}),false);assert.equal(await manager.play("achievement",{force:true}),false);now+=1000;assert.equal(await manager.play("uiClick"),"custom")
});

let passed=0;
for(const {name,run} of tests){try{await run();passed++;console.log("PASS "+name)}catch(error){console.error("FAIL "+name);throw error}}
console.log("Engagement tests passed: "+passed+"/"+tests.length+".");
