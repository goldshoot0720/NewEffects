(() => {
  'use strict';

  const categories = { fantasy: '奇幻', anime: '動漫', animal: '動物擬人', real: '寫實' };
  const characters = [
    ['dragon', '白龍精靈', 'fantasy', '#eee4ff'],
    ['marigold', '橙花少女', 'fantasy', '#ffedd9'],
    ['whale', '藍鯨女僕', 'fantasy', '#e4edff'],
    ['penguin', '企鵝帽少女', 'anime', '#f7efd9'],
    ['fox', '紅髮狐耳少女', 'anime', '#ffe7e5'],
    ['sailor', '水手服少女', 'anime', '#e2edf8'],
    ['calico', '街頭三花貓', 'animal', '#f6e4d5'],
    ['snow', '連帽白貓', 'animal', '#f5eadb'],
    ['jacket', '米色外套男子', 'real', '#e5eee8'],
    ['tee', '灰 T 恤少年', 'real', '#e7e7f3'],
  ].map(([id, name, category, tint], index) => ({
    id, name, category, tint, number: String(index + 1).padStart(2, '0'),
  }));

  const viewTypes = [
    { id: 'portrait', label: '全身立繪', caption: '正面 · T 姿勢' },
    { id: 'sheet', label: '三視圖', caption: '由左至右：正面、側面、背面' },
  ];

  const byId = id => document.getElementById(id);
  const imagePath = (character, type) => `assets/characters/${character.id}-${type}.webp`;
  const cards = byId('cards');
  const filters = byId('filters');
  const dialog = byId('detail');
  const views = byId('views');
  const image = byId('detail-image');
  const download = byId('download');
  let currentCharacter;

  cards.innerHTML = characters.map(character => `
    <button class="card" type="button" data-character="${character.id}" data-category="${character.category}" style="--tint:${character.tint}">
      <span class="card-art">
        <img src="${imagePath(character, 'thumb')}" width="460" height="355" alt="" loading="lazy">
        <span class="card-number" aria-hidden="true">NO. ${character.number}</span>
      </span>
      <span class="card-info">
        <span><strong>${character.name}</strong><small>${categories[character.category]}</small></span>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </span>
    </button>`).join('');

  views.innerHTML = viewTypes.map(view =>
    `<button type="button" data-view="${view.id}" aria-pressed="false">${view.label}</button>`
  ).join('');

  function markSelected(group, selected) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button === selected));
    }
  }

  filters.addEventListener('click', event => {
    const selected = event.target.closest('[data-filter]');
    if (!selected) return;
    markSelected(filters, selected);
    let count = 0;
    for (const card of cards.children) {
      const visible = selected.dataset.filter === 'all' || card.dataset.category === selected.dataset.filter;
      card.hidden = !visible;
      if (visible) count++;
    }
    byId('result-count').textContent = `${count} 位角色`;
  });

  function showView(selected) {
    const view = viewTypes.find(type => type.id === selected.dataset.view);
    markSelected(views, selected);
    image.alt = `${currentCharacter.name}的${view.label}`;
    image.src = imagePath(currentCharacter, view.id);
    byId('detail-caption').textContent = view.caption;
    download.href = image.src;
    download.download = `${currentCharacter.name}-${view.label}.webp`;
  }

  document.querySelector('main').addEventListener('click', event => {
    const button = event.target.closest('[data-character]');
    if (!button) return;
    currentCharacter = characters.find(character => character.id === button.dataset.character);
    byId('detail-index').textContent = `NO. ${currentCharacter.number} / ${categories[currentCharacter.category]}`;
    byId('detail-title').textContent = currentCharacter.name;
    showView(views.firstElementChild);
    dialog.scrollTop = 0;
    dialog.showModal();
  });

  views.addEventListener('click', event => {
    const selected = event.target.closest('[data-view]');
    if (selected) showView(selected);
  });
})();
