// トップのお知らせカード（src/fragments/home-special.html）を、data-show-until の日時を過ぎたら隠す。
// 作り直しを待たずに、開いたままの画面でも消えるようにする（ビルドの時点で過ぎていれば index.astro が出さない）
const cards=[...document.querySelectorAll('[data-show-until]')];
if(cards.length){
  const update=()=>{
    const now=Date.now();
    for(const card of cards){
      const until=Date.parse(card.dataset.showUntil);
      card.hidden=Number.isFinite(until)&&now>=until;
    }
  };
  update();
  window.setInterval(update,30000);
  window.addEventListener('focus',update);
  window.addEventListener('pageshow',update);
  document.addEventListener('visibilitychange',update);
}
