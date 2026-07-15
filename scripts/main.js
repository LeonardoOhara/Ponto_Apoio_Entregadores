(function(){
  const STORAGE_KEY_PREFIX = 'mapcomment:';
  const THEME_KEY = 'theme';

  // Declarar todas as referências DOM primeiro
  const listEl = document.getElementById('comment-list');
  const countEl = document.getElementById('count-label');
  const statusEl = document.getElementById('status');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchResultsEl = document.getElementById('search-results');
  const filterInput = document.getElementById('filter-input');
  const themeToggle = document.getElementById('theme-toggle');

  // Elementos do formulário mobile
  const mobileCategoriesContainer = document.getElementById('mobile-categories');
  const mobileNumberInput = document.getElementById('mobile-number');
  const mobileAddressInput = document.getElementById('mobile-address');
  const mobileCommentInput = document.getElementById('mobile-comment');
  const mobileSaveBtn = document.getElementById('mobile-save');
  const mobileCancelBtn = document.getElementById('mobile-cancel');
  const mobileFormToggle = document.getElementById('mobile-form-toggle');
  const mobileFormContainer = document.getElementById('mobile-form');
  const mobileFormWrapper = document.querySelector('.mobile-form-container');

  let comments = {}; // id -> {id, lat, lng, text, ts}
  const markers = {}; // id -> leaflet marker
  let map; // guardar referência do mapa
  let selectedLatLng = null; // armazena a localização selecionada no mapa
  const categories = ['Wifi', 'Tomada', 'Banheiro', 'Água', 'Descanso', 'Refeição', 'Estacionamento'];

  // Função para aplicar tema
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      themeToggle.textContent = '☀️ Tema';
    } else {
      document.documentElement.classList.remove('dark-theme');
      themeToggle.textContent = '🌙 Tema';
    }
  }

  // Inicializar mapa
  map = L.map('map', { zoomControl: true }).setView([-23.5505, -46.6333], 12); // São Paulo default

  // Adicionar tile layer original (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Carregar tema salvo
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme('light');
  }

  // Listener do botão de tema
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
  });

  const markerIcon = L.divIcon({
    className: 'custom-pin',
    html: '<div style="width:14px;height:14px;border-radius:50% 50% 50% 0;background:#3c5a45;border:2px solid #fffdf7;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>',
    iconSize: [14,14],
    iconAnchor: [7,14]
  });

  // Preencher checkboxes de categoria no formulário mobile
  function populateMobileCategories() {
    mobileCategoriesContainer.innerHTML = '';
    categories.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat;
      input.id = `mobile-cat-${cat.toLowerCase()}`;
      const label = document.createElement('label');
      label.htmlFor = `mobile-cat-${cat.toLowerCase()}`;
      label.textContent = cat;
      div.appendChild(input);
      div.appendChild(label);
      mobileCategoriesContainer.appendChild(div);
    });
  }

  // Função para alternar o formulário
  function toggleMobileForm() {
    mobileFormContainer.classList.toggle('expanded');
    mobileFormWrapper.classList.toggle('expanded');
  }

  // Função para expandir o formulário
  function expandMobileForm() {
    mobileFormContainer.classList.add('expanded');
    mobileFormWrapper.classList.add('expanded');
  }

  // Resetar formulário mobile
  function resetMobileForm() {
    selectedLatLng = null;
    mobileNumberInput.value = '';
    mobileAddressInput.value = '';
    mobileCommentInput.value = '';
    // Desmarcar todos os checkboxes
    const checkboxes = mobileCategoriesContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
  }

  // Preencher checkboxes de categoria
  populateMobileCategories();

  // Listener do toggle
  mobileFormToggle.addEventListener('click', toggleMobileForm);

  // Clique no mapa para selecionar localização e expandir formulário
  map.on('click', (e) => {
    selectedLatLng = e.latlng;
    expandMobileForm();
    // Tentar buscar o endereço automaticamente
    reverseGeocode(e.latlng.lat, e.latlng.lng).then(address => {
      if (address) {
        mobileAddressInput.value = address;
      }
    });
  });

  // Listener do botão salvar mobile
  mobileSaveBtn.addEventListener('click', async () => {
    if (!selectedLatLng) {
      alert('Clique no mapa para selecionar o local!');
      return;
    }

    const text = mobileCommentInput.value.trim();
    if (!text) {
      alert('Escreva um comentário!');
      mobileCommentInput.focus();
      return;
    }

    // Coletar categorias selecionadas
    const selectedCats = [];
    const checkboxes = mobileCategoriesContainer.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => selectedCats.push(cb.value));

    // Criar objeto do comentário
    const comment = {
      id: 'c' + Date.now() + Math.random().toString(36).slice(2,7),
      lat: selectedLatLng.lat,
      lng: selectedLatLng.lng,
      text: text,
      address: mobileAddressInput.value.trim(),
      number: mobileNumberInput.value.trim(),
      categories: selectedCats,
      ts: Date.now()
    };

    // Salvar
    await saveComment(comment);
    resetMobileForm();
    // Recolher formulário
    mobileFormContainer.classList.remove('expanded');
    mobileFormWrapper.classList.remove('expanded');
  });

  // Listener do botão cancelar mobile
  mobileCancelBtn.addEventListener('click', () => {
    resetMobileForm();
    // Recolher formulário
    mobileFormContainer.classList.remove('expanded');
    mobileFormWrapper.classList.remove('expanded');
  });

  function setStatus(msg){ statusEl.textContent = msg; }

  function fmtTime(ts){
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  async function loadAll(){
    try{
      // Carregar dados do Firebase Realtime Database
      const snapshot = await database.ref('comments').once('value');
      comments = snapshot.val() || {};
      renderAll();
      const count = Object.keys(comments).length;
      setStatus(count + ' ponto(s) salvos online!');
    }catch(e){
      console.error(e);
      setStatus('Não foi possível carregar os pontos salvos.');
    }
  }

  function renderAll(filterText = ''){
    listEl.innerHTML = '';
    Object.values(markers).forEach(m => map.removeLayer(m));
    for(const key in markers) delete markers[key];

    const sorted = Object.values(comments).sort((a,b) => b.ts - a.ts);

    const filtered = sorted.filter(c => {
      if(!filterText) return true;
      const searchLower = filterText.toLowerCase();
      return (
        (c.text && c.text.toLowerCase().includes(searchLower)) ||
        (c.address && c.address.toLowerCase().includes(searchLower)) ||
        (c.number && c.number.toLowerCase().includes(searchLower)) ||
        (c.categories && c.categories.some(cat => cat.toLowerCase().includes(searchLower)))
      );
    });

    countEl.textContent = filtered.length + (filtered.length === 1 ? ' no total' : ' no total');

    filtered.forEach(c => {
      addMarkerForComment(c);
      addListItem(c);
    });
  }

  function addMarkerForComment(c){
    const marker = L.marker([c.lat, c.lng], { icon: markerIcon }).addTo(map);
    marker.bindPopup(buildViewPopup(c));
    markers[c.id] = marker;
  }

  function buildViewPopup(c){
    const div = document.createElement('div');
    div.className = 'popup-view';

    if(c.categories && c.categories.length > 0){
      c.categories.forEach(cat => {
        const catSpan = document.createElement('span');
        catSpan.className = 'category';
        catSpan.textContent = cat;
        div.appendChild(catSpan);
      });
    }

    if(c.number){
      const numP = document.createElement('p');
      numP.className = 'number';
      numP.textContent = 'Número: ' + c.number;
      div.appendChild(numP);
    }

    if(c.address){
      const addr = document.createElement('p');
      addr.className = 'addr';
      addr.textContent = c.address;
      div.appendChild(addr);
    }

    const p = document.createElement('p');
    p.style.margin = '0 0 10px';
    p.textContent = c.text;

    const small = document.createElement('div');
    small.style.color = '#8a836b';
    small.style.fontSize = '12px';
    small.textContent = fmtTime(c.ts);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'del';
    delBtn.style.marginTop = '10px';
    delBtn.style.cursor = 'pointer';
    delBtn.addEventListener('click', () => deleteComment(c.id));

    div.appendChild(p);
    div.appendChild(small);
    div.appendChild(delBtn);
    return div;
  }

  function addListItem(c){
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = c.id;

    if(c.categories && c.categories.length > 0){
      c.categories.forEach(cat => {
        const catSpan = document.createElement('span');
        catSpan.className = 'category';
        catSpan.textContent = cat;
        li.appendChild(catSpan);
      });
    }

    if(c.number){
      const numP = document.createElement('p');
      numP.className = 'number';
      numP.textContent = 'Número: ' + c.number;
      li.appendChild(numP);
    }

    if(c.address){
      const addr = document.createElement('p');
      addr.className = 'addr';
      addr.textContent = c.address;
      li.appendChild(addr);
    }

    const txt = document.createElement('p');
    txt.className = 'txt';
    txt.textContent = c.text;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span');
    time.textContent = fmtTime(c.ts);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'excluir';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteComment(c.id); });
    meta.appendChild(time);
    meta.appendChild(del);

    li.appendChild(txt);
    li.appendChild(meta);

    li.addEventListener('click', () => {
      map.setView([c.lat, c.lng], Math.max(map.getZoom(), 14));
      markers[c.id].openPopup();
    });
    listEl.appendChild(li);
  }

  async function saveComment(c){
    comments[c.id] = c;
    try{
      // Salvar ponto no Firebase Realtime Database
      await database.ref('comments/' + c.id).set(c);
      setStatus('Ponto salvo com sucesso!');
    }catch(e){
      console.error(e);
      setStatus('Erro ao salvar o ponto — verifique a configuração do Firebase.');
    }
    renderAll();
  }

  async function deleteComment(id){
    delete comments[id];
    try{
      // Remover ponto do Firebase Realtime Database
      await database.ref('comments/' + id).remove();
      setStatus('Ponto removido com sucesso!');
    }catch(e){
      console.error(e);
      setStatus('Erro ao remover o ponto — verifique a configuração do Firebase.');
    }
    renderAll();
  }

  async function reverseGeocode(lat, lng){
    try{
      const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng;
      const res = await fetch(url);
      const data = await res.json();
      return (data && data.display_name) ? data.display_name : '';
    }catch(e){
      console.error(e);
      return '';
    }
  }

  function openNewCommentPopup(latlng, prefillAddress){
    const container = document.createElement('div');
    container.className = 'popup-form';

    // Campo Categorias (checkboxes)
    const catLabel = document.createElement('label');
    catLabel.textContent = 'Categorias';

    const catGroup = document.createElement('div');
    catGroup.className = 'checkbox-group';
    const categories = ['Wifi', 'Tomada', 'Banheiro', 'Água', 'Descanso', 'Refeição', 'Estacionamento'];
    categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'cat-' + cat.toLowerCase();
      checkbox.value = cat;

      const label = document.createElement('label');
      label.htmlFor = 'cat-' + cat.toLowerCase();
      label.textContent = cat;

      item.appendChild(checkbox);
      item.appendChild(label);
      catGroup.appendChild(item);
    });

    // Campo Número
    const numLabel = document.createElement('label');
    numLabel.textContent = 'Número do Local';

    const numInput = document.createElement('input');
    numInput.type = 'text';
    numInput.placeholder = 'Ex: 1, 2, A, B...';

    // Campo Endereço
    const addrLabel = document.createElement('label');
    addrLabel.textContent = 'Endereço';

    const addrInput = document.createElement('input');
    addrInput.type = 'text';
    addrInput.placeholder = 'Endereço deste local (opcional)';
    addrInput.value = prefillAddress || '';

    // Campo Comentário
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Comentário';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Escreva seu comentário sobre este local...';

    const row = document.createElement('div');
    row.className = 'row';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel';
    cancelBtn.textContent = 'Cancelar';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save';
    saveBtn.textContent = 'Salvar';

    row.appendChild(cancelBtn);
    row.appendChild(saveBtn);

    container.appendChild(catLabel);
    container.appendChild(catGroup);
    container.appendChild(numLabel);
    container.appendChild(numInput);
    container.appendChild(addrLabel);
    container.appendChild(addrInput);
    container.appendChild(textLabel);
    container.appendChild(textarea);
    container.appendChild(row);

    const popup = L.popup({ closeButton: true, minWidth: 240 })
      .setLatLng(latlng)
      .setContent(container)
      .openOn(map);

    // Se não veio um endereço pronto (clique direto no mapa), busca automaticamente
    // via geocodificação reversa, sem sobrescrever se o usuário já tiver digitado algo.
    if(!prefillAddress){
      addrInput.placeholder = 'Buscando endereço...';
      reverseGeocode(latlng.lat, latlng.lng).then(addr => {
        if(addr && !addrInput.value.trim()){
          addrInput.value = addr;
        }
        addrInput.placeholder = 'Endereço deste local (opcional)';
      });
    }

    cancelBtn.addEventListener('click', () => map.closePopup(popup));

    saveBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if(!text) { textarea.focus(); return; }

      const selectedCats = [];
      const checkboxes = catGroup.querySelectorAll('input[type="checkbox"]:checked');
      checkboxes.forEach(cb => selectedCats.push(cb.value));

      const c = {
        id: 'c' + Date.now() + Math.random().toString(36).slice(2,7),
        lat: latlng.lat,
        lng: latlng.lng,
        text: text,
        address: addrInput.value.trim(),
        categories: selectedCats,
        number: numInput.value.trim(),
        ts: Date.now()
      };
      map.closePopup(popup);
      saveComment(c);
    });

    setTimeout(() => textarea.focus(), 50);
  }

  map.on('click', (e) => {
    openNewCommentPopup(e.latlng);
  });

  function clearSearchResults(){
    searchResultsEl.innerHTML = '';
    searchResultsEl.classList.remove('show');
  }

  async function searchPlace(query){
    if(!query){ clearSearchResults(); return; }
    searchResultsEl.innerHTML = '<li class="empty">Buscando...</li>';
    searchResultsEl.classList.add('show');
    try{
      const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=br&q=' + encodeURIComponent(query);
      const res = await fetch(url);
      const data = await res.json();
      renderSearchResults(data);
    }catch(e){
      console.error(e);
      searchResultsEl.innerHTML = '<li class="empty">Erro ao buscar. Tente novamente.</li>';
    }
  }

  function renderSearchResults(results){
    searchResultsEl.innerHTML = '';
    if(!results || !results.length){
      searchResultsEl.innerHTML = '<li class="empty">Nenhum resultado encontrado.</li>';
      searchResultsEl.classList.add('show');
      return;
    }
    results.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.display_name;
      li.addEventListener('click', () => {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        map.setView([lat, lon], 16);
        clearSearchResults();
        searchInput.value = r.display_name;

        // Check if we're on mobile (mobile form is visible)
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          // Fill in mobile form and expand
          selectedLatLng = L.latLng(lat, lon);
          mobileAddressInput.value = r.display_name;
          expandMobileForm();
        } else {
          // Desktop: open popup
          openNewCommentPopup(L.latLng(lat, lon), r.display_name);
        }
      });
      searchResultsEl.appendChild(li);
    });
    searchResultsEl.classList.add('show');
  }

  searchBtn.addEventListener('click', () => searchPlace(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      e.preventDefault();
      searchPlace(searchInput.value.trim());
    }
  });
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-wrap')){
      clearSearchResults();
    }
  });

  filterInput.addEventListener('input', (e) => {
    renderAll(e.target.value);
  });

  loadAll();
})();
