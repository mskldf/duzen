/* Gelen kutusu: telefonda Paylaş → Düzen ile gelen link, metin ve fotoğraflar; elle yazılan kısa notlar.
   Paylaşılan şey önce cihazda bekler (servis çalışanı saklar), Emir "Gelen kutusuna ekle" deyince depoya yazılır.
   Claude Pazar değerlendirmesinde ya da "gelen kutusunu işle" deyince her öğeyi yerine taşır ve işlendi diye işaretler. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const PAYLASIM = 'duzen-paylasim', FOTO_ONBELLEK = 'duzen-foto-1';
  const YERLER = [
    ['saatler', 'Saatler'], ['ilan', 'İlan defteri'], ['fiyat', 'Fiyat takibi'], ['proje', 'Proje notu'], ['is', 'İş'], ['diger', 'Diğer'],
  ];
  const yerAdi = k => (YERLER.find(y => y[0] === k) || [k, k])[1];
  let bekleyenler = [];      // cihazda bekleyen paylaşımlar
  const fotoUrl = {};        // depo yolu -> nesne adresi

  // ---------- cihazda bekleyen paylaşımlar ----------
  async function bekleyenleriOku() {
    try {
      const c = await caches.open(PAYLASIM);
      const anahtarlar = (await c.keys()).map(r => new URL(r.url).pathname).filter(p => /\/paylasim\/[^/]+\/meta$/.test(p));
      const liste = [];
      for (const p of anahtarlar) {
        const r = await c.match(p);
        if (r) liste.push(await r.json());
      }
      bekleyenler = liste.sort((a, b) => String(a.t).localeCompare(String(b.t)));
    } catch (e) { bekleyenler = []; }
    return bekleyenler;
  }
  async function bekleyenSil(id) {
    const c = await caches.open(PAYLASIM);
    for (const r of await c.keys()) if (new URL(r.url).pathname.includes('/paylasim/' + id + '/')) await c.delete(r);
    await bekleyenleriOku();
  }
  async function bekleyenDosya(m, i) {
    const c = await caches.open(PAYLASIM);
    const r = await c.match(m.dosyalar[i].yol);
    return r ? r.blob() : null;
  }

  // ---------- depodaki gelen kutusu ----------
  function ogeler() {
    return Object.keys(D.durum.dosyalar).filter(y => /^gelen\/\d{4}-\d{2}\.jsonl$/.test(y)).sort()
      .flatMap(y => L.jsonlOku(D.metin(y)).map(o => Object.assign({ _yol: y }, o)));
  }
  const islenmemis = () => ogeler().filter(o => !o.islendi);

  // Fotoğrafı küçültüp JPEG yapar (en uzun kenar 1600 px)
  async function kucult(blob) {
    const bmp = await createImageBitmap(blob);
    const oran = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * oran); cv.height = Math.round(bmp.height * oran);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
  }
  async function blobB64(blob) {
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function ogeEkle(o, foto) {
    const simdi = new Date();
    const id = L.isoTarih(simdi) + '-' + L.pad(simdi.getHours()) + L.pad(simdi.getMinutes()) + L.pad(simdi.getSeconds()) + '-' + Math.random().toString(36).slice(2, 5);
    const kayit = Object.assign({ id, t: L.isoTarih(simdi) + 'T' + L.saatYazi(simdi) }, o);
    if (foto) {
      const yol = 'gelen/foto/' + id + '.jpg';
      const kucuk = await kucult(foto);
      await D.gh(`/repos/${D.SAHIP}/${D.DEPO}/contents/${yol}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Gelen: fotoğraf', content: await blobB64(kucuk), branch: D.DAL }),
      });
      kayit.foto = yol;
      fotoUrl[yol] = URL.createObjectURL(kucuk);
    }
    for (const k of Object.keys(kayit)) if (kayit[k] === '' || kayit[k] == null) delete kayit[k];
    await D.degistirVeYaz('gelen/' + L.isoTarih(simdi).slice(0, 7) + '.jsonl',
      eski => (eski && !eski.endsWith('\n') ? eski + '\n' : eski) + JSON.stringify(kayit) + '\n',
      'Gelen: ' + (kayit.baslik || kayit.metin || kayit.url || 'fotoğraf').slice(0, 50));
  }

  async function ogeSil(o) {
    await D.degistirVeYaz(o._yol, eski => L.jsonlOku(eski).filter(x => x.id !== o.id).map(x => JSON.stringify(x)).join('\n') + '\n', 'Gelen: silindi');
    if (o.foto) {
      try {
        const r = await D.gh(`/repos/${D.SAHIP}/${D.DEPO}/contents/${o.foto}?ref=${D.DAL}`);
        await D.gh(`/repos/${D.SAHIP}/${D.DEPO}/contents/${o.foto}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Gelen: fotoğraf silindi', sha: r.sha, branch: D.DAL }) });
      } catch (e) { /* fotoğraf zaten yoksa geç */ }
    }
  }

  // Depodaki fotoğrafı göstermek için indirir (bir kez, sonra cihazda)
  async function fotoGetir(yol, img) {
    if (fotoUrl[yol]) { img.src = fotoUrl[yol]; return; }
    try {
      const c = await caches.open(FOTO_ONBELLEK);
      let r = await c.match(yol);
      if (!r) {
        const bilgi = await D.gh(`/repos/${D.SAHIP}/${D.DEPO}/contents/${yol}?ref=${D.DAL}`);
        const ham = await fetch(`https://api.github.com/repos/${D.SAHIP}/${D.DEPO}/git/blobs/${bilgi.sha}`,
          { headers: { Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer ' + D.durum.anahtar } });
        if (!ham.ok) return;
        await c.put(yol, new Response(await ham.blob(), { headers: { 'content-type': 'image/jpeg' } }));
        r = await c.match(yol);
      }
      fotoUrl[yol] = URL.createObjectURL(await r.blob());
      img.src = fotoUrl[yol];
    } catch (e) { /* fotoğrafsız devam */ }
  }

  // ---------- görünüm ----------
  function yerSecimi(ad, secili) {
    return '<div class="cipler yer-secimi" role="radiogroup" aria-label="Nereye">' + YERLER.map(([k, v]) =>
      '<label class="cip cip-radyo"><input type="radio" name="' + ad + '" value="' + k + '"' + (secili === k ? ' checked' : '') + '> ' + esc(v) + '</label>').join('') + '</div>';
  }

  function bekleyenKarti(m) {
    const foto = (m.dosyalar || []).length ? '<img class="gelen-foto" alt="Paylaşılan fotoğraf" data-bekleyen-foto="' + esc(m.id) + '">' : '';
    return '<form class="kart gelen-bekleyen" data-bekleyen="' + esc(m.id) + '">' +
      '<h2>Paylaşıldı</h2>' + foto +
      (m.baslik ? '<p class="gelen-baslik">' + esc(m.baslik) + '</p>' : '') +
      (m.metin ? '<p class="gelen-metin">' + esc(m.metin) + '</p>' : '') +
      (m.url ? '<p class="gelen-url"><a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.url) + '</a></p>' : '') +
      '<p class="not">Nereye?</p>' + yerSecimi('nereye-' + m.id, '') +
      '<label class="alan">Not (isteğe bağlı)<input name="not" type="text"></label>' +
      '<div class="dialog-alt"><button type="button" class="metin-dugme" data-bekleyen-sil="' + esc(m.id) + '">Sil</button>' +
      '<button type="submit" class="dugme">Gelen kutusuna ekle</button></div></form>';
  }

  function ogeSatiri(o) {
    const bag = o.url ? '<a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + esc(o.baslik || o.url) + '</a>' : esc(o.baslik || '');
    return '<li class="gelen-oge">' + (o.foto ? '<img class="gelen-kucuk" alt="" data-foto="' + esc(o.foto) + '">' : '') +
      '<div class="gelen-govde"><div class="satir-ust"><span class="satir-baslik">' + (bag || esc((o.metin || '').slice(0, 80))) + '</span>' +
      (o.nereye ? '<span class="rozet">' + esc(yerAdi(o.nereye)) + '</span>' : '') + '</div>' +
      (o.metin && bag ? '<small>' + esc(o.metin) + '</small>' : '') + (o.not ? '<small>Not: ' + esc(o.not) + '</small>' : '') +
      '<small class="sayi">' + esc(String(o.t || '').replace('T', ' ')) + (o.islendi ? ' · işlendi: ' + esc(o.islendi.nereye || '') : '') + '</small>' +
      (o.islendi ? '' : '<button type="button" class="metin-dugme" data-gelen-sil="' + esc(o.id) + '">Sil</button>') + '</div></li>';
  }

  function gorunum() {
    const acik = islenmemis();
    const biten = ogeler().filter(o => o.islendi).slice(-10).reverse();
    return '<article class="gelen">' +
      '<header class="bolum-bas"><h1>Gelen kutusu</h1></header>' +
      '<p class="not">Telefonda bir ilanı, linki ya da ekran görüntüsünü Paylaş → Düzen ile buraya at. Pazar günü ya da "gelen kutusunu işle" deyince Claude yerine taşır. İşle ilgili dosya ve yazışma paylaşma.</p>' +
      bekleyenler.map(bekleyenKarti).join('') +
      '<form class="kart" id="gelenNot"><h2>Not düş</h2>' +
      '<label class="alan">Aklındaki<textarea name="metin" rows="2"></textarea></label>' +
      '<label class="alan">Link (isteğe bağlı)<input name="url" type="url" inputmode="url"></label>' +
      '<p class="not">Nereye?</p>' + yerSecimi('nereye', '') +
      '<div class="dialog-alt"><button type="submit" class="dugme">Ekle</button></div></form>' +
      '<section><h2>Bekleyenler (' + acik.length + ')</h2>' + (acik.length ? '<ul class="liste">' + acik.slice().reverse().map(ogeSatiri).join('') + '</ul>' : '<p class="not">Boş.</p>') + '</section>' +
      (biten.length ? '<section><h2>Son işlenenler</h2><ul class="liste soluk">' + biten.map(ogeSatiri).join('') + '</ul></section>' : '') +
      '</article>';
  }

  D.gorunum('gelen', gorunum, 'daha');
  D.panel({ ad: 'Gelen kutusu', href: '#gelen', ikon: 'gelen', aciklama: 'Telefondan paylaştıkların, kısa notlar', sira: 50 });
  D.kart('bugun-ust', () => {
    const n = islenmemis().length, b = bekleyenler.length;
    if (!n && !b) return '';
    return '<p class="gelen-bildirim"><a href="#gelen">' + (b ? b + ' paylaşım eklenmeyi bekliyor' : 'Gelen kutusunda ' + n + ' öğe') + '</a></p>';
  });
  D.sonra(function (sayfa, arg, ana) {
    if (sayfa !== 'gelen') return;
    ana.querySelectorAll('img[data-foto]').forEach(img => fotoGetir(img.dataset.foto, img));
    ana.querySelectorAll('img[data-bekleyen-foto]').forEach(async img => {
      const m = bekleyenler.find(x => x.id === img.dataset.bekleyenFoto);
      const blob = m && await bekleyenDosya(m, 0);
      if (blob) img.src = URL.createObjectURL(blob);
    });
  });

  // ---------- olaylar ----------
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f.id === 'gelenNot') {
      e.preventDefault();
      const v = new FormData(f);
      const metin = String(v.get('metin') || '').trim(), url = String(v.get('url') || '').trim();
      if (!metin && !url) { D.tost('Bir şey yaz ya da link ekle', true); return; }
      D.islemle(f.querySelector('[type=submit]'), () => ogeEkle({ tur: url ? 'link' : 'metin', metin, url, nereye: v.get('nereye') || '' }), 'Gelen kutusuna eklendi');
    } else if (f.dataset.bekleyen) {
      e.preventDefault();
      const m = bekleyenler.find(x => x.id === f.dataset.bekleyen);
      if (!m) return;
      const v = new FormData(f);
      D.islemle(f.querySelector('[type=submit]'), async () => {
        const foto = (m.dosyalar || []).length ? await bekleyenDosya(m, 0) : null;
        await ogeEkle({ tur: foto ? 'foto' : (m.url ? 'link' : 'metin'), baslik: m.baslik, metin: m.metin, url: m.url,
          nereye: v.get('nereye-' + m.id) || '', not: String(v.get('not') || '').trim() }, foto);
        await bekleyenSil(m.id);
        return true;
      }, 'Gelen kutusuna eklendi');
    }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-bekleyen-sil], [data-gelen-sil]');
    if (!t) return;
    if (t.dataset.bekleyenSil) { bekleyenSil(t.dataset.bekleyenSil).then(() => D.ciz()); return; }
    const o = ogeler().find(x => x.id === t.dataset.gelenSil);
    if (o) D.islemle(t, () => ogeSil(o), 'Silindi');
  });

  // Paylaşımdan gelindiyse (#gelen/yeni/...) bekleyenleri oku ve göster
  bekleyenleriOku().then(() => D.ciz());
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#gelen')) bekleyenleriOku().then(() => D.ciz()); });
});
