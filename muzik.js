/* Haftanın albümü: muzik/albumler.json'daki kuyruktan her pazartesi bir albüm; dinlenmeyen sonraki haftaya geçer.
   "Dinledim" her zaman açık: albüm haftası gelmeden de, kuyruktaki herhangi bir albüm için de denebilir. */
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
  const uygAdi = uyg => (UYGULAMALAR.find(x => x[0] === uyg) || [])[1] || '';
  function acAdresi(a, uyg) {
    const q = encodeURIComponent([a.sanatci, a.album].filter(Boolean).join(' '));
    return { spotify: 'https://open.spotify.com/search/' + q, youtube_music: 'https://music.youtube.com/search?q=' + q, apple_music: 'https://music.apple.com/search?term=' + q }[uyg] || '';
  }
  const haftaYazi = iso => { const d = L.tarihAyristir(iso); return L.kisaTarih(d) + '–' + L.kisaTarih(L.gunEkle(d, 6)); };

  // Dinledim'in hedefi: bu haftanın albümü; yoksa kuyruktaki ilk dinlenmemiş albüm (haftası gelmeden)
  function hedef(v, simdi) {
    const p = L.albumPlani(v, simdi);
    const buHafta = L.isoTarih(L.haftaBasi(simdi));
    const dinlenen = p.plan.filter(x => x.album.dinlendi && x.album.dinlendi >= buHafta).pop() || null;
    if (p.aktif) return { satir: p.aktif, dinlenen, durum: p.aktif.kacinci > 1 ? p.aktif.kacinci + '. hafta' : 'bu hafta' };
    const sonraki = p.plan.find(x => !x.album.dinlendi) || null;
    return { satir: sonraki, dinlenen, durum: sonraki ? 'sıradaki' : '' };
  }

  // ---------- Bugün kutucuğu ----------
  D.kutucuk(20, simdi => {
    const v = veri();
    if (!(v.albumler || []).length) return D.kutucukHtml({ href: '#muzik', ikon: 'muzik', etiket: 'Albüm', ana: 'Kuyruk boş', alt: 'Albüm ekle' });
    const h = hedef(v, simdi);
    if (!h.satir) return D.kutucukHtml({ href: '#muzik', ikon: 'muzik', etiket: 'Albüm', ana: 'Kuyruk bitti', alt: h.dinlenen ? 'Bu haftaki dinlendi; yeni albüm ekle' : 'Albüm ekle' });
    const a = h.satir.album;
    return D.kutucukHtml({ attrs: 'data-album-dinledim="' + esc(a.id) + '"', ikon: 'muzik', etiket: 'Albüm · ' + h.durum, ana: a.album,
      alt: [a.sanatci, a.yil].filter(Boolean).join(' · '), eylem: 'Dinledim' });
  });

  // ---------- Müzik sayfası ----------
  function gorunum() {
    const v = veri();
    const simdi = new Date();
    const p = L.albumPlani(v, simdi);
    const dinlenenler = p.plan.filter(x => x.album.dinlendi).reverse();
    const sirada = p.plan.filter(x => !x.album.dinlendi);
    const satir = (x, i) => '<li class="album-satir">' +
      '<div class="album-bilgi"><span class="album-hafta sayi">' + esc(haftaYazi(x.hafta)) +
      (x.kacinci ? ' · ' + (x.kacinci > 1 ? x.kacinci + '. hafta, devretti' : 'bu hafta') : '') + '</span>' +
      '<span class="satir-baslik">' + esc(x.album.album) + '</span>' +
      '<small>' + esc([x.album.sanatci, x.album.yil].filter(Boolean).join(' · ')) + (x.album.secen === 'Claude' ? ' · koçun önerisi' : '') + '</small></div>' +
      '<div class="album-dugmeler"><button type="button" class="dugme ikincil kucuk" data-album-dinledim="' + esc(x.album.id) + '">Dinledim</button>' +
      (i > 0 ? '<button type="button" class="ikon-kucuk" data-album-yukari="' + esc(x.album.id) + '" aria-label="Yukarı">↑</button>' : '') +
      (i < sirada.length - 1 ? '<button type="button" class="ikon-kucuk" data-album-asagi="' + esc(x.album.id) + '" aria-label="Aşağı">↓</button>' : '') +
      '<button type="button" class="ikon-kucuk" data-album-sil="' + esc(x.album.id) + '" aria-label="Kuyruktan çıkar">✕</button></div></li>';
    return '<article class="muzik">' +
      '<header class="bolum-bas"><h1>Müzik</h1></header>' +
      '<p class="not">Her pazartesi kuyruktaki sıradaki albüm gelir. Dinlemediğin albüm sonraki haftaya geçer. Haftası gelmeden dinlersen "Dinledim" de; sıradaki, ertesi pazartesi gelir. Kuyruk azalınca koç Pazar günü öneri getirir.</p>' +
      '<section><h2>Kuyruk</h2>' + (sirada.length ? '<ol class="liste album-liste">' + sirada.map(satir).join('') + '</ol>' : '<p class="not">Kuyruk boş.</p>') + '</section>' +
      '<form class="kart" id="albumEkle"><h2>Albüm ekle</h2><div class="iki-alan"><label class="alan">Sanatçı<input name="sanatci" type="text" required></label>' +
      '<label class="alan">Albüm<input name="album" type="text" required></label></div><label class="alan">Yıl (isteğe bağlı)<input name="yil" type="number" inputmode="numeric" min="1900" max="2100"></label>' +
      '<div class="dialog-alt"><button type="submit" class="dugme">Kuyruğa ekle</button></div></form>' +
      (dinlenenler.length ? '<section><h2>Dinlenenler</h2><ul class="liste">' + dinlenenler.map(x => '<li class="girdi"><span class="sayi">' + esc(x.album.dinlendi) + '</span> ' +
        esc(ad(x.album)) + (x.album.puan ? ' · ' + '★'.repeat(x.album.puan) : '') + (x.album.not ? ' · ' + esc(x.album.not) : '') + '</li>').join('') + '</ul></section>' : '') +
      '<section><h2>Dinlediğin uygulama</h2><label class="alan satir-ici-alan">Albüm penceresindeki "aç" düğmesi buna göre<select data-album-uygulama>' +
      UYGULAMALAR.map(([k, e]) => '<option value="' + k + '"' + ((v.uygulama || '') === k ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></label></section>' +
      '</article>';
  }
  D.gorunum('muzik', gorunum, 'daha');
  D.panel({ ad: 'Müzik', href: '#muzik', ikon: 'muzik', aciklama: 'Haftanın albümü ve kuyruk', sira: 10 });

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
    d.setAttribute('aria-labelledby', 'album-baslik');
    d.innerHTML = '<form id="albumForm" method="dialog"><h2 id="album-baslik"></h2><p class="not" id="album-ad"></p><p id="album-ac"></p><input type="hidden" name="id">' +
      '<fieldset class="alan"><legend>Puan (isteğe bağlı)</legend><div class="secimler">' +
      [1, 2, 3, 4, 5].map(n => '<label class="secim"><input type="radio" name="puan" value="' + n + '"> ' + '★'.repeat(n) + '</label>').join('') + '</div></fieldset>' +
      '<label class="alan">Tek satır not (isteğe bağlı)<input name="not" type="text"></label>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt"><button type="button" class="metin-dugme" data-kapat="albumDialog">Vazgeç</button>' +
      '<button type="submit" class="dugme">Dinledim</button></div></form>';
    document.body.appendChild(d);
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      let sonuc = null;
      D.islemle(e.submitter || d.querySelector('[type=submit]'), async () => {
        sonuc = await dinledim(String(f.get('id')), f.get('puan') ? Number(f.get('puan')) : null, String(f.get('not') || '').trim());
        return true;
      }).then(ok => {
        if (!ok) return;
        d.close();
        D.tost(sonuc.a.album + ' dinlendi', false, { ad: 'Geri al', fn: () => D.islemle(null, () => geriAl(sonuc), 'Geri alındı') });
      });
    });
    return d;
  }

  function pencereAc(id) {
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    const v = veri();
    const a = (v.albumler || []).find(x => x.id === id);
    if (!a) { D.tost('Albüm bulunamadı; önce yenile', true); return; }
    const d = pencere();
    d.querySelector('form').reset();
    d.querySelector('[name=id]').value = id;
    d.querySelector('#album-baslik').textContent = a.album;
    d.querySelector('#album-ad').textContent = [a.sanatci, a.yil].filter(Boolean).join(' · ') + (a.dinlendi ? ' · ' + a.dinlendi + ' tarihinde dinlendi' : '');
    const u = acAdresi(a, v.uygulama);
    d.querySelector('#album-ac').innerHTML = u ? '<a class="dugme ikincil" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(uygAdi(v.uygulama)) + '\'da aç</a>'
      : '<span class="not">Müzik sayfasında uygulamanı seçersen burada açma düğmesi çıkar.</span>';
    D.pencereAc('albumDialog');
  }

  async function dinledim(id, puan, not) {
    const gun = L.isoTarih(L.kapanisGunu(new Date()));
    let a = null, geri = null;
    await degistir(v => {
      const i = v.albumler.findIndex(x => x.id === id);
      if (i < 0) throw new Error('Albüm bulunamadı; önce yenile.');
      a = v.albumler[i];
      geri = { sira: i, eski: JSON.parse(JSON.stringify(a)) };
      a.dinlendi = gun;
      if (puan) a.puan = puan;
      if (not) a.not = not;
      // Sıra dışı dinlenen albüm dinlenmemişlerin önüne alınır; hafta planı bozulmaz
      const ilkBekleyen = v.albumler.findIndex(x => !x.dinlendi);
      if (ilkBekleyen >= 0 && ilkBekleyen < i) { v.albumler.splice(i, 1); v.albumler.splice(ilkBekleyen, 0, a); }
    }, 'Müzik: ' + id + ' dinlendi');
    const k = { t: gun, tur: 'muzik', kaynak: 'uygulama', sanatci: a.sanatci || '', album: a.album };
    if (puan) k.puan = puan;
    await D.kayitEkle(k);
    return { a, geri, k };
  }

  async function geriAl(r) {
    await degistir(v => {
      const i = v.albumler.findIndex(x => x.id === r.a.id);
      if (i >= 0) v.albumler.splice(i, 1);
      v.albumler.splice(Math.min(r.geri.sira, v.albumler.length), 0, r.geri.eski);
    }, 'Müzik: ' + r.a.id + ' geri alındı');
    await D.kayitSil(r.k);
    return true;
  }

  // Kısayol: ?album -> bu haftanın (ya da sıradaki) albümün penceresi
  D.acilis('album', () => {
    const h = hedef(veri(), new Date());
    if (h.satir) pencereAc(h.satir.album.id); else location.hash = '#muzik';
  });

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
    if (t.dataset.albumDinledim) { pencereAc(t.dataset.albumDinledim); return; }
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    if (t.dataset.albumSil) {
      const id = t.dataset.albumSil;
      let geri = null;
      D.islemle(t, () => degistir(v => {
        const i = v.albumler.findIndex(x => x.id === id);
        if (i < 0) return;
        geri = { sira: i, a: v.albumler[i] };
        v.albumler.splice(i, 1);
      }, 'Müzik: ' + id + ' kuyruktan çıktı')).then(ok => {
        if (ok && geri) D.tost(geri.a.album + ' kuyruktan çıktı', false, { ad: 'Geri al', fn: () => D.islemle(null, () => degistir(v => { v.albumler.splice(Math.min(geri.sira, v.albumler.length), 0, geri.a); }, 'Müzik: ' + id + ' geri alındı'), 'Geri alındı') });
      });
    } else {
      const id = t.dataset.albumYukari || t.dataset.albumAsagi;
      const yon = t.dataset.albumYukari ? -1 : 1;
      D.islemle(t, () => degistir(v => {
        // Sadece dinlenmemişler arasında yer değiştirir
        const bekleyen = v.albumler.filter(x => !x.dinlendi);
        const i = bekleyen.findIndex(x => x.id === id);
        const j = i + yon;
        if (i < 0 || j < 0 || j >= bekleyen.length) return;
        const ia = v.albumler.indexOf(bekleyen[i]), ib = v.albumler.indexOf(bekleyen[j]);
        [v.albumler[ia], v.albumler[ib]] = [v.albumler[ib], v.albumler[ia]];
      }, 'Müzik: sıra'));
    }
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-album-uygulama]');
    if (!s) return;
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    D.islemle(s, () => degistir(v => { v.uygulama = s.value || null; }, 'Müzik: uygulama ' + (s.value || 'yok')), 'Kaydedildi');
  });
});
