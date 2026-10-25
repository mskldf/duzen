/* Odak modu: tablet masadayken tam ekran saat, şu anki blok, sayaç. Sayaç bitince süre koça yazılır. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const TURLER = [
    { tur: 'okuma', ad: 'Okuma' },
    { tur: 'atolye', ad: 'Atölye' },
    { tur: 'sabah_blogu', ad: 'Sabah bloğu' },
    { tur: 'serbest', ad: 'Serbest' },   // kaydedilmez, sadece süre tutar
  ];
  const sayac = () => D.sakla.al('sayac', null);
  const sayacYaz = v => (v ? D.sakla.koy('sayac', v) : D.sakla.sil('sayac'));
  const gecen = s => (s ? (s.birikim || 0) + (s.bas ? Date.now() - s.bas : 0) : 0);
  const iki = n => String(n).padStart(2, '0');
  function sureYazi(ms) {
    const sn = Math.floor(ms / 1000);
    return iki(Math.floor(sn / 3600)) + ':' + iki(Math.floor(sn / 60) % 60) + ':' + iki(sn % 60);
  }

  // Şu anki ve sıradaki iş uygulamanın ortak hesabından (iskelet + takvim + kalkış/ışık)
  const anlik = simdi => D.anlik(simdi);

  function gorunum() {
    const simdi = new Date();
    const s = sayac();
    const secim = TURLER.map(t => '<button type="button" class="cip' + (s && s.tur === t.tur ? ' secili' : '') + '" data-odak-tur="' + t.tur + '"' + (s ? ' disabled' : '') + '>' + esc(t.ad) + '</button>').join('');
    return '<section class="odak">' +
      '<div class="odak-ust"><a class="geri-odak" href="#bugun">‹ Çık</a>' +
      '<button type="button" class="metin-dugme" data-odak="tam">Tam ekran</button></div>' +
      '<div class="odak-saat-alani">' +
      '<p class="odak-saat sayi" id="odakSaat">' + L.saatYazi(simdi) + '</p>' +
      '<p class="odak-tarih">' + esc(L.tarihYazi(simdi)) + '</p>' +
      '</div>' +
      '<div class="odak-yan">' +
      '<div class="odak-blok" id="odakBlok"></div>' +
      '<div class="odak-sayac">' +
      '<h2>Sayaç</h2>' +
      '<div class="cipler" role="group" aria-label="Ne yapıyorsun">' + secim + '</div>' +
      '<p class="odak-sure sayi" id="odakSure">' + sureYazi(gecen(s)) + '</p>' +
      '<div class="odak-dugmeler" id="odakDugmeler"></div>' +
      '</div></div></section>';
  }

  function blokCiz() {
    const yer = document.getElementById('odakBlok');
    if (!yer) return;
    const simdi = new Date();
    const a = anlik(simdi);
    let html = '';
    if (a.su) {
      const oran = Math.min(1, Math.max(0, (a.dk - a.su.bas) / Math.max(1, a.su.bit - a.su.bas)));
      html += '<h2>Şu an</h2><p class="odak-is">' + esc(a.su.ad) + '</p>' +
        '<div class="cubuk odak-cubuk" role="img" aria-label="Bloğun yüzde ' + Math.round(oran * 100) + ' geçti"><div class="cubuk-dolu" style="width:' + (oran * 100).toFixed(1) + '%"></div></div>' +
        '<p class="not sayi">' + esc(a.su.saat) + ' · ' + (a.su.bit - a.dk) + ' dk kaldı</p>';
    } else {
      html += '<h2>Şu an</h2><p class="odak-is soluk-yazi">Planda blok yok</p>';
    }
    if (a.sonraki) html += '<p class="odak-sonraki"><span>Sıradaki</span> <b class="sayi">' + esc(a.sonraki.saat.split('-')[0]) + '</b> ' + esc(a.sonraki.ad) + '</p>';
    if (a.isik != null && simdi.getHours() >= 18 && a.isik > a.dk) html += '<p class="odak-isik">Işığa <b class="sayi">' + (a.isik - a.dk) + '</b> dk</p>';
    yer.innerHTML = html;
  }

  function dugmeCiz() {
    const yer = document.getElementById('odakDugmeler');
    if (!yer) return;
    const s = sayac();
    if (!s) { yer.innerHTML = '<p class="not">Ne yaptığını seç, sayaç başlasın.</p>'; return; }
    yer.innerHTML = (s.bas ? '<button type="button" class="dugme ikincil" data-odak="durdur">Duraklat</button>' : '<button type="button" class="dugme ikincil" data-odak="devam">Devam</button>') +
      '<button type="button" class="dugme" data-odak="bitir">Bitir</button>' +
      '<button type="button" class="metin-dugme" data-odak="iptal">Sıfırla</button>';
  }

  // ---------- kayıt penceresi ----------
  function pencere() {
    let d = document.getElementById('odakDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'odakDialog';
    d.setAttribute('aria-labelledby', 'odak-baslik');
    d.innerHTML = '<form id="odakForm" method="dialog"><h2 id="odak-baslik">Kaydet</h2><div id="odak-alanlar"></div>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt">' +
      '<button type="button" class="metin-dugme" data-kapat="odakDialog">Vazgeç</button><button type="submit" class="dugme">Koça yaz</button></div></form>';
    document.body.appendChild(d);
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const btn = e.submitter || d.querySelector('button[type=submit]');
      D.islemle(btn, () => kaydet(new FormData(e.target)), 'Koça yazıldı').then(ok => { if (ok) { d.close(); sayacYaz(null); D.ciz(); } });
    });
    return d;
  }

  function bitir() {
    const s = sayac();
    if (!s) return;
    const dk = Math.round(gecen(s) / 60000);
    if (s.tur === 'serbest') { sayacYaz(null); D.tost(dk + ' dk'); D.ciz(); return; }
    if (!D.durum.anahtar) { D.tost('Kaydetmek için anahtar gerekli', true); return; }
    const d = pencere();
    let alan = '<input type="hidden" name="tur" value="' + esc(s.tur) + '">' +
      '<label class="alan">Dakika<input name="dk" type="number" inputmode="numeric" min="0" value="' + dk + '"></label>';
    if (s.tur === 'okuma') {
      alan += '<label class="alan">Kitap<input name="kitap" type="text" value="' + esc(D.sakla.al('sonKitap', '')) + '"></label>' +
        '<label class="alan">Sayfa<input name="sayfa" type="number" inputmode="numeric" min="0"></label>';
    } else if (s.tur === 'atolye') {
      const pler = D.projeler().filter(p => /Atölye/.test(p.meta.kulvar || '') && p.meta.durum !== 'bitti');
      alan += '<label class="alan">Proje<select name="proje">' + pler.map(p => '<option value="' + esc(p.slug) + '">' + esc(p.meta.baslik) + '</option>').join('') + '</select></label>' +
        '<label class="alan">Ne yapıldı<input name="not" type="text"></label>';
    } else if (s.tur === 'sabah_blogu') {
      alan += '<label class="alan">Konu<input name="konu" type="text"></label>';
    }
    d.querySelector('#odak-baslik').textContent = (TURLER.find(t => t.tur === s.tur) || {}).ad + ' kaydı';
    d.querySelector('#odak-alanlar').innerHTML = alan;
    D.pencereAc('odakDialog');
  }

  async function kaydet(v) {
    const s = sayac();
    const tur = String(v.get('tur'));
    const k = { t: L.isoTarih(new Date(s && s.basladi ? s.basladi : Date.now())), tur, kaynak: 'uygulama' };
    const dk = Number(v.get('dk'));
    if (dk > 0) k.dk = dk;
    const metin = ad => String(v.get(ad) || '').trim();
    if (tur === 'okuma') {
      if (metin('kitap')) { k.kitap = metin('kitap'); D.sakla.koy('sonKitap', k.kitap); }
      if (metin('sayfa')) k.sayfa = Number(metin('sayfa'));
    } else if (tur === 'atolye') {
      if (metin('proje')) k.proje = metin('proje');
      if (metin('not')) k.not = metin('not');
    } else if (tur === 'sabah_blogu') {
      k.yapildi = true;
      if (metin('konu')) k.konu = metin('konu');
    }
    if (!k.dk) { D.hataGoster('Süre sıfır; kaydedilecek bir şey yok.'); return false; }
    await D.kayitEkle(k);
    return true;
  }

  // ---------- olaylar ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-odak], [data-odak-tur]');
    if (!t || t.disabled) return;
    if (t.dataset.odakTur) {
      sayacYaz({ tur: t.dataset.odakTur, bas: Date.now(), birikim: 0, basladi: Date.now() });
    } else if (t.dataset.odak === 'durdur') {
      const s = sayac(); sayacYaz(Object.assign(s, { birikim: gecen(s), bas: null }));
    } else if (t.dataset.odak === 'devam') {
      const s = sayac(); sayacYaz(Object.assign(s, { bas: Date.now() }));
    } else if (t.dataset.odak === 'bitir') {
      const s = sayac(); if (s && s.bas) sayacYaz(Object.assign(s, { birikim: gecen(s), bas: null }));
      bitir(); return;
    } else if (t.dataset.odak === 'iptal') {
      sayacYaz(null);
    } else if (t.dataset.odak === 'tam') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    D.ciz();
  });

  // ---------- ekran açık kalsın, saniye saniye güncelle ----------
  let zaman = null, kilit = null;
  async function kilitAl() {
    try { if ('wakeLock' in navigator && !kilit && document.visibilityState === 'visible') { kilit = await navigator.wakeLock.request('screen'); kilit.addEventListener('release', () => { kilit = null; }); } } catch (e) { kilit = null; }
  }
  function kilitBirak() { if (kilit) { kilit.release().catch(() => {}); kilit = null; } }
  document.addEventListener('visibilitychange', () => { if (location.hash.startsWith('#odak')) kilitAl(); });

  D.gorunum('odak', gorunum, 'daha');
  D.sonra(function (sayfa) {
    clearInterval(zaman);
    if (sayfa !== 'odak') { kilitBirak(); return; }
    kilitAl();
    blokCiz();
    dugmeCiz();
    let son = -1;
    zaman = setInterval(() => {
      const simdi = new Date();
      const s = document.getElementById('odakSure');
      if (!s) { clearInterval(zaman); return; }
      s.textContent = sureYazi(gecen(sayac()));
      document.getElementById('odakSaat').textContent = L.saatYazi(simdi);
      if (simdi.getMinutes() !== son) { son = simdi.getMinutes(); blokCiz(); }
    }, 1000);
  });
  // Bugün'de odak moduna giriş: geniş ekranda (tablet, bilgisayar) kutucuk
  D.kutucuk(70, () => {
    const s = sayac();
    return D.kutucukHtml({ href: '#odak', ikon: 'odak', etiket: 'Masa', ana: 'Odak modu', sinif: 'genis-ekran',
      alt: s ? 'Sayaç çalışıyor: ' + ((TURLER.find(t => t.tur === s.tur) || {}).ad || '') : 'Saat, şu anki blok, sayaç' });
  });
});
