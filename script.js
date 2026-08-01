let entries = [];
let currentRating = 0;
let activeCategory = 'Todas';
let expandedCards = new Set();

const grid = document.getElementById('grid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const overlay = document.getElementById('overlay');
const toast = document.getElementById('toast');

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 2200);
}

const SHEET_ID = '1c8YySipc7jMFjRlvVZfPinzV_aTpv2ULN8da1MUuyYk';
const SHEET_TAB_NAME = 'Respostas ao formulário 1';
const FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe_JbT9xfZeCoxXgNLF83xqFkWP35SS60WBZXSiX5u_unbnOg/formResponse';
const FORM_ENTRY_IDS = {
  category: 'entry.934728267',
  name: 'entry.115204625',
  rating: 'entry.1178898547',
  comment: 'entry.1820562745',
  author: 'entry.1752634184',
  location: 'entry.1784327988'
};

function fetchSheetRows(){
  return new Promise((resolve)=>{
    const callbackName = 'gvizCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    const script = document.createElement('script');
    window[callbackName] = (resp)=>{
      delete window[callbackName];
      script.remove();
      resolve(resp);
    };
    script.onerror = ()=>{
      delete window[callbackName];
      resolve(null);
    };
    script.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?sheet='
      + encodeURIComponent(SHEET_TAB_NAME) + '&range=A2:G&tqx=responseHandler:' + callbackName;
    document.body.appendChild(script);
  });
}

function parseSheetTimestamp(cell){
  const match = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/.exec((cell && cell.v) || '');
  if(!match) return Date.now();
  const [, year, month, day, hour = 0, minute = 0, second = 0] = match;
  return new Date(+year, +month, +day, +hour, +minute, +second).getTime();
}

async function loadEntries(){
  try{
    const resp = await fetchSheetRows();
    const rows = (resp && resp.table && resp.table.rows) || [];
    entries = rows.map((row, i)=>{
      const val = idx => (row.c[idx] && row.c[idx].v != null) ? String(row.c[idx].v) : '';
      return {
        id: 'row-' + i,
        date: parseSheetTimestamp(row.c[0]),
        category: val(1) || 'Outros',
        name: val(2),
        rating: parseInt(val(3), 10) || 0,
        comment: val(4),
        author: val(5),
        location: val(6)
      };
    }).filter(e => e.name);
  }catch(err){
    entries = [];
  }
  loadingState.style.display = 'none';
  grid.style.display = 'grid';
  renderChips();
  render();
}

function submitEntryToSheet(entry){
  const body = new URLSearchParams({
    [FORM_ENTRY_IDS.category]: entry.category,
    [FORM_ENTRY_IDS.name]: entry.name,
    [FORM_ENTRY_IDS.rating]: entry.rating,
    [FORM_ENTRY_IDS.comment]: entry.comment,
    [FORM_ENTRY_IDS.author]: entry.author,
    [FORM_ENTRY_IDS.location]: entry.location
  });
  return fetch(FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body });
}

function groupEntries(list){
  const groups = {};
  list.forEach(e=>{
    const key = (e.category + '::' + e.name).toLowerCase().trim();
    if(!groups[key]){
      groups[key] = { category: e.category, name: e.name, reviews: [] };
    }
    groups[key].reviews.push(e);
  });
  return Object.values(groups).map(g=>{
    const avg = g.reviews.reduce((s,r)=>s+r.rating,0) / g.reviews.length;
    const mostRecent = Math.max(...g.reviews.map(r=>r.date));
    return { ...g, avg, count: g.reviews.length, mostRecent };
  });
}

function renderChips(){
  const cats = ['Todas', ...new Set(entries.map(e=>e.category))];
  const container = document.getElementById('categoryChips');
  container.innerHTML = '';
  cats.forEach(cat=>{
    const chip = document.createElement('div');
    chip.className = 'chip' + (cat === activeCategory ? ' active' : '');
    chip.textContent = cat;
    chip.onclick = ()=>{ activeCategory = cat; renderChips(); render(); };
    container.appendChild(chip);
  });
}

function render(){
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  const sortBy = document.getElementById('sortSelect').value;

  let filtered = entries.filter(e=>{
    const matchesCat = activeCategory === 'Todas' || e.category === activeCategory;
    const matchesSearch = !searchTerm ||
      e.name.toLowerCase().includes(searchTerm) ||
      e.category.toLowerCase().includes(searchTerm) ||
      (e.comment && e.comment.toLowerCase().includes(searchTerm)) ||
      (e.location && e.location.toLowerCase().includes(searchTerm));
    return matchesCat && matchesSearch;
  });

  let groups = groupEntries(filtered);

  if(sortBy === 'rating') groups.sort((a,b)=> b.avg - a.avg);
  else if(sortBy === 'reviews') groups.sort((a,b)=> b.count - a.count);
  else groups.sort((a,b)=> b.mostRecent - a.mostRecent);

  grid.innerHTML = '';

  if(groups.length === 0){
    emptyState.style.display = 'block';
    grid.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  grid.style.display = 'grid';

  groups.forEach(g=>{
    const key = (g.category + '::' + g.name).toLowerCase().trim();
    const card = document.createElement('div');
    card.className = 'card';

    const fullStars = Math.round(g.avg);
    const starsHtml = [1,2,3,4,5].map(i=>
      `<span class="${i<=fullStars?'filled':''}">★</span>`
    ).join('');

    const latestComment = [...g.reviews].sort((a,b)=>b.date-a.date).find(r=>r.comment);
    const latestLocation = [...g.reviews].sort((a,b)=>b.date-a.date).find(r=>r.location);

    const isOpen = expandedCards.has(key);

    card.innerHTML = `
      <div class="cat">${escapeHtml(g.category)}</div>
      <h3>${escapeHtml(g.name)}</h3>
      <div class="stars">${starsHtml} <span style="color:var(--ink-soft); font-size:12px; font-family:'Inter',sans-serif;">${g.avg.toFixed(1)}</span></div>
      <div class="meta-line">${g.count} indicaç${g.count>1?'ões':'ão'}${latestLocation ? ' · 📍 ' + escapeHtml(latestLocation.location) : ''}</div>
      ${latestComment ? `<div class="snippet">"${escapeHtml(truncate(latestComment.comment, 90))}"</div>` : ''}
      <div class="expanded-reviews ${isOpen ? 'open' : ''}">
        ${g.reviews.sort((a,b)=>b.date-a.date).map(r=>`
          <div class="review">
            <div class="rev-head">
              <span class="rev-author">${escapeHtml(r.author)}</span>
              <span style="color:var(--mustard)">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
            </div>
            ${r.location ? `<div class="rev-location">📍 ${escapeHtml(r.location)}</div>` : ''}
            ${r.comment ? `<div class="rev-comment">${escapeHtml(r.comment)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    card.onclick = ()=>{
      if(expandedCards.has(key)) expandedCards.delete(key);
      else expandedCards.add(key);
      render();
    };
    grid.appendChild(card);
  });
}

function truncate(str, n){
  return str.length > n ? str.slice(0,n) + '...' : str;
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('sortSelect').addEventListener('change', render);

document.getElementById('openModalBtn').onclick = ()=>{ overlay.classList.add('open'); };
document.getElementById('cancelBtn').onclick = ()=>{ overlay.classList.remove('open'); resetForm(); };
overlay.onclick = (e)=>{ if(e.target === overlay){ overlay.classList.remove('open'); resetForm(); } };

document.getElementById('catSelect').addEventListener('change', (e)=>{
  document.getElementById('customCatField').style.display = e.target.value === '__custom__' ? 'flex' : 'none';
});

document.getElementById('starPicker').addEventListener('click', (e)=>{
  if(e.target.tagName === 'SPAN'){
    currentRating = parseInt(e.target.dataset.val);
    updateStarPicker();
  }
});
function updateStarPicker(){
  document.querySelectorAll('#starPicker span').forEach(s=>{
    s.classList.toggle('filled', parseInt(s.dataset.val) <= currentRating);
  });
}

function resetForm(){
  document.getElementById('entryForm').reset();
  currentRating = 0;
  updateStarPicker();
  document.getElementById('customCatField').style.display = 'none';
  document.querySelectorAll('.field-error').forEach(el=>el.classList.remove('show'));
}

document.getElementById('entryForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const catSelect = document.getElementById('catSelect');
  const category = catSelect.value === '__custom__'
    ? document.getElementById('customCat').value.trim()
    : catSelect.value;
  const name = document.getElementById('nameInput').value.trim();
  const location = document.getElementById('locationInput').value.trim();
  const comment = document.getElementById('commentInput').value.trim();
  const author = document.getElementById('authorInput').value.trim();

  const locationPattern = /^.+-\s*[A-Za-z]{2}$/;
  const isLocationValid = locationPattern.test(location);

  let valid = true;
  document.getElementById('nameError').classList.toggle('show', !name);
  document.getElementById('locationError').classList.toggle('show', !isLocationValid);
  document.getElementById('ratingError').classList.toggle('show', currentRating === 0);
  document.getElementById('authorError').classList.toggle('show', !author);
  if(!name || !isLocationValid || currentRating === 0 || !author) valid = false;
  if(!valid) return;

  const newEntry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2,8),
    category: category || 'Outros',
    name,
    location,
    rating: currentRating,
    comment,
    author,
    date: Date.now()
  };

  entries.push(newEntry);
  renderChips();
  render();
  overlay.classList.remove('open');
  resetForm();

  try{
    await submitEntryToSheet(newEntry);
    showToast('Indicação colada no mural! 📌');
  }catch(err){
    showToast('Não consegui salvar. Tenta de novo?');
  }
});

loadEntries();
