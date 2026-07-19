// Parser untuk file .md berisi soal, tanpa perlu AI/API key.
// Format yang harus diikuti (bisa berulang untuk banyak soal dalam satu file):
//
// ## Soal
// Berapakah hasil dari 7 x 8?
//
// - A. 48
// - B. 54
// - C. 56
// - D. 63
//
// Jawaban: C
// Pembahasan: 7 dikali 8 sama dengan 56.
//
// Baris "Pembahasan:" boleh dihilangkan kalau tidak ada.
window.EK = window.EK || {};

EK.parseMarkdownSoal = function (text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const chunks = normalized.split(/\n(?=##\s*Soal)/i).filter(c => /##\s*Soal/i.test(c));

  const results = [];
  for (const chunk of chunks) {
    const body = chunk.replace(/^##\s*Soal\s*/i, '').trim();

    const getOption = (letter) => {
      const re = new RegExp('^[-*]\\s*' + letter + '[.).]\\s*(.+)$', 'im');
      const m = body.match(re);
      return m ? m[1].trim() : '';
    };
    const pilihan_a = getOption('A');
    const pilihan_b = getOption('B');
    const pilihan_c = getOption('C');
    const pilihan_d = getOption('D');

    const jawabanMatch = body.match(/Jawaban\s*:\s*([ABCD])/i);
    const pembahasanMatch = body.match(/Pembahasan\s*:\s*([\s\S]*)/i);

    const firstOptIdx = body.search(/^[-*]\s*A[.).]/im);
    const pertanyaan = (firstOptIdx > -1 ? body.slice(0, firstOptIdx) : body)
      .replace(/\n+/g, ' ')
      .trim();

    const soal = {
      pertanyaan,
      pilihan_a,
      pilihan_b,
      pilihan_c,
      pilihan_d,
      jawaban_benar: jawabanMatch ? jawabanMatch[1].toUpperCase() : '',
      pembahasan: pembahasanMatch ? pembahasanMatch[1].split(/\n##\s*Soal/i)[0].trim() : '',
    };

    if (soal.pertanyaan && soal.pilihan_a && soal.pilihan_b && soal.pilihan_c && soal.pilihan_d) {
      results.push(soal);
    }
  }
  return results;
};

EK.MD_TEMPLATE_EXAMPLE = `## Soal
Berapakah hasil dari 7 x 8?

- A. 48
- B. 54
- C. 56
- D. 63

Jawaban: C
Pembahasan: 7 dikali 8 sama dengan 56.

## Soal
Ibu kota Indonesia adalah...

- A. Bandung
- B. Jakarta
- C. Surabaya
- D. Medan

Jawaban: B
`;
