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
const playerTotal=state=>(state.player.level-1)*100+state.player.xp;

function legacy(options={}){
 const names=options.habitNames||core.HABIT_DEFINITIONS.map(item=>item.name);
 const values=options.habitValues||names.map(()=>Array(7).fill(false));
 return{
  player:options.player||{level:4,xp:20,xpGoal:100},
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
function checkHabit(state,id,column=0,prefix="habit",now="2026-07-17T13:00:00.000Z"){
 const habit=state.habits.items.find(item=>item.id===id),before=habit.values[column];habit.values[column]=true;
 return core.completeHabit(state,id,column,{idFactory:ids(prefix),now,transitioned:!before,previousValue:before})
}
function uncheckHabit(state,id,column=0,prefix="habit-reverse",now="2026-07-17T14:00:00.000Z"){
 const habit=state.habits.items.find(item=>item.id===id),before=habit.values[column];habit.values[column]=false;
 return core.reopenHabit(state,id,column,{idFactory:ids(prefix),now,transitioned:before,previousValue:before})
}

test("schema v7 installs reversible standard habits and preserves custom history",()=>{
 const names=["Gym / Train","My Custom Habit"],values=[[true,false,false,false,false,false,false],[false,true,false,false,false,false,false]],state=migrated("migration",{habitNames:names,habitValues:values});
 assert.deepEqual(state.habits.items.slice(0,7).map(item=>item.id),core.HABIT_IDS);
 assert.equal(state.habits.items.find(item=>item.name==="Gym / Train").values[0],true);
 assert.equal(state.habits.items.find(item=>item.name==="My Custom Habit").values[1],true);
 assert.equal(state.meta.schemaVersion,7)
});

test("standard habit rewards match the progression contract",()=>{
 const byId=Object.fromEntries(core.HABIT_DEFINITIONS.map(item=>[item.id,item.rewards]));
 assert.ok(Object.values(byId).every(reward=>reward.playerXp===5));assert.equal(migrated("reward-default").habits.dailyClearRewards.playerXp,10);
 assert.deepEqual(byId["gym-train"].progression.map(item=>[item.targetId,item.amount]),[["fitness",5],["energy",2]]);
 assert.deepEqual(byId["content-released"].progression.map(item=>[item.targetId,item.amount]),[["leverage",6],["music-creation",4],["momentum",2]])
});

test("legacy checked cells get no migration XP but future rechecks use reward v2",()=>{
 const values=core.HABIT_DEFINITIONS.map(()=>Array(7).fill(false));values[0][0]=true;const state=migrated("legacy-cell",{habitValues:values}),before=playerTotal(state);
 assert.equal(state.rewardTransactions.length,0);assert.ok(state.rewardClaims.some(claim=>claim.idempotencyKey==="habit:gym-train:2026-07-13:reward-v1"));
 uncheckHabit(state,"gym-train");const result=checkHabit(state,"gym-train",0,"legacy-recheck");assert.equal(result.habitResult.applied,true);assert.equal(result.habitResult.transaction.idempotencyKey,"habit:gym-train:2026-07-13:reward-v2");assert.equal(playerTotal(state),before+5)
});

test("a habit reward applies once, reverses exactly, and reinstates without stacking",()=>{
 const state=migrated("direct"),beforePlayer=playerTotal(state),beforeFitness=state.progression.tracks.fitness.xp,beforeEnergy=state.progression.tracks.energy.xp,result=checkHabit(state,"gym-train");
 assert.equal(result.habitResult.applied,true);assert.equal(result.habitResult.transaction.rewards.playerXp,5);assert.equal(playerTotal(state),beforePlayer+5);assert.equal(state.progression.tracks.fitness.xp,beforeFitness+5);assert.equal(state.progression.tracks.energy.xp,beforeEnergy+2);
 const reversed=uncheckHabit(state,"gym-train");assert.equal(reversed.habitResult.applied,true);assert.equal(reversed.habitResult.removedRewards.playerXp,5);assert.equal(playerTotal(state),beforePlayer);assert.equal(state.progression.tracks.fitness.xp,beforeFitness);assert.equal(state.progression.tracks.energy.xp,beforeEnergy);
 const reinstated=checkHabit(state,"gym-train",0,"reinstate","2026-07-17T15:00:00.000Z"),duplicate=core.completeHabit(state,"gym-train",0,{transitioned:false,previousValue:true,idFactory:ids("duplicate")});assert.equal(reinstated.habitResult.reinstated,true);assert.equal(duplicate.habitResult.applied,false);assert.equal(playerTotal(state),beforePlayer+5);
 assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-completion").length,1);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-reversal").length,1)
});

test("habit steps use the E-flat seven-note frequency language",()=>{
 assert.deepEqual(HABIT_STEP_FREQUENCIES,[311.13,349.23,392,466.16,523.25,622.25,783.99]);
 const state=migrated("steps");for(let index=0;index<7;index++){const result=checkHabit(state,core.HABIT_IDS[index],1,"step-"+index);assert.equal(result.step,index+1)}
});

test("Daily System Clear applies, reverses, and reinstates exactly once",()=>{
 const state=migrated("clear"),beforePlayer=playerTotal(state);let final;
 for(let index=0;index<7;index++)final=checkHabit(state,core.HABIT_IDS[index],2,"clear-"+index);
 assert.equal(final.dayComplete,true);assert.equal(final.dayClearResult.applied,true);assert.equal(final.dayClearResult.transaction.rewards.playerXp,10);assert.equal(playerTotal(state),beforePlayer+45);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-day-clear").length,1);
 const reversed=uncheckHabit(state,core.HABIT_IDS[6],2,"clear-reverse");assert.equal(reversed.dayClearResult.applied,true);assert.equal(reversed.dayClearResult.removedRewards.playerXp,10);assert.equal(playerTotal(state),beforePlayer+30);
 const restored=checkHabit(state,core.HABIT_IDS[6],2,"clear-reinstate","2026-07-17T15:00:00.000Z");assert.equal(restored.dayClearResult.reinstated,true);assert.equal(playerTotal(state),beforePlayer+45);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-day-clear").length,1);assert.equal(state.rewardTransactions.filter(item=>item.type==="habit-day-clear-reversal").length,1)
});

test("cloud merge deduplicates simultaneous checks and preserves a remote reversal over stale state",()=>{
 const base=migrated("cloud"),local=copy(base),remote=copy(base),before=playerTotal(base);checkHabit(local,"gym-train",3,"local");checkHabit(remote,"gym-train",3,"remote");
 const checked=core.mergeCloudState(local,remote),key="habit:gym-train:2026-07-16:reward-v2";assert.equal(checked.rewardTransactions.filter(item=>item.idempotencyKey===key).length,1);assert.equal(playerTotal(checked),before+5);assert.equal(checked.habits.items.find(item=>item.id==="gym-train").values[3],true);
 const stale=copy(checked),reversed=copy(checked);uncheckHabit(reversed,"gym-train",3,"remote-reverse","2026-07-18T12:00:00.000Z");const merged=core.mergeCloudState(stale,reversed),reward=merged.rewardTransactions.find(item=>item.idempotencyKey===key);
 assert.equal(reward.status,"reversed");assert.equal(merged.habits.items.find(item=>item.id==="gym-train").values[3],false);assert.equal(playerTotal(merged),before);
 const refreshed=core.migrateState(copy(merged),legacy(),{idFactory:ids("refresh"),now:"2026-07-18T13:00:00.000Z"});assert.equal(refreshed.rewardTransactions.find(item=>item.idempotencyKey===key).status,"reversed");assert.equal(playerTotal(refreshed),before)
});

test("habit reversal can level down while preserving unrelated XP",()=>{
 const state=migrated("level-down",{player:{level:4,xp:98,xpGoal:100}}),baseline=playerTotal(state);const checked=checkHabit(state,"gym-train");assert.equal(state.player.level,5);assert.equal(state.player.xp,3);assert.ok(checked.habitResult.levelUps.some(item=>item.targetId==="player"));
 const levelUpId=checked.habitResult.levelUps.find(item=>item.targetId==="player").id;uncheckHabit(state,"gym-train");assert.equal(state.player.level,4);assert.equal(state.player.xp,98);assert.equal(state.levelUps.find(item=>item.id===levelUpId).active,false);
 core.createManualAdjustment(state,{idempotencyKey:"manual:unrelated",sourceId:"unrelated",sourceName:"Unrelated XP",playerXp:30,progression:[]},{idFactory:ids("unrelated")});checkHabit(state,"gym-train",1,"second-day");uncheckHabit(state,"gym-train",1,"second-day-reverse");assert.equal(playerTotal(state),baseline+30)
});

test("migration preserves configured XP and never retroactively rewards checked history",()=>{
 const values=core.HABIT_DEFINITIONS.map(()=>Array(7).fill(false));values[0][0]=true;const state=migrated("migration-xp",{habitValues:values}),before=playerTotal(state);assert.equal(state.rewardTransactions.length,0);assert.equal(playerTotal(state),before);
 state.habits.items.find(item=>item.id==="gym-train").rewards.playerXp=17;state.habits.dailyClearRewards.playerXp=22;const refreshed=core.migrateState(copy(state),legacy(),{idFactory:ids("migration-refresh"),now:"2026-07-18T12:00:00.000Z"});assert.equal(refreshed.habits.items.find(item=>item.id==="gym-train").rewards.playerXp,17);assert.equal(refreshed.habits.dailyClearRewards.playerXp,22);assert.equal(playerTotal(refreshed),before)
});

test("current-week reversals leave archived weekly history and earned XP untouched",()=>{
 const state=migrated("archive"),baseline=playerTotal(state);checkHabit(state,"gym-train",0,"archive-old");core.archiveRollovers(state,{today:state.daily.date,week:"2026-07-20"},{idFactory:ids("rollover"),now:"2026-07-20T12:00:00.000Z"});const archived=copy(state.weeklyHistory[0]),earned=playerTotal(state);assert.equal(earned,baseline+5);
 checkHabit(state,"gym-train",0,"archive-new","2026-07-20T13:00:00.000Z");uncheckHabit(state,"gym-train",0,"archive-new-reverse","2026-07-20T14:00:00.000Z");assert.equal(playerTotal(state),earned);assert.deepEqual(state.weeklyHistory[0],archived)
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

test("AI handoff reports habit rewards and reversals with active status",()=>{
 const state=migrated("handoff"),item=state.bottleneck.items[0];checkHabit(state,"gym-train",4,"handoff-habit");uncheckHabit(state,"gym-train",4,"handoff-reverse","2026-07-17T16:00:00.000Z");core.resolveBottleneck(state,item.id,"Cleared",{idFactory:ids("handoff-bottle"),now:"2026-07-17T17:00:00.000Z"});
 const handoff=core.buildHandoff(state,{exportId:"engagement-export",exportedAt:"2026-07-17T18:00:00.000Z"}),markdown=core.handoffToMarkdown(handoff),completion=handoff.engagement.habitCompletions[0],reversal=handoff.engagement.habitReversals[0];
 assert.equal(completion.active,false);assert.equal(completion.playerXpGranted,0);assert.equal(reversal.playerXpRemoved,5);assert.equal(reversal.sourceId,"gym-train");assert.equal(handoff.engagement.bottlenecksRemoved.length,1);assert.match(markdown,/Habit reopened: Gym \/ Train - 5 Player XP removed/);assert.doesNotMatch(markdown,/Habit completed: Gym \/ Train/);assert.match(markdown,/Bottlenecks Removed/)
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
