/* Düzen uygulaması: veri mskldf/duzen-veri deposundan, GitHub API ile. */
(function () {
  'use strict';
  const L = window.DuzenLib;
  const SAHIP = 'mskldf', DEPO = 'duzen-veri', DAL = 'main';
  const API = 'https://api.github.com';
  const KONUM = { lat: 41.06, lon: 28.99 };
  const ILGILI = /^(defter|koc|is|muzik|saat|gelen)\//;
  const IKILI = /\.(jpe?g|png|webp|gif|zip)$/i;  // fotoğraflar ve arşivler eşitlenmez, gerektiğinde ayrıca alınır

  // ---------- yerel saklama ----------
  const sakla = {
    al(k, v) { try { const x = localStorage.getItem('duzen.' + k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } },
    koy(k, v) { try { localStorage.setItem('duzen.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    sil(k) { try { localStorage.removeItem('duzen.' + k); } catch (e) { /* yok */ } },
  };

  const durum = {
    anahtar: sakla.al('anahtar', ''),
    dosyalar: sakla.al('dosyalar', {}),
    sonEsitleme: sakla.al('sonEsitleme', null),
    hava: sakla.al('hava', null),
    esitleniyor: false,
    hata: null,
  };

  // ---------- yardımcılar ----------
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function md(metin) {
    const html = window.marked ? window.marked.parse(metin || '') : '<pre>' + esc(metin) + '</pre>';
    const t = document.createElement('template');
    t.innerHTML = html;
    t.content.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    t.content.querySelectorAll('table').forEach(tb => {
      const sar = document.createElement('div'); sar.className = 'tablo-sar';
      tb.parentNode.insertBefore(sar, tb); sar.appendChild(tb);
    });
    const kap = document.createElement('div'); kap.appendChild(t.content);
    return kap.innerHTML;
  }
  function b64Coz(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u8);
  }
  function b64Yap(metin) {
    const u8 = new TextEncoder().encode(metin);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const yolKodla = y => y.split('/').map(encodeURIComponent).join('/');

  let tostZaman = null;
  function tost(metin, hata) {
    const t = $('#tost');
    t.textContent = metin;
    t.className = 'tost' + (hata ? ' tost-hata' : '');
    t.hidden = false;
    clearTimeout(tostZaman);
    tostZaman = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- GitHub ----------
  async function gh(yol, ayar) {
    ayar = ayar || {};
    const r = await fetch(API + yol, {
      method: ayar.method || 'GET',
      body: ayar.body,
      cache: 'no-store',
      headers: Object.assign({ 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + durum.anahtar }, ayar.headers || {}),
    });
    if (!r.ok) {
      const e = new Error('GitHub ' + r.status);
      e.status = r.status;
      try { e.detay = (await r.json()).message; } catch (x) { /* gövde yok */ }
      throw e;
    }
    return r.status === 204 ? null : r.json();
  }

  function hataMetni(e) {
    const detay = e.detay ? ' (GitHub: ' + e.detay + ')' : '';
    if (e.status === 401) return 'Anahtar geçersiz ya da süresi dolmuş. Yeni anahtar oluşturup gir.' + detay;
    if (e.status === 404) return 'Anahtar duzen-veri deposunu göremiyor. Anahtarı oluştururken Repository access kısmında Only select repositories deyip duzen-veri\'yi seç.' + detay;
    if (e.status === 403 && /rate limit/i.test(e.detay || '')) return 'GitHub istek sınırı doldu, birkaç dakika sonra tekrar dene.' + detay;
    if (e.status === 403) return 'Anahtarın depoya yazma izni yok. Permissions altında Repositories sekmesinde Contents iznini Read and write yap.' + detay;
    if (!navigator.onLine) return 'İnternet yok. Son kopya gösteriliyor.';
    return 'GitHub\'a ulaşılamadı' + (e.status ? ' (' + e.status + ')' : '') + detay + '. Son kopya gösteriliyor.';
  }

  // Açık bir pencere varsa hatayı onun içinde göster (bildirim pencerenin arkasında kalıyor)
  function hataGoster(metin) {
    const d = document.querySelector('dialog[open]');
    const yer = d && d.querySelector('.dialog-hata');
    if (yer) { yer.textContent = metin; yer.hidden = false; }
    else tost(metin, true);
  }
  function pencereAc(id) {
    const d = $('#' + id);
    d.querySelectorAll('.dialog-hata').forEach(x => { x.hidden = true; x.textContent = ''; });
    d.showModal();
  }

  async function esitle(sessiz) {
    if (!durum.anahtar || durum.esitleniyor) return;
    durum.esitleniyor = true; ciz();
    try {
      const agac = await gh(`/repos/${SAHIP}/${DEPO}/git/trees/${DAL}?recursive=1`);
      const yeni = {};
      for (const o of agac.tree) if (o.type === 'blob' && ILGILI.test(o.path) && !IKILI.test(o.path)) yeni[o.path] = o.sha;
      const degisen = Object.keys(yeni).filter(y => !durum.dosyalar[y] || durum.dosyalar[y].sha !== yeni[y]);
      for (let i = 0; i < degisen.length; i += 6) {
        await Promise.all(degisen.slice(i, i + 6).map(async y => {
          const blob = await gh(`/repos/${SAHIP}/${DEPO}/git/blobs/${yeni[y]}`);
          durum.dosyalar[y] = { sha: yeni[y], metin: b64Coz(blob.content) };
        }));
      }
      for (const y of Object.keys(durum.dosyalar)) if (!(y in yeni)) delete durum.dosyalar[y];
      durum.sonEsitleme = new Date().toISOString();
      durum.hata = null;
      if (!sakla.koy('dosyalar', durum.dosyalar)) durum.hata = 'Cihazda yer kalmadı; son kopya saklanamadı.';
      sakla.koy('sonEsitleme', durum.sonEsitleme);
      if (!sessiz && degisen.length) tost('Güncellendi');
    } catch (e) {
      durum.hata = hataMetni(e);
    } finally {
      durum.esitleniyor = false; ciz();
    }
  }

  async function tazeDosya(yol) {
    try {
      const r = await gh(`/repos/${SAHIP}/${DEPO}/contents/${yolKodla(yol)}?ref=${DAL}`);
      return { sha: r.sha, metin: b64Coz(r.content) };
    } catch (e) {
      if (e.status === 404) return { sha: null, metin: '' };
      throw e;
    }
  }

  async function dosyaYaz(yol, metin, sha, mesaj) {
    const govde = { message: mesaj, content: b64Yap(metin), branch: DAL };
    if (sha) govde.sha = sha;
    const r = await gh(`/repos/${SAHIP}/${DEPO}/contents/${yolKodla(yol)}`, {
      method: 'PUT', body: JSON.stringify(govde), headers: { 'Content-Type': 'application/json' },
    });
    durum.dosyalar[yol] = { sha: r.content.sha, metin };
    sakla.koy('dosyalar', durum.dosyalar);
  }

  // Oku, değiştir, yaz; araya başka yazma girerse bir kez daha dene
  async function degistirVeYaz(yol, degistir, mesaj) {
    for (let deneme = 0; deneme < 2; deneme++) {
      const { sha, metin } = await tazeDosya(yol);
      try { await dosyaYaz(yol, degistir(metin), sha, mesaj); return; }
      catch (e) { if (deneme === 1 || (e.status !== 409 && e.status !== 422)) throw e; }
    }
  }

  // Girdileri ay dosyalarına ekler; aynı aydakiler tek seferde yazılır
  async function kayitlarEkle(liste, mesaj) {
    const gruplar = {};
    for (const k of liste) (gruplar[k.t.slice(0, 7)] = gruplar[k.t.slice(0, 7)] || []).push(k);
    for (const ay of Object.keys(gruplar).sort()) {
      const satirlar = gruplar[ay].map(k => JSON.stringify(k)).join('\n') + '\n';
      await degistirVeYaz('koc/kayit/' + ay + '.jsonl', eski => (eski && !eski.endsWith('\n') ? eski + '\n' : eski) + satirlar,
        mesaj || ('Koç girdisi: ' + gruplar[ay].map(k => k.tur).join(', ') + ' ' + gruplar[ay][0].t));
    }
  }
  const kayitEkle = kayit => kayitlarEkle([kayit]);

  async function gorevDegistir(fn, mesaj) {
    await degistirVeYaz('is/gorevler.json', eski => {
      let veri = { gorevler: [] };
      try { if (eski) veri = JSON.parse(eski); } catch (e) { throw new Error('is/gorevler.json okunamadı.'); }
      veri.gorevler = veri.gorevler || [];
      fn(veri.gorevler);
      veri.guncelleme = L.isoTarih(new Date());
      return JSON.stringify(veri, null, 2) + '\n';
    }, mesaj);
  }

  // ---------- veri okuma ----------
  const metin = y => (durum.dosyalar[y] ? durum.dosyalar[y].metin : null);
  function projeler() {
    return Object.keys(durum.dosyalar).filter(y => /^defter\/projeler\/[^/]+\.md$/.test(y))
      .map(y => L.projeOku(y, metin(y)))
      .sort((a, b) => (a.meta.sira ?? 999) - (b.meta.sira ?? 999));
  }
  function jsonOku(y) { try { return JSON.parse(metin(y)); } catch (e) { return null; } }
  const iskelet = () => jsonOku('defter/iskelet.json');
  const gorevler = () => ((jsonOku('is/gorevler.json') || {}).gorevler || []);
  function kayitlar() {
    return Object.keys(durum.dosyalar).filter(y => /^koc\/kayit\/[^/]+\.jsonl$/.test(y)).sort()
      .flatMap(y => L.jsonlOku(metin(y)));
  }
  function havuz() { const t = metin('defter/havuz-2027.md'); return t ? L.onYaziAyristir(t) : null; }
  const veriVar = () => Object.keys(durum.dosyalar).length > 0;

  // ---------- hava ----------
  async function havaGetir() {
    if (durum.hava && durum.hava.alindi && Date.now() - durum.hava.alindi < 30 * 60 * 1000) return;
    try {
      const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + KONUM.lat + '&longitude=' + KONUM.lon +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&current=temperature_2m,weather_code&timezone=Europe%2FIstanbul&forecast_days=3';
      const r = await fetch(u);
      if (!r.ok) return;
      const v = await r.json();
      v.alindi = Date.now();
      durum.hava = v; sakla.koy('hava', v); ciz();
    } catch (e) { /* hava olmadan devam */ }
  }

  function havaSatiri(hedef, yarin) {
    const h = durum.hava;
    if (!h || !h.daily) return '';
    const i = (h.daily.time || []).indexOf(L.isoTarih(hedef));
    if (i < 0) return '';
    const d = h.daily;
    const parca = [];
    if (!yarin && h.current) parca.push('<span class="hava-simdi">' + Math.round(h.current.temperature_2m) + '°</span>');
    parca.push('<span>' + esc(L.HAVA[d.weather_code[i]] || '') + '</span>');
    parca.push('<span class="sayi">' + Math.round(d.temperature_2m_min[i]) + '° / ' + Math.round(d.temperature_2m_max[i]) + '°</span>');
    if (d.precipitation_probability_max && d.precipitation_probability_max[i] != null) {
      parca.push('<span>yağış %' + d.precipitation_probability_max[i] + '</span>');
    }
    return '<div class="hava">' + parca.join('') + '</div>';
  }

  // ---------- görünümler ----------
  const GIRDI_ADI = { uyku: 'Uyku', sabah_blogu: 'Sabah bloğu', okuma: 'Okuma', bisiklet: 'Bisiklet', atolye: 'Atölye', konusma: 'Konuşma', is: 'İş notu', not: 'Not', film: 'Film', muzik: 'Albüm' };
  const eksikEtiketi = (e, gunIso) => (e.tur === 'okuma' && e.t !== gunIso ? 'Dünkü okuma' : GIRDI_ADI[e.tur]);
  // Defterdeki projelerin Düzen içindeki panelleri
  const PANELLER = [
    { ad: 'Film defteri', ac: 'Film defterini aç', href: 'film.html', proje: 'letterboxd-paneli' },
  ];
  const ekGorunumler = {};       // modüllerin görünümleri: ad -> { fn, sekme }
  const kartUreticiler = {};     // modüllerin Bugün kartları: yer -> [fn]
  const cizimSonrasi = [];       // her çizimden sonra çalışan modül işleri
  function ekKartlar(yer, simdi) {
    return (kartUreticiler[yer] || []).map(fn => { try { return fn(simdi) || ''; } catch (e) { console.error(e); return ''; } }).join('');
  }

  function bosDurum(baslik, aciklama) {
    return '<div class="bos"><p class="bos-baslik">' + esc(baslik) + '</p><p>' + aciklama + '</p></div>';
  }

  function ilkKurulum() {
    return bosDurum('Veri henüz gelmedi',
      durum.anahtar ? 'Eşitleniyor; birkaç saniye sürebilir.' : 'Bu cihazda anahtar yok. <button class="metin-dugme" data-ac="ayar">Ayarlar\'ı aç</button> ve GitHub anahtarını gir.');
  }

  function askerlikKarti(hm, simdi) {
    const a = hm.askerlik;
    if (!Array.isArray(a) || a.length !== 2) return '';
    const bugun = L.sadeceGun(simdi);
    const iso = L.isoTarih(bugun);
    if (iso < a[0]) {
      const n = L.kalanGun(a[0], bugun);
      if (n > 30) return '';
      const pler = projeler().filter(p => p.meta.son_gun && p.meta.son_gun < a[0] && !['bitti', 'dustu'].includes(p.meta.durum));
      const isler = gorevler().filter(g => g.durum !== 'bitti' && [g.son_tarih, g.deadline].some(t => t && t < a[0]));
      const satirlar = pler.map(p => '<li><a class="satir-bag" href="#defter/' + esc(p.slug) + '"><span class="satir-baslik">' + esc(p.meta.baslik) + '</span>' +
        '<small>Son gün ' + esc(L.kisaTarih(L.tarihAyristir(p.meta.son_gun))) + ' (' + esc(L.kalanYazi(L.kalanGun(p.meta.son_gun, bugun))) + ')</small></a></li>')
        .concat(L.gorevSirala(isler).map(gorevSatiri));
      return '<section class="kart"><h2>' + (n === 1 ? 'Askerlik yarın' : 'Askerliğe ' + n + ' gün') + '</h2>' +
        (satirlar.length ? '<p class="not">Ondan önce bitmesi gerekenler:</p><ul class="liste">' + satirlar.join('') + '</ul>'
          : '<p class="not">Son tarihi askerlikten önce olan iş yok.</p>') + '</section>';
    }
    if (iso <= a[1]) {
      return '<section class="kart"><h2>Askerlik</h2><p class="not">Dönüşe ' + L.kalanGun(a[1], bugun) +
        ' gün. Bu sürede eksik girdi uyarısı yok; 2027 hızı da bu günleri saymıyor.</p></section>';
    }
    return '';
  }

  function bugunGorunumu() {
    if (!veriVar()) return ilkKurulum();
    const simdi = new Date();
    const { yarin, hedef } = L.gunModu(simdi);
    const hm = (havuz() || {}).meta || {};
    const plan = L.gunPlani(iskelet(), hedef);
    const satirlar = [];
    if (plan.uyku) satirlar.push({ saat: plan.uyku.kalkis, baslik: 'Kalkış', alt: '' });
    for (const b of plan.bloklar) satirlar.push({ saat: b.saat, baslik: b.is, alt: b.kulvar });
    if (plan.uyku) satirlar.push({ saat: plan.uyku.isik, baslik: 'Işık kapanır', alt: 'Son yarım saat telefon yok' });
    satirlar.sort((a, b) => L.saatAnahtari(a.saat) - L.saatAnahtari(b.saat));
    const dk = simdi.getHours() * 60 + simdi.getMinutes();
    const planHtml = satirlar.map(s => {
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(s.saat || '');
      const simdiMi = !yarin && m && dk >= Number(m[1]) * 60 + Number(m[2]) && dk < Number(m[3]) * 60 + Number(m[4]);
      return '<li class="plan-satir' + (simdiMi ? ' simdi' : '') + '"><span class="plan-saat sayi">' + esc(s.saat) + '</span>' +
        '<span class="plan-is">' + esc(s.baslik) + (s.alt ? '<small>' + esc(s.alt) + '</small>' : '') + '</span></li>';
    }).join('');
    const serbest = plan.serbest ? '<p class="not">Haftada bir serbest akşam: ' + esc(plan.serbest.is) + ' (ofis günü ' + esc(plan.serbest.baslangic_ofis) + ', ev günü ' + esc(plan.serbest.baslangic_ev) + ' sonrası).</p>' : '';
    // Bu akşam okumaya kalan süre: sığan bir film için seçiciye
    const okuma = L.okumaBloku(L.gunPlani(iskelet(), L.sadeceGun(simdi)));
    const okumayaKalan = okuma ? L.saatAnahtari(okuma.saat) - dk : null;
    const buAksam = simdi.getHours() >= 17 && okumayaKalan >= 60 && !L.haricMi(L.isoTarih(simdi), hm.haric)
      ? '<p class="not">Bu akşam okumaya ' + okumayaKalan + ' dk var. <a href="film.html#secici&amp;okuma">Sığan bir film seç</a></p>' : '';

    // iş: açık ve devam eden görevler, en yakın tarihli önce
    const acik = L.gorevSirala(gorevler().filter(g => g.durum === 'acik' || g.durum === 'devam'));
    const isHtml = acik.length ? '<ul class="liste">' + acik.slice(0, 5).map(gorevSatiri).join('') + '</ul>' +
      (acik.length > 5 ? '<p class="not"><a href="#is">' + (acik.length - 5) + ' görev daha</a></p>' : '')
      : '<p class="not">Açık iş görevi yok.</p>';
    const cuma = !yarin && simdi.getDay() === 5 && !haftalikDokum(gorevler(), L.haftaBasi(simdi)).bos
      ? '<p class="not"><a href="#is/hafta/' + L.isoTarih(L.haftaBasi(simdi)) + '">Bu haftanın iş dökümü hazır</a></p>' : '';

    // sıradaki işler: devam eden projeler
    const aktif = projeler().filter(p => p.meta.durum === 'devam').slice(0, 4);
    const projeHtml = aktif.map(p => '<li><a class="satir-bag" href="#defter/' + esc(p.slug) + '"><span class="satir-baslik">' + esc(p.meta.baslik) + '</span>' +
      (p.sirada ? '<small>' + esc(p.sirada) + '</small>' : '') + '</a></li>').join('');

    // eksik girdiler: kapanış günü için (gece 04:00'e kadar önceki gün)
    const kapanis = L.kapanisGunu(simdi);
    const kapIso = L.isoTarih(kapanis);
    const eksik = L.eksikGirdiler(kayitlar(), kapanis, hm.haric);
    const eksikHtml = eksik.length ? '<div class="cipler">' + eksik.map(e => '<button class="cip" data-ekle="' + e.tur + '" data-tarih="' + e.t + '">+ ' + esc(eksikEtiketi(e, kapIso)) + '</button>').join('') +
      '<button class="cip cip-vurgu" data-ac="kapat">Günü kapat</button></div>'
      : '<p class="not">' + (L.haricMi(kapIso, hm.haric) ? 'Bugün takip dışı.' : 'Girdiler tamam.') + '</p>';
    const aksam = simdi.getHours() >= 18 || simdi.getHours() < 4;
    const kapatKarti = aksam && eksik.length ? '<section class="kart kart-vurgu"><div class="kart-ust"><h2>Günü kapat</h2><button class="dugme" data-ac="kapat">Günü kapat</button></div>' +
      '<p class="not">Eksik: ' + eksik.map(e => esc(eksikEtiketi(e, kapIso))).join(', ') + '</p></section>' : '';

    return '<article class="gun">' +
      '<header class="gun-bas"><h1>' + (yarin ? 'Yarın' : 'Bugün') + '</h1><p class="gun-tarih">' + esc(L.tarihYazi(hedef)) + '</p>' + havaSatiri(hedef, yarin) + '</header>' +
      kapatKarti + ekKartlar('bugun-ust', simdi) + askerlikKarti(hm, simdi) +
      '<section><h2>Plan</h2>' + (planHtml ? '<ol class="plan">' + planHtml + '</ol>' : '<p class="not">Bu gün için iskelette blok yok.</p>') + serbest + buAksam + '</section>' +
      ekKartlar('bugun-plan-alti', simdi) +
      '<section><h2>İş</h2>' + isHtml + cuma + '</section>' +
      '<section><h2>Sıradaki işler</h2>' + (projeHtml ? '<ul class="liste">' + projeHtml + '</ul>' : '<p class="not">Devam eden proje yok.</p>') + '</section>' +
      (kapatKarti ? '' : '<section><h2>' + (yarin ? 'Bugünden eksik kalan girdiler' : 'Eksik girdiler') + '</h2>' + eksikHtml + '</section>') +
      '</article>';
  }

  function gorevSatiri(g) {
    const bugun = L.sadeceGun(new Date());
    const tarih = (etiket, iso) => {
      if (!iso) return '';
      const n = L.kalanGun(iso, bugun);
      const sinif = g.durum === 'bitti' ? '' : (n < 0 ? ' gecikti' : (n <= 2 ? ' yaklasti' : ''));
      return '<span class="tarih' + sinif + '">' + etiket + ' ' + esc(L.kisaTarih(L.tarihAyristir(iso))) + (g.durum === 'bitti' ? '' : ' (' + L.kalanYazi(n) + ')') + '</span>';
    };
    const kim = [g.proje, g.veren].filter(Boolean).map(esc).join(', ');
    return '<li class="gorev"><div class="gorev-ust"><span class="satir-baslik">' + esc(g.baslik) + '</span>' +
      (g.durum === 'beklemede' ? '<span class="rozet">beklemede</span>' : '') + '</div>' +
      (kim ? '<small>' + kim + '</small>' : '') +
      '<div class="tarihler">' + tarih('Son tarih', g.son_tarih) + tarih('Deadline', g.deadline) + '</div></li>';
  }

  function durumIsareti(d) {
    return '<span class="durum durum-' + esc(d) + '"><i></i>' + esc(L.DURUM_ADI[d] || d) + '</span>';
  }

  function defterListesi(pler, secili) {
    const gruplar = [];
    const bul = ad => { let g = gruplar.find(x => x.ad === ad); if (!g) { g = { ad, p: [] }; gruplar.push(g); } return g; };
    for (const p of pler) bul(p.meta.durum === 'bitti' ? 'Bitenler' : (p.meta.donem || 'Dönemsiz')).p.push(p);
    gruplar.sort((a, b) => (a.ad === 'Bitenler') - (b.ad === 'Bitenler'));
    const ust = '<div class="defter-ust"><a class="sekme-bag' + (secili === 'plan' ? ' secili' : '') + '" href="#defter/plan">Düzen planı</a>' +
      '<a class="sekme-bag' + (secili === 'havuz' ? ' secili' : '') + '" href="#defter/havuz">Havuz 2027</a></div>' +
      '<div class="defter-ust paneller" aria-label="Paneller">' + PANELLER.map(p => '<a class="sekme-bag panel-bag" href="' + esc(p.href) + '">' + esc(p.ad) + '</a>').join('') + '</div>';
    return ust + gruplar.map(g => '<section class="grup"><h2>' + esc(g.ad) + '</h2><ul class="liste">' + g.p.map(p =>
      '<li><a class="satir-bag' + (p.slug === secili ? ' secili' : '') + '" href="#defter/' + esc(p.slug) + '">' +
      '<span class="satir-ust"><span class="satir-baslik">' + esc(p.meta.baslik || p.slug) + '</span>' + durumIsareti(p.meta.durum) + '</span>' +
      (p.sirada && p.meta.durum !== 'bitti' ? '<small>' + esc(p.sirada) + '</small>' : '') + '</a></li>').join('') + '</ul></section>').join('');
  }

  function antet(m) {
    const hucre = (etiket, deger, sinif) => '<div class="hucre' + (sinif ? ' ' + sinif : '') + '"><span class="hucre-etiket">' + etiket + '</span><span class="hucre-deger">' + deger + '</span></div>';
    const rev = m.guncelleme ? esc(L.kisaTarih(L.tarihAyristir(m.guncelleme)) + ' ' + String(m.guncelleme).slice(0, 4)) : '';
    return '<div class="antet">' +
      hucre('Proje', esc(m.baslik || ''), 'genis') +
      hucre('Durum', durumIsareti(m.durum)) +
      hucre('Dönem', esc(m.donem || '')) +
      hucre('Büyüklük', esc(m.buyukluk || '')) +
      hucre('Yapan', esc(m.yapan === 'kendin' ? 'Kendin' : 'Birlikte')) +
      hucre('Kulvar', esc(m.kulvar || ''), 'genis-yarim') +
      hucre('Rev.', rev, 'genis-yarim') +
      '</div>';
  }

  function projeSayfasi(p) {
    const m = p.meta;
    const bag = (m.bagimlilik || []).length ? '<p class="ek"><span>Bağımlılık:</span> ' + m.bagimlilik.map(esc).join(', ') + '</p>' : '';
    const sohbet = (m.sohbet || []).length ? '<p class="ek"><span>Sohbet:</span> ' + m.sohbet.map((u, i) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + (m.sohbet.length > 1 ? 'sohbet ' + (i + 1) : 'sohbeti aç') + '</a>').join(', ') + '</p>' : '';
    const panel = PANELLER.find(x => x.proje === p.slug);
    const panelBag = panel ? '<p class="ek"><a class="dugme panel-dugme" href="' + esc(panel.href) + '">' + esc(panel.ac) + '</a></p>' : '';
    return '<article class="sayfa">' + antet(m) + panelBag + bag + sohbet + '<div class="metin">' + md(L.basliksizGovde(p.govde)) + '</div></article>';
  }

  function belgeSayfasi(yol) {
    const t = metin(yol);
    if (!t) return bosDurum('Sayfa bulunamadı', 'Eşitlemeden sonra tekrar dene.');
    const { meta, govde } = L.onYaziAyristir(t);
    const rev = meta.guncelleme ? '<p class="ek"><span>Rev.</span> ' + esc(meta.guncelleme) + '</p>' : '';
    return '<article class="sayfa belge">' + rev + '<div class="metin">' + md(govde) + '</div></article>';
  }

  function defterGorunumu(arg) {
    if (!veriVar()) return ilkKurulum();
    const pler = projeler();
    let sag = '';
    if (arg === 'plan') sag = belgeSayfasi('defter/duzen-plani.md');
    else if (arg === 'havuz') sag = belgeSayfasi('defter/havuz-2027.md');
    else if (arg) {
      const p = pler.find(x => x.slug === arg);
      sag = p ? projeSayfasi(p) : bosDurum('Proje bulunamadı', 'Listeden bir proje seç.');
    } else {
      sag = '<div class="sayfa-bos">Soldan bir proje seç.</div>';
    }
    return '<div class="defter' + (arg ? ' sayfa-acik' : '') + '"><nav class="defter-liste" aria-label="Projeler">' + defterListesi(pler, arg) + '</nav>' +
      '<div class="defter-sayfa">' + (arg ? '<a class="geri" href="#defter">Defter</a>' : '') + sag + '</div></div>';
  }

  // Haftalık iş dökümü: o hafta biten, not düşülen, yeni gelen ve süren görevler
  function haftalikDokum(tum, pazartesi) {
    const bas = L.isoTarih(pazartesi), son = L.isoTarih(L.gunEkle(pazartesi, 6));
    const icinde = t => t && t >= bas && t <= son;
    const biten = tum.filter(g => g.durum === 'bitti' && icinde(g.bitis));
    const yeni = tum.filter(g => icinde(g.verildi) && !biten.includes(g));
    const notlu = tum.map(g => ({ g, n: (g.notlar || []).filter(n => icinde(n.t)) })).filter(x => x.n.length);
    const suren = L.gorevSirala(tum.filter(g => (g.durum === 'acik' || g.durum === 'devam' || g.durum === 'beklemede') && !(g.verildi && g.verildi > son)));
    const ad = g => g.baslik + (g.proje ? ' (' + g.proje + ')' : '');
    const aralik = pazartesi.getDate() + (pazartesi.getMonth() === L.gunEkle(pazartesi, 6).getMonth() ? '' : ' ' + L.AY_ADLARI[pazartesi.getMonth()]) +
      '–' + L.kisaTarih(L.gunEkle(pazartesi, 6));
    const satirlar = [aralik];
    if (biten.length) satirlar.push('Biten: ' + biten.map(ad).join(', '));
    for (const x of notlu) satirlar.push(x.g.baslik + ': ' + x.n.map(n => n.metin.replace(/\.?$/, '.')).join(' '));
    if (yeni.length) satirlar.push('Yeni gelen: ' + yeni.map(g => ad(g) + (g.veren ? ', ' + g.veren : '')).join('; '));
    if (suren.length) satirlar.push('Süren: ' + suren.map(g => g.baslik + (g.durum === 'beklemede' ? ' (beklemede)' : '')).join(', '));
    return { aralik, biten, yeni, notlu, suren, metin: satirlar.join('\n'), bos: !biten.length && !yeni.length && !notlu.length };
  }

  function dokumHtml(tum, arg) {
    const m = /^hafta\/(\d{4}-\d{2}-\d{2})$/.exec(arg || '');
    const pazartesi = L.haftaBasi(m ? L.tarihAyristir(m[1]) : new Date());
    const dk = haftalikDokum(tum, pazartesi);
    const onceki = L.isoTarih(L.gunEkle(pazartesi, -7)), sonraki = L.isoTarih(L.gunEkle(pazartesi, 7));
    const buHafta = L.isoTarih(L.haftaBasi(new Date()));
    const li = (etiket, ic) => '<li><span class="dokum-etiket">' + etiket + '</span> ' + ic + '</li>';
    const govde = dk.bos && !dk.suren.length ? '<p class="not">Bu hafta için görev kaydı yok.</p>' : '<ul class="dokum">' +
      (dk.biten.length ? li('Biten', dk.biten.map(g => esc(g.baslik)).join(', ')) : '') +
      dk.notlu.map(x => li(esc(x.g.baslik), x.n.map(n => esc(n.metin)).join(' · '))).join('') +
      (dk.yeni.length ? li('Yeni gelen', dk.yeni.map(g => esc(g.baslik) + (g.veren ? ' <small class="satir-ici">' + esc(g.veren) + '</small>' : '')).join(', ')) : '') +
      (dk.suren.length ? li('Süren', dk.suren.map(g => esc(g.baslik)).join(', ')) : '') + '</ul>';
    return '<section id="dokum"><div class="kart-ust"><h2>Haftalık döküm</h2><div class="hafta-gez">' +
      '<a href="#is/hafta/' + onceki + '" aria-label="Önceki hafta">‹</a><span class="sayi">' + esc(dk.aralik) + '</span>' +
      (sonraki <= buHafta ? '<a href="#is/hafta/' + sonraki + '" aria-label="Sonraki hafta">›</a>' : '<span class="soluk-ok">›</span>') + '</div></div>' +
      govde + (dk.bos ? '' : '<button type="button" class="metin-dugme" data-kopyala="' + esc(dk.metin) + '">Düz metin olarak kopyala</button>') + '</section>';
  }

  function isGorunumu(arg) {
    if (!veriVar()) return ilkKurulum();
    const tum = gorevler();
    const acik = L.gorevSirala(tum.filter(g => g.durum === 'acik' || g.durum === 'devam'));
    const bekle = L.gorevSirala(tum.filter(g => g.durum === 'beklemede'));
    const biten = tum.filter(g => g.durum === 'bitti').sort((a, b) => String(b.bitis || '').localeCompare(String(a.bitis || ''))).slice(0, 10);
    const kart = g => gorevSatiri(g).replace('</li>',
      '<div class="gorev-dugmeler">' +
      (g.durum !== 'bitti' ? '<button class="metin-dugme" data-gorev-bitti="' + esc(g.id) + '">Bitti olarak işaretle</button>' : '<button class="metin-dugme" data-gorev-ac="' + esc(g.id) + '">Geri aç</button>') +
      '</div>' + (g.notlar && g.notlar.length ? '<details><summary>Notlar (' + g.notlar.length + ')</summary><ul class="notlar">' +
        g.notlar.map(n => '<li><span class="sayi">' + esc(n.t || '') + '</span> ' + esc(n.metin || '') + '</li>').join('') + '</ul></details>' : '') + '</li>');
    return '<article class="is">' +
      '<header class="bolum-bas"><h1>İş</h1><button class="dugme" data-ac="gorev">Görev ekle</button></header>' +
      '<section><h2>Açık</h2>' + (acik.length ? '<ul class="liste">' + acik.map(kart).join('') + '</ul>' : '<p class="not">Açık görev yok. Sohbette yaz ya da Görev ekle\'ye bas.</p>') + '</section>' +
      (bekle.length ? '<section><h2>Beklemede</h2><ul class="liste">' + bekle.map(kart).join('') + '</ul></section>' : '') +
      (biten.length ? '<section><h2>Bitenler</h2><ul class="liste soluk">' + biten.map(kart).join('') + '</ul></section>' : '') +
      dokumHtml(tum, arg) +
      '</article>';
  }

  function kocGorunumu() {
    if (!veriVar()) return ilkKurulum();
    const simdi = new Date();
    const hv = havuz();
    const h = L.hiz(projeler(), hv ? hv.meta : null, simdi);
    const yuzde = x => (h.toplam ? Math.min(100, x / h.toplam * 100) : 0).toFixed(1);
    let hizHtml = '<p class="buyuk-sayi sayi">' + h.biten + ' <span>/ ' + h.toplam + ' birim bitti</span></p>';
    if (h.beklenen != null) {
      const fark = h.biten - h.beklenen;
      hizHtml += '<div class="cubuk" role="img" aria-label="Biten ' + h.biten + ', beklenen ' + h.beklenen.toFixed(1) + ' birim">' +
        '<div class="cubuk-dolu" style="width:' + yuzde(h.biten) + '%"></div><div class="cubuk-hedef" style="left:' + yuzde(h.beklenen) + '%"></div></div>' +
        '<p class="not">Bugüne kadar beklenen ' + h.beklenen.toFixed(1).replace('.', ',') + ' birim; ' +
        (fark >= -0.5 ? 'hızın yetiyor.' : (Math.abs(fark).toFixed(1).replace('.', ',') + ' birim gerideyiz.')) +
        ' Hedef için haftada ' + h.haftalik.toFixed(1).replace('.', ',') + ' birim gerekiyor.</p>';
    }
    const kay = kayitlar();
    const iskel = iskelet();
    const uykular = kay.filter(k => k.tur === 'uyku').sort((a, b) => b.t.localeCompare(a.t)).slice(0, 14);
    const gecMi = (v, h2) => L.isikGecMi(v, h2, 15);
    const uykuHtml = uykular.length ? '<table class="kucuk-tablo"><thead><tr><th>Gün</th><th>Işık</th><th>Kalkış</th></tr></thead><tbody>' + uykular.map(k => {
      const hedef = L.gunPlani(iskel, L.tarihAyristir(k.t)).uyku || {};
      return '<tr><td>' + esc(L.kisaTarih(L.tarihAyristir(k.t))) + '</td><td class="sayi' + (gecMi(k.isik, hedef.isik) ? ' gecikti' : '') + '">' + esc(k.isik || '–') + '</td>' +
        '<td class="sayi' + (gecMi(k.kalkis, hedef.kalkis) ? ' gecikti' : '') + '">' + esc(k.kalkis || '–') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="not">Henüz uyku girdisi yok.</p>';
    const son = kay.slice(-8).reverse();
    const sonHtml = son.length ? '<ul class="liste">' + son.map(k => '<li class="girdi"><span class="sayi">' + esc(k.t) + '</span> ' + esc(GIRDI_ADI[k.tur] || k.tur) + ' ' + esc(girdiOzeti(k)) + '</li>').join('') + '</ul>' : '<p class="not">Henüz girdi yok. + düğmesiyle ya da Koç sohbetinde yazarak başla.</p>';
    const degYollari = Object.keys(durum.dosyalar).filter(y => /^koc\/degerlendirme\/.+\.md$/.test(y)).sort();
    const degHtml = degYollari.length ? '<div class="metin">' + md(L.onYaziAyristir(metin(degYollari[degYollari.length - 1])).govde) + '</div>' : '<p class="not">İlk değerlendirme Pazar akşamı gelecek.</p>';
    return '<article class="koc">' +
      '<header class="bolum-bas"><h1>Koç</h1></header>' +
      ekKartlar('koc-ust', simdi) +
      '<section><h2>2027 hızı</h2>' + hizHtml + '</section>' +
      haftalarHtml(kay, iskel, hv, simdi) +
      '<section><h2>Uyku, son 14 gün</h2>' + uykuHtml + '</section>' +
      '<section><h2>Son girdiler</h2>' + sonHtml + '</section>' +
      '<section><h2>Son değerlendirme</h2>' + degHtml + '</section>' +
      ekKartlar('koc-alt', simdi) +
      '</article>';
  }

  // Haftalar: her ölçüde son 8 hafta ve kendi baseline'ın (önceki en fazla 4 haftanın ortalaması)
  function haftalarHtml(kay, iskel, hv, simdi) {
    const olculer = L.haftalikOlculer(kay, simdi, {
      n: 8, haric: hv ? hv.meta.haric : [],
      hedefIsik: t => (L.gunPlani(iskel, L.tarihAyristir(t)).uyku || {}).isik,
    }).filter(o => o.veriVar);
    if (!olculer.length) return '<section><h2>Haftalar</h2><p class="not">Girdiler birikince her ölçü için haftalık grafik ve baseline burada çıkar.</p></section>';
    const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
    const kisa = h => L.kisaTarih(L.tarihAyristir(h.bas));
    const kartlar = olculer.map(o => {
      const gecerli = o.degerler.filter(v => v !== null);
      const ust = Math.max(1, ...gecerli, o.baz || 0);
      const sutunlar = o.haftalar.map((h, i) => {
        const v = o.degerler[i];
        const etiket = kisa(h) + ' haftası: ' + (v === null ? (h.haricGun >= 4 ? 'takip dışı' : 'takip başlamadan') : fmt(v) + ' ' + o.birim);
        return '<div class="mini-sutun' + (h.buHafta ? ' bu' : '') + (v === null ? ' yok' : '') + '" tabindex="0" title="' + esc(etiket) + '" aria-label="' + esc(etiket) + '">' +
          (v ? '<i style="height:' + (v / ust * 100).toFixed(1) + '%"></i>' : '') + '</div>';
      }).join('');
      const cizgi = o.baz !== null ? '<div class="mini-baz" style="bottom:' + (o.baz / ust * 100).toFixed(1) + '%" aria-hidden="true"></div>' : '';
      let baz;
      if (o.baz === null) baz = 'Baseline bir hafta daha veri birikince çıkar.';
      else {
        const r1 = v => Math.round(v * 10) / 10;
        const f = o.bu === null ? 0 : r1(r1(o.bu) - r1(o.beklenen));   // gösterilen sayılarla tutarlı
        const yon = Math.abs(f) < 0.05 ? 'aynı' : (f > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(f));
        const sinif = o.iyi && Math.abs(f) >= 0.05 ? (f > 0 ? ' iyi' : ' kotu') : '';
        baz = 'Baseline ' + fmt(o.baz) + '/hafta · bu noktada ' + fmt(o.beklenen) + ' · <span class="' + sinif.trim() + '">' + yon + '</span>';
      }
      return '<div class="olcu"><h3>' + esc(o.baslik) + '</h3>' +
        '<p class="olcu-deger"><span class="olcu-sayi">' + (o.bu === null ? '–' : fmt(o.bu)) + '</span> ' + esc(o.birim) + ' bu hafta</p>' +
        '<p class="olcu-baz">' + baz + '</p>' +
        '<div class="mini" role="group" aria-label="' + esc(o.baslik) + ', son 8 hafta">' + cizgi + sutunlar + '</div>' +
        '<div class="mini-eksen"><span>' + esc(kisa(o.haftalar[0])) + '</span><span>bu hafta</span></div></div>';
    }).join('');
    const h0 = olculer[0].haftalar;
    const tablo = '<details class="tablo-ac"><summary>Tablo</summary><div class="tablo-sar"><table class="kucuk-tablo"><thead><tr><th></th>' +
      h0.map(h => '<th class="sayi">' + esc(kisa(h)) + '</th>').join('') + '<th>Baseline</th></tr></thead><tbody>' +
      olculer.map(o => '<tr><td>' + esc(o.baslik) + ' <small class="satir-ici">' + esc(o.birim) + '</small></td>' +
        o.degerler.map(v => '<td class="sayi">' + (v === null ? '–' : fmt(v)) + '</td>').join('') +
        '<td class="sayi">' + (o.baz === null ? '–' : fmt(o.baz)) + '</td></tr>').join('') + '</tbody></table></div></details>';
    return '<section><h2>Haftalar</h2><p class="not">Ölçü kendi baseline\'ın: önceki en fazla 4 haftanın ortalaması. Hafta bitmeden, haftanın geçen kısmına göre karşılaştırılır. Gezi ve askerlik haftaları sayılmaz.</p>' +
      '<div class="olculer">' + kartlar + '</div>' + tablo + '</section>';
  }

  function girdiOzeti(k) {
    switch (k.tur) {
      case 'uyku': return [k.isik && 'ışık ' + k.isik, k.kalkis && 'kalkış ' + k.kalkis].filter(Boolean).join(', ');
      case 'sabah_blogu': return (k.yapildi === false ? 'yapılmadı' : 'yapıldı') + (k.konu ? ', ' + k.konu : '');
      case 'okuma': return [k.kitap, k.sayfa && k.sayfa + ' sayfa', k.dk && k.dk + ' dk'].filter(Boolean).join(', ');
      case 'bisiklet': return [k.km && k.km + ' km', k.dk && k.dk + ' dk'].filter(Boolean).join(', ');
      case 'atolye': return [k.proje, k.dk && k.dk + ' dk', k.not].filter(Boolean).join(', ');
      case 'konusma': return k.yapildi === false ? 'yapılmadı' : 'yapıldı';
      case 'film': return [k.baslik, k.puan && k.puan + '★'].filter(Boolean).join(', ');
      default: return k.not || k.metin || '';
    }
  }

  // ---------- çizim ----------
  function rota() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'bugun';
    const [sayfa, ...kalan] = h.split('/');
    return { sayfa, arg: kalan.join('/') };
  }

  function ciz() {
    const simdi = new Date();
    $('#saat').textContent = L.tarihYazi(simdi) + ', ' + L.saatYazi(simdi);
    const { sayfa, arg } = rota();
    const ek = ekGorunumler[sayfa];
    const sekme = ek ? ek.sekme : sayfa;
    document.querySelectorAll('[data-sekme]').forEach(a => a.setAttribute('aria-current', a.dataset.sekme === sekme ? 'page' : 'false'));
    document.body.dataset.sayfa = sayfa;
    const dc = $('#durum');
    if (durum.hata) { dc.textContent = durum.hata; dc.hidden = false; dc.className = 'durum-cubugu hata'; }
    else if (durum.esitleniyor) { dc.textContent = 'Eşitleniyor…'; dc.hidden = false; dc.className = 'durum-cubugu'; }
    else dc.hidden = true;
    const gorunumler = { bugun: bugunGorunumu, defter: () => defterGorunumu(arg), is: () => isGorunumu(arg), koc: kocGorunumu };
    const fn = ek ? () => ek.fn(arg) : (gorunumler[sayfa] || bugunGorunumu);
    const ana = $('#gorunum');
    const kaydirma = ana.dataset.sayfa === sayfa + '/' + arg ? window.scrollY : 0;
    ana.innerHTML = fn();
    ana.dataset.sayfa = sayfa + '/' + arg;
    if (kaydirma) window.scrollTo(0, kaydirma);
    for (const fn2 of cizimSonrasi) { try { fn2(sayfa, arg, ana); } catch (e) { console.error(e); } }
  }

  // ---------- hızlı ekle ----------
  const ALANLAR = {
    uyku: [['isik', 'Işık kapandı', 'time'], ['kalkis', 'Kalkış', 'time']],
    sabah_blogu: [['yapildi', 'Yapıldı', 'evethayir'], ['konu', 'Konu', 'text'], ['dk', 'Dakika', 'number']],
    okuma: [['kitap', 'Kitap', 'text'], ['sayfa', 'Sayfa', 'number'], ['dk', 'Dakika', 'number']],
    bisiklet: [['km', 'Km', 'number'], ['dk', 'Dakika', 'number'], ['not', 'Not', 'text']],
    atolye: [['proje', 'Proje', 'atolye'], ['dk', 'Dakika', 'number'], ['not', 'Ne yapıldı', 'text']],
    konusma: [['yapildi', 'Yapıldı', 'evethayir']],
    is: [['not', 'Not', 'textarea']],
    not: [['metin', 'Not', 'textarea']],
  };

  function ekleFormu(tur, tarih) {
    const secenekler = Object.keys(ALANLAR).map(t => '<button type="button" class="cip' + (t === tur ? ' secili' : '') + '" data-tur="' + t + '">' + esc(GIRDI_ADI[t]) + '</button>').join('');
    const atolyeProjeleri = projeler().filter(p => /Atölye/.test(p.meta.kulvar || '') && p.meta.durum !== 'bitti');
    const sonKitap = sakla.al('sonKitap', '');
    const alan = ([ad, etiket, tip]) => {
      const id = 'ekle-' + ad;
      if (tip === 'evethayir') return '<fieldset class="alan"><legend>' + etiket + '</legend><label class="secim"><input type="radio" name="' + ad + '" value="evet" checked> Evet</label><label class="secim"><input type="radio" name="' + ad + '" value="hayir"> Hayır</label></fieldset>';
      if (tip === 'atolye') return '<label class="alan" for="' + id + '">' + etiket + '<select id="' + id + '" name="' + ad + '">' + atolyeProjeleri.map(p => '<option value="' + esc(p.slug) + '">' + esc(p.meta.baslik) + '</option>').join('') + '</select></label>';
      if (tip === 'textarea') return '<label class="alan" for="' + id + '">' + etiket + '<textarea id="' + id + '" name="' + ad + '" rows="3"></textarea></label>';
      const deger = ad === 'kitap' ? ' value="' + esc(sonKitap) + '"' : (tur === 'sabah_blogu' && ad === 'dk' ? ' value="35"' : '');
      return '<label class="alan" for="' + id + '">' + etiket + '<input id="' + id + '" name="' + ad + '" type="' + tip + '"' + (tip === 'number' ? ' inputmode="numeric" min="0"' : '') + deger + '></label>';
    };
    return '<div class="cipler" role="group" aria-label="Girdi türü">' + secenekler + '</div>' +
      '<label class="alan" for="ekle-tarih">Tarih<input id="ekle-tarih" name="t" type="date" value="' + (tarih || L.isoTarih(new Date())) + '"></label>' +
      ALANLAR[tur].map(alan).join('');
  }

  let ekleTuru = 'uyku';
  function ekleAc(tur, tarih) {
    if (!durum.anahtar) { ayarAc(); hataGoster('Girdi eklemek için önce anahtar gir.'); return; }
    ekleTuru = ALANLAR[tur] ? tur : ekleTuru;
    $('#ekle-alanlar').innerHTML = ekleFormu(ekleTuru, tarih);
    pencereAc('ekleDialog');
  }

  // ---------- günü kapat ----------
  // Sabah bloğunun konusu iskeletten: "Şirket prosedürleri (net ~35 dk)" -> "Şirket prosedürleri"
  function sabahKonusu(gun) {
    const b = L.gunPlani(iskelet(), gun).bloklar.find(x => /^0?[4-9]:\d{2}-/.test(x.saat || ''));
    return b ? String(b.is).replace(/\s*\([^)]*\)/g, '').replace(/:.*$/, '').trim() : '';
  }

  function kapatFormu() {
    const gun = L.kapanisGunu(new Date());
    const hm = (havuz() || {}).meta || {};
    const eksik = L.eksikGirdiler(kayitlar(), gun, hm.haric);
    const bul = t => eksik.find(e => e.tur === t);
    const parca = [];
    if (bul('uyku')) parca.push('<fieldset class="kapat-bolum"><legend>Uyku</legend><div class="iki-alan">' +
      '<label class="alan">Dün gece ışık<input name="uyku_isik" type="time"></label>' +
      '<label class="alan">Bu sabah kalkış<input name="uyku_kalkis" type="time"></label></div></fieldset>');
    if (bul('sabah_blogu')) parca.push('<fieldset class="kapat-bolum"><legend>Sabah bloğu</legend>' +
      '<div class="secimler"><label class="secim"><input type="radio" name="sabah_yapildi" value="evet"> Yapıldı</label>' +
      '<label class="secim"><input type="radio" name="sabah_yapildi" value="hayir"> Yapılmadı</label></div>' +
      '<div class="iki-alan"><label class="alan">Konu<input name="sabah_konu" type="text" value="' + esc(sabahKonusu(gun)) + '"></label>' +
      '<label class="alan">Dakika<input name="sabah_dk" type="number" inputmode="numeric" min="0" value="35"></label></div></fieldset>');
    const ok = bul('okuma');
    if (ok) parca.push('<fieldset class="kapat-bolum"><legend>Dün gece okuma</legend>' +
      '<div class="secimler"><label class="secim"><input type="radio" name="okuma_yapildi" value="evet"> Okudum</label>' +
      '<label class="secim"><input type="radio" name="okuma_yapildi" value="hayir"> Okumadım</label></div>' +
      '<label class="alan">Kitap<input name="okuma_kitap" type="text" value="' + esc(sakla.al('sonKitap', '')) + '"></label>' +
      '<div class="iki-alan"><label class="alan">Sayfa<input name="okuma_sayfa" type="number" inputmode="numeric" min="0"></label>' +
      '<label class="alan">Dakika<input name="okuma_dk" type="number" inputmode="numeric" min="0"></label></div>' +
      '<input type="hidden" name="okuma_t" value="' + esc(ok.t) + '"></fieldset>');
    parca.push('<label class="alan">Günden bir not (isteğe bağlı)<textarea name="not" rows="2"></textarea></label>');
    return { gun, html: (eksik.length ? '<p class="not">Boş bıraktığın kaydedilmez.</p>' : '<p class="not">Bu günün girdileri tamam; istersen not bırak.</p>') + parca.join('') };
  }

  function kapatAc() {
    if (!durum.anahtar) { ayarAc(); hataGoster('Önce anahtar gir.'); return; }
    const f = kapatFormu();
    $('#kapat-tarih').textContent = L.tarihYazi(f.gun);
    $('#kapat-alanlar').innerHTML = f.html;
    pencereAc('kapatDialog');
  }

  async function kapatKaydet(form) {
    const v = new FormData(form);
    const iso = L.isoTarih(L.kapanisGunu(new Date()));
    const s = ad => String(v.get(ad) || '').trim();
    const liste = [];
    if (s('uyku_isik') || s('uyku_kalkis')) {
      const k = { t: iso, tur: 'uyku', kaynak: 'uygulama' };
      if (s('uyku_isik')) k.isik = s('uyku_isik');
      if (s('uyku_kalkis')) k.kalkis = s('uyku_kalkis');
      liste.push(k);
    }
    if (s('sabah_yapildi')) {
      const k = { t: iso, tur: 'sabah_blogu', kaynak: 'uygulama', yapildi: s('sabah_yapildi') === 'evet' };
      if (k.yapildi && s('sabah_konu')) k.konu = s('sabah_konu');
      if (k.yapildi && s('sabah_dk')) k.dk = Number(s('sabah_dk'));
      liste.push(k);
    }
    const okT = s('okuma_t');
    if (okT && (s('okuma_yapildi') || s('okuma_sayfa') || s('okuma_dk'))) {
      const k = { t: okT, tur: 'okuma', kaynak: 'uygulama' };
      if (s('okuma_yapildi') === 'hayir') k.yapildi = false;
      else {
        if (s('okuma_kitap')) { k.kitap = s('okuma_kitap'); sakla.koy('sonKitap', k.kitap); }
        if (s('okuma_sayfa')) k.sayfa = Number(s('okuma_sayfa'));
        if (s('okuma_dk')) k.dk = Number(s('okuma_dk'));
      }
      liste.push(k);
    }
    if (s('not')) liste.push({ t: iso, tur: 'not', kaynak: 'uygulama', metin: s('not') });
    if (!liste.length) { hataGoster('Kaydedilecek bir şey yok; en az bir bölümü doldur.'); return false; }
    await kayitlarEkle(liste, 'Koç: günü kapat ' + iso);
    return true;
  }

  async function ekleKaydet(form) {
    const v = new FormData(form);
    const kayit = { t: v.get('t') || L.isoTarih(new Date()), tur: ekleTuru, kaynak: 'uygulama' };
    for (const [ad, , tip] of ALANLAR[ekleTuru]) {
      const x = v.get(ad);
      if (x === null || x === '') continue;
      if (tip === 'evethayir') kayit[ad] = x === 'evet';
      else if (tip === 'number') kayit[ad] = Number(x);
      else kayit[ad] = String(x).trim();
    }
    if (Object.keys(kayit).length <= 3) { hataGoster('Boş girdi kaydedilmedi; en az bir alanı doldur.'); return false; }
    if (kayit.kitap) sakla.koy('sonKitap', kayit.kitap);
    await kayitEkle(kayit);
    return true;
  }

  // ---------- görev ekle ----------
  async function gorevKaydet(form) {
    const v = new FormData(form);
    const baslik = String(v.get('baslik') || '').trim();
    if (!baslik) { hataGoster('Görevin adını yaz.'); return false; }
    const bugun = L.isoTarih(new Date());
    const g = {
      id: bugun + '-' + baslik.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
      baslik, proje: String(v.get('proje') || '').trim(), veren: String(v.get('veren') || '').trim(),
      verildi: bugun, son_tarih: v.get('son_tarih') || null, deadline: v.get('deadline') || null,
      durum: 'acik', bitis: null, notlar: [],
    };
    const not = String(v.get('not') || '').trim();
    if (not) g.notlar.push({ t: bugun, metin: not });
    await gorevDegistir(liste => { liste.push(g); }, 'İş: ' + baslik);
    return true;
  }

  async function gorevDurum(id, yeni) {
    const bugun = L.isoTarih(new Date());
    await gorevDegistir(liste => {
      const g = liste.find(x => x.id === id);
      if (!g) throw new Error('Görev bulunamadı; önce eşitle.');
      g.durum = yeni;
      g.bitis = yeni === 'bitti' ? bugun : null;
    }, 'İş: ' + id + ' ' + yeni);
  }

  // ---------- ayarlar ----------
  function ayarAc() {
    $('#ayar-anahtar').value = '';
    $('#ayar-durum').textContent = durum.anahtar ? 'Bu cihazda anahtar kayıtlı.' + (durum.sonEsitleme ? ' Son eşitleme: ' + new Date(durum.sonEsitleme).toLocaleString('tr-TR') + '.' : '') : 'Bu cihazda anahtar yok.';
    $('#anahtarSil').hidden = !durum.anahtar;
    if (!$('#ayarDialog').open) pencereAc('ayarDialog');
  }

  async function anahtarKaydet() {
    const a = $('#ayar-anahtar').value.trim();
    if (!a) { hataGoster('Anahtarı yapıştır.'); return; }
    const btn = $('#anahtarKaydet');
    btn.disabled = true;
    durum.anahtar = a;
    try {
      // Hem okuma hem yazma iznini dene: depo bilgisi ve izinler
      const depo = await gh(`/repos/${SAHIP}/${DEPO}`);
      if (depo && depo.permissions && depo.permissions.push === false) {
        throw Object.assign(new Error('yazma yok'), { status: 403, detay: 'contents: read-only' });
      }
    } catch (e) {
      durum.anahtar = sakla.al('anahtar', '');
      hataGoster(hataMetni(e));
      btn.disabled = false;
      return;
    }
    btn.disabled = false;
    sakla.koy('anahtar', a);
    $('#ayarDialog').close();
    tost('Anahtar kaydedildi');
    esitle(true);
  }

  // ---------- olaylar ----------
  function islemle(btn, fn, basari) {
    btn.disabled = true;
    return fn().then(ok => { if (ok !== false) { if (basari) tost(basari); ciz(); } return ok; })
      .catch(e => { hataGoster(e.status ? hataMetni(e) : e.message); return false; })
      .finally(() => { btn.disabled = false; });
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-ac]');
    if (!t) return;
    if (t.dataset.ac === 'ayar') { e.preventDefault(); ayarAc(); }
    else if (t.dataset.ac === 'kapat') { e.preventDefault(); kapatAc(); }
    else if (t.dataset.ac === 'gorev') { e.preventDefault(); if (!durum.anahtar) { ayarAc(); return; } $('#gorevForm').reset(); pencereAc('gorevDialog'); }
    else if (t.dataset.ekle) ekleAc(t.dataset.ekle, t.dataset.tarih);
    else if (t.dataset.tur) { ekleTuru = t.dataset.tur; $('#ekle-alanlar').innerHTML = ekleFormu(ekleTuru); }
    else if (t.dataset.gorevBitti) islemle(t, () => gorevDurum(t.dataset.gorevBitti, 'bitti'), 'Bitti olarak işaretlendi');
    else if (t.dataset.gorevAc) islemle(t, () => gorevDurum(t.dataset.gorevAc, 'devam'), 'Geri açıldı');
    else if (t.dataset.kapat) $('#' + t.dataset.kapat).close();
    else if (t.dataset.kopyala !== undefined) {
      const yaz = navigator.clipboard ? navigator.clipboard.writeText(t.dataset.kopyala) : Promise.reject();
      yaz.then(() => tost('Kopyalandı'), () => tost('Kopyalanamadı', true));
    }
  });

  $('#ekleBtn').addEventListener('click', () => ekleAc());
  $('#ayarBtn').addEventListener('click', ayarAc);
  $('#yenileBtn').addEventListener('click', () => esitle(false));
  $('#anahtarKaydet').addEventListener('click', anahtarKaydet);
  $('#anahtarSil').addEventListener('click', () => {
    durum.anahtar = ''; sakla.sil('anahtar');
    $('#ayarDialog').close(); tost('Anahtar bu cihazdan silindi'); ciz();
  });
  $('#ekleForm').addEventListener('submit', e => {
    e.preventDefault();
    const btn = e.submitter || $('#ekleForm button[type=submit]');
    islemle(btn, () => ekleKaydet(e.target), 'Kaydedildi').then(ok => { if (ok) $('#ekleDialog').close(); });
  });
  $('#kapatForm').addEventListener('submit', e => {
    e.preventDefault();
    const btn = e.submitter || $('#kapatForm button[type=submit]');
    islemle(btn, () => kapatKaydet(e.target), 'Gün kapandı').then(ok => { if (ok) $('#kapatDialog').close(); });
  });
  $('#gorevForm').addEventListener('submit', e => {
    e.preventDefault();
    const btn = e.submitter || $('#gorevForm button[type=submit]');
    islemle(btn, () => gorevKaydet(e.target), 'Görev eklendi').then(ok => { if (ok) $('#gorevDialog').close(); });
  });
  window.addEventListener('hashchange', () => {
    ciz();
    const dokum = /^#is\/hafta\//.test(location.hash) && document.getElementById('dokum');
    if (dokum) dokum.scrollIntoView(); else window.scrollTo(0, 0);
  });
  window.addEventListener('online', () => { esitle(true); havaGetir(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { esitle(true); havaGetir(); ciz(); } });

  // Saat her dakika; Bugün sayfası dakikada bir, diğerleri gün değişince (20:00, gece yarısı) yeniden çizilir
  let sonDakika = -1;
  let sonGun = L.isoTarih(L.gunModu(new Date()).hedef) + L.gunModu(new Date()).yarin;
  setInterval(() => {
    const d = new Date();
    if (d.getMinutes() === sonDakika) return;
    sonDakika = d.getMinutes();
    $('#saat').textContent = L.tarihYazi(d) + ', ' + L.saatYazi(d);
    const mod = L.gunModu(d);
    const gun = L.isoTarih(mod.hedef) + mod.yarin;
    const acikDialog = document.querySelector('dialog[open]');
    if (gun !== sonGun || (rota().sayfa === 'bugun' && !acikDialog)) { sonGun = gun; if (!acikDialog) ciz(); }
  }, 15000);

  if ('serviceWorker' in navigator) {
    // Yeni sürüm devreye girince sayfayı bir kez yenile
    const ilkKontrol = !!navigator.serviceWorker.controller;
    let yenilendi = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (ilkKontrol && !yenilendi && !document.querySelector('dialog[open]')) { yenilendi = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı olmadan devam */ });
  }

  // ---------- modüller ----------
  const MODUL_API = {
    L, durum, sakla, esc, md, tost, hataGoster, pencereAc, islemle, hataMetni, gh, tazeDosya, dosyaYaz, degistirVeYaz,
    kayitEkle, kayitlarEkle, metin, jsonOku, projeler, gorevler, kayitlar, iskelet, havuz, ciz, esitle, b64Yap, b64Coz, gorevSatiri, bosDurum,
    SAHIP, DEPO, DAL,
    gorunum(ad, fn, sekme) { ekGorunumler[ad] = { fn, sekme: sekme || ad }; },
    kart(yer, fn) { (kartUreticiler[yer] = kartUreticiler[yer] || []).push(fn); },
    panel(p) { PANELLER.push(p); },
    sonra(fn) { cizimSonrasi.push(fn); },
  };
  (window.DuzenModuller || []).forEach(m => { try { m(MODUL_API); } catch (e) { console.error(e); } });

  // Kısayollardan ve takvim hatırlatmasından gelen istek: ?kapat, ?odak, ?ekle=okuma, ?gorev
  function acilisIstegi() {
    const q = new URLSearchParams(location.search);
    if (!Array.from(q.keys()).length) return;
    history.replaceState(null, '', location.pathname + (location.hash || '#bugun'));
    if (!durum.anahtar) return;
    if (q.has('kapat')) kapatAc();
    else if (q.has('odak')) location.hash = '#odak';
    else if (q.get('ekle')) ekleAc(q.get('ekle'));
    else if (q.has('gorev')) { $('#gorevForm').reset(); pencereAc('gorevDialog'); }
  }

  ciz();
  havaGetir();
  if (durum.anahtar) esitle(true); else ayarAc();
  acilisIstegi();
})();
