window.EK = window.EK || {};

EK.shuffle = function (array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

EK.gradeLetter = function (skor) {
  if (skor >= 85) return 'A';
  if (skor >= 70) return 'B';
  if (skor >= 55) return 'C';
  return 'D';
};

EK.gradeClass = function (skor) {
  return 'badge-grade-' + EK.gradeLetter(skor).toLowerCase();
};

EK.formatDate = function (iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

EK.formatDuration = function (seconds) {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`;
};

EK.kelasLabel = function (kelas) {
  if (!kelas) return '-';
  return `${kelas.jenjang} Kelas ${kelas.nomor}`;
};

EK.materiLabel = function (materi) {
  if (!materi) return '-';
  const kelas = materi.kelas ? EK.kelasLabel(materi.kelas) : '';
  const mapel = materi.mata_pelajaran ? materi.mata_pelajaran.nama : '';
  return `${kelas} — ${mapel} — ${materi.nama}`;
};

EK.escapeHtml = function (str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
};

// Token unik untuk link assignment quiz. Tidak perlu aman secara kriptografis,
// cukup panjang & acak supaya tidak mudah ditebak lewat percobaan biasa.
EK.genToken = function (len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  arr.forEach(v => { out += chars[v % chars.length]; });
  return out;
};
