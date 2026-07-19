window.EK = window.EK || {};

EK.renderNav = function (activePage) {
  const root = document.getElementById('nav-root');
  if (!root) return;

  const link = (href, page, icon, label) =>
    `<a href="${href}" class="${activePage === page ? 'active' : ''}"><i class="ti ti-${icon}"></i> ${label}</a>`;

  const links = [
    link('dashboard.html', 'dashboard', 'layout-dashboard', 'Dashboard'),
    link('bank-soal.html', 'bank-soal', 'books', 'Bank soal'),
    link('buat-quiz.html', 'buat-quiz', 'clipboard-list', 'Quiz'),
    link('nilai.html', 'nilai', 'chart-bar', 'Nilai'),
    link('kelola-anak.html', 'kelola-anak', 'users', 'Anak'),
    link('settings.html', 'settings', 'settings', 'Pengaturan'),
  ].join('');

  root.innerHTML = `
    <div class="nav-inner">
      <div class="nav-brand"><i class="ti ti-school"></i> EduKids</div>
      <nav class="nav-links">${links}</nav>
      <div class="nav-user">
        <button id="logout-btn" class="btn" style="padding:6px 10px;"><i class="ti ti-lock"></i> Keluar</button>
      </div>
    </div>
  `;
  document.getElementById('logout-btn').addEventListener('click', EK.logout);
};
