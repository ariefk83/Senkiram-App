(function () {
  if (!EK.requireAdmin()) return;
  EK.renderNav('bank-soal');

  const supabase = EK.supabaseClient;
  const { parseMarkdownSoal, MD_TEMPLATE_EXAMPLE } = EK;
  const { materiLabel, kelasLabel, escapeHtml } = EK;

  // ============================================================
  // State
  // ============================================================
  let kelasCache = [];
  let mapelCache = [];
  let materiCache = [];

  // Current filter selections (by value, not id)
  let selJenjang = '';
  let selKelasId = '';
  let selMapelId = '';
  let selMateriId = '';  // for the Kelola Materi dropdown
  let selectedMateriIds = new Set(); // tags on the current soal being composed

  // Current soal type
  let soalType = 'pg';

  // ============================================================
  // Bootstrap
  // ============================================================
  init();

  async function init() {
    document.getElementById('md-template').textContent = MD_TEMPLATE_EXAMPLE;

    await loadKelasCache();
    await loadMapelCache();
    await loadMateriCache();

    buildJenjangDrop();
    buildKelasDrop();
    buildMapelDrop();
    buildMateriDrop();
    renderMateriChips();

    await loadSoalList();

    // Soal type pills
    document.querySelectorAll('.bs-type-pill[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bs-type-pill[data-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        soalType = btn.dataset.type;
        document.getElementById('pg-options').classList.toggle('hidden', soalType !== 'pg');
      });
    });

    // Upload toggle
    document.getElementById('tab-upload-btn').addEventListener('click', toggleUploadSection);
    document.getElementById('tab-md-btn').addEventListener('click', () => switchUploadTab('md'));
    document.getElementById('tab-ai-btn').addEventListener('click', () => switchUploadTab('ai'));

    // Footer actions
    document.getElementById('simpan-soal-btn').addEventListener('click', saveSoal);
    document.getElementById('tambah-lagi-btn').addEventListener('click', () => { saveSoal(true); });
    document.getElementById('batal-btn').addEventListener('click', resetForm);

    // MD import
    document.getElementById('md-parse-btn').addEventListener('click', onMdParse);
    document.getElementById('md-save-all-btn').addEventListener('click', () => saveBatch('md'));

    // AI import
    setupAiSection();

    // Inline-add mapel
    document.getElementById('f-mapel-add-btn').addEventListener('click', onAddMapel);
    document.getElementById('f-mapel-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onAddMapel(); } });

    // Inline-add materi
    document.getElementById('m-materi-add-btn').addEventListener('click', onAddMateri);
    document.getElementById('m-materi-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onAddMateri(); } });

    // Close dropdowns on outside click
    document.addEventListener('click', closeAllDropdowns);
  }

  // ============================================================
  // Cache loaders
  // ============================================================
  async function loadKelasCache() {
    const { data } = await supabase.from('kelas').select('id, jenjang, nomor').order('jenjang').order('nomor');
    kelasCache = data || [];
  }

  async function loadMapelCache() {
    const { data } = await supabase.from('mata_pelajaran').select('id, nama').order('nama');
    mapelCache = data || [];
  }

  async function loadMateriCache() {
    const { data } = await supabase
      .from('materi')
      .select('id, nama, kelas_id, mapel_id, kelas(jenjang, nomor), mata_pelajaran(nama)')
      .order('nama');
    materiCache = data || [];
  }

  // ============================================================
  // Custom Dropdown helpers
  // ============================================================
  function openDrop(dropId, chevId) {
    // Close others first
    document.querySelectorAll('.bs-dropdown.open').forEach(d => {
      if (d.id !== dropId) d.classList.remove('open');
    });
    document.querySelectorAll('.bs-chev.open').forEach(c => {
      if (c.id !== chevId) c.classList.remove('open');
    });
    const drop = document.getElementById(dropId);
    const chev = document.getElementById(chevId);
    const isOpen = drop.classList.contains('open');
    drop.classList.toggle('open', !isOpen);
    chev.classList.toggle('open', !isOpen);
  }

  function closeAllDropdowns(e) {
    const dropdowns = document.querySelectorAll('.bs-dropdown.open');
    dropdowns.forEach(d => {
      const wrap = d.closest('.bs-filter-item')?.querySelector('.bs-select-wrap');
      if (wrap && !wrap.contains(e.target) && !d.contains(e.target)) {
        d.classList.remove('open');
        const chevId = wrap.querySelector('.bs-chev')?.id;
        if (chevId) document.getElementById(chevId)?.classList.remove('open');
      }
    });
  }

  function setDropValue(valElId, chevId, dropId, val, label) {
    const valEl = document.getElementById(valElId);
    valEl.textContent = label || val || '-';
    valEl.classList.toggle('placeholder', !val);
    document.getElementById(dropId).classList.remove('open');
    document.getElementById(chevId).classList.remove('open');
    // Mark selected option
    document.querySelectorAll(`#${dropId} .bs-drop-opt`).forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.val === String(val));
    });
  }

  // ============================================================
  // Filter bar: Jenjang
  // ============================================================
  function buildJenjangDrop() {
    const wrap = document.querySelector('#f-jenjang-drop .bs-select-wrap');
    document.querySelector('#f-jenjang-drop').querySelectorAll('.bs-drop-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selJenjang = opt.dataset.val;
        setDropValue('f-jenjang-val', 'f-jenjang-chev', 'f-jenjang-drop', selJenjang, opt.textContent.trim());
        selKelasId = '';
        setDropValue('f-kelas-val', 'f-kelas-chev', 'f-kelas-drop', '', '- Pilih Kelas -');
        selMapelId = '';
        setDropValue('f-mapel-val', 'f-mapel-chev', 'f-mapel-drop', '', '- Mata Pelajaran -');
        buildKelasDrop();
        buildMapelDrop();
        buildMateriDrop();
        renderMateriChips();
        loadSoalList();
      });
    });
    document.getElementById('f-jenjang-val').closest('.bs-select-wrap').addEventListener('click', e => {
      e.stopPropagation();
      openDrop('f-jenjang-drop', 'f-jenjang-chev');
    });
  }

  // ============================================================
  // Filter bar: Kelas
  // ============================================================
  function buildKelasDrop() {
    const drop = document.getElementById('f-kelas-drop');
    const filtered = selJenjang
      ? kelasCache.filter(k => k.jenjang === selJenjang)
      : kelasCache;

    drop.innerHTML = '<div class="bs-drop-opt" data-val="">- Pilih Kelas -</div>' +
      filtered.map(k => `<div class="bs-drop-opt" data-val="${k.id}">${escapeHtml(kelasLabel(k))}</div>`).join('');

    drop.querySelectorAll('.bs-drop-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        selKelasId = opt.dataset.val;
        setDropValue('f-kelas-val', 'f-kelas-chev', 'f-kelas-drop', selKelasId, opt.textContent.trim());
        selMapelId = '';
        setDropValue('f-mapel-val', 'f-mapel-chev', 'f-mapel-drop', '', '- Mata Pelajaran -');
        buildMapelDrop();
        buildMateriDrop();
        renderMateriChips();
        loadSoalList();
      });
    });

    document.getElementById('f-kelas-val').closest('.bs-select-wrap').addEventListener('click', e => {
      e.stopPropagation();
      openDrop('f-kelas-drop', 'f-kelas-chev');
    });
  }

  // ============================================================
  // Filter bar: Mata Pelajaran (with inline-add)
  // ============================================================
  function buildMapelDrop() {
    const optsEl = document.getElementById('f-mapel-opts');
    optsEl.innerHTML = mapelCache.map(m =>
      `<div class="bs-drop-opt" data-val="${m.id}">${escapeHtml(m.nama)}</div>`
    ).join('');

    document.getElementById('f-mapel-drop').querySelectorAll('.bs-drop-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        selMapelId = opt.dataset.val;
        setDropValue('f-mapel-val', 'f-mapel-chev', 'f-mapel-drop', selMapelId, opt.textContent.trim());
        selMateriId = '';
        setDropValue('m-materi-val', 'm-materi-chev', 'm-materi-drop', '', '- Pilih Materi -');
        buildMateriDrop();
        renderMateriChips();
        loadSoalList();
      });
    });

    // wire header click once
    const wrap = document.getElementById('f-mapel-val').closest('.bs-select-wrap');
    wrap.onclick = null;
    wrap.addEventListener('click', e => {
      e.stopPropagation();
      openDrop('f-mapel-drop', 'f-mapel-chev');
    });
  }

  async function onAddMapel() {
    const inp = document.getElementById('f-mapel-new');
    const nama = inp.value.trim();
    if (!nama) return;
    const { error } = await supabase.from('mata_pelajaran').insert({ nama });
    if (error) { alert('Gagal tambah mata pelajaran: ' + error.message); return; }
    inp.value = '';
    await loadMapelCache();
    buildMapelDrop();
  }

  // ============================================================
  // Kelola Materi dropdown (with inline-add)
  // ============================================================
  function buildMateriDrop() {
    const optsEl = document.getElementById('m-materi-opts');
    // Filter by current context
    const filtered = materiCache.filter(m => {
      if (selMapelId && m.mapel_id !== selMapelId) return false;
      if (selKelasId && m.kelas_id !== selKelasId) return false;
      return true;
    });

    optsEl.innerHTML = filtered.map(m =>
      `<div class="bs-drop-opt" data-val="${m.id}">${escapeHtml(m.nama)}</div>`
    ).join('');

    document.getElementById('m-materi-drop').querySelectorAll('.bs-drop-opt').forEach(opt => {
      if (!opt.dataset.val) return;
      opt.addEventListener('click', e => {
        e.stopPropagation();
        selMateriId = opt.dataset.val;
        const materi = materiCache.find(m => m.id === selMateriId);
        setDropValue('m-materi-val', 'm-materi-chev', 'm-materi-drop', selMateriId, materi ? materi.nama : opt.textContent.trim());
        if (selMateriId && !selectedMateriIds.has(selMateriId)) {
          selectedMateriIds.add(selMateriId);
          renderMateriChips();
        }
      });
    });

    const wrap = document.getElementById('m-materi-val').closest('.bs-select-wrap');
    wrap.onclick = null;
    wrap.addEventListener('click', e => {
      e.stopPropagation();
      openDrop('m-materi-drop', 'm-materi-chev');
    });
  }

  async function onAddMateri() {
    const inp = document.getElementById('m-materi-new');
    const nama = inp.value.trim();
    if (!nama) { alert('Isi nama materi.'); return; }
    if (!selKelasId) { alert('Pilih kelas terlebih dahulu di filter atas.'); return; }
    if (!selMapelId) { alert('Pilih mata pelajaran terlebih dahulu.'); return; }
    const { error } = await supabase.from('materi').insert({ nama, kelas_id: selKelasId, mapel_id: selMapelId });
    if (error) { alert('Gagal tambah materi: ' + error.message); return; }
    inp.value = '';
    await loadMateriCache();
    buildMateriDrop();
    renderMateriChips();
  }

  // ============================================================
  // Materi chips — tags on current soal
  // ============================================================
  function renderMateriChips() {
    const el = document.getElementById('materi-chips');
    // Show materi relevant to current context
    const relevant = materiCache.filter(m => {
      if (selMapelId && m.mapel_id !== selMapelId) return false;
      if (selKelasId && m.kelas_id !== selKelasId) return false;
      return true;
    });

    if (relevant.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = relevant.map(m => {
      const isSelected = selectedMateriIds.has(m.id);
      return `
        <div class="bs-chip ${isSelected ? 'selected' : ''}" data-mid="${m.id}">
          ${escapeHtml(m.nama)}
          ${isSelected ? `<button onclick="window.removeMateriTag('${m.id}')"><i class="ti ti-x"></i></button>` : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.bs-chip:not(.selected)').forEach(chip => {
      chip.addEventListener('click', () => {
        const mid = chip.dataset.mid;
        selectedMateriIds.add(mid);
        renderMateriChips();
      });
    });
  }

  window.removeMateriTag = (id) => {
    selectedMateriIds.delete(id);
    renderMateriChips();
  };

  // ============================================================
  // Custom dropdown: Jawaban Benar
  // ============================================================
  (function wireJawaban() {
    document.getElementById('m-jawaban-val').closest('.bs-select-wrap').addEventListener('click', e => {
      e.stopPropagation();
      openDrop('m-jawaban-drop', 'm-jawaban-chev');
    });
    document.getElementById('m-jawaban-drop').querySelectorAll('.bs-drop-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        setDropValue('m-jawaban-val', 'm-jawaban-chev', 'm-jawaban-drop', opt.dataset.val, opt.textContent.trim());
      });
    });
  })();

  // ============================================================
  // Form actions
  // ============================================================
  function getJawabanBenar() {
    const el = document.getElementById('m-jawaban-val');
    const val = el.textContent.trim();
    return ['A','B','C','D'].includes(val) ? val : '';
  }

  async function saveSoal(addAnother = false) {
    const pertanyaan = document.getElementById('m-pertanyaan').value.trim();
    if (!pertanyaan) { alert('Tulis soal terlebih dahulu.'); return; }

    const payload = { pertanyaan, pembahasan: document.getElementById('m-pembahasan').value.trim() || null };

    if (soalType === 'pg') {
      payload.pilihan_a = document.getElementById('m-a').value.trim();
      payload.pilihan_b = document.getElementById('m-b').value.trim();
      payload.pilihan_c = document.getElementById('m-c').value.trim();
      payload.pilihan_d = document.getElementById('m-d').value.trim();
      payload.jawaban_benar = getJawabanBenar();
      if (!payload.pilihan_a || !payload.pilihan_b || !payload.pilihan_c || !payload.pilihan_d) {
        alert('Lengkapi semua pilihan A-D.'); return;
      }
      if (!payload.jawaban_benar) { alert('Pilih jawaban benar.'); return; }
    } else {
      // Non-PG: store type in pembahasan prefix for now; pilihan_x dibiarkan '-'
      payload.pilihan_a = '-'; payload.pilihan_b = '-'; payload.pilihan_c = '-'; payload.pilihan_d = '-';
      payload.jawaban_benar = 'A';
    }

    const { data, error } = await supabase.from('soal').insert(payload).select().single();
    if (error) { alert('Gagal menyimpan soal: ' + error.message); return; }

    if (selectedMateriIds.size > 0) {
      const rows = [...selectedMateriIds].map(mid => ({ soal_id: data.id, materi_id: mid }));
      await supabase.from('soal_materi').insert(rows);
    }

    if (addAnother) {
      // Clear pertanyaan + pilihan only, keep context
      document.getElementById('m-pertanyaan').value = '';
      ['m-a','m-b','m-c','m-d','m-pembahasan'].forEach(id => { document.getElementById(id).value = ''; });
      setDropValue('m-jawaban-val', 'm-jawaban-chev', 'm-jawaban-drop', '', '- Jawaban Benar -');
    } else {
      resetForm();
    }
    await loadSoalList();
  }

  function resetForm() {
    document.getElementById('m-pertanyaan').value = '';
    ['m-a','m-b','m-c','m-d','m-pembahasan'].forEach(id => { document.getElementById(id).value = ''; });
    setDropValue('m-jawaban-val', 'm-jawaban-chev', 'm-jawaban-drop', '', '- Jawaban Benar -');
    selectedMateriIds.clear();
    renderMateriChips();
  }

  // ============================================================
  // Upload section toggle
  // ============================================================
  let uploadVisible = false;

  function toggleUploadSection() {
    uploadVisible = !uploadVisible;
    document.getElementById('upload-section').classList.toggle('hidden', !uploadVisible);
    if (uploadVisible) switchUploadTab('md');
  }

  function switchUploadTab(which) {
    ['md','ai'].forEach(t => {
      document.getElementById(`${t}-section`).classList.toggle('hidden', t !== which);
    });
    document.getElementById('tab-md-btn').classList.toggle('active', which === 'md');
    document.getElementById('tab-ai-btn').classList.toggle('active', which === 'ai');
    if (which === 'ai') setupAiSection();
  }

  // ============================================================
  // MD import
  // ============================================================
  let mdDrafts = [];

  async function onMdParse() {
    const file = document.getElementById('md-file').files[0];
    const statusEl = document.getElementById('md-status');
    if (!file) { alert('Pilih file .md dulu.'); return; }
    const text = await file.text();
    const parsed = EK.parseMarkdownSoal(text);
    if (parsed.length === 0) {
      statusEl.textContent = 'Tidak ada soal terbaca. Periksa format file.';
      return;
    }
    mdDrafts = parsed;
    statusEl.textContent = `Berhasil membaca ${parsed.length} soal.`;
    renderDraftReview('md-review-list', mdDrafts);
    document.getElementById('md-review').classList.remove('hidden');
  }

  // ============================================================
  // AI import
  // ============================================================
  let aiDrafts = [];

  function setupAiSection() {
    const banner = document.getElementById('ai-no-key-banner');
    const uploadArea = document.getElementById('ai-upload-area');
    if (!EK.hasApiKey()) {
      banner.innerHTML = `<div class="banner banner-warning">Belum ada API key. Atur di <a href="settings.html">Pengaturan</a>.</div>`;
      uploadArea.classList.add('hidden');
      return;
    }
    banner.innerHTML = '';
    uploadArea.classList.remove('hidden');
    const btn = document.getElementById('ai-extract-btn');
    btn.onclick = async () => {
      const file = document.getElementById('ai-file').files[0];
      if (!file) { alert('Pilih file PDF dulu.'); return; }
      const statusEl = document.getElementById('ai-status');
      btn.disabled = true;
      try {
        const results = await EK.extractSoalFromPdf(file, msg => { statusEl.textContent = msg; });
        aiDrafts = results;
        statusEl.textContent = `Berhasil mengekstrak ${results.length} soal.`;
        renderDraftReview('ai-review-list', aiDrafts);
        document.getElementById('ai-review').classList.remove('hidden');
      } catch (err) { alert(err.message); }
      btn.disabled = false;
    };
  }

  // ============================================================
  // Shared draft review
  // ============================================================
  function renderDraftReview(elId, drafts) {
    const el = document.getElementById(elId);
    el.innerHTML = drafts.map((s, i) => `
      <div class="card" style="background:var(--bg); margin-bottom:10px;">
        <div class="flex-between" style="margin-bottom:8px;">
          <label style="margin:0;">Soal ${i + 1}</label>
          <label class="checkbox-row" style="margin:0;">
            <input type="checkbox" checked data-idx="${i}" class="draft-include" />
            <span style="font-weight:400;">Sertakan</span>
          </label>
        </div>
        <textarea data-idx="${i}" data-field="pertanyaan" class="draft-field">${escapeHtml(s.pertanyaan)}</textarea>
        <div class="bs-options-grid">
          ${['a','b','c','d'].map(l => `
            <div class="bs-option-row">
              <span class="bs-opt-letter">${l.toUpperCase()}</span>
              <input type="text" data-idx="${i}" data-field="pilihan_${l}" class="draft-field" value="${escapeHtml(s['pilihan_'+l])}" />
            </div>
          `).join('')}
        </div>
        <select data-idx="${i}" data-field="jawaban_benar" class="draft-field">
          ${['A','B','C','D'].map(l => `<option value="${l}" ${s.jawaban_benar===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    `).join('');

    el.querySelectorAll('.draft-field').forEach(f => {
      f.addEventListener('input', () => {
        const idx = parseInt(f.dataset.idx, 10);
        const target = elId.startsWith('md') ? mdDrafts : aiDrafts;
        target[idx][f.dataset.field] = f.value;
      });
    });
  }

  async function saveBatch(kind) {
    const isAi = kind === 'ai';
    const drafts = isAi ? aiDrafts : mdDrafts;
    const listId = isAi ? 'ai-review-list' : 'md-review-list';

    const includeFlags = [...document.querySelectorAll(`#${listId} .draft-include`)];
    const toSave = drafts.filter((_, i) => includeFlags[i] && includeFlags[i].checked);
    if (toSave.length === 0) { alert('Tidak ada soal yang dipilih.'); return; }

    const rows = toSave.map(s => ({
      pertanyaan: s.pertanyaan, pilihan_a: s.pilihan_a, pilihan_b: s.pilihan_b,
      pilihan_c: s.pilihan_c, pilihan_d: s.pilihan_d,
      jawaban_benar: s.jawaban_benar, pembahasan: s.pembahasan || null,
    }));

    const { data, error } = await supabase.from('soal').insert(rows).select();
    if (error) { alert('Gagal menyimpan: ' + error.message); return; }

    if (selectedMateriIds.size > 0 && data) {
      const relRows = [];
      data.forEach(soal => [...selectedMateriIds].forEach(mid => relRows.push({ soal_id: soal.id, materi_id: mid })));
      await supabase.from('soal_materi').insert(relRows);
    }

    alert(`${data.length} soal disimpan.`);
    if (isAi) { aiDrafts = []; document.getElementById('ai-review').classList.add('hidden'); document.getElementById('ai-status').textContent = ''; }
    else { mdDrafts = []; document.getElementById('md-review').classList.add('hidden'); document.getElementById('md-status').textContent = ''; }
    await loadSoalList();
  }

  // ============================================================
  // Soal list
  // ============================================================
  async function loadSoalList() {
    const el = document.getElementById('soal-list');
    el.innerHTML = '<p class="text-muted">Memuat...</p>';

    const { data, error } = await supabase
      .from('soal')
      .select('id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, pembahasan, created_at, soal_materi(materi(id, nama, kelas_id, kelas(jenjang,nomor), mata_pelajaran(nama)))')
      .order('created_at', { ascending: false });

    if (error || !data) { el.innerHTML = '<p class="text-muted">Gagal memuat soal.</p>'; return; }

    let filtered = data;
    if (selMapelId) {
      filtered = filtered.filter(s => (s.soal_materi||[]).some(sm => sm.materi?.mapel_id === selMapelId));
    } else if (selKelasId) {
      filtered = filtered.filter(s => (s.soal_materi||[]).some(sm => sm.materi?.kelas_id === selKelasId));
    } else if (selJenjang) {
      filtered = filtered.filter(s => (s.soal_materi||[]).some(sm => sm.materi?.kelas?.jenjang === selJenjang));
    }

    if (filtered.length === 0) {
      el.innerHTML = '<div class="empty-state"><i class="ti ti-books"></i>Belum ada soal untuk filter ini.</div>';
      return;
    }

    el.innerHTML = filtered.map(s => renderSoalRow(s)).join('');
    attachSoalRowHandlers(filtered);
  }

  function renderSoalRow(s) {
    const tags = (s.soal_materi||[]).map(sm => sm.materi
      ? `<span class="badge badge-muted" style="font-size:10px;">${escapeHtml(materiLabel(sm.materi))}</span>` : '').join(' ');
    return `
      <div class="soal-row" id="soal-row-${s.id}">
        <div style="font-size:13px; margin-bottom:6px;">${escapeHtml(s.pertanyaan)}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">${tags}</div>
        <div class="soal-actions">
          <button class="btn btn-sm" data-action="edit" data-id="${s.id}"><i class="ti ti-edit"></i> Edit</button>
          <button class="btn btn-sm" data-action="duplicate" data-id="${s.id}"><i class="ti ti-copy"></i> Duplikat</button>
          <button class="btn btn-sm" data-action="move" data-id="${s.id}"><i class="ti ti-arrows-move"></i> Pindah materi</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}"><i class="ti ti-trash"></i> Hapus</button>
        </div>
        <div id="soal-edit-${s.id}"></div>
      </div>
    `;
  }

  function attachSoalRowHandlers(soalData) {
    const byId = Object.fromEntries(soalData.map(s => [s.id, s]));
    document.querySelectorAll('#soal-list [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const soal = byId[id];
        if (action === 'edit') openEditForm(soal);
        if (action === 'duplicate') duplicateSoal(soal);
        if (action === 'move') openMoveForm(soal);
        if (action === 'delete') deleteSoal(id);
      });
    });
  }

  function openEditForm(soal) {
    const wrap = document.getElementById(`soal-edit-${soal.id}`);
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="soal-edit-form">
        <label>Pertanyaan</label>
        <textarea id="e-pertanyaan-${soal.id}">${escapeHtml(soal.pertanyaan)}</textarea>
        <div class="bs-options-grid">
          ${['a','b','c','d'].map(l => `
            <div class="bs-option-row">
              <span class="bs-opt-letter">${l.toUpperCase()}</span>
              <input type="text" id="e-${l}-${soal.id}" value="${escapeHtml(soal['pilihan_'+l]||'')}" />
            </div>
          `).join('')}
        </div>
        <label>Jawaban benar</label>
        <select id="e-jawaban-${soal.id}" style="margin-bottom:10px;">
          ${['A','B','C','D'].map(l => `<option value="${l}" ${soal.jawaban_benar===l?'selected':''}>${l}</option>`).join('')}
        </select>
        <label>Pembahasan (opsional)</label>
        <textarea id="e-pembahasan-${soal.id}">${escapeHtml(soal.pembahasan||'')}</textarea>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="e-save-${soal.id}"><i class="ti ti-device-floppy"></i> Simpan</button>
          <button class="btn btn-sm" id="e-cancel-${soal.id}">Batal</button>
        </div>
      </div>
    `;
    document.getElementById(`e-cancel-${soal.id}`).addEventListener('click', () => { wrap.innerHTML = ''; });
    document.getElementById(`e-save-${soal.id}`).addEventListener('click', async () => {
      const payload = {
        pertanyaan: document.getElementById(`e-pertanyaan-${soal.id}`).value.trim(),
        pilihan_a: document.getElementById(`e-a-${soal.id}`).value.trim(),
        pilihan_b: document.getElementById(`e-b-${soal.id}`).value.trim(),
        pilihan_c: document.getElementById(`e-c-${soal.id}`).value.trim(),
        pilihan_d: document.getElementById(`e-d-${soal.id}`).value.trim(),
        jawaban_benar: document.getElementById(`e-jawaban-${soal.id}`).value,
        pembahasan: document.getElementById(`e-pembahasan-${soal.id}`).value.trim() || null,
      };
      const { error } = await supabase.from('soal').update(payload).eq('id', soal.id);
      if (error) { alert('Gagal menyimpan: ' + error.message); return; }
      await loadSoalList();
    });
  }

  async function duplicateSoal(soal) {
    const payload = {
      pertanyaan: '(Salinan) ' + soal.pertanyaan,
      pilihan_a: soal.pilihan_a, pilihan_b: soal.pilihan_b,
      pilihan_c: soal.pilihan_c, pilihan_d: soal.pilihan_d,
      jawaban_benar: soal.jawaban_benar, pembahasan: soal.pembahasan,
    };
    const { data, error } = await supabase.from('soal').insert(payload).select().single();
    if (error) { alert('Gagal menduplikat: ' + error.message); return; }
    const materiIds = (soal.soal_materi||[]).map(sm => sm.materi?.id).filter(Boolean);
    if (materiIds.length > 0) {
      await supabase.from('soal_materi').insert(materiIds.map(mid => ({ soal_id: data.id, materi_id: mid })));
    }
    await loadSoalList();
  }

  function openMoveForm(soal) {
    const wrap = document.getElementById(`soal-edit-${soal.id}`);
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
    const currentIds = (soal.soal_materi||[]).map(sm => sm.materi?.id).filter(Boolean);
    const gridId = `move-grid-${soal.id}`;

    wrap.innerHTML = `
      <div class="soal-edit-form">
        <label>Pilih materi (tautan lama akan diganti)</label>
        <div class="checkbox-grid" id="${gridId}"></div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="move-save-${soal.id}"><i class="ti ti-device-floppy"></i> Simpan</button>
          <button class="btn btn-sm" id="move-cancel-${soal.id}">Batal</button>
        </div>
      </div>
    `;

    const gridEl = document.getElementById(gridId);
    gridEl.innerHTML = materiCache.map(m => `
      <label class="checkbox-pill ${currentIds.includes(m.id) ? 'checked' : ''}">
        <input type="checkbox" value="${m.id}" ${currentIds.includes(m.id) ? 'checked' : ''} />
        <span>${escapeHtml(materiLabel(m))}</span>
      </label>
    `).join('');
    gridEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => cb.closest('.checkbox-pill').classList.toggle('checked', cb.checked));
    });

    document.getElementById(`move-cancel-${soal.id}`).addEventListener('click', () => { wrap.innerHTML = ''; });
    document.getElementById(`move-save-${soal.id}`).addEventListener('click', async () => {
      const newIds = [...gridEl.querySelectorAll('input:checked')].map(cb => cb.value);
      await supabase.from('soal_materi').delete().eq('soal_id', soal.id);
      if (newIds.length > 0) {
        await supabase.from('soal_materi').insert(newIds.map(mid => ({ soal_id: soal.id, materi_id: mid })));
      }
      await loadSoalList();
    });
  }

  async function deleteSoal(id) {
    if (!confirm('Hapus soal ini?')) return;
    const { error } = await supabase.from('soal').delete().eq('id', id);
    if (error) { alert('Gagal menghapus: ' + error.message); return; }
    await loadSoalList();
  }
})();
