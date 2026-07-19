(function () {
  if (!EK.requireAdmin()) return;
  EK.renderNav('kelola-anak');
  const supabase = EK.supabaseClient;
  const { escapeHtml, formatDate } = EK;

  init();

  async function init() {
    await loadAnakList();

    document.getElementById('anak-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = document.getElementById('anak-nama').value.trim();
      if (!nama) return;
      const { error } = await supabase.from('anak').insert({ nama });
      if (error) { alert('Gagal menambah anak: ' + error.message); return; }
      document.getElementById('anak-nama').value = '';
      await loadAnakList();
    });
  }

  async function loadAnakList() {
    const el = document.getElementById('anak-list');
    const { data, error } = await supabase
      .from('anak')
      .select('id, nama, created_at, assignment(id, skor, dikerjakan_at)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada anak. Tambahkan lewat form di atas.</p>';
      return;
    }

    el.innerHTML = data.map(a => {
      const selesai = (a.assignment || []).filter(x => x.dikerjakan_at);
      const rata = selesai.length
        ? (selesai.reduce((s, x) => s + Number(x.skor), 0) / selesai.length).toFixed(1)
        : '-';
      return `
        <div class="flex-between" style="padding:10px 0; border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:14px; font-weight:600;">${escapeHtml(a.nama)}</div>
            <div style="font-size:11px; color:var(--text-muted);">${selesai.length} quiz selesai · rata-rata ${rata} · sejak ${formatDate(a.created_at)}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="window.hapusAnak('${a.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
    }).join('');
  }

  window.hapusAnak = async (id) => {
    if (!confirm('Hapus anak ini? Semua assignment dan riwayat nilainya ikut terhapus.')) return;
    const { error } = await supabase.from('anak').delete().eq('id', id);
    if (error) { alert('Gagal menghapus: ' + error.message); return; }
    await loadAnakList();
  };
})();
