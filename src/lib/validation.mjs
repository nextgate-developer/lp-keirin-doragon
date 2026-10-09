export function validateContent({topics,faq,archives,site}) {
  const errors=[];
  const require=(condition,message)=>{if(!condition)errors.push(message);};
  const nonempty=value=>typeof value==='string' && value.trim().length>0;
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  const timestamp=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:00\+09:00$/.test(value) && date(value.slice(0,10));
  const https=value=>{try{const u=new URL(value);return u.protocol==='https:' && !!u.hostname && !u.username && !u.password;}catch{return false;}};
  require(https(site.site),'site.site must be an HTTPS URL');
  require(nonempty(site.title),'site.title is required');
  require(nonempty(site.description),'site.description is required');
  require(typeof site.ogImage==='string'&&site.ogImage.startsWith('/assets/')&&!site.ogImage.includes('..'),'site.ogImage must be a local asset path');
  require(nonempty(site.topicsHeading?.full)&&nonempty(site.topicsHeading?.mobile),'site.topicsHeading is required');
  const slugs=new Set(),orders=new Set();
  for(const t of topics){
    const name='topic '+t.slug;
    require(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug),name+': invalid slug');
    require(!slugs.has(t.slug),name+': duplicate slug');slugs.add(t.slug);
    for(const key of ['title','category','grade','venue'])require(nonempty(t[key]),name+': '+key+' is required');
    require(typeof t.tentative==='boolean',name+': tentative must be boolean');
    require(typeof t.note==='string',name+': note must be text');
    require(Array.isArray(t.facts),name+': facts must be an array');
    for(const f of (Array.isArray(t.facts)?t.facts:[]))require(nonempty(f.label)&&nonempty(f.value),name+': fact label/value required');
    if(t.featuredOrder!==null){require(Number.isInteger(t.featuredOrder)&&t.featuredOrder>0,name+': invalid featuredOrder');require(!orders.has(t.featuredOrder),name+': duplicate featuredOrder');orders.add(t.featuredOrder);}
    require(Array.isArray(t.sessions)&&t.sessions.length>0,name+': sessions required');
    let previous=-Infinity;
    for(const [i,s] of (Array.isArray(t.sessions)?t.sessions:[]).entries()){
      const prefix=name+' session '+(i+1);
      require(timestamp(s.startsAt),prefix+': startsAt must be valid JST timestamp');
      require(timestamp(s.endsAt),prefix+': endsAt must be valid JST timestamp');
      const start=Date.parse(s.startsAt),end=Date.parse(s.endsAt);
      require(end>start,prefix+': end must be after start');
      require(start>=previous,prefix+': sessions must be chronological and not overlap');previous=end;
      require(typeof s.approximate==='boolean',prefix+': approximate must be boolean');
      for(const key of ['stage','target'])require(nonempty(s[key]),prefix+': '+key+' required');
      require(typeof s.guest==='string',prefix+': guest must be text');
      require(s.guestLabel===undefined||nonempty(s.guestLabel),prefix+': guestLabel must be nonempty text when supplied');
    }
  }
  const numbers=new Set(),ids=new Set();
  for(const group of faq){
    require(/^faq-category-\d+$/.test(group.id)&&!ids.has(group.id),'FAQ category id invalid/duplicate');ids.add(group.id);
    require(nonempty(group.title),'FAQ category title required');
    require(Array.isArray(group.questions),'FAQ category questions must be an array');
    for(const q of (Array.isArray(group.questions)?group.questions:[])){
      require(Number.isInteger(q.number)&&q.number>0&&!numbers.has(q.number),'FAQ number invalid/duplicate');numbers.add(q.number);
      require(nonempty(q.question)&&nonempty(q.answerHtml),'FAQ question and answer required');
      require(!/<(?:script|iframe|object|embed)\b|\bon\w+\s*=|javascript:/i.test(q.answerHtml),'FAQ answer contains unsupported executable markup');
    }
  }
  const videoIds=new Set();
  for(const a of archives){
    require(/^[\w-]{1,80}$/.test(a.id)&&!videoIds.has(a.id),'Archive id invalid/duplicate');videoIds.add(a.id);
    require(nonempty(a.title)&&date(a.publishedAt)&&https(a.videoUrl),'Archive title, date, HTTPS URL required');
    require(a.description===undefined||typeof a.description==='string','Archive description must be text');
  }
  if(errors.length)throw new Error(errors.join('\n'));
  return {topics:topics.length,sessions:topics.reduce((n,t)=>n+t.sessions.length,0),faq:numbers.size,archives:archives.length};
}
