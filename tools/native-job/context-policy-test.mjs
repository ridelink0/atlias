import assert from 'node:assert/strict';
import {contextOverrides,summaryFixtureRequest} from './context-policy.mjs';
let checks = 0;
const equal = (a,b) => {assert.deepEqual(a,b);checks++;};
const rejects = (host, policy) => {assert.throws(() => contextOverrides(host,policy));checks++;};
for (const host of ['codex','claude']) equal(contextOverrides(host),{argv:[],env:{},measurement:'full-native-input'});
equal(contextOverrides('codex',{limitTokens:32000}),{argv:['-c','model_auto_compact_token_limit=32000','-c','model_auto_compact_token_limit_scope="total"'],env:{},measurement:'full-native-input'});
equal(contextOverrides('codex',{limitTokens:32000,scope:'body_after_prefix'}).measurement,'full-native-input');
equal(contextOverrides('claude',{windowTokens:100000,percent:30}),{argv:[],env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'100000',CLAUDE_AUTOCOMPACT_PCT_OVERRIDE:'30'},measurement:'full-native-input'});
for (const x of [0,-1,NaN,Infinity,1.5,'32000',2000001,Number.MAX_SAFE_INTEGER+1]) rejects('codex',{limitTokens:x});
for (const x of ['',false,null,undefined,'TOTAL','body_after_prefix\n-c model="other"']) rejects('codex',{limitTokens:32000,scope:x});
for (const x of [99999,1000001,'100000',NaN,100000.5]) rejects('claude',{windowTokens:x,percent:30});
for (const x of [0,101,'30',30.1,NaN,Infinity]) rejects('claude',{windowTokens:100000,percent:x});
for (const host of ['codex','claude']) for (const x of [undefined,false,[],Object.create(null),{unexpected:true}]) {
  // Undefined means default-off through the public default argument.
  if (x === undefined) equal(contextOverrides(host,x).argv,[]);else rejects(host,x);
}
rejects('codex',{limitTokens:32000,percent:30});
rejects('claude',{windowTokens:100000,percent:30,scope:'total'});
rejects('other',null);
const original={limitTokens:32000,scope:'total'};contextOverrides('codex',original);equal(original,{limitTokens:32000,scope:'total'});
equal(summaryFixtureRequest('codex',{tools:[{name:'exec_command'}],input:[{content:'task mentions compaction'}]}),false);
equal(summaryFixtureRequest('codex',{tools:[],input:[{content:'summarize previous context'}]}),true);
equal(summaryFixtureRequest('claude',{tools:[],messages:[{content:[{type:'text',text:'ordinary question about compaction'}]}]}),false);
const nativeSummary='CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.\nYour task is to create a detailed summary of the conversation so far';
equal(summaryFixtureRequest('claude',{tools:[{name:'Read'}],messages:[{content:[{type:'text',text:nativeSummary}]}]}),true);
equal(summaryFixtureRequest('claude',{messages:[{content:[{type:'tool_result',text:nativeSummary}]}]}),false);
equal(summaryFixtureRequest('claude',{}),false);
equal(summaryFixtureRequest('other',{}),false);
console.log(`${checks} context-policy controls passed; zero model calls`);
