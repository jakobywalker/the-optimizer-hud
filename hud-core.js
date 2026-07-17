(function(root){
"use strict";
const APP_VERSION="1.1.0",STATE_SCHEMA_VERSION=2,HANDOFF_SCHEMA_VERSION="1.0",UPDATE_SCHEMA_VERSION="1.0",EVENT_LIMIT=5000,HISTORY_LIMIT=730;
const OPS=new Set(["add","update","complete","reopen","archive","remove"]),TYPES=new Set(["topStat","characterStat","mainQuest","questStage","mission","missionTask","bottleneck","buff","debuff","resource","skill","homeBase","party","dailyAction","dailyPriority","habit","note","money"]);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function createId(){return root.crypto?.randomUUID?root.crypto.randomUUID():`id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,11)}`}
function iso(v,f){const d=v?new Date(v):new Date(f||Date.now());return Number.isNaN(d.getTime())?new Date(f||Date.now()).toISOString():d.toISOString()}
function mergeDeep(t,s){if(!s||typeof s!=="object")return t;Object.keys(s).forEach(k=>{if(Array.isArray(s[k]))t[k]=clone(s[k]);else if(s[k]&&typeof s[k]==="object")t[k]=mergeDeep(t[k]||{},s[k]);else t[k]=s[k]});return t}
function id(v,f){return v&&typeof v.id==="string"&&v.id?v.id:f()}
function item(v,f,fields){if(Array.isArray(v)){const o={id:f()};fields.forEach((x,i)=>o[x]=v[i]);return o}const o={...(v||{})};o.id=id(o,f);return o}
function dedupe(a,key){const m=new Map();(a||[]).forEach(x=>{if(x?.[key])m.set(x[key],clone(x))});return [...m.values()]}
const byTime=k=>(a,b)=>new Date(a?.[k]||0)-new Date(b?.[k]||0);
function recalculateMoney(history){if(!history.length)return[];let balance=Number(history[0].balance)-Number(history[0].delta||0);if(!Number.isFinite(balance))balance=0;return history.map(entry=>{const e=clone(entry),delta=Number(e.delta)||0;if(!e.undoneAt)balance=Math.round((balance+delta)*100)/100;e.balance=balance;return e})}
function migrateState(input,defaults,opt={}){const f=opt.idFactory||createId,now=iso(opt.now),raw=clone(input||{}),s=mergeDeep(clone(defaults||{}),raw);
 s.meta={schemaVersion:2,appVersion:APP_VERSION,createdAt:iso(s.meta?.createdAt,now),updatedAt:iso(s.meta?.updatedAt,now),lastHandoffAt:s.meta?.lastHandoffAt?iso(s.meta.lastHandoffAt,now):null,lastHandoffId:s.meta?.lastHandoffId||null};
 if(Array.isArray(s.top))s.top=s.top.map(x=>item(x,f,["name","value"]));else s.top=Object.entries(s.top||{}).map(([name,value])=>({id:f(),name,value:Number(value)||0}));
 s.character=(s.character||[]).map(x=>item(x,f,["icon","name","value"]));
 s.resources=(s.resources||[]).map(x=>item(x,f,["icon","name","value"]));
 s.skills=(s.skills||[]).map(x=>item(x,f,["name","value"]));
 s.base=(s.base||[]).map(x=>item(x,f,["icon","name","value"]));
 s.buffs=(s.buffs||[]).map(x=>item(x,f,["icon","name","description"]));
 s.activeDebuffs=(s.activeDebuffs||[]).map(x=>item(x,f,["icon","name","description"]));
 if(!raw.money||typeof raw.money!=="object"){
  const legacy=(raw.resources||[]).find(x=>String(Array.isArray(x)?x[1]:x?.name).toLowerCase()==="money");
  if(legacy){const value=Array.isArray(legacy)?legacy[2]:legacy.value,opening=Number(String(value??"").replace(/[^0-9.-]/g,""));if(Number.isFinite(opening))s.money={balance:opening,range:"30",history:[{id:"opening",ts:now,delta:0,balance:opening,note:"Opening balance",type:"set"}]}}
 } s.bottleneck={...(s.bottleneck||{}),id:id(s.bottleneck,f)};s.bottleneck.items=Array.isArray(s.bottleneck.items)?clone(s.bottleneck.items):[];
 s.quest={...(s.quest||{}),id:id(s.quest,f)};s.quest.stages=(s.quest.stages||[]).map(x=>item(x,f,["name","value"]));
 s.missions=(s.missions||[]).map(m=>{const o={...(m||{}),id:id(m,f),status:m?.status||"active"};o.tasks=(o.tasks||[]).map(t=>Array.isArray(t)?{id:f(),name:String(t[0]||""),completed:Boolean(t[1])}:{...(t||{}),id:id(t,f),name:String(t?.name||t?.title||""),completed:Boolean(t?.completed??t?.done)});return o});
 s.daily={...(s.daily||{})};for(const g of ["night","morning"])s.daily[g]=(s.daily[g]||[]).map(x=>Array.isArray(x)?{id:f(),name:String(x[0]||""),completed:Boolean(x[1])}:{...(x||{}),id:id(x,f),completed:Boolean(x?.completed)});s.daily.priorities=(s.daily.priorities||[]).map(x=>typeof x==="string"?{id:f(),name:x}:{...(x||{}),id:id(x,f)});
 s.habits={...(s.habits||{})};if(!Array.isArray(s.habits.items)){const n=Array.isArray(s.habits.names)?s.habits.names:[],v=Array.isArray(s.habits.values)?s.habits.values:[];s.habits.items=n.map((name,i)=>({id:f(),name,values:Array.from({length:7},(_,d)=>Boolean(v[i]?.[d]))}))}else s.habits.items=s.habits.items.map(x=>({...x,id:id(x,f),values:Array.from({length:7},(_,d)=>Boolean(x?.values?.[d]))}));delete s.habits.names;delete s.habits.values;
 s.party=(s.party||[]).map(x=>typeof x==="string"?{id:f(),name:x}:{...(x||{}),id:id(x,f),name:String(x?.name||"")});
 s.money={...(s.money||{}),balance:Number.isFinite(Number(s.money?.balance))?Number(s.money.balance):0,range:String(s.money?.range||"30")};
 const moneySource=raw.money&&typeof raw.money==="object"?(Array.isArray(raw.money.history)?raw.money.history:[]):(Array.isArray(s.money.history)?s.money.history:[]);
 s.money.history=dedupe(moneySource.map((e,i)=>({...e,id:e?.id||(i?f():"opening"),ts:iso(e?.ts,now),delta:Number(e?.delta)||0,balance:Number(e?.balance)||0,note:String(e?.note||"Balance update"),type:e?.type||"adjust",undoneAt:e?.undoneAt?iso(e.undoneAt,now):null})),"id").sort(byTime("ts"));
 if(!s.money.history.length)s.money.history=[{id:"opening",ts:now,delta:0,balance:s.money.balance,note:"Opening balance",type:"set",undoneAt:null}];
 s.money.history=recalculateMoney(s.money.history);s.money.balance=Number(s.money.history.at(-1)?.balance)||0; s.events=dedupe((Array.isArray(s.events)?s.events:[]).map(x=>({...x,id:x?.id||f(),timestamp:iso(x?.timestamp,now)})),"id").sort(byTime("timestamp")).slice(-EVENT_LIMIT);
 s.checkIns=dedupe((Array.isArray(s.checkIns)?s.checkIns:[]).map(x=>({...x,id:x?.id||f(),timestamp:iso(x?.timestamp,now)})),"id").sort(byTime("timestamp"));
 s.handoffs=dedupe((Array.isArray(s.handoffs)?s.handoffs:[]).map(x=>({...x,exportId:x?.exportId||f(),exportedAt:iso(x?.exportedAt,now)})),"exportId").sort(byTime("exportedAt"));
 s.dailyHistory=dedupe((Array.isArray(s.dailyHistory)?s.dailyHistory:[]).map(x=>({...x,id:x?.id||`daily-${x?.date||f()}`,archivedAt:iso(x?.archivedAt,now)})),"id").sort(byTime("archivedAt")).slice(-HISTORY_LIMIT);
 s.weeklyHistory=dedupe((Array.isArray(s.weeklyHistory)?s.weeklyHistory:[]).map(x=>({...x,id:x?.id||`weekly-${x?.week||f()}`,archivedAt:iso(x?.archivedAt,now)})),"id").sort(byTime("archivedAt")).slice(-HISTORY_LIMIT);s.rollback=s.rollback?.updateId?clone(s.rollback):null;return s}
function touch(s,t){s.meta=s.meta||{};Object.assign(s.meta,{schemaVersion:2,appVersion:APP_VERSION,updatedAt:iso(t)})}
function recordEvent(s,d,opt={}){const e={id:d.id||(opt.idFactory||createId)(),timestamp:iso(d.timestamp||opt.now),action:String(d.action||"state changed"),entityType:String(d.entityType||"state"),entityId:d.entityId||null,entityName:d.entityName||null,previousValue:clone(d.previousValue),newValue:clone(d.newValue),note:d.note||"",source:d.source||"user",clientId:d.clientId||opt.clientId||"unknown"};s.events=Array.isArray(s.events)?s.events:[];if(!s.events.some(x=>x.id===e.id))s.events.push(e);s.events.sort(byTime("timestamp"));if(s.events.length>EVENT_LIMIT)s.events.splice(0,s.events.length-EVENT_LIMIT);touch(s,e.timestamp);return e}
function summary(a){const total=a.length,complete=a.filter(x=>x.completed).length;return{total,complete,incomplete:total-complete,percent:total?Math.round(complete/total*100):0}}
function archiveRollovers(s,k,opt={}){const now=iso(opt.now);let changed=false;if(s.daily?.date!==k.today){const a=[...(s.daily.night||[]),...(s.daily.morning||[])],z=summary(a),old=s.daily.date,key=`daily-${old}`;if(!s.dailyHistory.some(x=>x.id===key))s.dailyHistory.push({id:key,date:old,archivedAt:now,completedActions:a.filter(x=>x.completed).map(x=>({id:x.id,name:x.name})),incompleteActions:a.filter(x=>!x.completed).map(x=>({id:x.id,name:x.name})),completionPercent:z.percent});a.forEach(x=>x.completed=false);s.daily.date=k.today;recordEvent(s,{action:"daily rollover",entityType:"daily",entityId:key,entityName:key,previousValue:z,newValue:{date:k.today},source:"system"},opt);changed=true}if(s.habits?.week!==k.week){const h=s.habits.items||[],total=h.length*7,complete=h.reduce((n,x)=>n+x.values.filter(Boolean).length,0),old=s.habits.week,key=`weekly-${old}`;if(!s.weeklyHistory.some(x=>x.id===key))s.weeklyHistory.push({id:key,week:old,archivedAt:now,habits:h.map(x=>({id:x.id,name:x.name,values:clone(x.values),completed:x.values.filter(Boolean).length})),completionPercent:total?Math.round(complete/total*100):0});h.forEach(x=>x.values=Array(7).fill(false));s.habits.week=k.week;recordEvent(s,{action:"weekly rollover",entityType:"habits",entityId:key,entityName:key,previousValue:{complete,total},newValue:{week:k.week},source:"system"},opt);changed=true}s.dailyHistory=dedupe(s.dailyHistory,"id").sort(byTime("archivedAt")).slice(-HISTORY_LIMIT);s.weeklyHistory=dedupe(s.weeklyHistory,"id").sort(byTime("archivedAt")).slice(-HISTORY_LIMIT);return changed}
const num=v=>v===""||v==null?null:Number.isFinite(Number(v))?Number(v):null,pct=v=>{const n=num(v);return n==null?null:Math.max(0,Math.min(100,n))};
function createCheckIn(s,v,opt={}){const sleep=num(v.sleepHours),c={id:(opt.idFactory||createId)(),timestamp:iso(opt.now),energy:pct(v.energy),clarity:pct(v.clarity),momentum:pct(v.momentum),alignment:pct(v.alignment),stress:pct(v.stress),sleepHours:sleep==null?null:Math.max(0,Math.min(24,sleep)),physicalCondition:String(v.physicalCondition||""),emotionalCondition:String(v.emotionalCondition||""),note:String(v.note||""),blockers:String(v.blockers||""),significantWins:String(v.significantWins||"")};s.checkIns.push(c);recordEvent(s,{action:"check-in recorded",entityType:"checkIn",entityId:c.id,entityName:"Condition check-in",previousValue:null,newValue:c,source:opt.source||"user"},opt);return c}
function questProgress(s){const a=s.quest?.stages||[];return a.length?Math.round(a.reduce((n,x)=>n+Number(x.value||0),0)/a.length):0}
const digest=e=>({id:e.id,timestamp:e.timestamp,action:e.action,entityType:e.entityType,entityId:e.entityId,entityName:e.entityName,previousValue:clone(e.previousValue),newValue:clone(e.newValue),note:e.note});
function authoritativeState(s){const x=clone(s);delete x.rollback;return x}
function buildHandoff(s,opt={}){const exportedAt=iso(opt.exportedAt||opt.now),exportId=opt.exportId||(opt.idFactory||createId)(),previousExportAt=s.meta.lastHandoffAt||null,events=(s.events||[]).filter(e=>!previousExportAt||new Date(e.timestamp)>new Date(previousExportAt)),daily=summary([...(s.daily.night||[]),...(s.daily.morning||[])]),ht=(s.habits.items||[]).length*7,hc=(s.habits.items||[]).reduce((n,x)=>n+x.values.filter(Boolean).length,0);return{format:"optimizer-ai-handoff",schemaVersion:HANDOFF_SCHEMA_VERSION,exportId,exportedAt,previousExportId:s.meta.lastHandoffId||null,previousExportAt,appVersion:APP_VERSION,summary:{currentChapter:`Level ${s.player?.level||0}`,mainQuest:s.quest.title,mainQuestProgress:questProgress(s),currentBottleneck:{title:s.bottleneck.title,detail:s.bottleneck.sub},completedSinceLastHandoff:events.filter(e=>/completed$/.test(e.action)).map(digest),reopenedSinceLastHandoff:events.filter(e=>/reopened$/.test(e.action)).map(digest),newlyAddedSinceLastHandoff:events.filter(e=>/\badded$/.test(e.action)||e.action==="mission created").map(digest),blockedItems:clone(s.bottleneck.items||[]),habitSummary:{completed:hc,total:ht,percent:ht?Math.round(hc/ht*100):0},dailySummary:daily,moneyChange:events.filter(e=>e.entityType==="money").reduce((n,e)=>n+Number(e.newValue?.delta||0),0),majorStatChanges:events.filter(e=>["topStat","characterStat"].includes(e.entityType)).map(digest)},latestCheckIn:clone(s.checkIns.at(-1)||null),changesSincePreviousHandoff:clone(events),currentState:authoritativeState(s),relevantHistory:{events:clone(s.events.slice(-1000)),checkIns:clone(s.checkIns.slice(-100)),daily:clone(s.dailyHistory.slice(-90)),weekly:clone(s.weeklyHistory.slice(-52)),money:clone(s.money.history.slice(-1000))}}}
function commitHandoff(s,h,opt={}){s.handoffs.push({exportId:h.exportId,exportedAt:h.exportedAt,previousExportId:h.previousExportId,previousExportAt:h.previousExportAt});s.handoffs=dedupe(s.handoffs,"exportId").sort(byTime("exportedAt"));s.meta.lastHandoffId=h.exportId;s.meta.lastHandoffAt=h.exportedAt;recordEvent(s,{action:"AI handoff exported",entityType:"handoff",entityId:h.exportId,entityName:"AI handoff",previousValue:h.previousExportId,newValue:h.exportId},opt)}
function handoffToMarkdown(h){return["# Optimizer AI Handoff","",`- Export ID: \`${h.exportId}\``,`- Exported: ${h.exportedAt}`,`- Main quest: ${h.summary.mainQuest} (${h.summary.mainQuestProgress}%)`,`- Bottleneck: ${h.summary.currentBottleneck.title}`,"","## Latest Check-In","",h.latestCheckIn?"```json\n"+JSON.stringify(h.latestCheckIn,null,2)+"\n```":"No check-in recorded.","","## Changes Since Previous Handoff","",...(h.changesSincePreviousHandoff.length?h.changesSincePreviousHandoff.map(e=>`- ${e.timestamp}: **${e.action}** - ${e.entityName||e.entityType}`):["No recorded changes."]),"","## Current State","","```json",JSON.stringify(h.currentState,null,2),"```",""].join("\n")}
function resolve(s,o){
 const maps={topStat:s.top,characterStat:s.character,questStage:s.quest.stages,mission:s.missions,buff:s.buffs,debuff:s.activeDebuffs,resource:s.resources,skill:s.skills,homeBase:s.base,party:s.party,dailyPriority:s.daily.priorities,habit:s.habits.items};
 if(maps[o.entityType]){const i=maps[o.entityType].findIndex(x=>x.id===o.entityId);return i<0?null:{type:o.entityType,item:maps[o.entityType][i],collection:maps[o.entityType],index:i}}
 if(o.entityType==="dailyAction"){for(const group of ["night","morning"]){const i=s.daily[group].findIndex(x=>x.id===o.entityId);if(i>=0)return{type:o.entityType,item:s.daily[group][i],collection:s.daily[group],index:i,group}}return null}
 if(o.entityType==="mainQuest")return s.quest.id===o.entityId?{type:o.entityType,item:s.quest}:null;
 if(o.entityType==="bottleneck")return s.bottleneck.id===o.entityId?{type:o.entityType,item:s.bottleneck}:null;
 if(o.entityType==="missionTask"){for(const m of s.missions){const i=m.tasks.findIndex(x=>x.id===o.entityId);if(i>=0)return{type:o.entityType,item:m.tasks[i],collection:m.tasks,index:i,parent:m}}return null}
 if(o.entityType==="note"&&(!o.entityId||o.entityId==="today-leverage"))return{type:o.entityType,item:s,property:"todayLeverage"};
 if(o.entityType==="money")return{type:o.entityType,item:s.money};
 return null
}const getPath=(o,p)=>String(p||"").split(".").filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],o);
function safePath(p){const a=String(p||"").split(".").filter(Boolean);return a.length&&!a.some(k=>["__proto__","prototype","constructor"].includes(k))}
function setPath(o,p,v){if(!safePath(p))throw Error("An update operation requires a safe path.");const a=String(p).split(".").filter(Boolean);let x=o;for(let i=0;i<a.length-1;i++)x=x[a[i]]||(x[a[i]]={});x[a.at(-1)]=clone(v)}const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function readValue(t,o){if(!t)return;if(t.property)return t.item[t.property];if(["complete","reopen"].includes(o.operation)&&o.path)return getPath(t.item,o.path);if(["complete","reopen"].includes(o.operation))return t.item.completed??t.item.value??t.item.status;if(o.path)return getPath(t.item,o.path);return clone(t.item)}
function validateAiUpdate(s,p){
 const r={patch:p,errors:[],warnings:[],valid:[],conflicting:[],unresolved:[],baseMismatch:false};
 if(!p||typeof p!=="object"){r.errors.push("The update file must contain a JSON object.");return r}
 if(p.format!=="optimizer-ai-update")r.errors.push("Invalid update format.");
 if(p.schemaVersion!==UPDATE_SCHEMA_VERSION)r.errors.push("Unsupported update schema version.");
 if(!p.updateId)r.errors.push("Missing updateId.");
 if(!p.generatedAt)r.warnings.push("generatedAt is missing.");
 if(!Array.isArray(p.operations))r.errors.push("Operations must be an array.");
 if(p.baseExportId!=null&&p.baseExportId!==s.meta.lastHandoffId){r.baseMismatch=true;r.errors.push(`baseExportId does not match the last handoff (${s.meta.lastHandoffId||"none"}).`)}
 if(p.updateId&&(s.events||[]).some(e=>e.action==="AI update imported"&&e.entityId===p.updateId))r.errors.push("This updateId has already been imported.");
 if(!Array.isArray(p.operations))return r;
 const seen=new Set(),addTypes=new Set(["topStat","characterStat","questStage","mission","missionTask","buff","debuff","resource","skill","homeBase","party","dailyAction","dailyPriority","habit"]),completable=new Set(["questStage","mission","missionTask","dailyAction","habit"]);
 p.operations.forEach((raw,i)=>{
  const o={...(raw||{}),id:raw?.id||`operation-${i+1}`};
  if(seen.has(o.id)){r.errors.push(`Duplicate operation ID: ${o.id}.`);r.unresolved.push({operation:o,reason:"Duplicate operation ID."});return}seen.add(o.id);
  if(!OPS.has(o.operation)||!TYPES.has(o.entityType)){r.unresolved.push({operation:o,reason:"Unsupported operation or entity type."});return}
  if(o.entityType==="money"){
   const delta=Number(o.value?.delta);
   if(o.operation!=="add"||!Number.isFinite(delta)||!delta){r.unresolved.push({operation:o,reason:"Money updates must be non-zero additive ledger operations."});return}
   const cur=s.money.balance;
   if(Object.hasOwn(o,"previousValue")&&!equal(o.previousValue,cur)){r.conflicting.push({operation:o,target:resolve(s,o),currentValue:cur,reason:"Previous value conflict."});return}
   r.valid.push({operation:o,target:resolve(s,o),currentValue:cur});return
  }
  if(o.operation==="archive"&&o.entityType!=="mission"){r.unresolved.push({operation:o,reason:"Only missions can be archived."});return}
  if(["complete","reopen"].includes(o.operation)&&!completable.has(o.entityType)){r.unresolved.push({operation:o,reason:"This entity type cannot be completed or reopened."});return}
  if(o.entityType==="habit"&&["complete","reopen"].includes(o.operation)&&!/^values\.[0-6]$/.test(String(o.path||""))){r.unresolved.push({operation:o,reason:"Habit completion requires a values.0 through values.6 path."});return}
  const isAdd=o.operation==="add"&&addTypes.has(o.entityType),addTask=isAdd&&o.entityType==="missionTask";
  if(o.operation==="add"&&!isAdd){r.unresolved.push({operation:o,reason:"Add is not supported for this entity type."});return}
  if(isAdd&&(o.value==null||typeof o.value!=="object")){r.unresolved.push({operation:o,reason:"Add operations require an object value."});return}
  if(addTask&&!s.missions.some(m=>m.id===o.entityId)){r.unresolved.push({operation:o,reason:"Unknown parent mission ID."});return}
  const t=isAdd?null:resolve(s,o);
  if(!t){if(isAdd){r.valid.push({operation:o,target:null,currentValue:null});return}r.unresolved.push({operation:o,reason:"Unknown entity ID."});return}
  if(o.operation==="remove"&&!t.collection&&o.entityType!=="party"){r.unresolved.push({operation:o,reason:"This target cannot be removed."});return}
  if(o.operation==="update"&&o.entityType!=="note"&&!safePath(o.path)){r.unresolved.push({operation:o,reason:"Update operations require a safe target path."});return}
  const cur=readValue(t,o);
  if(Object.hasOwn(o,"previousValue")&&!equal(o.previousValue,cur)){r.conflicting.push({operation:o,target:t,currentValue:clone(cur),reason:"Previous value conflict."});return}
  r.valid.push({operation:o,target:t,currentValue:clone(cur)})
 });
 return r
}function rollbackSnapshot(s){const x=clone(s);delete x.rollback;return x}
function mutationAction(type,verb){
 if(type==="missionTask")return verb==="changed"?"task edited":`task ${verb}`;
 if(type==="mission")return verb==="added"?"mission created":`mission ${verb}`;
 if(type==="questStage")return "quest stage changed";
 if(type==="topStat"||type==="characterStat")return "stat changed";
 if(type==="homeBase")return "home-base value changed";
 if(type==="mainQuest")return "main quest changed";
 if(type==="dailyAction")return `daily action ${verb}`;
 if(type==="dailyPriority")return "daily priority changed";
 if(type==="habit")return `habit ${verb}`;
 if(type==="note")return "note changed";
 return `${type} ${verb}`
}
function applyOperation(s,o,opt){
 const t=resolve(s,o);let previous=t?readValue(t,o):null,next=clone(o.value),name=t?.item?.name||t?.item?.title||o.entityType,action=mutationAction(o.entityType,"changed"),targetId=o.entityId;
 if(o.entityType==="money"){
  const delta=Number(o.value?.delta),entry={id:o.value?.id||(opt.idFactory||createId)(),ts:iso(opt.now),delta,balance:0,note:String(o.value?.note||o.reason||"AI ledger entry"),type:delta>0?"income":"expense",undoneAt:null};
  previous=s.money.balance;s.money.history.push(entry);s.money.history=recalculateMoney(s.money.history.sort(byTime("ts")));s.money.balance=s.money.history.at(-1).balance;next=s.money.history.find(x=>x.id===entry.id);name=entry.note;action="money entry added";targetId=entry.id;
 }else if(o.operation==="add"){
  let collection;
  if(o.entityType==="missionTask")collection=s.missions.find(x=>x.id===o.entityId).tasks;
  else if(o.entityType==="dailyAction"){const group=o.value.group==="morning"?"morning":"night";collection=s.daily[group]}
  else collection={topStat:s.top,characterStat:s.character,questStage:s.quest.stages,mission:s.missions,buff:s.buffs,debuff:s.activeDebuffs,resource:s.resources,skill:s.skills,homeBase:s.base,party:s.party,dailyPriority:s.daily.priorities,habit:s.habits.items}[o.entityType];
  const x={...o.value,id:o.value.id||(opt.idFactory||createId)()};delete x.group;
  if(o.entityType==="mission"){x.tasks=(x.tasks||[]).map(q=>({...q,id:q.id||(opt.idFactory||createId)(),completed:Boolean(q.completed)}));x.status=x.status||"active"}
  if(o.entityType==="missionTask"||o.entityType==="dailyAction")x.completed=Boolean(x.completed);
  if(o.entityType==="habit")x.values=Array.from({length:7},(_,i)=>Boolean(x.values?.[i]));
  if(o.entityType==="party")x.name=String(x.name||"");
  collection.push(x);next=x;name=x.name||x.title||o.entityType;targetId=x.id;action=mutationAction(o.entityType,"added");
 }else if(o.operation==="remove"){
  if(o.entityType==="party"){previous=clone(t.item);t.item.name="";next=clone(t.item)}else{t.collection.splice(t.index,1);next=null}
  action=mutationAction(o.entityType,"removed");
 }else if(o.operation==="archive"){
  previous=t.item.status;t.item.status="archived";next=t.item.status;action="mission archived";
 }else if(["complete","reopen"].includes(o.operation)){
  const done=o.operation==="complete",verb=done?"completed":"reopened";
  if(o.path){setPath(t.item,o.path,done);next=getPath(t.item,o.path)}
  else if(Object.hasOwn(t.item,"completed")){t.item.completed=done;next=t.item.completed}
  else if(Object.hasOwn(t.item,"value")){t.item.value=done?100:0;next=t.item.value}
  else{t.item.status=done?"completed":"active";next=t.item.status}
  action=mutationAction(o.entityType,verb);
 }else if(t.property){
  t.item[t.property]=clone(o.value);next=t.item[t.property];action="note changed";
 }else{
  setPath(t.item,o.path,o.value);next=getPath(t.item,o.path);action=mutationAction(o.entityType,"changed");
 }
 return recordEvent(s,{action,entityType:o.entityType,entityId:targetId,entityName:name,previousValue:previous,newValue:next,note:o.reason||"",source:"ai"},opt)
}function replaceState(target,source){Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,clone(source))}
function applyAiUpdate(s,v,selected,opt={}){
 if(v.errors.length)throw Error(v.errors.join(" "));
 const ids=new Set(selected==null?v.valid.map(x=>x.operation.id):selected),list=[...v.valid,...v.conflicting].filter(x=>ids.has(x.operation.id));
 if(!list.length)throw Error("Select at least one valid or conflicting operation.");
 const original=clone(s),p=v.patch;
 try{
  s.rollback={createdAt:iso(opt.now),updateId:p.updateId,stateBeforeUpdate:rollbackSnapshot(s)};
  const applied=list.map(x=>({operationId:x.operation.id,eventId:applyOperation(s,x.operation,opt).id}));
  recordEvent(s,{action:"AI update imported",entityType:"aiUpdate",entityId:p.updateId,entityName:p.title||"AI update",previousValue:null,newValue:{appliedOperations:applied.map(x=>x.operationId)},note:p.rationale||"",source:"ai"},opt);
  return applied
 }catch(error){replaceState(s,original);throw error}
}function restoreRollback(s,opt={}){
 if(!s.rollback?.stateBeforeUpdate)throw Error("No AI update rollback is available.");
 const now=iso(opt.now),updateId=s.rollback.updateId,x=clone(s.rollback.stateBeforeUpdate);
 x.events=dedupe([...(x.events||[]),...(s.events||[])],"id").sort(byTime("timestamp")).slice(-EVENT_LIMIT);
 const beforeIds=new Set((x.money?.history||[]).map(e=>e.id)),rolledBack=(s.money?.history||[]).filter(e=>!beforeIds.has(e.id)).map(e=>({...e,undoneAt:now,undoReason:`Rollback ${updateId}`}));
 x.money.history=recalculateMoney([...(x.money?.history||[]),...rolledBack].sort(byTime("ts")));x.money.balance=x.money.history.at(-1)?.balance||0;
 x.rollback={createdAt:s.rollback.createdAt,updateId,restoredAt:now,stateBeforeUpdate:null};
 recordEvent(x,{action:"AI update rolled back",entityType:"aiUpdate",entityId:updateId,entityName:updateId,previousValue:"applied",newValue:"rolled back"},opt);
 return x
}function mergeMoney(a,b){
 const map=new Map();
 for(const entry of [...(a||[]),...(b||[])]){if(!entry?.id)continue;const previous=map.get(entry.id)||{},merged={...previous,...clone(entry)};if(previous.undoneAt||entry.undoneAt)merged.undoneAt=[previous.undoneAt,entry.undoneAt].filter(Boolean).sort().at(-1);map.set(entry.id,merged)}
 return recalculateMoney([...map.values()].sort(byTime("ts")))
}
function mergeCloudState(l,r){
 const x=clone(l),merge=(a,b,k,t)=>dedupe([...(a||[]),...(b||[])],k).sort(byTime(t));
 x.events=merge(l.events,r.events,"id","timestamp").slice(-EVENT_LIMIT);
 x.checkIns=merge(l.checkIns,r.checkIns,"id","timestamp");
 x.handoffs=merge(l.handoffs,r.handoffs,"exportId","exportedAt");
 x.dailyHistory=merge(l.dailyHistory,r.dailyHistory,"id","archivedAt").slice(-HISTORY_LIMIT);
 x.weeklyHistory=merge(l.weeklyHistory,r.weeklyHistory,"id","archivedAt").slice(-HISTORY_LIMIT);
 x.money=x.money||{};x.money.history=mergeMoney(l.money?.history,r.money?.history);if(x.money.history.length)x.money.balance=x.money.history.at(-1).balance;
 const h=x.handoffs.at(-1);if(h){x.meta.lastHandoffId=h.exportId;x.meta.lastHandoffAt=h.exportedAt}
 const rollbackTime=v=>new Date(v?.restoredAt||v?.createdAt||0).getTime();if(r.rollback&&rollbackTime(r.rollback)>rollbackTime(x.rollback))x.rollback=clone(r.rollback);
 touch(x);return x
}root.OptimizerHudCore={APP_VERSION,STATE_SCHEMA_VERSION,HANDOFF_SCHEMA_VERSION,UPDATE_SCHEMA_VERSION,createId,clone,mergeDeep,migrateState,recordEvent,archiveRollovers,createCheckIn,buildHandoff,commitHandoff,handoffToMarkdown,validateAiUpdate,applyAiUpdate,restoreRollback,mergeCloudState,questProgress,authoritativeState};
})(typeof window!=="undefined"?window:globalThis);
