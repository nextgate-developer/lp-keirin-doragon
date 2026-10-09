// Preserve the delivery's click-to-load behavior: no video request before consent to open it.
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-archive-player-src]');
  if(!button)return;
  const type=button.dataset.archivePlayerType;
  if(!['iframe','video'].includes(type))return;
  const src=new URL(button.dataset.archivePlayerSrc);
  if(src.protocol!=='https:')return;
  const media=document.createElement(type);
  media.src=src.href;
  if(type==='video'){
    media.controls=true;media.preload='metadata';media.playsInline=true;
    media.setAttribute('aria-label',button.dataset.archivePlayerTitle);
  }else{
    media.title=button.dataset.archivePlayerTitle;
    media.allow='fullscreen; picture-in-picture';media.allowFullscreen=true;
    media.referrerPolicy='strict-origin-when-cross-origin';
  }
  button.parentElement.replaceChildren(media);
  media.tabIndex=0;media.focus({preventScroll:true});
});
