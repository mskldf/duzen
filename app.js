/* Düzen uygulaması: veri mskldf/duzen-veri deposundan, GitHub API ile. */
(function () {
  'use strict';
  const L = window.DuzenLib;
  const SAHIP = 'mskldf', DEPO = 'duzen-veri', DAL = 'main';
  const API = 'https://api.github.com';
  const KONUM = { lat: 41.06, lon: 28.99 };
  const ILGILI = /^(defter|koc|is|muzik|dizi|saat|gelen|takvim|para)\//;
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

  // Bildirim; eylem verilirse ({ ad, fn }) yanında düğme olur ve biraz daha uzun kalır (ör. "Geri al")
  let tostZaman = null;
  function tost(metin, hata, eylem) {
    const t = $('#tost');
    t.replaceChildren(document.createTextNode(metin));
    if (eylem) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tost-eylem';
      b.textContent = eylem.ad;
      b.addEventListener('click', () => { t.hidden = true; clearTimeout(tostZaman); eylem.fn(); });
      t.append(b);
    }
    t.className = 'tost' + (hata ? ' tost-hata' : '');
    t.hidden = false;
    clearTimeout(tostZaman);
    tostZaman = setTimeout(() => { t.hidden = true; }, eylem ? 7000 : 3200);
  }

  // Çizgi simgeler (24×24, kontur)
  const IKONLAR = {
    bugun: 'M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    defter: 'M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM5 16.5a3 3 0 0 1 3-3h11M9 8.5h6',
    is: 'M4 8h16v11H4zM9 8V6.2c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2V8M4 13h16',
    koc: 'M4 20h16M7 16.5v-4M12 16.5V8M17 16.5v-6.5',
    daha: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
    ay: 'M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z',
    muzik: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z',
    dizi: 'M3 6.5h18v12H3zM8.5 21h7M8.5 3l3.5 3.5L15.5 3',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
    gorev: 'M4 4h16v16H4zM8 12.5l3 3l5-6.5',
    girdi: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    odak: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM12 7v5l3.5 2',
    kilavuz: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.7.3-1.2.9-1.2 1.7v.6M12 17.4v.1',
    saat: 'M8.5 3h7l1 4h-9zM7.5 17h9l-1 4h-7zM18 12a6 6 0 1 1-12 0a6 6 0 1 1 12 0zM12 9.2V12l1.8 1.2',
    gelen: 'M3 13.5L6 5h12l3 8.5V19H3zM3 13.5h5l1.2 2h5.6l1.2-2h5',
    ayar: 'M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    yenile: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
    indir: 'M12 4v11M7 10l5 5l5-5M5 20h14',
    para: 'M3 6.5h18v11H3zM14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM6.5 9.5v5M17.5 9.5v5',
    ok: 'M9 6l6 6l-6 6',
    daha3: 'M6 12h.01M12 12h.01M18 12h.01',
  };
  const ikon = ad => (IKONLAR[ad] ? '<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="' + IKONLAR[ad] + '"/></svg>' : '');

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

  // Geri al: ay dosyasında koşula uyan son girdiyi siler (kayıt nesnesi verilirse birebir aynısını)
  async function kayitSil(kosul, ay, mesaj) {
    const birebir = typeof kosul === 'object' ? JSON.stringify(kosul) : null;
    if (birebir) ay = ay || kosul.t.slice(0, 7);
    let bulundu = false;
    await degistirVeYaz('koc/kayit/' + ay + '.jsonl', eski => {
      bulundu = false;
      const satirlar = (eski || '').split('\n');
      for (let i = satirlar.length - 1; i >= 0; i--) {
        if (!satirlar[i].trim()) continue;
        let uyar = false;
        if (birebir) uyar = satirlar[i] === birebir;
        else { try { uyar = kosul(JSON.parse(satirlar[i])); } catch (e) { uyar = false; } }
        if (uyar) { satirlar.splice(i, 1); bulundu = true; break; }
      }
      if (!bulundu) throw Object.assign(new Error('bulunamadı'), { bulunamadi: true });
      return satirlar.join('\n');
    }, mesaj || 'Koç girdisi geri alındı').catch(e => { if (!e.bulunamadi) throw e; });
    return bulundu;
  }

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
  const GIRDI_ADI = { uyku: 'Uyku', sabah_blogu: 'Sabah bloğu', okuma: 'Okuma', bisiklet: 'Bisiklet', atolye: 'Atölye', konusma: 'Konuşma', is: 'İş notu', not: 'Not', film: 'Film', muzik: 'Albüm', dizi: 'Dizi' };
  const eksikEtiketi = (e, gunIso) => (e.tur === 'okuma' && e.t !== gunIso ? 'Dünkü okuma' : GIRDI_ADI[e.tur]);
  // Paneller: Daha menüsünde (geniş ekranda yan menüde) listelenir; proje verilirse defter sayfasında da düğmesi çıkar
  const PANELLER = [
    { ad: 'Film defteri', ac: 'Film defterini aç', href: 'film.html', proje: 'letterboxd-paneli', ikon: 'film', aciklama: 'Letterboxd istatistikleri, bu akşam ne izlesem', sira: 30 },
  ];
  const panellerSirali = () => PANELLER.slice().sort((a, b) => (a.sira || 99) - (b.sira || 99));
  const ekGorunumler = {};       // modüllerin görünümleri: ad -> { fn, sekme }
  const kartUreticiler = {};     // modüllerin Bugün kartları: yer -> [fn]
  const kutucukUreticiler = [];  // Bugün kutucukları: { sira, fn }
  const acilisIstekleri = [];    // kısayol adresleri (?album, ?film): [anahtar, fn]
  const cizimSonrasi = [];       // her çizimden sonra çalışan modül işleri
  function ekKartlar(yer, simdi) {
    return (kartUreticiler[yer] || []).map(fn => { try { return fn(simdi) || ''; } catch (e) { console.error(e); return ''; } }).join('');
  }

  // Bugün kutucuğu: tek dokunuşla iş gören büyük düğme ya da bağlantı
  function kutucukHtml(o) {
    const ic = '<span class="kutucuk-ust">' + ikon(o.ikon) + '<span class="kutucuk-etiket">' + esc(o.etiket || '') + '</span></span>' +
      '<span class="kutucuk-ana">' + esc(o.ana || '') + '</span>' +
      (o.alt ? '<span class="kutucuk-alt">' + esc(o.alt) + '</span>' : '') +
      (o.eylem ? '<span class="kutucuk-eylem">' + esc(o.eylem) + '</span>' : '');
    const sinif = 'kutucuk' + (o.vurgu ? ' vurgu' : '') + (o.sinif ? ' ' + o.sinif : '');
    return o.href ? '<a class="' + sinif + '" href="' + esc(o.href) + '">' + ic + '</a>'
      : '<button type="button" class="' + sinif + '" ' + (o.attrs || '') + '>' + ic + '</button>';
  }
  function kutucuklar(simdi) {
    return kutucukUreticiler.slice().sort((a, b) => a.sira - b.sira)
      .map(k => { try { return k.fn(simdi) || ''; } catch (e) { console.error(e); return ''; } }).join('');
  }

  function bosDurum(baslik, aciklama) {
    return '<div class="bos"><p class="bos-baslik">' + esc(baslik) + '</p><p>' + aciklama + '</p></div>';
  }

  // ---------- ilk kurulum: anahtarı olmayan cihaz ----------
  let yuklemeIstegi = null;   // Chrome'un "uygulamayı yükle" olayı
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); yuklemeIstegi = e; ciz(); });
  window.addEventListener('appinstalled', () => { yuklemeIstegi = null; tost('Düzen ana ekrana eklendi'); ciz(); });
  const uygulamaModu = () => window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const qrOkunabilir = () => 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function anaEkranBolumu() {
    if (uygulamaModu()) return '';
    return '<section class="kart"><h2>Ana ekrana ekle</h2>' +
      (yuklemeIstegi ? '<p class="not">Düzen ana ekranda simgesiyle açılır; linki aramana gerek kalmaz.</p><button class="dugme" data-ac="yukle">' + ikon('indir') + ' Ana ekrana ekle</button>'
        : '<p class="not">Chrome\'da sağ üstteki ⋮ menüsünden "Ana ekrana ekle" ya da "Uygulamayı yükle"yi seç. Düzen ana ekranda simgesiyle açılır; linki aramana gerek kalmaz.</p>') +
      '</section>';
  }

  function kurulumGorunumu() {
    const qr = qrOkunabilir();
    return '<article class="kurulum">' +
      '<h1>Bu cihazı bağla</h1>' +
      '<p class="kurulum-giris">Düzen verini GitHub\'daki duzen-veri deposundan okur ve oraya yazar. Bunun için her cihaza bir kez anahtar girilir.</p>' +
      (qr ? '<section class="kart"><h2>En kolayı: QR ile</h2><ol class="adimlar">' +
        '<li>Anahtarı olan cihazda (tablet ya da bilgisayar) Düzen\'i aç, sağ üstteki ayar simgesine bas.</li>' +
        '<li>"Başka cihaza aktar (QR)" de.</li>' +
        '<li>Burada aşağıdaki düğmeye bas, kamerayı o QR\'a tut.</li></ol>' +
        '<button class="dugme genis-dugme" data-ac="qr-oku">QR\'ı okut</button></section>' : '') +
      '<section class="kart"><h2>' + (qr ? 'Ya da anahtarı elle gir' : 'Anahtarı gir') + '</h2>' +
      '<p class="not">GitHub\'da anahtar oluşturup yapıştırırsın; adımlar açılan pencerede.</p>' +
      '<button class="dugme ' + (qr ? 'ikincil' : '') + '" data-ac="ayar">Anahtarı gir</button></section>' +
      anaEkranBolumu() +
      '<p class="not"><a href="#kilavuz">Kılavuzu oku</a></p>' +
      '</article>';
  }

  function ilkKurulum() {
    if (!durum.anahtar) return kurulumGorunumu();
    return bosDurum('Veri geliyor', durum.hata ? esc(durum.hata) : 'İlk eşitleme birkaç saniye sürer.');
  }

  // Bir günün takvim etkinlikleri: saatliler "SS:DD-SS:DD", tüm gün olanlar ayrı
  function takvimGunu(gun) {
    const tk = jsonOku('takvim/yakin.json');
    const iso = L.isoTarih(gun);
    const tum = (tk && tk.etkinlikler) || [];
    const saatli = tum.filter(e => !e.tum_gun && String(e.bas).slice(0, 10) === iso).map(e => {
      const bas = String(e.bas).slice(11, 16), bit = String(e.bit || '').slice(0, 10) === iso ? String(e.bit).slice(11, 16) : '';
      return Object.assign({}, e, { saat: bit && bit !== bas ? bas + '-' + bit : bas });
    });
    const tumGun = tum.filter(e => e.tum_gun && e.bas <= iso && (e.bit || e.bas) >= iso);
    return { saatli, tumGun };
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

  // Bugünün planında şu anki ve sıradaki iş: iskelet, takvim, kalkış ve ışık
  const dakikaOf = s => { const p = String(s).padStart(5, '0'); return Number(p.slice(0, 2)) * 60 + Number(p.slice(3, 5)); };
  const sureMetni = dk => (dk >= 60 ? Math.floor(dk / 60) + ' sa' + (dk % 60 ? ' ' + (dk % 60) + ' dk' : '') : dk + ' dk');
  function anlik(simdi) {
    const plan = L.gunPlani(iskelet(), L.sadeceGun(simdi));
    const dk = simdi.getHours() * 60 + simdi.getMinutes();
    const satirlar = [];
    for (const b of plan.bloklar) {
      const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(b.saat || '');
      if (m) satirlar.push({ bas: dakikaOf(m[1]), bit: dakikaOf(m[2]), ad: b.is, saat: b.saat });
    }
    for (const e of takvimGunu(simdi).saatli) {
      const [b1, b2] = e.saat.split('-');
      satirlar.push({ bas: dakikaOf(b1), bit: dakikaOf(b2 || b1), ad: e.baslik, saat: e.saat, an: !b2, takvim: true });
    }
    // Kalkış ve ışık: hedef aralıksa "06:00–07:00"; "Işığa" ve "Gün bitti" aralığın sınırına göre
    const up = L.uykuPlani(iskelet(), L.sadeceGun(simdi));
    if (up && up.kalkis) satirlar.push({ bas: up.kalkis.bas, bit: up.kalkis.bas, ad: 'Kalkış', saat: up.kalkis.yazi, an: true });
    if (up && up.isik) satirlar.push({ bas: up.isik.bas, bit: up.isik.bas, ad: 'Işık kapanır', saat: up.isik.yazi, an: true });
    satirlar.sort((a, b) => a.bas - b.bas);
    const su = satirlar.find(s => !s.an && dk >= s.bas && dk < s.bit) || null;
    const sonraki = satirlar.find(s => s.bas > dk) || null;
    // Saati belirsiz bloklar ("gün içi", "öğleden sonra"): o anda saatli blok yoksa gösterilir
    const gunici = plan.bloklar.filter(b => !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(b.saat || ''));
    return { su, sonraki, dk, gunici, isik: up && up.isik ? up.isik.sinir : null };
  }

  function simdiKarti(simdi, hm) {
    const a = anlik(simdi);
    let html = '';
    if (a.su) {
      const oran = Math.min(1, Math.max(0, (a.dk - a.su.bas) / Math.max(1, a.su.bit - a.su.bas)));
      html += '<div class="simdi-satir"><span class="simdi-etiket">Şimdi</span><span class="simdi-is">' + esc(a.su.ad) + '</span>' +
        '<span class="simdi-zaman sayi">' + esc(a.su.saat) + ' · ' + sureMetni(a.su.bit - a.dk) + ' kaldı</span></div>' +
        '<div class="cubuk simdi-cubuk" role="img" aria-label="Bloğun yüzde ' + Math.round(oran * 100) + '\'i geçti"><div class="cubuk-dolu" style="width:' + (oran * 100).toFixed(1) + '%"></div></div>';
    } else if (a.gunici.length && !(a.isik != null && a.dk >= a.isik)) {
      html += a.gunici.map(b => '<div class="simdi-satir"><span class="simdi-etiket">Bugün</span><span class="simdi-is">' + esc(b.is) + '</span>' +
        '<span class="simdi-zaman">' + esc(b.saat || '') + '</span></div>').join('');
    } else if (!a.sonraki) {
      // Şu an blok yoksa sadece sıradaki görünür; o da yoksa gün bitmiştir
      html += '<div class="simdi-satir"><span class="simdi-etiket">Şimdi</span><span class="simdi-is soluk-yazi">' +
        (a.isik != null && a.dk >= a.isik ? 'Gün bitti' : 'Planda başka blok yok') + '</span></div>';
    }
    if (a.sonraki) {
      html += '<div class="simdi-satir' + (html ? ' sonraki' : '') + '"><span class="simdi-etiket">Sıradaki</span><span class="simdi-is">' + esc(a.sonraki.ad) + '</span>' +
        '<span class="simdi-zaman sayi">' + esc(a.sonraki.saat.split('-')[0]) + ' · ' + sureMetni(a.sonraki.bas - a.dk) + ' sonra</span></div>';
    }
    const ek = [];
    if (a.isik != null && simdi.getHours() >= 18 && a.isik > a.dk) ek.push('Işığa <b class="sayi">' + sureMetni(a.isik - a.dk) + '</b>');
    // Bu akşam okumaya kalan süre: sığan bir film için seçiciye
    const okuma = L.okumaBloku(L.gunPlani(iskelet(), L.sadeceGun(simdi)));
    const okumayaKalan = okuma ? L.saatAnahtari(okuma.saat) - a.dk : null;
    if (simdi.getHours() >= 17 && okumayaKalan >= 60 && !L.haricMi(L.isoTarih(simdi), hm.haric)) {
      ek.push('Okumaya ' + sureMetni(okumayaKalan) + ' var: <a href="film.html#secici&amp;okuma">sığan bir film seç</a>');
    }
    if (ek.length) html += '<p class="simdi-ek">' + ek.join(' · ') + '</p>';
    return '<section class="kart simdi-kart" aria-label="Şimdi ve sıradaki">' + html + '</section>';
  }

  // Bir günün planı: iskelet blokları, takvim etkinlikleri, kalkış ve ışık
  function planListesi(gun, canli, tumGunGoster) {
    const plan = L.gunPlani(iskelet(), gun);
    const up = L.uykuPlani(iskelet(), gun);
    const satirlar = [];
    if (up && up.kalkis) satirlar.push({ saat: up.kalkis.yazi, baslik: 'Kalkış', alt: '' });
    for (const b of plan.bloklar) satirlar.push({ saat: b.saat, baslik: b.is, alt: b.kulvar });
    if (up && up.isik) satirlar.push({ saat: up.isik.yazi, baslik: 'Işık kapanır', alt: 'Son yarım saat telefon yok' });
    const gt = takvimGunu(gun);
    for (const e of gt.saatli) satirlar.push({ saat: e.saat, baslik: e.baslik, alt: e.konum ? e.konum + ' · Takvim' : 'Takvim', takvim: true });
    satirlar.sort((a, b) => L.saatAnahtari(a.saat) - L.saatAnahtari(b.saat));
    const simdi = new Date();
    const dk = simdi.getHours() * 60 + simdi.getMinutes();
    const li = satirlar.map(s => {
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(s.saat || '');
      const simdiMi = canli && m && dk >= Number(m[1]) * 60 + Number(m[2]) && dk < Number(m[3]) * 60 + Number(m[4]);
      return '<li class="plan-satir' + (simdiMi ? ' simdi' : '') + (s.takvim ? ' takvim' : '') + '"><span class="plan-saat sayi">' + esc(s.saat) + '</span>' +
        '<span class="plan-is">' + esc(s.baslik) + (s.alt ? '<small>' + esc(s.alt) + '</small>' : '') + '</span></li>';
    }).join('');
    const serbest = plan.serbest ? '<p class="not">Haftada bir serbest akşam: ' + esc(plan.serbest.is) + ' (ofis günü ' + esc(plan.serbest.baslangic_ofis) + ', ev günü ' + esc(plan.serbest.baslangic_ev) + ' sonrası).</p>' : '';
    return (tumGunGoster && gt.tumGun.length ? '<p class="tum-gun">' + gt.tumGun.map(e => '<span>' + esc(e.baslik) + '</span>').join('') + '</p>' : '') +
      (li ? '<ol class="plan">' + li + '</ol>' : '<p class="not">Bu gün için iskelette blok yok.</p>') + serbest;
  }

  function yarinBolumu(simdi) {
    const yarin = L.gunEkle(L.sadeceGun(simdi), 1);
    return '<section class="yarin"><h2>Yarın · ' + esc(L.tarihYazi(yarin)) + '</h2>' + havaSatiri(yarin, true) + planListesi(yarin, false, true) + '</section>';
  }

  function isBolumu(simdi, yarin) {
    const acik = L.gorevSirala(gorevler().filter(g => g.durum === 'acik' || g.durum === 'devam'));
    const cuma = !yarin && simdi.getDay() === 5 && !haftalikDokum(gorevler(), L.haftaBasi(simdi)).bos
      ? '<p class="not"><a href="#is/hafta/' + L.isoTarih(L.haftaBasi(simdi)) + '">Bu haftanın iş dökümü hazır</a></p>' : '';
    return '<section><h2><a class="baslik-bag" href="#is">İş</a></h2>' +
      (acik.length ? '<ul class="liste">' + acik.slice(0, 3).map(gorevSatiri).join('') + '</ul>' +
        (acik.length > 3 ? '<p class="not"><a href="#is">' + (acik.length - 3) + ' görev daha</a></p>' : '')
        : '<p class="not">Açık iş görevi yok.</p>') + cuma + '</section>';
  }

  function projeBolumu() {
    const aktif = projeler().filter(p => p.meta.durum === 'devam').slice(0, 3);
    return '<section><h2><a class="baslik-bag" href="#defter">Projelerde sıradaki</a></h2>' +
      (aktif.length ? '<ul class="liste">' + aktif.map(p => '<li><a class="satir-bag" href="#defter/' + esc(p.slug) + '"><span class="satir-baslik">' + esc(p.meta.baslik) + '</span>' +
        (p.sirada ? '<small>' + esc(p.sirada) + '</small>' : '') + '</a></li>').join('') + '</ul>'
        : '<p class="not">Devam eden proje yok.</p>') + '</section>';
  }

  // Günü kapat: eksik her girdi tek dokunuşla "evet" olarak yazılır; ayrıntı ya da "hayır" için yanındaki ⋯
  function kapanisEksikleri(simdi) {
    const hm = (havuz() || {}).meta || {};
    const kapanis = L.kapanisGunu(simdi), kapIso = L.isoTarih(kapanis);
    return { kapanis, kapIso, eksik: L.eksikGirdiler(kayitlar(), kapanis, hm.haric, L.uykuHedefi(iskelet(), kapIso)) };
  }
  function hizliSatir(e, kapanis) {
    let baslik, alt;
    if (e.tur === 'uyku') { baslik = 'Uyku hedefte'; alt = L.uykuHedefYazisi(L.uykuHedefi(iskelet(), e.t), e.t); }
    else if (e.tur === 'sabah_blogu') { baslik = 'Sabah bloğu yapıldı'; alt = sabahKonusu(kapanis) || 'Sabah 06:00–07:00'; }
    else { baslik = 'Dün gece okudum'; alt = 'Kitap ve sayfa için ⋯'; }
    return '<li class="hizli-satir"><button type="button" class="hizli-evet" data-hizli="' + e.tur + '" data-tarih="' + e.t + '" aria-label="' + esc(baslik) + ' olarak kaydet">' +
      '<span class="hizli-isaret" aria-hidden="true"></span><span class="hizli-yazi"><span class="hizli-baslik">' + esc(baslik) + '</span>' +
      (alt ? '<span class="hizli-alt">' + esc(alt) + '</span>' : '') + '</span></button>' +
      '<button type="button" class="hizli-ayrinti" data-kapat-ayrinti="' + e.tur + '" aria-label="' + esc(GIRDI_ADI[e.tur]) + ': ayrıntı ya da hayır" title="Ayrıntı ya da hayır">' + ikon('daha3') + '</button></li>';
  }
  let vurguKapat = false;   // takvimdeki "Günü kapat" bağlantısından gelince kart vurgulanır
  function gunuKapatKarti(simdi) {
    const { kapanis, eksik } = kapanisEksikleri(simdi);
    if (!eksik.length) return '';
    const aksam = simdi.getHours() >= 18 || simdi.getHours() < 4;
    return '<section class="kart gunu-kapat' + (aksam || vurguKapat ? ' kart-vurgu' : '') + '" id="gunuKapat" aria-label="Günü kapat">' +
      '<div class="kart-ust"><h2>Günü kapat</h2><span class="not">' + esc(L.tarihYazi(kapanis)) + '</span></div>' +
      '<p class="not">Dokun, kaydolsun. Ayrıntı ya da "hayır" için ⋯</p>' +
      '<ul class="hizli-liste">' + eksik.map(e => hizliSatir(e, kapanis)).join('') + '</ul></section>';
  }

  // Tek dokunuş: uyku hedefte, sabah bloğu yapıldı (konu plandan), dün gece okundu
  async function hizliKaydet(tur, t) {
    const k = { t, tur, kaynak: 'uygulama' };
    if (tur === 'uyku') k.hedefte = true;
    else if (tur === 'sabah_blogu') { k.yapildi = true; const konu = sabahKonusu(L.tarihAyristir(t)); if (konu) k.konu = konu; }
    else if (tur !== 'okuma') return null;
    await kayitEkle(k);
    return k;
  }

  // Uygulamanın kendi kutucukları: görev, diğer girdi (modüller albüm, dizi, film, odak ekler)
  kutucukUreticiler.push({ sira: 50, fn: () => kutucukHtml({ attrs: 'data-ac="gorev"', ikon: 'gorev', etiket: 'İş', ana: 'Görev ekle', alt: 'Ad, son tarih, deadline' }) });
  kutucukUreticiler.push({ sira: 60, fn: () => kutucukHtml({ attrs: 'data-ac="ekle"', ikon: 'girdi', etiket: 'Girdi', ana: 'Diğer girdi', alt: 'Okuma, bisiklet, atölye, not' }) });

  function bugunGorunumu() {
    if (!veriVar()) return ilkKurulum();
    const simdi = new Date();
    const { yarin } = L.gunModu(simdi);
    const hm = (havuz() || {}).meta || {};
    const bugun = L.sadeceGun(simdi);
    const tumGun = takvimGunu(bugun).tumGun;
    return '<article class="gun">' +
      '<header class="gun-bas"><h1>Bugün</h1><p class="gun-tarih">' + esc(L.tarihYazi(bugun)) + '</p>' + havaSatiri(bugun, false) +
      (tumGun.length ? '<p class="tum-gun">' + tumGun.map(e => '<span>' + esc(e.baslik) + '</span>').join('') + '</p>' : '') + '</header>' +
      simdiKarti(simdi, hm) +
      gunuKapatKarti(simdi) +
      '<section class="kutucuklar" aria-label="Hızlı işler">' + kutucuklar(simdi) + '</section>' +
      ekKartlar('bugun-ust', simdi) +
      (yarin ? yarinBolumu(simdi) : '') +
      askerlikKarti(hm, simdi) +
      ekKartlar('bugun-plan-alti', simdi) +
      isBolumu(simdi, yarin) + projeBolumu() +
      (yarin ? '' : '<details class="plan-ac"' + (window.innerWidth >= 900 ? ' open' : '') + '><summary>Günün planı</summary>' + planListesi(bugun, true, false) + '</details>') +
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
      '<a class="sekme-bag' + (secili === 'havuz' ? ' secili' : '') + '" href="#defter/havuz">Havuz 2027</a></div>';
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
    const uykular = L.gunlukSon(kay.filter(k => k.tur === 'uyku')).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 14);
    const isaret = x => (x === true ? '<span class="iyi-yazi" aria-label="hedefte">✓</span>' : (x === false ? '<span class="kotu-yazi" aria-label="hedef dışı">✗</span>' : '–'));
    const hucre = (deger, sonuc) => '<td class="sayi' + (sonuc === false ? ' gecikti' : '') + '">' + esc(deger || '–') + '</td>';
    const bugunH = L.uykuHedefi(iskel, L.isoTarih(simdi));
    const kayma = bugunH && bugunH.hedef ? Number(bugunH.hedef.hafta_sonu_kayma_dk) || 0 : 0;
    const kaymaYazi = kayma && kayma % 60 === 0 ? (kayma === 60 ? 'bir' : kayma / 60) + ' saat' : kayma + ' dk';
    const hedefNotu = bugunH && bugunH.hedef ? '<p class="not">Hedef: yatış ' + esc(bugunH.hedef.isik[1]) + '\'' + L.ekTen(L.dkAl(bugunH.hedef.isik[1])) + ', kalkış ' +
      esc(bugunH.hedef.kalkis[1]) + '\'' + L.ekTen(L.dkAl(bugunH.hedef.kalkis[1])) + ' önce; daha erkeni de sayılır.' +
      (kayma ? ' Cuma ve Cumartesi geceleri, Cumartesi ve Pazar sabahları ' + kaymaYazi + ' geç.' : '') + '</p>' : '';
    const uykuHtml = uykular.length ? hedefNotu + '<table class="kucuk-tablo"><thead><tr><th>Gün</th><th>Yatış</th><th>Kalkış</th><th>Hedef</th></tr></thead><tbody>' + uykular.map(k => {
      const d = L.uykuDegerlendir(k, L.uykuHedefi(iskel, k.t));
      const saatsiz = !k.isik && !k.kalkis;
      return '<tr><td>' + esc(L.kisaTarih(L.tarihAyristir(k.t))) + '</td>' +
        (saatsiz ? '<td colspan="2" class="soluk-yazi">' + (k.hedefte === true ? 'hedefte' : (k.hedefte === false ? 'hedef dışı' : '–')) + '</td>' : hucre(k.isik, d.isik) + hucre(k.kalkis, d.kalkis)) +
        '<td>' + isaret(d.hepsi) + '</td></tr>';
    }).join('') + '</tbody></table>' : hedefNotu + '<p class="not">Henüz uyku girdisi yok.</p>';
    const son = kay.slice(-8).reverse();
    const sonHtml = son.length ? '<ul class="liste">' + son.map(k => '<li class="girdi"><span class="sayi">' + esc(k.t) + '</span> ' + esc(GIRDI_ADI[k.tur] || k.tur) + ' ' + esc(girdiOzeti(k)) + '</li>').join('') + '</ul>' : '<p class="not">Henüz girdi yok. Bugün\'deki kutucuklarla ya da Koç sohbetinde yazarak başla.</p>';
    const degYollari = Object.keys(durum.dosyalar).filter(y => /^koc\/degerlendirme\/.+\.md$/.test(y)).sort();
    const degHtml = degYollari.length ? '<div class="metin">' + md(L.onYaziAyristir(metin(degYollari[degYollari.length - 1])).govde) + '</div>' : '<p class="not">İlk değerlendirme Pazar akşamı gelecek.</p>';
    return '<article class="koc">' +
      '<header class="bolum-bas"><h1>Koç</h1><button class="dugme" data-ac="ekle">Girdi ekle</button></header>' +
      ekKartlar('koc-ust', simdi) +
      '<section><h2>2027 hızı</h2>' + hizHtml + '</section>' +
      haftalarHtml(kay, iskel, hv, simdi) +
      '<section><h2>Uyku, son 14 gün</h2>' + uykuHtml + '</section>' +
      '<section><h2>Son girdiler</h2>' + sonHtml + '</section>' +
      '<section><h2>Son değerlendirme</h2>' + degHtml + '</section>' +
      ekKartlar('koc-alt', simdi) +
      '</article>';
  }

  // Haftalar: her ölçüde son 8 hafta ve kendi ortalaman (önceki en fazla 4 hafta)
  function haftalarHtml(kay, iskel, hv, simdi) {
    const olculer = L.haftalikOlculer(kay, simdi, {
      n: 8, haric: hv ? hv.meta.haric : [],
      uykuHedefi: t => L.uykuHedefi(iskel, t),
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
      if (o.baz === null) baz = 'Ortalaman bir hafta daha veri birikince çıkar.';
      else {
        const r1 = v => Math.round(v * 10) / 10;
        const f = o.bu === null ? 0 : r1(r1(o.bu) - r1(o.beklenen));   // gösterilen sayılarla tutarlı
        const yon = Math.abs(f) < 0.05 ? 'aynı' : (f > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(f));
        const sinif = o.iyi && Math.abs(f) >= 0.05 ? (f > 0 ? ' iyi' : ' kotu') : '';
        baz = 'Ortalaman ' + fmt(o.baz) + '/hafta · bugüne kadar ' + fmt(o.beklenen) + ' beklenirdi · <span class="' + sinif.trim() + '">' + yon + '</span>';
      }
      return '<div class="olcu"><h3>' + esc(o.baslik) + '</h3>' +
        '<p class="olcu-deger"><span class="olcu-sayi">' + (o.bu === null ? '–' : fmt(o.bu)) + '</span> ' + esc(o.birim) + ' bu hafta</p>' +
        '<p class="olcu-baz">' + baz + '</p>' +
        '<div class="mini" role="group" aria-label="' + esc(o.baslik) + ', son 8 hafta">' + cizgi + sutunlar + '</div>' +
        '<div class="mini-eksen"><span>' + esc(kisa(o.haftalar[0])) + '</span><span>bu hafta</span></div></div>';
    }).join('');
    const h0 = olculer[0].haftalar;
    const tablo = '<details class="tablo-ac"><summary>Tablo</summary><div class="tablo-sar"><table class="kucuk-tablo"><thead><tr><th></th>' +
      h0.map(h => '<th class="sayi">' + esc(kisa(h)) + '</th>').join('') + '<th>Ortalama</th></tr></thead><tbody>' +
      olculer.map(o => '<tr><td>' + esc(o.baslik) + ' <small class="satir-ici">' + esc(o.birim) + '</small></td>' +
        o.degerler.map(v => '<td class="sayi">' + (v === null ? '–' : fmt(v)) + '</td>').join('') +
        '<td class="sayi">' + (o.baz === null ? '–' : fmt(o.baz)) + '</td></tr>').join('') + '</tbody></table></div></details>';
    return '<section><h2>Haftalar</h2><p class="not">Her ölçü kendi ortalamanla karşılaştırılır: önceki en fazla 4 hafta. Hafta bitmeden, haftanın geçen kısmına göre bakılır; gezi ve askerlik haftaları sayılmaz.</p>' +
      '<div class="olculer">' + kartlar + '</div>' + tablo + '</section>';
  }

  function girdiOzeti(k) {
    switch (k.tur) {
      case 'uyku': return [k.isik && 'ışık ' + k.isik, k.kalkis && 'kalkış ' + k.kalkis].filter(Boolean).join(', ') ||
        (k.hedefte === true ? 'hedefte' : (k.hedefte === false ? 'hedef dışı' : ''));
      case 'sabah_blogu': return (k.sigmadi ? 'bugün sığmadı' : (k.yapildi === false ? 'yapılmadı' : 'yapıldı')) + (k.konu ? ', ' + k.konu : '');
      case 'okuma': return k.yapildi === false ? 'okunmadı' : ([k.kitap, k.sayfa && k.sayfa + ' sayfa', k.dk && k.dk + ' dk'].filter(Boolean).join(', ') || 'okundu');
      case 'bisiklet': return [k.km && k.km + ' km', k.dk && k.dk + ' dk'].filter(Boolean).join(', ');
      case 'atolye': return [k.proje, k.dk && k.dk + ' dk', k.not].filter(Boolean).join(', ');
      case 'konusma': return k.yapildi === false ? 'yapılmadı' : 'yapıldı';
      case 'film': return [k.baslik, k.puan && k.puan + '★'].filter(Boolean).join(', ');
      case 'dizi': return [k.dizi, 'S' + k.sezon + ' B' + k.bolum].filter(Boolean).join(', ');
      case 'muzik': return [k.album, k.sanatci, k.puan && k.puan + '★'].filter(Boolean).join(', ');
      default: return k.not || k.metin || '';
    }
  }

  // ---------- çizim ----------
  function rota() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'bugun';
    const [sayfa, ...kalan] = h.split('/');
    return { sayfa, arg: kalan.join('/') };
  }

  // Geniş ekranda yan menüde paneller, odak ve kılavuz
  function yanPaneller(sayfa) {
    const bag = (href, ik, ad) => '<a href="' + esc(href) + '"' + (href === '#' + sayfa ? ' aria-current="page"' : '') + '>' + ikon(ik) + '<span>' + esc(ad) + '</span></a>';
    return panellerSirali().map(p => bag(p.href, p.ikon, p.ad)).join('') + bag('#odak', 'odak', 'Odak modu') + bag('#kilavuz', 'kilavuz', 'Kılavuz');
  }

  // Daha: paneller ve araçlar (telefonda alt menünün beşincisi)
  function dahaGorunumu() {
    const satir = o => {
      const ic = ikon(o.ikon) + '<span class="daha-yazi"><span class="daha-ad">' + esc(o.ad) + '</span>' +
        (o.aciklama ? '<span class="daha-aciklama">' + esc(o.aciklama) + '</span>' : '') + '</span><span class="daha-ok" aria-hidden="true">›</span>';
      return '<li>' + (o.href ? '<a class="daha-satir" href="' + esc(o.href) + '">' + ic + '</a>'
        : '<button type="button" class="daha-satir" data-ac="' + esc(o.ac) + '">' + ic + '</button>') + '</li>';
    };
    const son = durum.sonEsitleme ? 'Son yenileme: ' + new Date(durum.sonEsitleme).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Henüz yenilenmedi';
    return '<article class="daha"><header class="bolum-bas"><h1>Daha</h1></header>' +
      '<ul class="daha-liste">' + panellerSirali().map(satir).join('') + '</ul>' +
      '<h2>Araçlar</h2><ul class="daha-liste">' +
      satir({ href: '#odak', ikon: 'odak', ad: 'Odak modu', aciklama: 'Tablet masadayken: saat, şu anki blok, sayaç' }) +
      satir({ href: '#kilavuz', ikon: 'kilavuz', ad: 'Kılavuz', aciklama: 'Düzen nasıl kullanılır' }) +
      satir({ ac: 'ayar', ikon: 'ayar', ad: 'Ayarlar', aciklama: 'Anahtar, başka cihaza aktarma (QR)' }) +
      satir({ ac: 'yenile', ikon: 'yenile', ad: 'Şimdi yenile', aciklama: son }) +
      (uygulamaModu() ? '' : satir({ ac: 'yukle', ikon: 'indir', ad: 'Ana ekrana ekle', aciklama: yuklemeIstegi ? 'Düzen uygulama gibi açılsın' : 'Chrome ⋮ menüsü, sonra "Ana ekrana ekle"' })) +
      '</ul></article>';
  }

  function ciz() {
    const simdi = new Date();
    $('#saat').textContent = L.kisaTarih(simdi) + ', ' + L.saatYazi(simdi);
    const { sayfa, arg } = rota();
    // Anahtarı ve verisi olmayan cihaz: kılavuz dışında her sayfa kurulum ekranına düşer
    const kurulum = !durum.anahtar && !veriVar() && sayfa !== 'kilavuz';
    const ek = ekGorunumler[sayfa];
    const sekme = kurulum ? 'bugun' : (ek ? ek.sekme : sayfa);
    document.querySelectorAll('[data-sekme]').forEach(a => a.setAttribute('aria-current', a.dataset.sekme === sekme ? 'page' : 'false'));
    $('#yanPaneller').innerHTML = yanPaneller(sayfa);
    document.body.dataset.sayfa = sayfa;
    const dc = $('#durum');
    if (durum.hata) { dc.textContent = durum.hata; dc.hidden = false; dc.className = 'durum-cubugu hata'; }
    else if (durum.esitleniyor) { dc.textContent = 'Güncelleniyor…'; dc.hidden = false; dc.className = 'durum-cubugu'; }
    else dc.hidden = true;
    const gorunumler = { bugun: bugunGorunumu, defter: () => defterGorunumu(arg), is: () => isGorunumu(arg), koc: kocGorunumu, daha: dahaGorunumu };
    const fn = kurulum ? kurulumGorunumu : (ek ? () => ek.fn(arg) : (gorunumler[sayfa] || bugunGorunumu));
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

  // Ayrıntı penceresi: sadece verilen bölüm (⋯'dan) ya da günün bütün eksikleri ve bir not
  function kapatFormu(sadece) {
    const { kapanis: gun, kapIso, eksik } = kapanisEksikleri(new Date());
    const bul = t => eksik.find(e => e.tur === t && (!sadece || sadece === t));
    const parca = [];
    // Tek bölüm açıldıysa başlık pencerenin başlığında; bölüm çerçevesiz
    const fs = sadece ? '<fieldset class="kapat-bolum tek"><legend class="gorunmez">' : '<fieldset class="kapat-bolum"><legend>';
    if (bul('uyku')) parca.push(fs + 'Uyku</legend>' +
      '<p class="not">' + esc(L.uykuHedefYazisi(L.uykuHedefi(iskelet(), kapIso), kapIso)) + '?</p>' +
      '<div class="secimler"><label class="secim"><input type="radio" name="uyku_hedef" value="evet"> Hedefteydim</label>' +
      '<label class="secim"><input type="radio" name="uyku_hedef" value="hayir"> Hedef dışı</label></div>' +
      '<div class="iki-alan"><label class="alan">Dün gece ışık (isteğe bağlı)<input name="uyku_isik" type="time"></label>' +
      '<label class="alan">Bu sabah kalkış (isteğe bağlı)<input name="uyku_kalkis" type="time"></label></div></fieldset>');
    if (bul('sabah_blogu')) parca.push(fs + 'Sabah bloğu</legend>' +
      '<div class="secimler"><label class="secim"><input type="radio" name="sabah_yapildi" value="evet"> Yapıldı</label>' +
      '<label class="secim"><input type="radio" name="sabah_yapildi" value="hayir"> Yapılmadı</label>' +
      '<label class="secim"><input type="radio" name="sabah_yapildi" value="sigmadi"> Bugün sığmadı</label></div>' +
      '<div class="iki-alan"><label class="alan">Konu<input name="sabah_konu" type="text" value="' + esc(sabahKonusu(gun)) + '"></label>' +
      '<label class="alan">Dakika (isteğe bağlı)<input name="sabah_dk" type="number" inputmode="numeric" min="0"></label></div></fieldset>');
    const ok = bul('okuma');
    if (ok) parca.push(fs + 'Dün gece okuma</legend>' +
      '<div class="secimler"><label class="secim"><input type="radio" name="okuma_yapildi" value="evet"> Okudum</label>' +
      '<label class="secim"><input type="radio" name="okuma_yapildi" value="hayir"> Okumadım</label></div>' +
      '<label class="alan">Kitap (isteğe bağlı)<input name="okuma_kitap" type="text" value="' + esc(sakla.al('sonKitap', '')) + '"></label>' +
      '<div class="iki-alan"><label class="alan">Sayfa<input name="okuma_sayfa" type="number" inputmode="numeric" min="0"></label>' +
      '<label class="alan">Dakika<input name="okuma_dk" type="number" inputmode="numeric" min="0"></label></div>' +
      '<input type="hidden" name="okuma_t" value="' + esc(ok.t) + '"></fieldset>');
    if (!sadece) parca.push('<label class="alan">Günden bir not (isteğe bağlı)<textarea name="not" rows="2"></textarea></label>');
    const baslik = sadece ? ({ uyku: 'Uyku', sabah_blogu: 'Sabah bloğu', okuma: 'Dün gece okuma' }[sadece] || 'Günü kapat') : 'Günü kapat';
    return { gun, baslik, html: (sadece || eksik.length ? '' : '<p class="not">Bu günün girdileri tamam; istersen not bırak.</p>') + parca.join('') };
  }

  function kapatAc(sadece) {
    if (!durum.anahtar) { ayarAc(); hataGoster('Önce anahtar gir.'); return; }
    const f = kapatFormu(sadece);
    $('#kapat-baslik').textContent = f.baslik;
    $('#kapat-tarih').textContent = L.tarihYazi(f.gun);
    $('#kapat-alanlar').innerHTML = f.html;
    pencereAc('kapatDialog');
  }

  async function kapatKaydet(form) {
    const v = new FormData(form);
    const iso = L.isoTarih(L.kapanisGunu(new Date()));
    const s = ad => String(v.get(ad) || '').trim();
    const liste = [];
    if (s('uyku_isik') || s('uyku_kalkis') || s('uyku_hedef')) {
      const k = { t: iso, tur: 'uyku', kaynak: 'uygulama' };
      if (s('uyku_isik')) k.isik = s('uyku_isik');
      if (s('uyku_kalkis')) k.kalkis = s('uyku_kalkis');
      // Saat girilmediyse seçim yazılır; saat varsa hedefte olup olmadığı saatlerden hesaplanır
      if (!k.isik && !k.kalkis) k.hedefte = s('uyku_hedef') === 'evet';
      liste.push(k);
    }
    if (s('sabah_yapildi')) {
      const sec = s('sabah_yapildi');
      const k = { t: iso, tur: 'sabah_blogu', kaynak: 'uygulama', yapildi: sec === 'evet' };
      if (sec === 'sigmadi') k.sigmadi = true;
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
    if (!liste.length) { hataGoster('Kaydedilecek bir şey yok; bir seçim yap.'); return false; }
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
  // Yazma işlemi: düğme beklerken kapalı; hata pencere içinde ya da bildirimde gösterilir
  function islemle(btn, fn, basari) {
    if (btn) btn.disabled = true;
    return fn().then(ok => { if (ok !== false) { if (basari) tost(basari); ciz(); } return ok; })
      .catch(e => { hataGoster(e.status ? hataMetni(e) : e.message); return false; })
      .finally(() => { if (btn) btn.disabled = false; });
  }

  async function anaEkranaEkle() {
    if (!yuklemeIstegi) { tost('Chrome\'da ⋮ menüsünden "Ana ekrana ekle"yi seç'); return; }
    const istek = yuklemeIstegi;
    istek.prompt();
    try { await istek.userChoice; } catch (e) { /* vazgeçti */ }
    yuklemeIstegi = null;
    ciz();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-ac]');
    if (!t) return;
    if (t.dataset.ac === 'ayar') { e.preventDefault(); ayarAc(); }
    else if (t.dataset.ac === 'kapat') { e.preventDefault(); kapatAc(); }
    else if (t.dataset.kapatAyrinti) { e.preventDefault(); kapatAc(t.dataset.kapatAyrinti); }
    else if (t.dataset.hizli) {
      e.preventDefault();
      if (!durum.anahtar) { ayarAc(); return; }
      let k = null;
      islemle(t, async () => { k = await hizliKaydet(t.dataset.hizli, t.dataset.tarih); return !!k; }).then(ok => {
        if (!ok || !k) return;
        const kalan = kapanisEksikleri(new Date()).eksik.length;
        tost(GIRDI_ADI[k.tur] + ': ' + girdiOzeti(k) + (kalan ? '' : ' · girdiler tamam'), false,
          { ad: 'Geri al', fn: () => islemle(null, async () => { await kayitSil(k); return true; }, 'Geri alındı') });
      });
    }
    else if (t.dataset.ac === 'gorev') { e.preventDefault(); if (!durum.anahtar) { ayarAc(); return; } $('#gorevForm').reset(); pencereAc('gorevDialog'); }
    else if (t.dataset.ac === 'ekle') { e.preventDefault(); ekleAc(); }
    else if (t.dataset.ac === 'yenile') { e.preventDefault(); esitle(false); }
    else if (t.dataset.ac === 'yukle') { e.preventDefault(); anaEkranaEkle(); }
    else if (t.dataset.ac === 'qr-oku') {
      e.preventDefault(); ayarAc();
      const q = $('#qrOku');
      if (q && !q.hidden) q.click();
    }
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
    $('#saat').textContent = L.kisaTarih(d) + ', ' + L.saatYazi(d);
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
    kayitEkle, kayitlarEkle, kayitSil, metin, jsonOku, projeler, gorevler, kayitlar, iskelet, havuz, ciz, esitle, b64Yap, b64Coz, gorevSatiri, bosDurum, takvimGunu,
    anlik, sureMetni, ikon, kutucukHtml,
    SAHIP, DEPO, DAL,
    gorunum(ad, fn, sekme) { ekGorunumler[ad] = { fn, sekme: sekme || ad }; },
    kart(yer, fn) { (kartUreticiler[yer] = kartUreticiler[yer] || []).push(fn); },
    kutucuk(sira, fn) { kutucukUreticiler.push({ sira, fn }); },
    panel(p) { PANELLER.push(p); },
    acilis(anahtar, fn) { acilisIstekleri.push([anahtar, fn]); },
    sonra(fn) { cizimSonrasi.push(fn); },
  };
  (window.DuzenModuller || []).forEach(m => { try { m(MODUL_API); } catch (e) { console.error(e); } });

  // Kısayollardan ve takvim hatırlatmasından gelen istek: ?kapat, ?odak, ?ekle=okuma, ?gorev; modüllerinki (?album, ?film)
  async function acilisIstegi(ilkEsitleme) {
    const q = new URLSearchParams(location.search);
    if (!Array.from(q.keys()).length) return;
    history.replaceState(null, '', location.pathname + (location.hash || '#bugun'));
    if (!durum.anahtar) return;
    if (!veriVar()) await ilkEsitleme;   // cihazdaki kopya yoksa ilk eşitlemeyi bekle
    if (q.has('kapat')) {
      if (!kapanisEksikleri(new Date()).eksik.length) { location.hash = '#bugun'; tost('Bugünün girdileri tamam'); return; }
      vurguKapat = true;
      setTimeout(() => { vurguKapat = false; }, 60000);
      location.hash = '#bugun';
      ciz();
      const kart = document.getElementById('gunuKapat');
      if (kart) kart.scrollIntoView({ block: 'center' });
    }
    else if (q.has('odak')) location.hash = '#odak';
    else if (q.get('ekle')) ekleAc(q.get('ekle'));
    else if (q.has('gorev')) { $('#gorevForm').reset(); pencereAc('gorevDialog'); }
    else {
      const h = acilisIstekleri.find(([k]) => q.has(k));
      if (h) h[1](q.get(h[0]));
    }
  }

  ciz();
  havaGetir();
  const ilkEsitleme = durum.anahtar ? esitle(true) : Promise.resolve();
  acilisIstegi(ilkEsitleme);
})();
