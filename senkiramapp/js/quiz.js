(function () {
  const supabase = EK.supabaseClient;
  const { shuffle, escapeHtml, formatDate, kelasLabel } = EK;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  let assignment = null;
  let quiz = null;
  let soalList = [];
  let currentIndex = 0;
  let answers = {};
  let timerInterval = null;
  let remainingSeconds = 0;

  init();

  async function init() {
    if (!token) return showError();

    const { data: assignData, error: assignErr } = await supabase
      .from('assignment')
      .select('id, token, skor, dikerjakan_at, anak(nama), quiz(id, judul, deskripsi, batas_waktu_menit, kelas(jenjang, nomor))')
      .eq('token', token)
      .single();

    if (assignErr || !assignData || !assignData.quiz) return showError();
    assignment = assignData;
    quiz = assignData.quiz;

    const { data: relData, error: relErr } = await supabase
      .from('quiz_soal')
      .select('soal(id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, pembahasan)')
      .eq('quiz_id', quiz.id);

    if (relErr || !relData || relData.length === 0) return showError();
    soalList = shuffle(relData.map(r => r.soal).filter(Boolean));

    showIntro();
  }

  function showError() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
  }

  function showIntro() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('intro-screen').classList.remove('hidden');

    document.getElementById('intro-judul').textContent = quiz.judul;
    document.getElementById('intro-kelas-badge').textContent = kelasLabel(quiz.kelas);
    document.getElementById('intro-nama-anak').textContent = assignment.anak ? assignment.anak.nama : 'kamu';
    document.getElementById('intro-deskripsi').textContent = quiz.deskripsi || '';
    document.getElementById('intro-jumlah-soal').textContent = soalList.length;

    if (quiz.batas_waktu_menit) {
      document.getElementById('intro-waktu-wrap').classList.remove('hidden');
      document.getElementById('intro-waktu').textContent = quiz.batas_waktu_menit;
    }

    if (assignment.dikerjakan_at) {
      document.getElementById('intro-riwayat').classList.remove('hidden');
      document.getElementById('intro-riwayat').textContent =
        `Percobaan sebelumnya: nilai ${Math.round(assignment.skor)} pada ${formatDate(assignment.dikerjakan_at)}. Mengerjakan lagi akan menimpa nilai ini.`;
    }

    document.getElementById('mulai-btn').addEventListener('click', startQuiz);
  }

  function startQuiz() {
    document.getElementById('intro-screen').classList.add('hidden');
    document.getElementById('play-screen').classList.remove('hidden');
    currentIndex = 0;
    answers = {};

    if (quiz.batas_waktu_menit) {
      remainingSeconds = quiz.batas_waktu_menit * 60;
      document.getElementById('timer-wrap').classList.remove('hidden');
      updateTimerDisplay();
      timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();
        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          finishQuiz();
        }
      }, 1000);
    }

    renderQuestion();
  }

  function updateTimerDisplay() {
    const m = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
  }

  function renderQuestion() {
    const soal = soalList[currentIndex];
    document.getElementById('q-progress').style.width = ((currentIndex / soalList.length) * 100) + '%';
    document.getElementById('q-num').textContent = `Soal ${currentIndex + 1} dari ${soalList.length}`;
    document.getElementById('q-question').textContent = soal.pertanyaan;

    const letters = ['A', 'B', 'C', 'D'];
    const opts = [soal.pilihan_a, soal.pilihan_b, soal.pilihan_c, soal.pilihan_d];
    document.getElementById('q-options').innerHTML = opts.map((o, i) => `
      <div class="quiz-option" data-letter="${letters[i]}">
        <div class="option-letter">${letters[i]}</div>
        <span>${escapeHtml(o)}</span>
      </div>
    `).join('');

    document.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => selectAnswer(soal.id, el.dataset.letter));
    });

    const nextBtn = document.getElementById('next-btn');
    nextBtn.disabled = !answers[soal.id];
    nextBtn.textContent = currentIndex === soalList.length - 1 ? 'Selesai' : 'Soal berikutnya →';
    nextBtn.onclick = onNextClick;

    if (answers[soal.id]) {
      const el = document.querySelector(`.quiz-option[data-letter="${answers[soal.id]}"]`);
      if (el) el.classList.add('selected');
    }
  }

  function selectAnswer(soalId, letter) {
    answers[soalId] = letter;
    document.querySelectorAll('.quiz-option').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.quiz-option[data-letter="${letter}"]`).classList.add('selected');
    document.getElementById('next-btn').disabled = false;
  }

  function onNextClick() {
    if (currentIndex < soalList.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      if (timerInterval) clearInterval(timerInterval);
      finishQuiz();
    }
  }

  async function finishQuiz() {
    document.getElementById('play-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');

    const total = soalList.length;
    let benar = 0;
    soalList.forEach(s => { if (answers[s.id] === s.jawaban_benar) benar++; });
    const skor = Math.round((benar / total) * 100);

    renderResultHeader(skor, benar, total - benar);

    await supabase.from('assignment').update({
      skor,
      jumlah_benar: benar,
      jumlah_soal: total,
      jawaban_siswa: answers,
      dikerjakan_at: new Date().toISOString(),
    }).eq('id', assignment.id);

    renderReview();
  }

  function renderResultHeader(skor, benar, salah) {
    let title, color;
    if (skor >= 90) { title = 'Luar biasa!'; color = 'var(--success)'; }
    else if (skor >= 70) { title = 'Bagus!'; color = 'var(--primary)'; }
    else if (skor >= 50) { title = 'Cukup baik'; color = 'var(--warning)'; }
    else { title = 'Terus berlatih!'; color = 'var(--danger)'; }

    const circle = document.querySelector('.result-circle');
    circle.style.borderColor = color;
    document.getElementById('result-score').style.color = color;
    document.getElementById('result-score').textContent = skor;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-sub').textContent =
      `Benar ${benar} dari ${soalList.length} soal · Salah ${salah}`;
  }

  function renderReview() {
    const letters = ['A', 'B', 'C', 'D'];
    const el = document.getElementById('review-list');
    el.innerHTML = soalList.map((s, i) => {
      const opts = [s.pilihan_a, s.pilihan_b, s.pilihan_c, s.pilihan_d];
      const userAnswer = answers[s.id];
      const optionsHtml = opts.map((o, idx) => {
        const letter = letters[idx];
        let cls = 'quiz-option';
        if (letter === s.jawaban_benar) cls += ' correct';
        else if (letter === userAnswer) cls += ' wrong';
        return `<div class="${cls}"><div class="option-letter">${letter}</div><span>${escapeHtml(o)}</span></div>`;
      }).join('');
      return `
        <div class="card" style="background:var(--bg);">
          <p style="font-size:13px; font-weight:600;">${i + 1}. ${escapeHtml(s.pertanyaan)}</p>
          ${optionsHtml}
          ${s.pembahasan ? `<p class="text-muted" style="font-size:12px; margin-top:8px;"><i class="ti ti-bulb"></i> ${escapeHtml(s.pembahasan)}</p>` : ''}
        </div>
      `;
    }).join('');
  }
})();
