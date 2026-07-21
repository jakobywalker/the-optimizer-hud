(function(root){
"use strict";

const base="assets/art";
const paths=Object.freeze({
 backgrounds:Object.freeze({
  hud:`${base}/backgrounds/hud-command-center-ultrawide.jpg`,
  grinds:`${base}/backgrounds/grinds-contract-terminal-ultrawide.jpg`
 }),
 campaign:Object.freeze({
  hero:`${base}/campaigns/subject-to-change/hero.jpg`,
  card:`${base}/campaigns/subject-to-change/card.jpg`,
  completion:`${base}/campaigns/subject-to-change/completion-background.jpg`
 }),
 grinds:Object.freeze({
  "music-creation":`${base}/grinds/music-creation.jpg`,
  "vocal-recording":`${base}/grinds/vocal-recording.jpg`,
  performance:`${base}/grinds/performance.jpg`,
  fitness:`${base}/grinds/fitness.jpg`,
  revenue:`${base}/grinds/revenue.jpg`,
  "content-production":`${base}/grinds/content-production.jpg`
 }),
 currencies:Object.freeze({
  "optimizer-credits":`${base}/currencies/optimizer-credits.jpg`,
  "mastery-tokens":`${base}/currencies/mastery-token.jpg`,
  "unlock-keys":`${base}/currencies/unlock-key.jpg`,
  "revenue-credits":`${base}/currencies/revenue-credit.jpg`
 }),
 achievements:Object.freeze({
  normal:`${base}/achievements/normal-achievement.jpg`,
  campaign:`${base}/achievements/campaign-achievement.jpg`,
  boss:`${base}/achievements/boss-completion.jpg`
 }),
 unlocks:Object.freeze({
  locked:`${base}/unlocks/card-locked.jpg`,
  unlocked:`${base}/unlocks/card-unlocked.jpg`
 })
});

const activityKeys=Object.freeze({
 "activity-songwriting":"music-creation",
 "activity-vocal-session":"vocal-recording",
 "activity-rehearsal":"performance",
 "activity-content-production":"content-production",
 "activity-content-release":"content-production",
 "activity-gym-protocol":"fitness",
 "activity-steps-8k":"fitness",
 "activity-sleep-7":"fitness",
 "activity-outreach":"revenue",
 "activity-applications":"revenue",
 "activity-pipeline":"revenue",
 "activity-paid-work":"revenue"
});

function grindKey(activity={}){
 if(activityKeys[activity.id])return activityKeys[activity.id];
 const signal=[activity.id,activity.name,activity.domain,...(activity.tags||[])].join(" ").toLowerCase();
 if(/vocal|record/.test(signal))return"vocal-recording";
 if(/performance|rehears|stage/.test(signal))return"performance";
 if(/content|release|capture|media/.test(signal))return"content-production";
 if(/fitness|gym|steps|sleep|body|training/.test(signal))return"fitness";
 if(/revenue|outreach|application|pipeline|paid|income|sales/.test(signal))return"revenue";
 if(/music|song|writing|album/.test(signal))return"music-creation";
 return null;
}

function achievementKey(achievement={}){
 const signal=[achievement.rarity,achievement.sourceType,achievement.name].join(" ").toLowerCase();
 if(/legendary|boss/.test(signal))return"boss";
 if(/epic|rare|campaign|milestone/.test(signal))return"campaign";
 return"normal";
}

const all=Object.freeze(Object.values(paths).flatMap(group=>Object.values(group)));
root.OptimizerArtwork=Object.freeze({
 paths,
 all,
 grindKey,
 grindFor:activity=>paths.grinds[grindKey(activity)]||null,
 currencyFor:id=>paths.currencies[id]||paths.currencies["optimizer-credits"],
 achievementKey,
 achievementFor:achievement=>paths.achievements[achievementKey(achievement)],
 unlockFor:status=>status==="purchased"?paths.unlocks.unlocked:paths.unlocks.locked
});
})(typeof globalThis!=="undefined"?globalThis:this);
