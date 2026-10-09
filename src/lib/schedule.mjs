export function sessionTimes(session) {
  return { start: Date.parse(session.startsAt), end: Date.parse(session.endsAt) };
}
export function sessionDay(session) { return session.startsAt.slice(0, 10); }
export function formatDay(day, full = false) {
  const [y,m,d] = day.split('-').map(Number);
  const weekday = '日月火水木金土'[new Date(day+'T00:00:00Z').getUTCDay()];
  return `${full ? y+'/' : ''}${m}/${d}（${weekday}）`;
}
export function displayTime(session) {
  const note = session.approximate ? '頃' : '';
  const nextDay = session.endsAt.slice(0,10) !== session.startsAt.slice(0,10) ? '翌' : '';
  return `${session.startsAt.slice(11,16)}${note}〜${nextDay}${session.endsAt.slice(11,16)}${note}`;
}
export function allSessions(topics) {
  return topics.flatMap(topic=>topic.sessions.map(session=>({
    ...sessionTimes(session), date:sessionDay(session), time:displayTime(session),
    title:topic.title, route:`/topics/${topic.slug}.html`, tentative:topic.tentative,
  }))).sort((a,b)=>a.start-b.start || a.end-b.end || a.route.localeCompare(b.route));
}
export function selectSession(sessions, now) {
  if (!Number.isFinite(now)) return { phase:'empty', session:null };
  const session=sessions.find(item=>item.end>now);
  return session ? {phase:now<session.start?'upcoming':'scheduled-window',session} : {phase:'empty',session:null};
}
