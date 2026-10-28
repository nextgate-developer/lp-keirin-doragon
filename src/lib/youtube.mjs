export const CHANNEL_ID='UC_O34vySXuFXrXhbSy1Z23g';
export const FEED_URL=`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export function validateVideo(video,{dated=true}={}){
  if(!video||!/^[-\w]{11}$/.test(video.id)||typeof video.title!=='string'||!video.title.trim()||video.title.length>1000)throw new Error('Invalid YouTube video metadata');
  const url=new URL(video.videoUrl);
  if(url.origin!=='https://www.youtube.com'||url.username||url.password||!(url.pathname===`/shorts/${video.id}`||(url.pathname==='/watch'&&url.searchParams.get('v')===video.id)))throw new Error('Invalid YouTube video URL');
  const thumbnail=new URL(video.thumbnailUrl);
  if(thumbnail.protocol!=='https:'||thumbnail.port||thumbnail.username||thumbnail.password||!/^i(?:[1-4])?\.ytimg\.com$/.test(thumbnail.hostname)||!thumbnail.pathname.startsWith(`/vi/${video.id}/`))throw new Error('Invalid YouTube thumbnail URL');
  if(dated&&(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(video.publishedAt)||!Number.isFinite(Date.parse(video.publishedAt))))throw new Error('Invalid YouTube publication date');
  return video;
}

export function validateYoutube(data){
  if(data.sourceUrl!==FEED_URL||data.channelUrl!=='https://www.youtube.com/@keirindragon')throw new Error('Unexpected YouTube channel');
  validateVideo(data.promotion,{dated:false});
  if(!Array.isArray(data.videos)||!data.videos.length||data.videos.length>6)throw new Error('YouTube data must contain 1–6 videos');
  const ids=new Set();
  for(const video of data.videos){
    validateVideo(video);
    if(ids.has(video.id)||video.id===data.promotion.id)throw new Error('Duplicate YouTube video');
    ids.add(video.id);
  }
  return data;
}
