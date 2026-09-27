import {HUMAN_POSTURE_RANGES} from './human-habits.js';
// Adult-human construction family. Shape and clothing are independent of role,
// complexion and gender; a future species supplies its own anatomical family.
const variants = {
 captain: {body:[1.04,1.06,1.02,.98,1.02,1.02],head:[1.04,1.10,1.00,1.07,1.08,1.08,1.02,0],outfit:'standard'},
 iona:    {body:[.92,.96,.88,1.12,.95,.92],head:[.97,.88,1.08,.94,.93,.93,1.01,3],outfit:'cargo'},
 bex:     {body:[1.09,1.13,1.10,1.10,1.12,1.10],head:[1.08,1.04,1.12,.96,.98,1.03,1.06,2],outfit:'work'},
 oren:    {body:[.98,.96,.93,.96,.95,.93],head:[.97,1.03,.94,1.10,1.14,1.08,1.05,5],outfit:'coat'},
 mara:    {body:[.94,1.00,.94,1.08,1.02,.97],head:[1.02,.93,1.07,.95,1.03,.94,.98,1],outfit:'vest'},
 jun:     {body:[.91,.90,.86,.97,.91,.89],head:[.94,.95,1.03,1.02,.91,.96,.94,4],outfit:'standard'}
};
const bodyKeys=['shoulder','rib','waist','pelvis','depth','arm'];
// Volume changes stay inside the existing skeleton's reach and support envelope.
// Metre offsets are separate from dimensionless breadth/depth multipliers.
const anatomy={
 captain:{neck:1.06,belly:.94,chestDepth:1.08,shoulderSlope:-.004,forearm:1.04,thigh:1.02,calf:1.04},
 iona:{neck:.91,belly:.87,chestDepth:.94,shoulderSlope:.012,forearm:.93,thigh:1.05,calf:.96},
 bex:{neck:1.14,belly:1.20,chestDepth:1.10,shoulderSlope:.004,forearm:1.13,thigh:1.10,calf:1.10},
 oren:{neck:.94,belly:1.11,chestDepth:.91,shoulderSlope:.020,forearm:.92,thigh:.92,calf:.92},
 mara:{neck:.98,belly:1.04,chestDepth:1.03,shoulderSlope:.008,forearm:.99,thigh:1.07,calf:1.02},
 jun:{neck:.90,belly:.86,chestDepth:.92,shoulderSlope:.002,forearm:.88,thigh:.90,calf:.93},
};
const bodyRanges=Object.fromEntries([...bodyKeys,'neck','belly','chestDepth','forearm','thigh','calf'].map(k=>[k,[.85,1.20]]));
bodyRanges.shoulder=[.90,1.12];bodyRanges.shoulderSlope=[-.008,.020];
const headKeys=['width','jaw','cheek','chin','nose','brow','depth','style'];
// Resting carriage is an independent authoring channel, never inferred from gender.
const postures={
 captain:{idleChestPitch:-.018,idleChestLift:.005,shoulderRest:-.015,shoulderForward:-.01,headPitch:.008,headTilt:0,armBend:.38,armAsymmetry:-.15,armForward:.018},
 iona:{idleChestPitch:-.012,idleChestLift:.007,shoulderRest:.008,shoulderForward:.018,headPitch:.006,headTilt:-.006,armBend:.52,armAsymmetry:.20,armForward:.022},
 bex:{idleChestPitch:.025,idleChestLift:-.004,shoulderRest:-.070,shoulderForward:.055,headPitch:-.012,headTilt:-.012,armBend:.60,armAsymmetry:-.32,armForward:.030},
 oren:{idleChestPitch:.060,idleChestLift:-.008,shoulderRest:-.075,shoulderForward:.042,headPitch:-.030,headTilt:.004,armBend:.24,armAsymmetry:.10,armForward:.015},
 mara:{idleChestPitch:-.025,idleChestLift:.008,shoulderRest:.016,shoulderForward:-.018,headPitch:.018,headTilt:.015,armBend:.57,armAsymmetry:.38,armForward:.018},
 jun:{idleChestPitch:.008,idleChestLift:0,shoulderRest:-.025,shoulderForward:.012,headPitch:-.004,headTilt:-.008,armBend:.36,armAsymmetry:-.20,armForward:.025},
};

// Garment fit belongs to the outfit, independently of anatomy or gender.
const wardrobes={
 standard:{hem:1.37,waist:1.06,sleeve:1.09,shirt:'#b7b4a1',trim:'#393f40',trouser:1},
 work:{hem:1.265,waist:1.16,sleeve:1.19,shirt:'#555c58',trim:'#65513b',trouser:1.12},
 cargo:{hem:1.32,waist:1.025,sleeve:1.11,shirt:'#aeb9b0',trim:'#444c49',trouser:1.15},
 coat:{hem:1.075,waist:1.045,sleeve:1.045,shirt:'#c7c4b0',trim:'#394149',trouser:.97},
 vest:{hem:1.36,waist:1.10,sleeve:.97,shirt:'#b8b6a0',trim:'#354b4d',trouser:1.04},
};
const facialLandmarks={
 captain:{jawAngle:.56,chinWidth:1.10,eyeSpacing:.96,browTilt:-.07},
 iona:{jawAngle:.19,chinWidth:.88,eyeSpacing:1.04,eyeTilt:.045,browTilt:.055},
 bex:{jawAngle:.44,chinWidth:1.08,eyeSpacing:1.02,noseBridge:.96,browTilt:-.025},
 oren:{jawAngle:.38,chinWidth:.94,eyeSpacing:.94,noseBridge:1.18,browTilt:-.08},
 mara:{jawAngle:.26,chinWidth:.94,eyeSpacing:1.07,eyeTilt:.025,browTilt:.045},
 jun:{jawAngle:.21,chinWidth:.89,eyeSpacing:1.02,noseBridge:.90,browTilt:.015},
};
const facialRanges={jawAngle:[0,.85],chinWidth:[.8,1.2],eyeSpacing:[.88,1.12],eyeTilt:[-.12,.12],noseBridge:[.75,1.25],browTilt:[-.14,.14]};
export function humanProfile(identity,seed=0){
 const name=String(identity?.name||identity||'').toLowerCase();
 const key=identity?.appearance?.template||Object.keys(variants).find(k=>name.includes(k));
 const resolved=Object.hasOwn(variants,key)?key:Object.keys(variants)[seed%6];
 const v=variants[resolved];
 const body=Object.fromEntries(bodyKeys.map((k,i)=>[k,v.body[i]]));
 Object.assign(body,anatomy[resolved]);
 const head=Object.fromEntries(headKeys.map((k,i)=>[k,v.head[i]]));
 Object.assign(head,facialLandmarks[resolved]);
 // A profile may customize landmarks without replacing the shared rig contract.
 for(const [k,[lo,hi]]of Object.entries(bodyRanges)){const value=identity?.appearance?.body?.[k];if(Number.isFinite(value))body[k]=Math.max(lo,Math.min(hi,value));}
 for(const k of headKeys){const value=identity?.appearance?.head?.[k];if(Number.isFinite(value))head[k]=k==='style'?Math.max(0,Math.min(5,Math.round(value))):Math.max(.85,Math.min(1.16,value));}
 for(const [k,[lo,hi]]of Object.entries(facialRanges)){const value=identity?.appearance?.head?.[k];if(Number.isFinite(value))head[k]=Math.max(lo,Math.min(hi,value));}
 const child=identity?.ageGroup==='child';if(child){Object.assign(body,{shoulder:.88,rib:.92,waist:.92,pelvis:.92,arm:.88,neck:.92,belly:1,chestDepth:.96,shoulderSlope:.006,forearm:.92,thigh:.94,calf:.94});Object.assign(head,{jaw:.88,chin:.9,nose:.86,brow:.9,cheek:1.12});}
 const posture={...postures[resolved]};
 for(const [k,[lo,hi]]of Object.entries(HUMAN_POSTURE_RANGES)){const value=identity?.appearance?.posture?.[k];if(Number.isFinite(value))posture[k]=Math.max(lo,Math.min(hi,value));}
 const outfit=Object.hasOwn(wardrobes,identity?.appearance?.outfit)?identity.appearance.outfit:v.outfit;
 return {family:child?'young-human':'adult-human',body,head,posture,outfit,wardrobe:{...wardrobes[outfit]},scale:child?Math.max(.55,Math.min(.8,identity.visualScale||.68)):1,headScale:child?1.13:1};
}
