/* İzleme: diziler (bölüm sayacı) ve film girişi.
   Diziler dizi/diziler.json'da; işaretlenen her bölüm koça "dizi" girdisi olarak da yazılır.
   Film girişi koça "film" girdisi (kaynak: uygulama) yazar. Aynı film Letterboxd'dan da gelirse
   film_guncelle.py ada ve tarihe (±2 gün) bakıp ikisini eşleştirir; koçta iki kez sayılmaz. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const YOL = 'dizi/diziler.json';
  const veri = () => D.jsonOku(YOL) || { diziler: [] };
  const diziler = () => veri().diziler || [];
  const gunIso = () => L.isoTarih(L.kapanisGunu(new Date()));
  const sbKisa = d => 'S' + d.sezon + ' B' + d.bolum;
  const sbUzun = d => 'Sezon ' + d.sezon + ' · Bölüm ' + d.bolum;
  const slug = s => String(s).toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'dizi';
  const sonYazi = d => (d.son ? 'Son bölüm ' + L.kisaTarih(L.tarihAyristir(d.son)) : 'Henüz bölüm işaretlenmedi');

  function degistir(fn, mesaj) {
    return D.degistirVeYaz(YOL, eski => {
      let v = { diziler: [] };
      if (eski) { try { v = JSON.parse(eski); } catch (e) { throw new Error(YOL + ' okunamadı.'); } }
      v.diziler = v.diziler || [];
      fn(v);
      v.guncelleme = L.isoTarih(new Date());
      return JSON.stringify(v, null, 2) + '\n';
    }, mesaj);
  }
  function bul(v, id) {
    const d = v.diziler.find(x => x.id === id);
    if (!d) throw new Error('Dizi bulunamadı; önce yenile.');
    return d;
  }

  // ---------- Bugün kutucukları ----------
  D.kutucuk(30, () => {
    const a = diziler().filter(d => d.durum === 'izliyorum');
    if (!a.length) return D.kutucukHtml({ href: '#dizi', ikon: 'dizi', etiket: 'Dizi', ana: 'Dizi ekle', alt: 'Bölümleri tek dokunuşla say' });
    return a.map(d => D.kutucukHtml({ attrs: 'data-dizi-arti="' + esc(d.id) + '"', ikon: 'dizi', etiket: 'Dizi · ' + sbKisa(d), ana: d.ad,
      alt: sonYazi(d), eylem: '+1 bölüm', sinif: 'dizi-kutucuk' })).join('');
  });
  D.kutucuk(40, () => D.kutucukHtml({ attrs: 'data-film-ac', ikon: 'film', etiket: 'Film', ana: 'Film izledim', alt: 'Ad ve istersen puan', eylem: 'Ekle' }));

  // ---------- Diziler sayfası ----------
  function gorunum() {
    const ds = diziler();
    const aktif = ds.filter(d => d.durum === 'izliyorum');
    const diger = ds.filter(d => d.durum !== 'izliyorum');
    const aktifSatir = d => '<li class="dizi-satir"><div class="dizi-ust"><span class="dizi-ad">' + esc(d.ad) + '</span><span class="dizi-sb sayi">' + esc(sbUzun(d)) + '</span></div>' +
      '<small>' + esc(sonYazi(d)) + '</small>' +
      '<div class="dizi-dugmeler"><button type="button" class="dugme" data-dizi-arti="' + esc(d.id) + '">+1 bölüm</button>' +
      '<button type="button" class="dugme ikincil" data-dizi-eksi="' + esc(d.id) + '"' + (d.bolum > 0 ? '' : ' disabled') + ' aria-label="Bir bölüm geri">−1</button>' +
      '<button type="button" class="dugme ikincil" data-dizi-sezon="' + esc(d.id) + '">Yeni sezon</button>' +
      '<button type="button" class="metin-dugme" data-dizi-durum="bitti" data-id="' + esc(d.id) + '">Bitti</button>' +
      '<button type="button" class="metin-dugme" data-dizi-durum="birakildi" data-id="' + esc(d.id) + '">Bıraktım</button></div></li>';
    const digerSatir = d => '<li class="dizi-satir"><div class="dizi-ust"><span class="dizi-ad">' + esc(d.ad) + '</span><span class="dizi-sb sayi">' + esc(sbUzun(d)) + '</span></div>' +
      '<small>' + (d.durum === 'bitti' ? 'Bitti' : 'Bırakıldı') + (d.son ? ' · ' + esc(sonYazi(d)) : '') + '</small>' +
      '<div class="dizi-dugmeler"><button type="button" class="dugme ikincil" data-dizi-durum="izliyorum" data-id="' + esc(d.id) + '">Yeniden izliyorum</button>' +
      '<button type="button" class="metin-dugme" data-dizi-sil="' + esc(d.id) + '">Listeden çıkar</button></div></li>';
    return '<article class="diziler">' +
      '<header class="bolum-bas"><h1>Diziler</h1></header>' +
      '<p class="not">İzlediğin her dizi Bugün\'de kendi kutucuğunu alır; bölümü bitirince dokun. Her bölüm koçta da sayılır.</p>' +
      '<section><h2>İzliyorum</h2>' + (aktif.length ? '<ul class="liste">' + aktif.map(aktifSatir).join('') + '</ul>' : '<p class="not">Şu an izlediğin dizi yok; aşağıdan ekle.</p>') + '</section>' +
      '<form class="kart" id="diziEkle"><h2>Dizi ekle</h2><label class="alan">Dizi adı<input name="ad" type="text" required autocomplete="off"></label>' +
      '<div class="iki-alan"><label class="alan">Sezon<input name="sezon" type="number" inputmode="numeric" min="1" value="1"></label>' +
      '<label class="alan">İzlediğin son bölüm<input name="bolum" type="number" inputmode="numeric" min="0" value="0"></label></div>' +
      '<div class="dialog-alt"><button type="submit" class="dugme">Ekle</button></div></form>' +
      (diger.length ? '<section><h2>Biten ve bırakılan</h2><ul class="liste soluk">' + diger.map(digerSatir).join('') + '</ul></section>' : '') +
      '</article>';
  }
  D.gorunum('dizi', gorunum, 'daha');
  D.panel({ ad: 'Diziler', href: '#dizi', ikon: 'dizi', aciklama: 'İzlediğin diziler, bölüm sayacı', sira: 20 });

  // ---------- dizi yazma ----------
  async function arti(id) {
    const gun = gunIso();
    let d = null, onceki = null;
    await degistir(v => {
      d = bul(v, id);
      onceki = { sezon: d.sezon, bolum: d.bolum, son: d.son || null };
      d.bolum = (Number(d.bolum) || 0) + 1;
      d.son = gun;
    }, 'Dizi: ' + id + ' +1');
    const k = { t: gun, tur: 'dizi', kaynak: 'uygulama', dizi: d.ad, sezon: d.sezon, bolum: d.bolum };
    await D.kayitEkle(k);
    return { d, onceki, k };
  }
  async function artiGeriAl(r) {
    await degistir(v => { Object.assign(bul(v, r.d.id), r.onceki); }, 'Dizi: ' + r.d.id + ' geri alındı');
    await D.kayitSil(r.k);
    return true;
  }
  // −1: sayaç bir azalır; o bölümün koç girdisi (bu ay ya da geçen ay) silinir
  async function eksi(id) {
    let d = null, onceki = null;
    await degistir(v => {
      d = bul(v, id);
      if (!(d.bolum > 0)) throw new Error('Bölüm zaten 0.');
      onceki = { sezon: d.sezon, bolum: d.bolum };
      d.bolum -= 1;
    }, 'Dizi: ' + id + ' -1');
    const kosul = k => k.tur === 'dizi' && k.dizi === d.ad && k.sezon === onceki.sezon && k.bolum === onceki.bolum;
    const bu = new Date();
    const gecen = new Date(bu.getFullYear(), bu.getMonth() - 1, 1);
    if (!(await D.kayitSil(kosul, L.isoTarih(bu).slice(0, 7), 'Koç: dizi bölümü geri alındı'))) {
      await D.kayitSil(kosul, L.isoTarih(gecen).slice(0, 7), 'Koç: dizi bölümü geri alındı');
    }
    return true;
  }

  // ---------- film ----------
  let filmler = null;   // Letterboxd verisinden: { n, y, u, s, d }
  async function filmVerisi() {
    if (filmler) return filmler;
    let v = null;
    try {
      const c = await caches.open('duzen-film-1');   // film defterinin cihazdaki kopyası
      const r = await c.match('film-veri');
      if (r) v = await r.json();
    } catch (e) { /* önbellek yok */ }
    if (!v && D.durum.anahtar && navigator.onLine) {
      try {
        const liste = await D.gh('/repos/' + D.SAHIP + '/' + D.DEPO + '/contents/film?ref=' + D.DAL);
        const dosya = liste.find(x => x.name === 'veri.json');
        if (dosya) {
          const r = await fetch('https://api.github.com/repos/' + D.SAHIP + '/' + D.DEPO + '/git/blobs/' + dosya.sha, {
            cache: 'no-store', headers: { Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer ' + D.durum.anahtar } });
          if (r.ok) {
            const metin = await r.text();
            v = JSON.parse(metin);
            try {
              const c = await caches.open('duzen-film-1');
              await c.put('film-veri', new Response(metin, { headers: { 'content-type': 'application/json', 'x-sha': dosya.sha } }));
            } catch (e) { /* yer yoksa kopyasız devam */ }
          }
        }
      } catch (e) { /* öneri olmadan devam */ }
    }
    filmler = v && Array.isArray(v.films) ? v.films.filter(f => f && f.n).map(f => ({ n: f.n, y: f.y, u: f.c ? 'https://boxd.it/' + f.c : f.u, s: f.s, d: f.d })) : [];
    return filmler;
  }

  const puanYazi = p => { const x = Number(p); return '★'.repeat(Math.floor(x)) + (x % 1 ? '½' : ''); };
  const lbArama = ad => (ad ? 'https://letterboxd.com/search/films/' + encodeURIComponent(ad) + '/' : 'https://letterboxd.com/');

  // Yazılan ad Letterboxd'daki bir filmle aynıysa yıl ve Letterboxd bağlantısı ondan gelir
  function eslesmeGuncelle(f) {
    const ad = f.elements.baslik.value.trim();
    const kucuk = ad.toLocaleLowerCase('tr');
    const es = (filmler || []).filter(x => String(x.n).toLocaleLowerCase('tr') === kucuk);
    const sec = es.find(x => x.s === 'l') || es.slice().sort((a, b) => String(b.d || '').localeCompare(String(a.d || '')))[0] || null;
    const yil = f.elements.yil;
    if (sec && sec.y && (!yil.value || yil.dataset.oto)) { yil.value = sec.y; yil.dataset.oto = '1'; }
    else if (!sec && yil.dataset.oto) { yil.value = ''; delete yil.dataset.oto; }
    document.getElementById('filmLb').href = sec && sec.u ? sec.u : lbArama(ad);
  }

  function filmPenceresi() {
    let d = document.getElementById('filmDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'filmDialog';
    d.setAttribute('aria-labelledby', 'film-baslik');
    const puanlar = ['', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
    d.innerHTML = '<form id="filmForm" method="dialog"><h2 id="film-baslik">Film izledim</h2>' +
      '<label class="alan">Film<input name="baslik" type="text" list="filmAdlari" autocomplete="off" required placeholder="Letterboxd\'daki adıyla"></label>' +
      '<datalist id="filmAdlari"></datalist>' +
      '<div class="iki-alan"><label class="alan">Yıl (isteğe bağlı)<input name="yil" type="number" inputmode="numeric" min="1888" max="2100"></label>' +
      '<label class="alan">Puan (isteğe bağlı)<select name="puan">' + puanlar.map(p => '<option value="' + p + '">' + (p ? puanYazi(p) : '—') + '</option>').join('') + '</select></label></div>' +
      '<div class="iki-alan"><label class="alan">Tarih<input name="t" type="date"></label>' +
      '<label class="secim tekrar-secim"><input type="checkbox" name="tekrar"> Tekrar izleme</label></div>' +
      '<p class="not">Letterboxd\'a da girersen ertesi sabah aynı film olarak eşleşir; koçta iki kez sayılmaz.</p>' +
      '<p class="dialog-hata" role="alert" hidden></p>' +
      '<div class="dialog-alt"><a class="metin-dugme" id="filmLb" href="https://letterboxd.com/" target="_blank" rel="noopener">Letterboxd\'da aç</a>' +
      '<button type="button" class="metin-dugme" data-kapat="filmDialog">Vazgeç</button><button type="submit" class="dugme">Kaydet</button></div></form>';
    document.body.appendChild(d);
    const f = d.querySelector('form');
    f.elements.baslik.addEventListener('input', () => eslesmeGuncelle(f));
    f.elements.yil.addEventListener('input', () => { delete f.elements.yil.dataset.oto; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      let k = null;
      D.islemle(e.submitter || f.querySelector('[type=submit]'), async () => { k = await filmKaydet(f); return !!k; }).then(ok => {
        if (!ok || !k) return;
        d.close();
        D.tost(k.baslik + ' kaydedildi', false, { ad: 'Geri al', fn: () => D.islemle(null, async () => { await D.kayitSil(k); return true; }, 'Geri alındı') });
      });
    });
    return d;
  }

  function filmAc() {
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    const d = filmPenceresi();
    const f = d.querySelector('form');
    f.reset();
    delete f.elements.yil.dataset.oto;
    f.elements.t.value = gunIso();
    document.getElementById('filmLb').href = 'https://letterboxd.com/';
    D.pencereAc('filmDialog');
    filmVerisi().then(fl => {
      const dl = document.getElementById('filmAdlari');
      if (!dl || dl.dataset.dolu || !fl.length) return;
      // İzleme listesindekiler önce, sonra en son izlenenler
      const sirali = fl.slice().sort((a, b) => (b.s === 'l') - (a.s === 'l') || String(b.d || '').localeCompare(String(a.d || '')));
      dl.innerHTML = sirali.map(x => '<option value="' + esc(x.n) + '"' + (x.y ? ' label="' + esc(String(x.y)) + '"' : '') + '></option>').join('');
      dl.dataset.dolu = '1';
    });
  }

  async function filmKaydet(f) {
    const v = new FormData(f);
    const baslik = String(v.get('baslik') || '').trim();
    if (!baslik) { D.hataGoster('Filmin adını yaz.'); return false; }
    const k = { t: String(v.get('t') || '') || gunIso(), tur: 'film', kaynak: 'uygulama', baslik };
    if (v.get('yil')) k.yil = Number(v.get('yil'));
    if (v.get('puan')) k.puan = Number(v.get('puan'));
    if (v.get('tekrar')) k.tekrar = true;
    await D.kayitEkle(k);
    return k;
  }

  D.acilis('film', filmAc);

  // ---------- olaylar ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-dizi-arti], [data-dizi-eksi], [data-dizi-sezon], [data-dizi-durum], [data-dizi-sil], [data-film-ac]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-film-ac')) { filmAc(); return; }
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    if (t.dataset.diziArti) {
      let r = null;
      D.islemle(t, async () => { r = await arti(t.dataset.diziArti); return true; }).then(ok => {
        if (ok && r) D.tost(r.d.ad + ': ' + sbKisa(r.d), false, { ad: 'Geri al', fn: () => D.islemle(null, () => artiGeriAl(r), 'Geri alındı') });
      });
    } else if (t.dataset.diziEksi) {
      D.islemle(t, () => eksi(t.dataset.diziEksi), 'Bir bölüm geri alındı');
    } else if (t.dataset.diziSezon) {
      D.islemle(t, () => degistir(v => { const d = bul(v, t.dataset.diziSezon); d.sezon = (Number(d.sezon) || 1) + 1; d.bolum = 0; },
        'Dizi: ' + t.dataset.diziSezon + ' yeni sezon'), 'Yeni sezon');
    } else if (t.dataset.diziDurum) {
      const yeni = t.dataset.diziDurum;
      D.islemle(t, () => degistir(v => { bul(v, t.dataset.id).durum = yeni; }, 'Dizi: ' + t.dataset.id + ' ' + yeni),
        { izliyorum: 'İzleniyor', bitti: 'Bitti olarak işaretlendi', birakildi: 'Bırakıldı' }[yeni]);
    } else if (t.dataset.diziSil) {
      const id = t.dataset.diziSil;
      let geri = null;
      D.islemle(t, () => degistir(v => {
        const i = v.diziler.findIndex(x => x.id === id);
        if (i < 0) return;
        geri = { sira: i, d: v.diziler[i] };
        v.diziler.splice(i, 1);
      }, 'Dizi: ' + id + ' listeden çıktı')).then(ok => {
        if (ok && geri) D.tost(geri.d.ad + ' listeden çıktı', false, { ad: 'Geri al', fn: () => D.islemle(null,
          () => degistir(v => { v.diziler.splice(Math.min(geri.sira, v.diziler.length), 0, geri.d); }, 'Dizi: ' + id + ' geri alındı'), 'Geri alındı') });
      });
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'diziEkle') return;
    e.preventDefault();
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    const f = new FormData(e.target);
    const ad = String(f.get('ad') || '').trim();
    if (!ad) return;
    const sezon = Math.max(1, Number(f.get('sezon')) || 1), bolum = Math.max(0, Number(f.get('bolum')) || 0);
    const bugun = L.isoTarih(new Date());
    D.islemle(e.target.querySelector('[type=submit]'), () => degistir(v => {
      if (v.diziler.some(x => x.durum === 'izliyorum' && x.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))) throw new Error(ad + ' zaten listede.');
      let id = bugun + '-' + slug(ad);
      if (v.diziler.some(x => x.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
      v.diziler.push({ id, ad, sezon, bolum, durum: 'izliyorum', eklendi: bugun, son: null });
    }, 'Dizi: ' + ad + ' eklendi'), ad + ' eklendi');
  });
});
