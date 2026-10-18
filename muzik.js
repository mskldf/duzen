/* Haftanın albümü: muzik/albumler.json'daki kuyruktan her pazartesi bir albüm; dinlenmeyen sonraki haftaya geçer. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const YOL = 'muzik/albumler.json';
  const UYGULAMALAR = [
    ['', 'Seçilmedi'],
    ['spotify', 'Spotify'],
    ['youtube_music', 'YouTube Music'],
    ['apple_music', 'Apple Music'],
  ];
  const veri = () => D.jsonOku(YOL) || { albumler: [] };
  const ad = a => (a.sanatci ? a.sanatci + ' — ' : '') + a.album + (a.yil ? ' (' + a.yil + ')' : '');
  function acBag(a, uyg) {
    const q = encodeURIComponent([a.sanatci, a.album].filter(Boolean).join(' '));
    const u = { spotify: 'https://open.spotify.com/search/' + q, youtube_music: 'https://music.youtube.com/search?q=' + q, apple_music: 'https://music.apple.com/search?term=' + q }[uyg];
    return u ? '<a class="dugme ikincil" href="' + u + '" target="_blank" rel="noopener">' + esc((UYGULAMALAR.find(x => x[0] === uyg) || [])[1]) + '\'da aç</a>' : '';
  }
  const haftaYazi = iso => { const d = L.tarihAyristir(iso); return L.kisaTarih(d) + '–' + L.kisaTarih(L.gunEkle(d, 6)); };

  // ---------- Bugün kartı ----------
  D.kart('bugun-plan-alti', simdi => {
    const v = veri();
    if (!v.albumler || !v.albumler.length) return '<section class="kart"><div class="kart-ust"><h2>Haftanın albümü</h2></div><p class="not">Kuyrukta albüm yok. <a href="#muzik">Albüm ekle</a></p></section>';
    const p = L.albumPlani(v, simdi);
    if (p.aktif) {
      const a = p.aktif.album;
      return '<section class="kart album-kart"><div class="kart-ust"><h2>Haftanın albümü</h2>' + (p.aktif.kacinci > 1 ? '<span class="rozet">' + p.aktif.kacinci + '. hafta</span>' : '') + '</div>' +
        '<p class="album-ad">' + esc(a.album) + '</p><p class="not">' + esc([a.sanatci, a.yil].filter(Boolean).join(' · ')) + (a.secen === 'Claude' ? ' · koçun önerisi' : '') + '</p>' +
        '<div class="oneri-dugmeler"><button type="button" class="dugme" data-album-dinledim="' + esc(a.id) + '">Dinledim</button>' + acBag(a, v.uygulama) +
        '<a class="metin-dugme" href="#muzik">Kuyruk</a></div></section>';
    }
    const sonraki = p.plan.find(x => x.gelecek);
    const buHafta = L.isoTarih(L.haftaBasi(simdi));
    const dinlenen = p.plan.filter(x => x.album.dinlendi && x.album.dinlendi >= buHafta).pop();
    return '<section class="kart"><div class="kart-ust"><h2>Haftanın albümü</h2></div>' +
      (dinlenen ? '<p class="not">Bu hafta dinlendi: ' + esc(ad(dinlenen.album)) + '.</p>' : '') +
      (sonraki ? '<p class="not">Sıradaki ' + esc(L.kisaTarih(L.tarihAyristir(sonraki.hafta))) + ' pazartesi: ' + esc(ad(sonraki.album)) + '</p>' : '<p class="not">Kuyruk bitti. <a href="#muzik">Albüm ekle</a></p>') + '</section>';
  });

  // ---------- Müzik sayfası ----------
  function gorunum() {
    const v = veri();
    const simdi = new Date();
    const p = L.albumPlani(v, simdi);
    const dinlenenler = p.plan.filter(x => x.album.dinlendi).reverse();
    const sirada = p.plan.filter(x => !x.album.dinlendi);
    const satir = (x, i) => '<li class="album-satir"><span class="album-hafta sayi">' + esc(haftaYazi(x.hafta)) + '</span>' +
      '<span class="album-orta"><span class="satir-baslik">' + esc(x.album.album) + '</span><small>' + esc([x.album.sanatci, x.album.yil].filter(Boolean).join(' · ')) +
      (x.kacinci ? ' · ' + (x.kacinci > 1 ? x.kacinci + '. hafta, devretti' : 'bu hafta') : '') + (x.album.secen === 'Claude' ? ' · koçun önerisi' : '') + '</small></span>' +
      '<span class="album-dugmeler">' + (i > 0 ? '<button type="button" class="ikon-kucuk" data-album-yukari="' + esc(x.album.id) + '" aria-label="Yukarı">↑</button>' : '') +
      (i < sirada.length - 1 ? '<button type="button" class="ikon-kucuk" data-album-asagi="' + esc(x.album.id) + '" aria-label="Aşağı">↓</button>' : '') +
      '<button type="button" class="ikon-kucuk" data-album-sil="' + esc(x.album.id) + '" aria-label="Kuyruktan çıkar">✕</button></span></li>';
    return '<article class="muzik">' +
      '<header class="bolum-bas"><h1>Müzik</h1></header>' +
      '<p class="not">Her pazartesi kuyruktaki sıradaki albüm gelir. Dinlemediğin albüm sonraki haftaya geçer, sıra kayar. Kuyruk azalınca koç Pazar günü öneri getirir.</p>' +
      '<form class="kart" id="albumEkle"><h2>Albüm ekle</h2><div class="iki-alan"><label class="alan">Sanatçı<input name="sanatci" type="text" required></label>' +
      '<label class="alan">Albüm<input name="album" type="text" required></label></div><label class="alan">Yıl (isteğe bağlı)<input name="yil" type="number" inputmode="numeric" min="1900" max="2100"></label>' +
      '<div class="dialog-alt"><button type="submit" class="dugme">Kuyruğa ekle</button></div></form>' +
      '<section><h2>Kuyruk</h2>' + (sirada.length ? '<ol class="liste album-liste">' + sirada.map(satir).join('') + '</ol>' : '<p class="not">Kuyruk boş.</p>') + '</section>' +
      (dinlenenler.length ? '<section><h2>Dinlenenler</h2><ul class="liste">' + dinlenenler.map(x => '<li class="girdi"><span class="sayi">' + esc(x.album.dinlendi) + '</span> ' +
        esc(ad(x.album)) + (x.album.puan ? ' · ' + '★'.repeat(x.album.puan) : '') + (x.album.not ? ' · ' + esc(x.album.not) : '') + '</li>').join('') + '</ul></section>' : '') +
      '<section><h2>Dinlediğin uygulama</h2><label class="alan satir-ici-alan">Kartta "aç" düğmesi buna göre<select data-album-uygulama>' +
      UYGULAMALAR.map(([k, e]) => '<option value="' + k + '"' + ((v.uygulama || '') === k ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></label></section>' +
      '</article>';
  }
  D.gorunum('muzik', gorunum, 'defter');
  D.panel({ ad: 'Müzik', href: '#muzik' });

  // ---------- yazma ----------
  function degistir(fn, mesaj) {
    return D.degistirVeYaz(YOL, eski => {
      const v = eski ? JSON.parse(eski) : {};
      v.albumler = v.albumler || [];
      if (!v.baslangic) v.baslangic = L.isoTarih(L.haftaBasi(new Date()));
      fn(v);
      v.guncelleme = L.isoTarih(new Date());
      return JSON.stringify(v, null, 2) + '\n';
    }, mesaj);
  }

  function pencere() {
    let d = document.getElementById('albumDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'albumDialog';
    d.innerHTML = '<form id="albumForm" method="dialog"><h2>Dinledim</h2><p class="not" id="album-ad"></p><input type="hidden" name="id">' +
      '<fieldset class="alan"><legend>Puan (isteğe bağlı)</legend><div class="secimler">' +
      [1, 2, 3, 4, 5].map(n => '<label class="secim"><input type="radio" name="puan" value="' + n + '"> ' + '★'.repeat(n) + '</label>').join('') + '</div></fieldset>' +
      '<label class="alan">Tek satır not (isteğe bağlı)<input name="not" type="text"></label>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt"><button type="button" class="metin-dugme" data-kapat="albumDialog">Vazgeç</button>' +
      '<button type="submit" class="dugme">Kaydet</button></div></form>';
    document.body.appendChild(d);
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      D.islemle(e.submitter || d.querySelector('[type=submit]'), () => dinledim(String(f.get('id')), f.get('puan') ? Number(f.get('puan')) : null, String(f.get('not') || '').trim()), 'Kaydedildi')
        .then(ok => { if (ok) d.close(); });
    });
    return d;
  }

  async function dinledim(id, puan, not) {
    const bugun = L.isoTarih(new Date());
    let a = null;
    await degistir(v => {
      a = v.albumler.find(x => x.id === id);
      if (!a) throw new Error('Albüm bulunamadı; önce eşitle.');
      a.dinlendi = bugun;
      if (puan) a.puan = puan;
      if (not) a.not = not;
    }, 'Müzik: ' + id + ' dinlendi');
    const k = { t: bugun, tur: 'muzik', kaynak: 'uygulama', sanatci: a.sanatci || '', album: a.album };
    if (puan) k.puan = puan;
    await D.kayitEkle(k);
    return true;
  }

  document.addEventListener('submit', e => {
    if (e.target.id !== 'albumEkle') return;
    e.preventDefault();
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    const f = new FormData(e.target);
    const bugun = L.isoTarih(new Date());
    const yeni = { id: bugun + '-' + Math.random().toString(36).slice(2, 7), sanatci: String(f.get('sanatci') || '').trim(), album: String(f.get('album') || '').trim(),
      yil: f.get('yil') ? Number(f.get('yil')) : null, secen: 'Emir', eklendi: bugun, dinlendi: null };
    D.islemle(e.target.querySelector('[type=submit]'), () => degistir(v => { v.albumler.push(yeni); }, 'Müzik: ' + yeni.album + ' kuyruğa'), 'Kuyruğa eklendi');
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-album-dinledim], [data-album-yukari], [data-album-asagi], [data-album-sil]');
    if (!t) return;
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    if (t.dataset.albumDinledim) {
      const a = (veri().albumler || []).find(x => x.id === t.dataset.albumDinledim);
      const d = pencere();
      d.querySelector('form').reset();
      d.querySelector('[name=id]').value = t.dataset.albumDinledim;
      d.querySelector('#album-ad').textContent = a ? ad(a) : '';
      D.pencereAc('albumDialog');
      return;
    }
    const id = t.dataset.albumYukari || t.dataset.albumAsagi || t.dataset.albumSil;
    D.islemle(t, () => degistir(v => {
      const sirada = v.albumler.filter(x => !x.dinlendi);
      const i = sirada.findIndex(x => x.id === id);
      if (i < 0) throw new Error('Albüm bulunamadı; önce eşitle.');
      if (t.dataset.albumSil) { v.albumler = v.albumler.filter(x => x.id !== id); return; }
      const j = t.dataset.albumYukari ? i - 1 : i + 1;
      if (j < 0 || j >= sirada.length) return;
      [sirada[i], sirada[j]] = [sirada[j], sirada[i]];
      v.albumler = v.albumler.filter(x => x.dinlendi).concat(sirada);
    }, 'Müzik: kuyruk düzenlendi'));
  });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-album-uygulama]')) return;
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    const deger = e.target.value || null;
    D.islemle(e.target, () => degistir(v => { v.uygulama = deger; }, 'Müzik: uygulama ' + (deger || 'yok')), 'Kaydedildi');
  });
});
