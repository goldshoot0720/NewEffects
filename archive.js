(() => {
  'use strict';

  const categories = { fantasy: '奇幻', anime: '動漫', animal: '動物擬人', real: '寫實' };
  // 三視圖的側面比正面窄，使用圖中人物之間的留白作為分界。
  const characters = [
    ['dragon', '白龍精靈', 'fantasy', '#eee4ff', [710, 1090]],
    ['marigold', '橙花少女', 'fantasy', '#ffedd9', [730, 1064]],
    ['whale', '鯨魚娘', 'fantasy', '#e4edff', [670, 1120]],
    ['penguin', '企鵝帽少女', 'anime', '#f7efd9', [734, 1050]],
    ['fox', '紅髮狐耳少女', 'anime', '#ffe7e5', [733, 1040]],
    ['sailor', '水手服少女', 'anime', '#e2edf8', [732, 1045]],
    ['calico', '街頭三花貓', 'animal', '#f6e4d5', [737, 1091]],
    ['snow', '連帽白貓', 'animal', '#f5eadb', [738, 1086]],
    ['jacket', '米色外套男子', 'real', '#e5eee8', [739, 1035]],
    ['tee', '灰 T 恤少年', 'real', '#e7e7f3', [739, 1035]],
  ].map(([id, name, category, tint, sheetCuts], index) => ({
    id, name, category, tint, sheetCuts, number: String(index + 1).padStart(2, '0'),
  }));

  const viewTypes = [
    { id: 'portrait', label: '全身立繪', caption: '正面 · T 姿勢' },
    { id: 'sheet', label: '三視圖', caption: '由左至右：正面、側面、背面' },
    { id: 'turntable', label: '旋轉檢視', caption: '三個參考角度' },
  ];

  const byId = id => document.getElementById(id);
  const imagePath = (character, type) => `assets/characters/${character.id}-${type}.webp`;
  const cards = byId('cards');
  const filters = byId('filters');
  const dialog = byId('detail');
  const views = byId('views');
  const image = byId('detail-image');
  const download = byId('download');
  const turntable = byId('turntable');
  const stage = byId('turntable-stage');
  const frame = byId('turntable-frame');
  const crop = byId('turntable-crop');
  const sheetImage = byId('turntable-image');
  const controls = byId('turntable-controls');
  const angles = [...controls.querySelectorAll('[data-angle]')];
  let currentCharacter;
  let angle = 0;
  let drag;

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
    const rotating = view.id === 'turntable';
    const file = imagePath(currentCharacter, rotating ? 'sheet' : view.id);
    byId('detail-art').hidden = rotating;
    turntable.hidden = !rotating;
    if (rotating) {
      sheetImage.setAttribute('href', file);
      showAngle(0);
    } else {
      image.alt = `${currentCharacter.name}的${view.label}`;
      image.src = file;
    }
    byId('detail-caption').textContent = view.caption;
    byId('download-label').textContent = rotating ? '下載三視圖' : '下載圖片';
    download.href = file;
    download.download = `${currentCharacter.name}-${rotating ? '三視圖' : view.label}.webp`;
  }

  function showAngle(index) {
    angle = Math.max(0, Math.min(angles.length - 1, index));
    const bounds = [0, ...currentCharacter.sheetCuts, 1774];
    const left = bounds[angle];
    const width = bounds[angle + 1] - left;
    crop.setAttribute('x', (740 - width) / 2);
    crop.setAttribute('width', width);
    crop.setAttribute('viewBox', `${left} 0 ${width} 887`);
    const selected = angles[angle];
    markSelected(controls, selected);
    frame.setAttribute('aria-label', `${currentCharacter.name}的${selected.textContent}`);
    byId('turntable-angle').textContent = `${selected.textContent} / ${angle * 90}°`;
  }

  controls.addEventListener('click', event => {
    const selected = event.target.closest('[data-angle]');
    if (selected) showAngle(Number(selected.dataset.angle));
  });

  stage.addEventListener('keydown', event => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    showAngle(angle + step);
  });

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { pointerId: event.pointerId, x: event.clientX, angle };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.pointerId) return;
    const nextAngle = drag.angle + Math.round((drag.x - event.clientX) / 90);
    if (Math.max(0, Math.min(angles.length - 1, nextAngle)) !== angle) showAngle(nextAngle);
  });
  stage.addEventListener('lostpointercapture', () => { drag = undefined; });

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
