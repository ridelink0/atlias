import {spawnSync} from 'node:child_process';
export default async function ({suite,check:reportCheck,ROOT,TMP,path}) {
  const check=(name,condition,details={happened:String(condition),why:'Lean metadata must preserve protocol and tool behaviour.',fix:'Keep every schema and dispatcher unchanged.'})=>reportCheck(name,condition,details);
  const toolsMod = await import('../mcp/tools.mjs');
  const {TOOLS}=toolsMod;
  const hostsMod = await import('../lib/hosts.mjs');
  suite('MCP catalog expert','lean-mcp-catalog',()=>{
    const off=JSON.stringify(TOOLS),lean=toolsMod.toolCatalog(true),wire=JSON.stringify({tools:lean}),full=JSON.stringify({tools:TOOLS});
    const semantics=tools=>tools.map(({description,...t})=>t);
    check('lean retains every tool and exact argument schema',JSON.stringify(semantics(lean))===JSON.stringify(semantics(TOOLS)));
    check('default-off catalog is unchanged and lean does not mutate it',toolsMod.toolCatalog(false)===TOOLS&&JSON.stringify(TOOLS)===off);
    check('lean reduces catalog characters without dropping descriptions',wire.length<=full.length-500&&lean.every(t=>t.description.length>20),{happened:`${full.length} full vs ${wire.length} lean characters`,why:'Catalog metadata is repeated context; count bytes without claiming model-token savings.',fix:'Keep names and schemas; shorten descriptions only.'});
    check('lean catalog is deterministic',wire===JSON.stringify({tools:toolsMod.toolCatalog(true)}));
    const unrelated='model = "test"\n[mcp_servers.other]\ncommand = "preserve"\nenv_vars = ["OTHER_FLAG"]\n';
    const installed=hostsMod.mergeToml(unrelated);
    check('Codex forwards the lean flag by name without baking its value',installed.includes('env_vars = ["ATLIAS_FLAG_LEAN_BRIEF"]')&&!installed.includes('ATLIAS_FLAG_LEAN_BRIEF ='));
    check('reinstall preserves unrelated environment policy and remains idempotent',installed.startsWith(unrelated.trimEnd())&&hostsMod.mergeToml(installed)===installed);
    for(const host of ['claude','codex'])for(const enabled of [false,true]){
      const input=[{jsonrpc:'2.0',id:1,method:'initialize'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'harness_verify',arguments:{paths:[]}}}].map(JSON.stringify).join('\n')+'\n';
      const env={...process.env,ATLIAS_HOME:path.join(TMP,'lean-catalog',host),ATLIAS_FLAG_LEAN_BRIEF:enabled?'1':'0',CLAUDE_CONFIG_DIR:path.join(TMP,'lean-catalog',host,'.claude'),CODEX_HOME:path.join(TMP,'lean-catalog',host,'.codex')};
      if(host==='claude')env.CLAUDE_PLUGIN_ROOT=ROOT;else env.CODEX_PLUGIN_ROOT=ROOT;
      const r=spawnSync(process.execPath,[path.join(ROOT,'mcp/server.mjs')],{env,cwd:ROOT,input,encoding:'utf8',timeout:30000,windowsHide:true});
      let replies=[];try{replies=(r.stdout||'').trim().split('\n').filter(Boolean).map(JSON.parse);}catch{}
      const listed=replies.find(t=>t.id===2)?.result?.tools,called=replies.find(t=>t.id===3)?.result;
      check(`${host} stdio ${enabled?'lean':'control'} lists exact catalog and dispatches`,r.status===0&&JSON.stringify(listed)===JSON.stringify(enabled?lean:TOOLS)&&called?.isError===false&&called.content[0].text==='verify: pass the changed file paths.',{happened:`exit${r.status}; replies${replies.length}`,why:'Both hosts must retain real protocol and dispatch behaviour.',fix:'Check server tools/list and shared callTool dispatch.'});
    }
  });
}
