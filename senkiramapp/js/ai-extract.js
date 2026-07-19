// Memanggil Anthropic API langsung dari browser memakai API key milik admin sendiri.
// Key disimpan di localStorage, tidak pernah dikirim ke server lain selain api.anthropic.com
window.EK = window.EK || {};

(function () {
  const MODEL = 'claude-haiku-4-5-20251001';

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  EK.hasApiKey = function () {
    return !!localStorage.getItem('edukids_anthropic_key');
  };

  EK.extractSoalFromPdf = async function (file, onProgress) {
    const apiKey = localStorage.getItem('edukids_anthropic_key');
    if (!apiKey) throw new Error('Belum ada API key. Atur di halaman Pengaturan.');

    onProgress && onProgress('Membaca file PDF...');
    const base64 = await fileToBase64(file);

    const prompt = `Kamu akan menerima file PDF berisi soal pilihan ganda (4 opsi: A, B, C, D).
Ekstrak SEMUA soal yang ditemukan dan kembalikan HANYA sebagai JSON array valid, tanpa teks lain, tanpa markdown fence.
Setiap item harus punya format persis seperti ini:
{"pertanyaan": "...", "pilihan_a": "...", "pilihan_b": "...", "pilihan_c": "...", "pilihan_d": "...", "jawaban_benar": "A", "pembahasan": ""}

Aturan:
- jawaban_benar harus salah satu dari "A", "B", "C", "D".
- Jika kunci jawaban tidak ditemukan di PDF, tebak jawaban paling masuk akal dan tetap isi jawaban_benar (jangan dikosongkan).
- Jika ada pembahasan/penjelasan di PDF, masukkan ke field pembahasan. Jika tidak ada, biarkan string kosong "".
- Jangan tambahkan teks pembuka atau penutup. Balas HANYA dengan JSON array.`;

    onProgress && onProgress('Mengirim ke Claude untuk diproses...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Anthropic API error (' + response.status + '): ' + errText);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('Tidak ada respons teks dari model.');

    onProgress && onProgress('Mem-parsing hasil...');

    let cleaned = textBlock.text.trim();
    cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error('Gagal membaca hasil AI sebagai JSON. Coba lagi atau input manual.');
    }
    if (!Array.isArray(parsed)) throw new Error('Format hasil AI tidak sesuai (bukan array).');
    return parsed;
  };
})();
