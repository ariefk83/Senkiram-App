(function () {
  if (!EK.requireAdmin()) return;
  EK.renderNav('dashboard');
  const supabase = EK.supabaseClient;
  const { gradeClass, formatDate, escapeHtml, kelasLabel } = EK;

  let kelasCache = [];
  let allHasil = []; // completed assignments with quiz.kelas joined

  init();

  async function init() {
    await loadKelasCache();
    renderKelasFilterOptions();
    await loadStats();
    await loadHasilData();
    await loadRecent();
    renderFilteredSection();

    document.getElementById('filter-jenjang').addEventListener('change', () => {
      renderKelasFilterOptions();
      renderFilteredSection();
    });
    document.getElementById('filter-kelas').addEventListener('change', renderFilteredSection);

    setupToggle('cta-toggle-btn', 'cta-group');
    setupToggle('filter-toggle-btn', 'filter-group');
  }

  function setupToggle(btnId, groupId) {
    const btn = document.getElementById(btnId);
    const group = document.getElementById(groupId);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !group.classList.contains('open');
      document.querySelectorAll('.cta-group.open, .filter-group.open').forEach(g => g.classList.remove('open'));
      if (willOpen) group.classList.add('open');
    });
    document.addEventListener('click', (e) => {
      if (!group.contains(e.target) && e.target !== btn) group.classList.remove('open');
    });
  }

  async function loadKelasCache() {
    const { data } = await supabase.from('kelas').select('id, jenjang, nomor').order('nomor');
    kelasCache = data || [];
  }

  function renderKelasFilterOptions() {
    const jenjang = document.getElementById('filter-jenjang').value;
    const sel = document.getElementById('filter-kelas');
    const filtered = jenjang ? kelasCache.filter(k => k.jenjang === jenjang) : kelasCache;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Semua kelas</option>' +
      filtered.map(k => `<option value="${k.id}">${escapeHtml(kelasLabel(k))}</option>`).join('');
    if (filtered.some(k => k.id === currentVal)) sel.value = currentVal;
  }

  async function loadStats() {
    const [{ count: soalCount }, { count: quizCount }, { count: anakCount }] = await Promise.all([
      supabase.from('soal').select('*', { count: 'exact', head: true }),
      supabase.from('quiz').select('*', { count: 'exact', head: true }),
      supabase.from('anak').select('*', { count: 'exact', head: true }),
    ]);

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = `
      <div class="stat-card"><div class="stat-label">Total soal</div><div class="stat-value">${soalCount ?? 0}</div></div>
      <div class="stat-card"><div class="stat-label">Total quiz</div><div class="stat-value">${quizCount ?? 0}</div></div>
      <div class="stat-card"><div class="stat-label">Total anak</div><div class="stat-value">${anakCount ?? 0}</div></div>
    `;
  }

  async function loadHasilData() {
    const { data } = await supabase
      .from('assignment')
      .select('skor, anak(nama), quiz(kelas_id, kelas(jenjang, nomor))')
      .not('dikerjakan_at', 'is', null);
    allHasil = data || [];
  }

  function getFilteredHasil() {
    const jenjang = document.getElementById('filter-jenjang').value;
    const kelasId = document.getElementById('filter-kelas').value;
    return allHasil.filter(h => {
      const k = h.quiz ? h.quiz.kelas : null;
      if (kelasId) return h.quiz && h.quiz.kelas_id === kelasId;
      if (jenjang) return k && k.jenjang === jenjang;
      return true;
    });
  }

  function renderFilteredSection() {
    const jenjang = document.getElementById('filter-jenjang').value;
    const kelasSel = document.getElementById('filter-kelas');
    const kelasId = kelasSel.value;

    let scopeLabel = 'Semua jenjang & kelas';
    if (kelasId) {
      const opt = kelasSel.selectedOptions[0];
      scopeLabel = opt ? opt.textContent : 'Kelas terpilih';
    } else if (jenjang) {
      scopeLabel = jenjang;
    }
    document.getElementById('filter-scope-label').textContent = scopeLabel;

    const filtered = getFilteredHasil();

    const avgEl = document.getElementById('avg-score');
    const countEl = document.getElementById('avg-count');
    countEl.textContent = filtered.length;
    avgEl.textContent = filtered.length
      ? (filtered.reduce((s, h) => s + Number(h.skor), 0) / filtered.length).toFixed(1)
      : '-';

    renderLeaderboard(filtered);
  }

  function renderLeaderboard(rows) {
    const el = document.getElementById('leaderboard-list');
    if (rows.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada data untuk filter ini.</p>';
      return;
    }

    const totals = {};
    rows.forEach(h => {
      const nama = h.anak ? h.anak.nama : 'Tanpa nama';
      if (!totals[nama]) totals[nama] = { total: 0, count: 0 };
      totals[nama].total += Number(h.skor);
      totals[nama].count += 1;
    });

    const ranked = Object.entries(totals)
      .map(([nama, v]) => ({ nama, rata: v.total / v.count }))
      .sort((a, b) => b.rata - a.rata)
      .slice(0, 5);

    el.innerHTML = ranked.map((r, i) => `
      <div class="leaderboard-item">
        <span class="rank">${i + 1}</span>
        <span style="flex:1;">${escapeHtml(r.nama)}</span>
        <span style="font-weight:600;">${r.rata.toFixed(1)}</span>
      </div>
    `).join('');
  }

  async function loadRecent() {
    const { data, error } = await supabase
      .from('assignment')
      .select('id, skor, dikerjakan_at, anak(nama), quiz(judul)')
      .not('dikerjakan_at', 'is', null)
      .order('dikerjakan_at', { ascending: false })
      .limit(6);

    const el = document.getElementById('recent-list');
    if (error || !data || data.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada pengerjaan quiz.</p>';
      return;
    }
    el.innerHTML = data.map(h => `
      <div class="flex-between" style="padding:8px 0; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:13px; font-weight:600;">${escapeHtml(h.quiz ? h.quiz.judul : 'Quiz')}</div>
          <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(h.anak ? h.anak.nama : '-')} · ${formatDate(h.dikerjakan_at)}</div>
        </div>
        <span class="badge ${gradeClass(h.skor)}">${Math.round(h.skor)}</span>
      </div>
    `).join('');
  }
})();
