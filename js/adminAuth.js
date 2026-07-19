// Ini BUKAN autentikasi sungguhan, hanya gerbang password sederhana di browser.
// Lihat catatan keamanan di README.
window.EK = window.EK || {};

(function () {
  const FLAG_KEY = 'edukids_admin_ok';

  EK.checkPassword = function (pw) {
    return pw === EK.ADMIN_PASSWORD;
  };

  EK.setAdminSession = function () {
    localStorage.setItem(FLAG_KEY, 'true');
  };

  EK.isAdmin = function () {
    return localStorage.getItem(FLAG_KEY) === 'true';
  };

  EK.logout = function () {
    localStorage.removeItem(FLAG_KEY);
    window.location.href = 'index.html';
  };

  // Panggil di setiap halaman admin. Redirect ke gerbang password kalau belum masuk.
  EK.requireAdmin = function () {
    if (!EK.isAdmin()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  };
})();
