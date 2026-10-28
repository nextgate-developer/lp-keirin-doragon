import { selectSession } from '../lib/schedule.mjs';

const root=document.querySelector('#topics');
const namesNode=document.getElementById('kd-home-topics-data');
const sessionsNode=document.getElementById('kd-sessions-data');
if(root&&namesNode&&sessionsNode){
  const names=JSON.parse(namesNode.textContent);
  const sessions=JSON.parse(sessionsNode.textContent);
  const cards=[...root.querySelectorAll('[data-home-topic]')];
  const full=root.querySelector('.topic-heading-full');
  const mobile=root.querySelector('.topic-heading-mobile');
  const empty=root.querySelector('[data-home-topic-empty]');
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  let headingRoute=null;
  function update(){
    const now=Date.now();
    let visible=0;
    for(const card of cards){
      const ended=Number(card.dataset.endsAt)<=now;
      card.hidden=ended;
      if(!ended)visible++;
    }
    if(empty)empty.hidden=visible!==0;
    const {session}=selectSession(sessions,now);
    const route=session?.route||'';
    if(route===headingRoute)return;
    headingRoute=route;
    const name=names[route];
    if(!name){
      setText(full,'次回の配信予定は準備中です。');
      setText(mobile,'次回の配信予定は準備中です。');
      return;
    }
    setText(full,name.full+'のレア情報公開準備中！');
    if(mobile){
      const first=document.createElement('span'),second=document.createElement('span');
      first.textContent=name.mobile;second.textContent='レア情報公開準備中！';
      mobile.replaceChildren(first,second);
    }
  }
  update();
  window.setInterval(update,1000);
  window.addEventListener('focus',update);
  window.addEventListener('pageshow',update);
  document.addEventListener('visibilitychange',update);
}
