(function(root){
"use strict";
const VERSION=1,XP_REQUIRED=100,MAX_XP=1000000000;
const TRACK_DEFINITIONS=[
["energy","Energy","coreStat"],["clarity","Clarity","coreStat"],["momentum","Momentum","coreStat"],["alignment","Alignment","coreStat"],["leverage","Leverage","coreStat"],["capacity","Capacity","coreStat"],
["vision-direction","Vision / Direction","attribute"],["creative-clarity","Creative Clarity","attribute"],["physical-energy","Physical Energy","attribute"],["team-infrastructure","Team Infrastructure","attribute"],
["fitness","Fitness","skill"],["optimization","Optimization","skill"],["music-creation","Music Creation","skill"],["sales-persuasion","Sales / Persuasion","skill"],["environment-alignment","Environment Alignment","skill"],["income-stability","Income Stability","skill"],["automation-ai","Automation / AI","skill"],["narrative-analysis","Narrative Analysis","skill"],["trading-market-read","Trading / Market Read","skill"],["leadership","Leadership","skill"]
].map(([id,name,type])=>({id,name,type}));
const ACHIEVEMENT_DEFINITIONS={
 "mission-complete":{id:"mission-complete",name:"Mission Complete",description:"Complete every required task in a mission.",icon:"mission",rarity:"common",repeatable:true,hidden:false},
 "bottleneck-removed":{id:"bottleneck-removed",name:"Bottleneck Removed",description:"Remove a source of recurring friction.",icon:"broken-chain",rarity:"uncommon",repeatable:true,hidden:false},
 "gym-first-set":{id:"gym-first-set",name:"First Set",description:"Complete the first logged working set.",icon:"training",rarity:"common",repeatable:false,hidden:false},
 "gym-first-protocol":{id:"gym-first-protocol",name:"First Protocol",description:"Complete the first training protocol.",icon:"training",rarity:"common",repeatable:false,hidden:false},
 "gym-mission-ready":{id:"gym-mission-ready",name:"Mission Ready",description:"Complete every required exercise in a workout.",icon:"target",rarity:"uncommon",repeatable:true,hidden:false},
 "gym-clean-run":{id:"gym-clean-run",name:"Clean Run",description:"Complete every required working set without skipping.",icon:"shield",rarity:"uncommon",repeatable:true,hidden:false},
 "gym-progressive-overload":{id:"gym-progressive-overload",name:"Progressive Overload",description:"Improve weight or reps on a comparable exercise.",icon:"trend",rarity:"uncommon",repeatable:true,hidden:false},
 "gym-weight-pr":{id:"gym-weight-pr",name:"Weight PR",description:"Set a new successful weight record.",icon:"weight",rarity:"rare",repeatable:true,hidden:false},
 "gym-rep-pr":{id:"gym-rep-pr",name:"Rep PR",description:"Set a new rep record at the same weight.",icon:"repeat",rarity:"rare",repeatable:true,hidden:false},
 "gym-volume-pr":{id:"gym-volume-pr",name:"Volume PR",description:"Exceed previous exercise volume.",icon:"chart",rarity:"rare",repeatable:true,hidden:false},
 "gym-locked-in":{id:"gym-locked-in",name:"Locked In",description:"Finish a workout with Efficiency of 90 or higher.",icon:"lock",rarity:"rare",repeatable:true,hidden:false},
 "gym-perfect-execution":{id:"gym-perfect-execution",name:"Perfect Execution",description:"Finish a workout with Execution of 95 or higher.",icon:"precision",rarity:"epic",repeatable:true,hidden:false},
 "gym-full-protocol-cycle":{id:"gym-full-protocol-cycle",name:"Full Protocol Cycle",description:"Complete all five protocols at least once.",icon:"cycle",rarity:"epic",repeatable:false,hidden:false},
 "gym-five-protocol-cycle":{id:"gym-five-protocol-cycle",name:"Five-Day Protocol",description:"Complete all five protocols within a rolling training cycle.",icon:"streak",rarity:"epic",repeatable:true,hidden:false},
 "gym-body-engine-online":{id:"gym-body-engine-online",name:"Body Engine Online",description:"Complete 20 workouts.",icon:"engine",rarity:"epic",repeatable:false,hidden:false},
 "gym-no-weak-links":{id:"gym-no-weak-links",name:"No Weak Links",description:"Earn an A grade or higher on all five protocols.",icon:"chain",rarity:"legendary",repeatable:true,hidden:false}
};
const MISSION_DEFAULTS={
"restore home base":{classification:"Infrastructure",impact:"High Leverage",rewards:{playerXp:50,progression:[{targetType:"coreStat",targetId:"alignment",amount:65},{targetType:"coreStat",targetId:"clarity",amount:40},{targetType:"skill",targetId:"environment-alignment",amount:55}]}},
"restore the body engine":{classification:"Health",impact:"Systemic",rewards:{playerXp:65,progression:[{targetType:"coreStat",targetId:"energy",amount:70},{targetType:"coreStat",targetId:"momentum",amount:55},{targetType:"skill",targetId:"fitness",amount:60}]}},
"establish income floor":{classification:"Financial",impact:"High Leverage",rewards:{playerXp:80,progression:[{targetType:"coreStat",targetId:"alignment",amount:45},{targetType:"coreStat",targetId:"momentum",amount:50},{targetType:"skill",targetId:"income-stability",amount:75},{targetType:"skill",targetId:"sales-persuasion",amount:45}]}}
};
const BINDINGS={
top:{energy:"energy",clarity:"clarity",momentum:"momentum",alignment:"alignment"},
character:{"vision / direction":"vision-direction","leverage perception":"leverage","creative clarity":"creative-clarity","execution consistency":"capacity","environment alignment":"environment-alignment","physical energy":"physical-energy","income stability":"income-stability","team infrastructure":"team-infrastructure"},
skills:{optimization:"optimization","narrative analysis":"narrative-analysis","music creation":"music-creation","trading / market read":"trading-market-read","sales / persuasion":"sales-persuasion",fitness:"fitness",leadership:"leadership","automation / ai":"automation-ai"}
};
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const clean=v=>String(v||"").trim();
const integer=(v,f=0)=>Number.isFinite(Number(v))?Math.round(Number(v)):f;
const makeId=()=>root.crypto?.randomUUID?.()||`id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,11)}`;
const slug=v=>clean(v).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"track";
function iso(v,f){const d=new Date(v||f||Date.now());return Number.isNaN(d.getTime())?new Date(f||Date.now()).toISOString():d.toISOString()}
function amount(v,zero=true){const n=integer(v,NaN);if(!Number.isFinite(n)||n<0||n>MAX_XP||(!zero&&!n))throw RangeError(`Progression XP must be ${zero?"non-negative":"positive"} and no greater than ${MAX_XP}.`);return n}
function normalizeTrack(v={},d={}){let level=Math.max(1,integer(v.level,1)),xp=Math.max(0,integer(v.xp,0));level+=Math.floor(xp/XP_REQUIRED);xp%=XP_REQUIRED;return{id:clean(v.id||d.id),name:clean(v.name||d.name||v.id||d.id),type:clean(v.type||d.type||"skill"),level,xp,xpRequired:XP_REQUIRED}}
function applyProgressionXp(track,value){
 if(!track||typeof track!=="object")throw TypeError("A progression track is required.");
 const added=amount(value);Object.assign(track,normalizeTrack(track,track));
 const previousLevel=track.level,previousXp=track.xp,total=previousXp+added,levelsGained=Math.floor(total/XP_REQUIRED),newLevel=previousLevel+levelsGained,newXp=total%XP_REQUIRED;
 Object.assign(track,{level:newLevel,xp:newXp,xpRequired:XP_REQUIRED});
 const count=Math.min(levelsGained,100),checkpoints=Array.from({length:count},(_,i)=>({level:previousLevel+i+1,xp:0}));
 if(levelsGained>count)checkpoints.push({level:newLevel,xp:newXp,summarized:true});
 return{previousLevel,previousXp,amountAdded:added,levelsGained,newLevel,newXp,xpRequired:XP_REQUIRED,checkpoints}
}
function normalizeRewards(v,label=""){
 const s=v&&typeof v==="object"&&!Array.isArray(v)?v:{};
 const progression=(Array.isArray(s.progression)?s.progression:[]).map(x=>{const n=integer(x?.amount,NaN);return x&&Number.isFinite(n)&&n>=0&&n<=MAX_XP?{targetType:clean(x.targetType||"skill"),targetId:clean(x.targetId),amount:n}:null}).filter(x=>x?.targetId);
 const achievements=(Array.isArray(s.achievements)?s.achievements:[{achievementId:"mission-complete"}]).map(x=>({achievementId:clean(typeof x==="string"?x:x?.achievementId)})).filter(x=>x.achievementId);
 const currencies=(Array.isArray(s.currencies)?s.currencies:[]).map(x=>{const n=Number(x?.amount);return x&&clean(x.currencyId)&&Number.isFinite(n)&&n>=0&&n<=MAX_XP?{currencyId:clean(x.currencyId),amount:Math.round(n*100)/100}:null}).filter(Boolean);
 const titles=[...new Set((Array.isArray(s.titles)?s.titles:[]).map(x=>clean(typeof x==="string"?x:x?.titleId)).filter(Boolean))],cosmetics=[...new Set((Array.isArray(s.cosmetics)?s.cosmetics:[]).map(x=>clean(typeof x==="string"?x:x?.cosmeticId)).filter(Boolean))];
 return{playerXp:Math.max(0,Math.min(MAX_XP,integer(s.playerXp,0))),progression,currencies,titles,cosmetics,achievements,legacyLabel:clean(s.legacyLabel||label)}
}
function normalizeMission(m,opt={}){
 const s=m&&typeof m==="object"?m:{},f=opt.idFactory||makeId,now=iso(opt.now),defaults=MISSION_DEFAULTS[clean(s.name).toLowerCase()]||null;
 const tasks=(Array.isArray(s.tasks)?s.tasks:[]).map(t=>Array.isArray(t)?{id:f(),name:clean(t[0]),completed:Boolean(t[1])}:{...t,id:clean(t?.id)||f(),name:clean(t?.name||t?.title),completed:Boolean(t?.completed??t?.done)});
 const complete=tasks.length>0&&tasks.every(t=>t.completed),known=complete||s.status==="completed"||Boolean(s.completedAt||s.rewardClaimedAt),structured=s.rewards&&typeof s.rewards==="object"&&!Array.isArray(s.rewards);
 const rewards=normalizeRewards(structured?s.rewards:defaults?.rewards,s.reward);if(!structured&&!defaults&&!rewards.playerXp&&!rewards.progression.length)rewards.playerXp=25;
 return{...s,id:clean(s.id)||f(),name:clean(s.name||"Untitled Mission"),classification:clean(s.classification||defaults?.classification||"General"),impact:clean(s.impact||defaults?.impact||"Standard"),tasks,rewards,status:s.status||(complete?"completed":"active"),completedAt:s.completedAt?iso(s.completedAt,now):(known?now:null),rewardClaimedAt:s.rewardClaimedAt?iso(s.rewardClaimedAt,now):(known?now:null),rewardVersion:Math.max(1,integer(s.rewardVersion,1)),completionCount:Math.max(known?1:0,integer(s.completionCount,0))}
}
function bind(items,map,type,defs,legacy){
 for(const item of items||[]){const key=clean(item.name).toLowerCase(),id=clean(item.progressionId||map[key]||slug(item.name));item.progressionId=id;if(!defs.has(id))defs.set(id,{id,name:clean(item.name),type});if(!legacy.has(id))legacy.set(id,Math.max(0,Math.min(99,integer(item.value,0))))}
}
function playerFromLegacy(p={}){
 if(p.xpRequired===100&&p.xpGoal==null)return normalizeTrack(p,{id:"player",name:"The Optimizer",type:"player"});
 const goal=Number(p.xpGoal),raw=Number(p.xp),xp=Number.isFinite(goal)&&goal>0&&Number.isFinite(raw)?Math.max(0,Math.min(99,Math.round(raw/goal*100))):Math.max(0,Math.min(99,integer(raw,0)));
 return normalizeTrack({id:"player",name:"The Optimizer",type:"player",level:Math.max(1,integer(p.level,1)),xp})
}
function normalizeTransaction(v,f,now){
 if(!v||typeof v!=="object")return null;const type=clean(v.type||"manual-adjustment"),sourceId=clean(v.sourceId),rewardVersion=Math.max(1,integer(v.rewardVersion,1)),key=clean(v.idempotencyKey||(type==="mission-completion"&&sourceId?`${sourceId}:reward-v${rewardVersion}`:v.id));if(!key)return null;
 return{...clone(v),id:clean(v.id)||f(),idempotencyKey:key,type,sourceId,sourceName:clean(v.sourceName),rewardVersion,createdAt:iso(v.createdAt,now),rewards:normalizeRewards(v.rewards||{playerXp:v.playerXp,progression:v.progression}),before:clone(v.before||{player:null,tracks:{}}),after:clone(v.after||{player:null,tracks:{}}),results:Array.isArray(v.results)?clone(v.results):[],levelUps:Array.isArray(v.levelUps)?clone(v.levelUps):[],achievementIds:Array.isArray(v.achievementIds)?[...new Set(v.achievementIds.filter(Boolean))]:[],diagnostics:Array.isArray(v.diagnostics)?clone(v.diagnostics):[],status:v.status==="failed"?"failed":"applied"}
}
function canonicalTransactions(values){
 const ids=new Map();for(const t of values||[])if(t?.id){const old=ids.get(t.id);if(!old||old.status!=="applied")ids.set(t.id,clone(t))}
 const keys=new Map();for(const t of [...ids.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id))){const old=keys.get(t.idempotencyKey);if(!old||(old.status!=="applied"&&t.status==="applied"))keys.set(t.idempotencyKey,t)}
 return[...keys.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id))
}
function records(values,f,now){const m=new Map();for(const v of Array.isArray(values)?values:[]){const x={...clone(v),id:clean(v?.id)||f(),earnedAt:iso(v?.earnedAt,now)};m.set(x.id,x)}return[...m.values()].sort((a,b)=>new Date(a.earnedAt)-new Date(b.earnedAt))}
function snapshot(s,ids){return{player:clone(s.player),tracks:Object.fromEntries([...new Set(ids)].filter(id=>s.progression.tracks[id]).map(id=>[id,clone(s.progression.tracks[id])]))}}
function applyRewardSet(s,rewards){
 const results=[],diagnostics=[];if(rewards.playerXp)results.push({targetId:"player",targetName:s.player.name,targetType:"player",result:applyProgressionXp(s.player,rewards.playerXp)});
 for(const reward of rewards.progression){const track=s.progression.tracks[reward.targetId];if(!track||(reward.targetType&&reward.targetType!==track.type)){const message=!track?`Unknown progression reward target: ${reward.targetId}`:`Progression type mismatch for ${reward.targetId}: expected ${track.type}, received ${reward.targetType}`;diagnostics.push({level:"warning",message,targetId:reward.targetId});root.console?.warn?.(message);continue}results.push({targetId:track.id,targetName:track.name,targetType:track.type,result:applyProgressionXp(track,reward.amount)})}
 return{results,diagnostics}
}
function deriveBaseline(s,transactions){
 const baseline={player:clone(s.player),tracks:clone(s.progression.tracks)},seen=new Set();let player=false;
 for(const t of transactions){if(!player&&t.before?.player){baseline.player=normalizeTrack(t.before.player,baseline.player);player=true}for(const[id,track]of Object.entries(t.before?.tracks||{}))if(!seen.has(id)&&baseline.tracks[id]){baseline.tracks[id]=normalizeTrack(track,baseline.tracks[id]);seen.add(id)}}
 return baseline
}
function syncLegacy(s){return s}
function rebuildProgression(s){
 const b=s.progression?.baseline;if(!b)return s;s.player=normalizeTrack(clone(b.player),{id:"player",name:"The Optimizer",type:"player"});s.progression.tracks=Object.fromEntries(Object.entries(b.tracks||{}).map(([id,t])=>[id,normalizeTrack(clone(t),t)]));
 for(const t of canonicalTransactions(s.rewardTransactions).filter(x=>x.status==="applied"))applyRewardSet(s,t.rewards);syncLegacy(s);return s
}
// Schema v3 captures a baseline once so repeated migration never turns current XP into another historical gain.
function migrateState(s,raw={},opt={}){
 const f=opt.idFactory||makeId,now=iso(opt.now),defs=new Map(TRACK_DEFINITIONS.map(x=>[x.id,clone(x)])),legacy=new Map();
 bind(s.top,BINDINGS.top,"coreStat",defs,legacy);bind(s.character,BINDINGS.character,"attribute",defs,legacy);bind(s.skills,BINDINGS.skills,"skill",defs,legacy);
 const old=s.progression&&typeof s.progression==="object"?s.progression:{},oldTracks=old.tracks&&typeof old.tracks==="object"?old.tracks:{},tracks={};
 for(const[id,d]of defs)tracks[id]=normalizeTrack(oldTracks[id]||{...d,level:1,xp:legacy.get(id)||0},d);for(const[id,v]of Object.entries(oldTracks))if(!tracks[id])tracks[id]=normalizeTrack(v,{id,name:v?.name||id,type:v?.type||"skill"});
 const playerSource=Number(raw.meta?.schemaVersion)>=3&&raw.player?raw.player:s.player;s.player=playerFromLegacy(playerSource);s.progression={version:VERSION,tracks,baseline:null};s.missions=(s.missions||[]).map(m=>normalizeMission(m,{idFactory:f,now}));
 s.rewardTransactions=canonicalTransactions((Array.isArray(s.rewardTransactions)?s.rewardTransactions:[]).map(v=>normalizeTransaction(v,f,now)).filter(Boolean));
 s.progression.baseline=old.baseline?.player&&old.baseline?.tracks?{player:normalizeTrack(old.baseline.player,{id:"player",name:"The Optimizer",type:"player"}),tracks:Object.fromEntries(Object.entries(tracks).map(([id,t])=>[id,normalizeTrack(old.baseline.tracks[id]||t,t)]))}:deriveBaseline(s,s.rewardTransactions);
 s.levelUps=records(s.levelUps,f,now);s.earnedAchievements=records(s.earnedAchievements,f,now);s.settings=s.settings&&typeof s.settings==="object"?s.settings:{};const audio=s.settings.audio&&typeof s.settings.audio==="object"?s.settings.audio:{};s.settings.audio={enabled:audio.enabled!==false,volume:Math.max(0,Math.min(1,Number.isFinite(Number(audio.volume))?Number(audio.volume):.22)),uiVolume:Math.max(0,Math.min(1,Number.isFinite(Number(audio.uiVolume))?Number(audio.uiVolume):.35)),progressVolume:Math.max(0,Math.min(1,Number.isFinite(Number(audio.progressVolume))?Number(audio.progressVolume):.65)),cinematicVolume:Math.max(0,Math.min(1,Number.isFinite(Number(audio.cinematicVolume))?Number(audio.cinematicVolume):1))};
 return rebuildProgression(s)
}
function levelUpRecords(results,source,transactionId,f,now){return results.filter(x=>x.result.levelsGained>0).map(x=>({id:f(),transactionId,type:"level-up",targetId:x.targetId,targetName:x.targetName,targetType:x.targetType,previousLevel:x.result.previousLevel,newLevel:x.result.newLevel,levelsGained:x.result.levelsGained,earnedAt:now,sourceType:source.type,sourceId:source.id,sourceName:source.name}))}
function achievementRecords(s,rewards,source,transactionId,f,now){
 const out=[];for(const request of rewards.achievements){const d=ACHIEVEMENT_DEFINITIONS[request.achievementId];if(!d||(!d.repeatable&&s.earnedAchievements.some(x=>x.achievementId===d.id)))continue;out.push({id:f(),transactionId,achievementId:d.id,name:d.name,description:source.type==="mission"?`Completed ${source.name}.`:d.description,rarity:d.rarity,earnedAt:now,sourceType:source.type,sourceId:source.id,sourceName:source.name})}return out
}
function applyTransaction(s,definition,opt={}){
 const f=opt.idFactory||makeId,now=iso(opt.now),rewards=normalizeRewards(definition.rewards||definition),key=clean(definition.idempotencyKey);if(!key)throw Error("A reward transaction requires an idempotency key.");
 const found=s.rewardTransactions.find(x=>x.idempotencyKey===key&&x.status==="applied");if(found)return{applied:false,transaction:clone(found),levelUps:[],achievements:[],diagnostics:[]};
 const original=clone(s);try{
  const id=clean(definition.id)||f(),ids=rewards.progression.map(x=>x.targetId),before=snapshot(s,ids),applied=applyRewardSet(s,rewards),source={type:clean(definition.sourceType||"system"),id:clean(definition.sourceId),name:clean(definition.sourceName)},levelUps=levelUpRecords(applied.results,source,id,f,now),achievements=achievementRecords(s,rewards,source,id,f,now);
  const transaction={id,idempotencyKey:key,type:clean(definition.type||"manual-adjustment"),sourceType:source.type,sourceId:source.id,sourceName:source.name,sourceDate:clean(definition.sourceDate)||null,sourceSnapshot:clone(definition.sourceSnapshot||null),rewardVersion:Math.max(1,integer(definition.rewardVersion,1)),createdAt:now,rewards,before,after:snapshot(s,ids),results:clone(applied.results),levelUps:clone(levelUps),achievementIds:achievements.map(x=>x.id),diagnostics:applied.diagnostics,status:"applied"};
  s.rewardTransactions.push(transaction);s.rewardTransactions=canonicalTransactions(s.rewardTransactions);s.levelUps.push(...levelUps);s.earnedAchievements.push(...achievements);syncLegacy(s);return{applied:true,transaction:clone(transaction),levelUps:clone(levelUps),achievements:clone(achievements),diagnostics:clone(applied.diagnostics)}
 }catch(error){Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,original);throw error}
}
// A mission ID plus reward version is the claim key; presentation and replay never mutate this transaction.
function claimMissionRewards(s,id,opt={}){
 const mission=s.missions.find(x=>x.id===id);if(!mission)throw Error("Mission not found.");if(!mission.tasks.length||!mission.tasks.every(x=>x.completed))return{applied:false,reason:"incomplete",transaction:null};
 mission.status="completed";const now=iso(opt.now);mission.completedAt||=now;const key=`${mission.id}:reward-v${mission.rewardVersion}`,found=s.rewardTransactions.find(x=>x.idempotencyKey===key&&x.status==="applied");
 if(mission.rewardClaimedAt||found){mission.rewardClaimedAt||=found?.createdAt||now;mission.completionCount=Math.max(1,integer(mission.completionCount,1));return{applied:false,reason:"already-claimed",transaction:clone(found||null),levelUps:[],achievements:[]}}
 const result=applyTransaction(s,{type:"mission-completion",sourceType:"mission",sourceId:mission.id,sourceName:mission.name,rewardVersion:mission.rewardVersion,idempotencyKey:key,rewards:mission.rewards},opt);const missionSnapshot={id:mission.id,name:mission.name,classification:mission.classification,impact:mission.impact,taskCount:mission.tasks.length,completedTaskCount:mission.tasks.filter(x=>x.completed).length};const stored=s.rewardTransactions.find(x=>x.id===result.transaction.id);if(stored)stored.mission=clone(missionSnapshot);result.transaction.mission=clone(missionSnapshot);mission.rewardClaimedAt=result.transaction.createdAt;mission.completionCount=Math.max(1,integer(mission.completionCount,0)+1);return result
}
function createManualAdjustment(s,a,opt={}){const f=opt.idFactory||makeId,sourceId=clean(a.sourceId||a.id)||f();return applyTransaction(s,{id:a.id,idempotencyKey:clean(a.idempotencyKey||`manual:${sourceId}`),type:"manual-adjustment",sourceType:clean(a.sourceType||"manual"),sourceId,sourceName:clean(a.sourceName||"Progression adjustment"),rewards:{playerXp:a.playerXp,progression:a.progression,achievements:[]}},opt)}
function createRewardTransaction(s,definition,opt={}){return applyTransaction(s,definition,opt)}
function replayMission(s,id,version){return clone(s.rewardTransactions.filter(x=>x.type==="mission-completion"&&x.sourceId===id&&(version==null||x.rewardVersion===version)).at(-1)||null)}
function trackForItem(s,item){return s.progression?.tracks?.[item?.progressionId]||null}
function formatMissionRewards(s,m){const r=normalizeRewards(m?.rewards,m?.reward),parts=[];if(r.playerXp)parts.push(`+${r.playerXp} Player XP`);for(const x of r.progression)parts.push(`+${x.amount} ${s.progression?.tracks?.[x.targetId]?.name||x.targetId} XP`);return parts.join(" | ")||r.legacyLabel||"Achievement unlock"}
function progressionHandoff(s,afterDate){const after=v=>!afterDate||new Date(v)>new Date(afterDate);return{player:{...clone(s.player),percentToNextLevel:s.player.xp},tracks:Object.values(s.progression.tracks).map(x=>({...clone(x),percentToNextLevel:x.xp})),missionsCompleted:s.missions.filter(x=>x.completedAt&&after(x.completedAt)).map(x=>({id:x.id,name:x.name,completedAt:x.completedAt,rewardVersion:x.rewardVersion})),rewardTransactions:s.rewardTransactions.filter(x=>after(x.createdAt)).map(clone),levelUps:s.levelUps.filter(x=>after(x.earnedAt)).map(clone),achievements:s.earnedAchievements.filter(x=>after(x.earnedAt)).map(clone)}}
function progressionMarkdown(p){
 const lines=["## Progression Since Last Handoff","",`Player: Level ${p.player.level} | ${p.player.xp}%`,"","### Missions Completed",...(p.missionsCompleted.length?p.missionsCompleted.map(x=>`- ${x.name} - ${x.completedAt}`):["- None"]),"" ,"### Rewards Earned"];if(!p.rewardTransactions.length)lines.push("- None");for(const t of p.rewardTransactions){if(t.rewards.playerXp)lines.push(`- ${t.sourceName}: +${t.rewards.playerXp} Player XP`);for(const r of t.rewards.progression)lines.push(`- ${t.sourceName}: +${r.amount} ${r.targetId} XP`)}lines.push("","### Levels Gained",...(p.levelUps.length?p.levelUps.map(x=>`- ${x.targetName}: Level ${x.previousLevel} -> Level ${x.newLevel}`):["- None"]),"","### Achievements",...(p.achievements.length?p.achievements.map(x=>`- ${x.name} - ${x.sourceName}`):["- None"]));return lines.join("\n")
}
function validateRewards(s,v){const rewards=normalizeRewards(v),warnings=[];for(const r of rewards.progression){const t=s.progression?.tracks?.[r.targetId];if(!t)warnings.push(`Unknown progression target: ${r.targetId}.`);else if(r.targetType&&t.type!==r.targetType)warnings.push(`Target type mismatch for ${r.targetId}; expected ${t.type}.`)}return{rewards,warnings}}
function mergeMissions(local,remote,preferRemote,transactions){
 const a=new Map((local||[]).map(x=>[x.id,x])),b=new Map((remote||[]).map(x=>[x.id,x])),out=[];for(const id of new Set([...a.keys(),...b.keys()])){const l=a.get(id),r=b.get(id),x=clone(preferRemote&&r?r:l||r);if(l&&r){x.completedAt=[l.completedAt,r.completedAt].filter(Boolean).sort()[0]||null;x.rewardClaimedAt=[l.rewardClaimedAt,r.rewardClaimedAt].filter(Boolean).sort()[0]||null;x.completionCount=Math.max(integer(l.completionCount),integer(r.completionCount))}const t=transactions.find(v=>v.type==="mission-completion"&&v.sourceId===id&&v.status==="applied");if(t){x.completedAt||=t.createdAt;x.rewardClaimedAt=t.createdAt;x.completionCount=Math.max(1,integer(x.completionCount))}out.push(x)}return out
}
// Canonicalize duplicate claims first, then rebuild from baseline so two devices cannot double-award XP.
function mergeCloudState(l,r,x){
 const tx=canonicalTransactions([...(l.rewardTransactions||[]),...(r.rewardTransactions||[])]),kept=new Set(tx.map(v=>v.id));x.rewardTransactions=tx;const merge=(a,b)=>{const m=new Map();for(const v of[...(a||[]),...(b||[])])if(v?.id&&(!v.transactionId||kept.has(v.transactionId)))m.set(v.id,clone(v));return[...m.values()].sort((c,d)=>new Date(c.earnedAt)-new Date(d.earnedAt))};x.levelUps=merge(l.levelUps,r.levelUps);x.earnedAchievements=merge(l.earnedAchievements,r.earnedAchievements);x.missions=mergeMissions(l.missions,r.missions,new Date(r.meta?.updatedAt||0)>new Date(l.meta?.updatedAt||0),tx);if(!x.progression?.baseline&&r.progression?.baseline)x.progression=clone(r.progression);return rebuildProgression(x)
}
class PresentationQueue{
 constructor(presenter){if(typeof presenter!=="function")throw TypeError("A presentation callback is required.");this.presenter=presenter;this.items=[];this.active=false}
 enqueue(item){return new Promise((resolve,reject)=>{this.items.push({item,resolve,reject});this.drain()})}
 async drain(){if(this.active)return;this.active=true;while(this.items.length){const e=this.items.shift();try{await this.presenter(e.item);e.resolve(e.item)}catch(error){e.reject(error)}}this.active=false}
 get size(){return this.items.length+(this.active?1:0)}
}
root.OptimizerProgressionEngine={PROGRESSION_VERSION:VERSION,XP_REQUIRED,TRACK_DEFINITIONS,ACHIEVEMENT_DEFINITIONS,MISSION_DEFAULTS,normalizeTrack,normalizeRewards,normalizeMission,migrateState,applyProgressionXp,claimMissionRewards,createManualAdjustment,createRewardTransaction,replayMission,rebuildProgression,trackForItem,formatMissionRewards,progressionHandoff,progressionMarkdown,validateRewards,mergeCloudState,PresentationQueue};
})(typeof window!=="undefined"?window:globalThis);
