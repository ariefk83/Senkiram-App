(function () {
  if (!EK.requireAdmin()) return;
  EK.renderNav('nilai');

  const supabase = EK.supabaseClient;
  const { gradeClass, formatDate, escapeHtml } = EK;

  let allHasil = [];

  init();

  async function init() {
    const [{ data: hasil }, { data: quizzes }, { data: anakList }] = await Promise.all([
      supabase.from('assignment').select('id, skor, jumlah_benar, jumlah_soal, dikerjakan_at, anak(id, nama), quiz(id, judul)').not('dikerjakan_at', 'is', null).order('dikerjakan_at', { ascending: false }),
      supabase.from('quiz').select('id, judul').order('judul'),
      supabase.from('anak').select('id, nama').order('nama'),
    ]);

    allHasil = hasil || [];

    document.getElementById('filter-quiz').innerHTML =
      '<option value="">Semua quiz</option>' + (quizzes || []).map(q => `<option value="${q.id}">${escapeHtml(q.judul)}</option>`).join('');
    document.getElementById('filter-anak').innerHTML =
      '<option value="">Semua anak</option>' + (anakList || []).map(a => `<option value="${a.id}">${escapeHtml(a.nama)}</option>`).join('');

    document.getElementById('filter-quiz').addEventListener('change', renderTable);
    document.getElementById('filter-anak').addEventListener('change', renderTable);

    renderTable();
    renderLeaderboard();
  }

  function renderTable() {
    const quizId = document.getElementById('filter-quiz').value;
    const anakId = document.getElementById('filter-anak').value;

    let filtered = allHasil;
    if (quizId) filtered = filtered.filter(h => h.quiz && h.quiz.id === quizId);
    if (anakId) filtered = filtered.filter(h => h.anak && h.anak.id === anakId);

    const tbody = document.getElementById('nilai-table-body');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada data.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(h => `
      <tr>
        <td>${escapeHtml(h.anak ? h.anak.nama : '-')}</td>
        <td>${escapeHtml(h.quiz ? h.quiz.judul : '-')}</td>
        <td><span class="badge ${gradeClass(h.skor)}">${Math.round(h.skor)}</span></td>
        <td>${h.jumlah_benar}/${h.jumlah_soal}</td>
        <td class="text-muted">${formatDate(h.dikerjakan_at)}</td>
      </tr>
    `).join('');
  }

  function renderLeaderboard() {
    const totals = {};
    allHasil.forEach(h => {
      const nama = h.anak ? h.anak.nama : null;
      if (!nama) return;
      if (!totals[nama]) totals[nama] = { total: 0, count: 0 };
      totals[nama].total += Number(h.skor);
      totals[nama].count += 1;
    });

    const ranked = Object.entries(totals)
      .map(([nama, v]) => ({ nama, rata: v.total / v.count, count: v.count }))
      .sort((a, b) => b.rata - a.rata);

    const el = document.getElementById('leaderboard-list');
    if (ranked.length === 0) { el.innerHTML = '<p class="text-muted">Belum ada data.</p>'; return; }

    el.innerHTML = ranked.map((r, i) => `
      <div class="leaderboard-item">
        <span class="rank">${i + 1}</span>
        <span style="flex:1;">${escapeHtml(r.nama)}</span>
        <span class="text-muted" style="font-size:12px;">${r.count} quiz</span>
        <span style="font-weight:700;">${r.rata.toFixed(1)}</span>
      </div>
    `).join('');
  }
})();
