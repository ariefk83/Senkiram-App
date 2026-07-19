(function () {
  if (!EK.requireAdmin()) return;
  EK.renderNav('buat-quiz');

  const supabase = EK.supabaseClient;
  const { kelasLabel, materiLabel, escapeHtml, genToken, formatDate, gradeClass } = EK;

  let kelasCache = [];
  let materiCache = [];
  let anakCache = [];
  let currentQuizId = null;
  const selectedSoalIds = new Set();

  init();

  async function init() {
    const [{ data: kd }, { data: md }, { data: ad }] = await Promise.all([
      supabase.from('kelas').select('id, jenjang, nomor').order('jenjang').order('nomor'),
      supabase.from('materi').select('id, nama, kelas_id, mapel_id, kelas(jenjang, nomor), mata_pelajaran(nama)').order('nama'),
      supabase.from('anak').select('id, nama').order('nama'),
    ]);
    kelasCache = kd || [];
    materiCache = md || [];
    anakCache = ad || [];

    renderKelasSelect();
    renderMateriSelect();
    renderAnakSelect();
    await loadQuizList();

    // Batas waktu toggle
    document.getElementById('q-batas-waktu-toggle').addEventListener('change', function () {
      document.getElementById('q-waktu-field').classList.toggle('hidden', !this.checked);
    });

    // Materi select → load soal
    document.getElementById('q-filter-materi').addEventListener('change', loadSoalByMateri);

    // Footer
    document.getElementById('save-quiz-btn').addEventListener('click', saveQuiz);
    document.getElementById('batal-quiz-btn').addEventListener('click', resetForm);

    // Assign
    document.getElementById('assign-btn').addEventListener('click', createAssignment);
  }

  // ============================================================
  // Selects
  // ============================================================
  function renderKelasSelect() {
    document.getElementById('q-kelas-select').innerHTML =
      '<option value="">— Pilih kelas —</option>' +
      kelasCache.map(k => `<option value="${k.id}">${escapeHtml(kelasLabel(k))}</option>`).join('');
  }

  function renderMateriSelect() {
    document.getElementById('q-filter-materi').innerHTML =
      '<option value="">— Pilih materi —</option>' +
      materiCache.map(m => `<option value="${m.id}">${escapeHtml(materiLabel(m))}</option>`).join('');
  }

  function renderAnakSelect() {
    const sel = document.getElementById('assign-anak-select');
    sel.innerHTML = anakCache.length
      ? anakCache.map(a => `<option value="${a.id}">${escapeHtml(a.nama)}</option>`).join('')
      : '<option value="">Belum ada anak — tambah di halaman Kelola anak</option>';
  }

  // ============================================================
  // Soal picker — load by materi
  // ============================================================
  async function loadSoalByMateri() {
    const materiId = document.getElementById('q-filter-materi').value;
    const el = document.getElementById('soal-picker');

    if (!materiId) {
      el.innerHTML = '<p class="text-muted">Pilih materi untuk memuat soal.</p>';
      updateSelectedCount();
      return;
    }

    el.innerHTML = '<p class="text-muted">Memuat soal...</p>';

    const { data, error } = await supabase
      .from('soal_materi')
      .select('soal(id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar)')
      .eq('materi_id', materiId);

    if (error || !data || data.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada soal di materi ini.</p>';
      updateSelectedCount();
      return;
    }

    const soalList = data.map(r => r.soal).filter(Boolean);

    el.innerHTML = soalList.map(s => `
      <label class="bq-soal-item">
        <input type="checkbox" value="${s.id}" class="soal-checkbox" ${selectedSoalIds.has(s.id) ? 'checked' : ''} />
        <span>${escapeHtml(s.pertanyaan)}</span>
      </label>
    `).join('');

    el.querySelectorAll('.soal-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedSoalIds.add(cb.value);
        else selectedSoalIds.delete(cb.value);
        updateSelectedCount();
      });
    });

    updateSelectedCount();
  }

  function updateSelectedCount() {
    document.getElementById('selected-count').textContent = selectedSoalIds.size;
  }

  // ============================================================
  // Save quiz
  // ============================================================
  async function saveQuiz() {
    const judul = document.getElementById('q-judul').value.trim();
    const kelasId = document.getElementById('q-kelas-select').value;
    const deskripsi = document.getElementById('q-deskripsi').value.trim() || null;
    const pakaiWaktu = document.getElementById('q-batas-waktu-toggle').checked;
    const menit = pakaiWaktu ? parseInt(document.getElementById('q-waktu-menit').value, 10) : null;

    if (!judul) { alert('Isi judul quiz dulu.'); return; }
    if (!kelasId) { alert('Pilih kelas untuk quiz ini.'); return; }
    if (selectedSoalIds.size === 0) { alert('Pilih minimal satu soal.'); return; }
    if (pakaiWaktu && (!menit || menit < 1)) { alert('Isi durasi waktu yang valid.'); return; }

    const btn = document.getElementById('save-quiz-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Menyimpan...';

    const { data: quiz, error } = await supabase
      .from('quiz')
      .insert({ judul, deskripsi, batas_waktu_menit: menit, kelas_id: kelasId })
      .select().single();

    if (error) { alert('Gagal membuat quiz: ' + error.message); btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Simpan quiz'; return; }

    const rows = [...selectedSoalIds].map(soal_id => ({ quiz_id: quiz.id, soal_id }));
    await supabase.from('quiz_soal').insert(rows);

    btn.innerHTML = '<i class="ti ti-check"></i> Tersimpan';

    await activateAssignSection(quiz.id, judul);
    await loadQuizList();
  }

  // ============================================================
  // Reset form
  // ============================================================
  function resetForm() {
    document.getElementById('q-judul').value = '';
    document.getElementById('q-kelas-select').value = '';
    document.getElementById('q-deskripsi').value = '';
    document.getElementById('q-batas-waktu-toggle').checked = false;
    document.getElementById('q-waktu-field').classList.add('hidden');
    document.getElementById('q-waktu-menit').value = '';
    document.getElementById('q-filter-materi').value = '';
    document.getElementById('soal-picker').innerHTML = '<p class="text-muted">Pilih materi untuk memuat soal.</p>';
    selectedSoalIds.clear();
    updateSelectedCount();
    currentQuizId = null;
    document.getElementById('assign-section').classList.add('hidden');

    const btn = document.getElementById('save-quiz-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i> Simpan quiz';
  }

  // ============================================================
  // Assign section
  // ============================================================
  async function activateAssignSection(quizId, judul) {
    currentQuizId = quizId;
    document.getElementById('assign-context').textContent = judul;
    document.getElementById('assign-section').classList.remove('hidden');
    document.getElementById('assign-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await loadAssignList();
  }

  async function createAssignment() {
    if (!currentQuizId) return;
    const anakId = document.getElementById('assign-anak-select').value;
    if (!anakId) { alert('Pilih anak dulu.'); return; }

    const { data: existing } = await supabase
      .from('assignment')
      .select('id')
      .eq('quiz_id', currentQuizId)
      .eq('anak_id', anakId)
      .maybeSingle();

    if (!existing) {
      const token = genToken();
      const { error } = await supabase.from('assignment').insert({ quiz_id: currentQuizId, anak_id: anakId, token });
      if (error) { alert('Gagal membuat link: ' + error.message); return; }
    }
    await loadAssignList();
  }

  async function loadAssignList() {
    const el = document.getElementById('assign-list');
    const { data, error } = await supabase
      .from('assignment')
      .select('id, token, skor, dikerjakan_at, anak(nama)')
      .eq('quiz_id', currentQuizId)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada anak yang di-assign. Pilih anak di atas lalu klik "Buat link".</p>';
      return;
    }

    const base = window.location.href.replace('buat-quiz.html', '') + 'quiz.html';
    el.innerHTML = data.map(a => {
      const link = `${base}?token=${a.token}`;
      const statusBadge = a.dikerjakan_at
        ? `<span class="badge ${gradeClass(a.skor)}">${Math.round(a.skor)}</span>`
        : '<span class="badge badge-muted">belum dikerjakan</span>';
      return `
        <div class="assign-row">
          <strong style="font-size:13px; min-width:90px;">${escapeHtml(a.anak ? a.anak.nama : '-')}</strong>
          ${statusBadge}
          <input type="text" class="assign-link-input" readonly value="${link}" />
          <button class="btn btn-sm" onclick="window.salinLink('${link}', this)"><i class="ti ti-copy"></i></button>
        </div>
      `;
    }).join('');
  }

  window.salinLink = (link, btn) => {
    navigator.clipboard.writeText(link).catch(() => {});
    btn.innerHTML = '<i class="ti ti-check"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i>'; }, 1500);
  };

  // ============================================================
  // Quiz list (existing quizzes)
  // ============================================================
  async function loadQuizList() {
    const el = document.getElementById('quiz-list');
    const { data, error } = await supabase
      .from('quiz')
      .select('id, judul, batas_waktu_menit, created_at, kelas(jenjang, nomor), assignment(id)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      el.innerHTML = '<p class="text-muted">Belum ada quiz.</p>';
      return;
    }

    el.innerHTML = data.map(q => `
      <div class="flex-between" style="padding:10px 0; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:13px; font-weight:600;">
            ${escapeHtml(q.judul)}
            <span class="badge badge-muted">${escapeHtml(kelasLabel(q.kelas))}</span>
            ${q.batas_waktu_menit ? `<span class="badge badge-muted"><i class="ti ti-clock" style="font-size:10px;"></i> ${q.batas_waktu_menit} mnt</span>` : ''}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">${(q.assignment || []).length} anak di-assign · ${formatDate(q.created_at)}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" onclick="window.kelolaQuiz('${q.id}', '${escapeHtml(q.judul).replace(/'/g, "\\'")}')"><i class="ti ti-link"></i> Kelola</button>
          <button class="btn btn-danger btn-sm" onclick="window.hapusQuiz('${q.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  window.kelolaQuiz = async (id, judul) => {
    await activateAssignSection(id, judul);
  };

  window.hapusQuiz = async (id) => {
    if (!confirm('Hapus quiz ini? Semua link dan riwayat nilainya ikut terhapus.')) return;
    const { error } = await supabase.from('quiz').delete().eq('id', id);
    if (error) { alert('Gagal menghapus: ' + error.message); return; }
    if (currentQuizId === id) {
      currentQuizId = null;
      document.getElementById('assign-section').classList.add('hidden');
    }
    await loadQuizList();
  };
})();
