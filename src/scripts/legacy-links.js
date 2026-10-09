// Hashes are handled in the browser; only known legacy routes are redirected.
export function legacyDestination(hash, routes) {
  if (!hash.startsWith('#/')) return null;
  let decoded;
  try { decoded=decodeURIComponent(hash.slice(2)); } catch { return null; }
  const [route,anchor]=decoded.split('#');
  const target=route==='index.html' || route==='' ? '/' : '/'+route;
  if (!routes.includes(target)) return null;
  return target+(anchor ? '#'+encodeURIComponent(anchor) : '');
}
if(typeof document!=='undefined'){
  const sessions=JSON.parse(document.getElementById('kd-sessions-data').textContent);
  const routes=['/','/topics.html','/faq.html','/archives.html','/viewing-guide.html',...sessions.map(s=>s.route)];
  const redirect=()=>{const target=legacyDestination(location.hash,routes);if(target)location.replace(target);};
  redirect();window.addEventListener('hashchange',redirect);
}
