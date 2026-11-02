import {validateHealth} from './youtube-health.mjs';

// Durable state lives on its own branch, never in deployed content or an expiring cache.
export function createGithubHealthStore({repository,branch,token,fetchImpl=fetch}){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository??''))throw new Error('Invalid GitHub repository');
  if(!['automation/youtube-rss-health','automation/youtube-rss-health-test'].includes(branch))throw new Error('Invalid RSS health branch');
  if(!token)throw new Error('Missing GitHub token for RSS health state');
  const base=`https://api.github.com/repos/${repository}`;
  let exists=false,fileSha;
  async function api(path,{method='GET',body,allowMissing=false}={}){
    const response=await fetchImpl(base+path,{method,signal:AbortSignal.timeout(15000),redirect:'error',
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',
        'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(allowMissing&&response.status===404)return null;
    if(!response.ok)throw new Error(`RSS health GitHub storage HTTP ${response.status} (${method})`);
    return response.json();
  }
  return {
    async load(){
      const ref=await api(`/git/ref/heads/${branch}`,{allowMissing:true});
      if(!ref){exists=false;return null;}
      exists=true;
      const file=await api(`/contents/state.json?ref=${encodeURIComponent(branch)}`);
      if(file.encoding!=='base64'||typeof file.content!=='string'||typeof file.sha!=='string')throw new Error('Invalid RSS health storage response');
      fileSha=file.sha;
      return validateHealth(JSON.parse(Buffer.from(file.content,'base64').toString('utf8')));
    },
    async save(state){
      validateHealth(state);
      const content=JSON.stringify(state,null,2)+'\n';
      if(exists){
        const saved=await api('/contents/state.json',{method:'PUT',body:{branch,message:'Record YouTube RSS fetch health',
          sha:fileSha,content:Buffer.from(content).toString('base64')}});
        fileSha=saved.content.sha;
      }else{
        // A root commit containing state.json only: no workflow/source files.
        const tree=await api('/git/trees',{method:'POST',body:{tree:[{path:'state.json',mode:'100644',type:'blob',content}]}});
        const commit=await api('/git/commits',{method:'POST',body:{message:'Initialize YouTube RSS fetch health',tree:tree.sha,parents:[]}});
        await api('/git/refs',{method:'POST',body:{ref:`refs/heads/${branch}`,sha:commit.sha}});
        exists=true;
        fileSha=tree.tree.find(entry=>entry.path==='state.json').sha;
      }
    }
  };
}
