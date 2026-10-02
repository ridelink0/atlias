import { sourceEvidence } from '../lib/source-evidence.mjs';
export default function({suite,check,TMP,fs,path}) {
  suite('source grounding expert','exact evidence preserves lines and explicit incompleteness',()=>{
    const root=path.join(TMP,'source evidence');fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'contract.md'),'Required result\r\nDo not invent evidence.\n');
    const r=sourceEvidence({root,file:'contract.md',maxLines:1});
    check('partial evidence never claims a complete source',!r.complete&&r.nextLine===2&&r.lastLine===1&&r.text==='Required result\r\n',{happened:JSON.stringify(r),why:'A partial source must not be mistaken for every requirement.',fix:'Preserve exact line ranges and require explicit continuation.'});
    const next=sourceEvidence({root,file:'contract.md',firstLine:2,expectedSha256:r.sha256});
    check('continuation binds to the original raw source',next.sha256===r.sha256&&next.endOfFile&&!next.complete&&next.text==='Do not invent evidence.\n',{happened:JSON.stringify(next),why:'Pages from different snapshots cannot prove one consistent source.',fix:'Require the original source hash for every continuation.'});
  });
}
