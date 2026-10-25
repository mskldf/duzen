/* Koçun önerileri: Pazar değerlendirmesinde Claude koc/oneriler.json'a yazar; Emir Kabul ya da Reddet der.
   Kabul edilen öneri makineyle uygulanabiliyorsa (proje alanı, albüm, iskelet bloğu) hemen uygulanır;
   değilse "kabul" olarak işaretlenir, Claude bir sonraki çalışmasında plana işler. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const YOL = 'koc/oneriler.json';
  const PROJE_ALANLARI = ['sira', 'donem', 'durum', 'son_gun', 'blok', 'buyukluk'];

  const oneriler = () => ((D.jsonOku(YOL) || {}).oneriler || []);
  // Bir haftadan eski bekleyen öneri gösterilmez: tarihi geçmiş öneri karar istemez; koç Pazar günü temizler
  const taze = o => !o.t || L.gunFarki(L.tarihAyristir(o.t), L.sadeceGun(new Date())) <= 7;
  const bekleyenler = () => oneriler().filter(o => o.durum === 'bekliyor' && taze(o));

  function kart(o) {
    return '<li class="oneri" data-oneri="' + esc(o.id) + '">' +
      '<p class="oneri-baslik">' + esc(o.baslik || 'Öneri') + '</p>' +
      (o.metin ? '<div class="metin oneri-metin">' + D.md(o.metin) + '</div>' : '') +
      '<div class="oneri-dugmeler"><button type="button" class="dugme" data-oneri-karar="kabul" data-id="' + esc(o.id) + '">Kabul</button>' +
      '<button type="button" class="dugme ikincil" data-oneri-karar="ret" data-id="' + esc(o.id) + '">Reddet</button>' +
      (o.t ? '<span class="not sayi">' + esc(L.kisaTarih(L.tarihAyristir(o.t))) + '</span>' : '') + '</div></li>';
  }

  function bolum(baslik, liste, fazlasi) {
    if (!liste.length) return '';
    return '<section class="kart oneriler"><h2>' + baslik + '</h2><ul class="liste">' + liste.map(kart).join('') + '</ul>' +
      (fazlasi ? '<p class="not"><a href="#koc">' + fazlasi + ' öneri daha</a></p>' : '') + '</section>';
  }

  D.kart('bugun-ust', () => { const b = bekleyenler(); return bolum('Koçun önerisi', b.slice(0, 2), Math.max(0, b.length - 2)); });
  D.kart('koc-ust', () => bolum('Bekleyen öneriler', bekleyenler(), 0));
  D.kart('koc-alt', () => {
    const son = oneriler().filter(o => o.durum !== 'bekliyor').sort((a, b) => String(b.karar_t || '').localeCompare(String(a.karar_t || ''))).slice(0, 6);
    if (!son.length) return '';
    return '<section><h2>Son kararlar</h2><ul class="liste">' + son.map(o => '<li class="girdi"><span class="sayi">' + esc(o.karar_t || '') + '</span> ' +
      (o.durum === 'kabul' ? 'Kabul' : 'Ret') + ': ' + esc(o.baslik || '') + (o.durum === 'kabul' && o.eylem && !o.uygulandi ? ' <small class="satir-ici">(Claude plana işleyecek)</small>' : '') + '</li>').join('') + '</ul></section>';
  });

  // ---------- uygulama ----------
  function onYaziDegistir(metin, alanlar) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(metin || '');
    if (!m) throw new Error('Proje sayfasının ön yazısı okunamadı.');
    let blok = m[1];
    for (const [k, v] of Object.entries(alanlar)) {
      const satir = k + ': ' + JSON.stringify(v);
      const re = new RegExp('^' + k + ':.*$', 'm');
      blok = re.test(blok) ? blok.replace(re, () => satir) : blok + '\n' + satir;
    }
    return metin.slice(0, m.index) + '---\n' + blok + '\n---' + metin.slice(m.index + m[0].length);
  }

  async function uygula(o) {
    const e = o.eylem;
    if (!e || !e.tur) return false;
    const bugun = L.isoTarih(new Date());
    if (e.tur === 'proje_alan') {
      if (!PROJE_ALANLARI.includes(e.alan) || !/^[a-z0-9-]+$/.test(e.slug || '')) return false;
      await D.degistirVeYaz('defter/projeler/' + e.slug + '.md', eski => {
        if (!eski) throw new Error('Proje sayfası bulunamadı: ' + e.slug);
        return onYaziDegistir(eski, { [e.alan]: e.deger, guncelleme: bugun });
      }, 'Defter: ' + e.slug + ' ' + e.alan + ' (koç önerisi)');
      return true;
    }
    if (e.tur === 'album_ekle') {
      await D.degistirVeYaz('muzik/albumler.json', eski => {
        const v = eski ? JSON.parse(eski) : { albumler: [] };
        v.albumler = v.albumler || [];
        v.albumler.push({ id: bugun + '-' + Math.random().toString(36).slice(2, 7), sanatci: e.sanatci || '', album: e.album || '', yil: e.yil || null,
          secen: 'Claude', eklendi: bugun, dinlendi: null, puan: null, not: '' });
        v.guncelleme = bugun;
        return JSON.stringify(v, null, 2) + '\n';
      }, 'Müzik: ' + (e.album || '') + ' kuyruğa (koç önerisi)');
      return true;
    }
    if (e.tur === 'iskelet_blok') {
      if (!Array.isArray(e.gunler) || !e.saat || !e.is) return false;
      await D.degistirVeYaz('defter/iskelet.json', eski => {
        const v = JSON.parse(eski);
        v.bloklar = v.bloklar || [];
        v.bloklar.push({ gunler: e.gunler, saat: e.saat, kulvar: e.kulvar || '', is: e.is });
        v.guncelleme = bugun;
        return JSON.stringify(v, null, 2) + '\n';
      }, 'İskelet: ' + e.is + ' (koç önerisi)');
      return true;
    }
    return false;
  }

  async function karar(id, ne) {
    const o = oneriler().find(x => x.id === id);
    if (!o) throw new Error('Öneri bulunamadı; önce eşitle.');
    const uygulandi = ne === 'kabul' ? await uygula(o) : false;
    await D.degistirVeYaz(YOL, eski => {
      const v = JSON.parse(eski);
      const x = (v.oneriler || []).find(y => y.id === id);
      if (!x) throw new Error('Öneri bulunamadı.');
      x.durum = ne;
      x.karar_t = L.isoTarih(new Date());
      if (uygulandi) x.uygulandi = true;
      v.guncelleme = x.karar_t;
      return JSON.stringify(v, null, 2) + '\n';
    }, 'Koç önerisi: ' + (o.baslik || id) + ' ' + ne);
    if (uygulandi) await D.esitle(true);
    return true;
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-oneri-karar]');
    if (!t) return;
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    D.islemle(t, () => karar(t.dataset.id, t.dataset.oneriKarar), t.dataset.oneriKarar === 'kabul' ? 'Kabul edildi' : 'Reddedildi');
  });
});
