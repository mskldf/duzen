/* Saatler: saat listesi dokümanı (saat/saatler.json) görsel olarak; durum takibi saat/takip.json'da, kutu saat/kutu.json'da. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const LISTE_ADI = { ortak: 'Ortak', flip: 'Flip', benim: 'Benim' };
  const DURUMLAR = [
    ['izliyorum', 'İzliyorum'], ['ariyorum', 'Arıyorum'], ['teklif', 'Teklif'], ['alindi', 'Alındı'],
    ['satista', 'Satışta'], ['satildi', 'Satıldı'], ['elendi', 'Elendi'],
  ];
  const FIYATLI = ['teklif', 'alindi', 'satista', 'satildi'];
  const durumAdi = k => (DURUMLAR.find(d => d[0] === k) || [k, k])[1];
  const SEKMELER = [['vitrin', 'Vitrin'], ['fiyat', 'Fiyat haritası'], ['flip', 'Flip marjı'], ['takip', 'Takip'], ['kutu', 'Kutu']];
  const nf = new Intl.NumberFormat('tr-TR');
  const dolar = v => nf.format(Math.round(v)) + ' $';

  const veri = () => D.jsonOku('saat/saatler.json');
  const takip = () => (D.jsonOku('saat/takip.json') || {}).saatler || {};
  const kutu = () => D.jsonOku('saat/kutu.json');
  const durumu = id => (takip()[id] || {}).durum || 'izliyorum';

  function suzgec() { return Object.assign({ liste: 'benim', mm: 'hepsi', sira: 'fiyat' }, D.sakla.al('saatSuzgec', {})); }
  function uygun(s, f) {
    if (f.liste === 'benim' && s.liste === 'flip') return false;
    if (f.liste === 'flip' && s.liste === 'benim') return false;
    if (f.mm !== 'hepsi' && !(s.mm && s.mm <= Number(f.mm))) return false;
    return true;
  }

  // ---------- simgeler (genel kasa biçimleri; marka tasarımı değil) ----------
  function kasaSimgesi(kasa) {
    const kayis = '<rect x="15" y="1" width="10" height="9" rx="2"/><rect x="15" y="42" width="10" height="9" rx="2"/>';
    const govde = {
      yuvarlak: '<circle cx="20" cy="26" r="13"/>',
      dikdortgen: '<rect x="11" y="9" width="18" height="34" rx="3"/>',
      kare: '<rect x="8" y="14" width="24" height="24" rx="6"/>',
      yastik: '<rect x="7" y="13" width="26" height="26" rx="9"/>',
    }[kasa] || '<circle cx="20" cy="26" r="13"/>';
    return '<svg class="kasa" viewBox="0 0 40 52" aria-hidden="true">' + kayis + govde + '<path d="M20 26 L15 21 M20 26 L27 22"/></svg>';
  }

  // Log ölçek: 10 $ – 30.000 $
  const LOG_ALT = 1, LOG_UST = Math.log10(30000);
  const xLog = v => Math.max(0, Math.min(100, (Math.log10(Math.max(v, 10)) - LOG_ALT) / (LOG_UST - LOG_ALT) * 100));

  function fiyatSeridi(s) {
    if (!s.fiyat_usd) return '<div class="seridi bos-seridi"><span>fiyat yok</span></div>';
    const [a, b] = s.fiyat_usd;
    const sol = xLog(a), sag = xLog(b);
    return '<div class="seridi" role="img" aria-label="' + esc(dolar(a) + (b !== a ? '–' + dolar(b) : '')) + '">' +
      '<i class="seridi-bin" style="left:' + xLog(1000).toFixed(2) + '%"></i>' +
      (b > a ? '<b class="aralik l-' + s.liste + '" style="left:' + sol.toFixed(2) + '%;width:' + Math.max(1.2, sag - sol).toFixed(2) + '%"></b>'
        : '<b class="nokta l-' + s.liste + '" style="left:' + sol.toFixed(2) + '%"></b>') + '</div>';
  }

  function durumSecimi(s) {
    const d = durumu(s.id);
    return '<label class="durum-sec">Durum <select data-saat-durum="' + esc(s.id) + '">' +
      DURUMLAR.map(([k, v]) => '<option value="' + k + '"' + (k === d ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>';
  }

  function kart(s) {
    const d = durumu(s.id);
    const refler = (s.refler || []).map(r => '<span class="ref" title="' + esc(r.not || '') + '">' + esc(r.ref) + (r.not ? '<small> ' + esc(r.not) + '</small>' : '') + '</span>').join('');
    const ek = [s.mm ? String(s.mm).replace('.', ',') + ' mm' : '', s.mekanizma || ''].filter(Boolean).join(' · ');
    const son = (takip()[s.id] || {}).gecmis || [];
    const sonOlay = son.length ? son[son.length - 1] : null;
    return '<article class="saat-kart' + (d === 'elendi' ? ' elendi' : '') + '" id="saat-' + esc(s.id) + '">' +
      '<div class="saat-ust">' + kasaSimgesi(s.kasa) + '<div class="saat-ad"><span class="saat-marka">' + esc(s.marka) + '</span>' +
      '<span class="saat-model">' + esc(s.model) + '</span></div>' +
      '<span class="liste-rozet l-' + s.liste + '">' + LISTE_ADI[s.liste] + '</span></div>' +
      (ek ? '<p class="saat-ek">' + esc(ek) + (s.grup ? ' · ' + esc(s.grup) : '') + '</p>' : (s.grup ? '<p class="saat-ek">' + esc(s.grup) + '</p>' : '')) +
      fiyatSeridi(s) +
      '<p class="saat-fiyat">' + esc(s.fiyat_metin) + '</p>' +
      (refler ? '<div class="refler">' + refler + '</div>' : '') +
      (s.not ? '<p class="saat-not">' + esc(s.not) + '</p>' : '') +
      (s.karistirma ? '<p class="saat-not uyari">Karıştırma: ' + esc(s.karistirma) + '</p>' : '') +
      '<div class="saat-alt">' + durumSecimi(s) +
      (sonOlay && sonOlay.fiyat ? '<span class="saat-son">' + esc(durumAdi(sonOlay.durum)) + ': ' + esc(nf.format(sonOlay.fiyat) + ' ' + (sonOlay.para || '')) + '</span>' : '') +
      ((s.kaynaklar || []).length ? '<details class="kaynaklar"><summary>Kaynak (' + s.kaynaklar.length + ')</summary>' +
        s.kaynaklar.map(k => '<a href="' + esc(k.url) + '" target="_blank" rel="noopener">' + esc(k.ad) + '</a>').join('') + '</details>' : '') +
      '</div></article>';
  }

  // ---------- görünümler ----------
  function lejant() {
    return '<div class="lejant">' + ['ortak', 'flip', 'benim'].map(l => '<span><i class="l-' + l + '"></i>' + LISTE_ADI[l] + '</span>').join('') + '</div>';
  }

  function vitrin(liste, f) {
    const sirali = liste.slice().sort(f.sira === 'marka'
      ? (a, b) => a.marka.localeCompare(b.marka, 'tr') || a.model.localeCompare(b.model, 'tr')
      : (a, b) => ((a.fiyat_usd || [1e9])[0] - (b.fiyat_usd || [1e9])[0]));
    return '<div class="saat-izgara">' + sirali.map(kart).join('') + '</div>';
  }

  function fiyatHaritasi(liste) {
    const sirali = liste.slice().sort((a, b) => ((a.fiyat_usd || [1e9])[0] - (b.fiyat_usd || [1e9])[0]));
    const isaret = [100, 1000, 10000];
    const eksen = '<div class="harita-eksen"><span class="harita-bos"></span><div class="harita-cubuk">' +
      isaret.map(v => '<span style="left:' + xLog(v).toFixed(2) + '%">' + dolar(v) + '</span>').join('') + '</div></div>';
    const satirlar = sirali.map(s => '<div class="harita-satir" title="' + esc(s.marka + ' ' + s.model + ': ' + s.fiyat_metin) + '">' +
      '<a class="harita-ad" href="#saatler/vitrin" data-saat-git="' + esc(s.id) + '">' + esc(s.marka) + ' <b>' + esc(s.model) + '</b></a>' +
      '<div class="harita-cubuk">' + isaret.map(v => '<i class="izgara' + (v === 1000 ? ' bin' : '') + '" style="left:' + xLog(v).toFixed(2) + '%"></i>').join('') +
      (s.fiyat_usd ? (s.fiyat_usd[1] > s.fiyat_usd[0]
        ? '<b class="aralik l-' + s.liste + '" style="left:' + xLog(s.fiyat_usd[0]).toFixed(2) + '%;width:' + Math.max(0.8, xLog(s.fiyat_usd[1]) - xLog(s.fiyat_usd[0])).toFixed(2) + '%"></b>'
        : '<b class="nokta l-' + s.liste + '" style="left:' + xLog(s.fiyat_usd[0]).toFixed(2) + '%"></b>') : '<span class="harita-yok">fiyat yok</span>') +
      '</div></div>').join('');
    return '<p class="not">Dolar, logaritmik eksen. Dikey çizgi 1.000 $ bandı. Aralık, dokümandaki en düşük ve en yüksek fiyat; £, € ve ¥ dokümandaki kurla çevrildi.</p>' +
      lejant() + '<div class="harita">' + eksen + satirlar + '</div>';
  }

  function flipMarji(liste) {
    // Verisi zayıf olanlar en sonda; kalanlar brüt farka göre büyükten küçüğe
    const fark = s => s.marj.satis_usd[0] - s.marj.alis_usd[0];
    const marjli = liste.filter(s => s.marj).sort((a, b) => (a.marj.zayif - b.marj.zayif) || (fark(b) - fark(a)));
    if (!marjli.length) return '<p class="not">Bu süzgeçte marj verisi olan saat yok.</p>';
    const UST = 5500;
    const x = v => (v / UST * 100).toFixed(2);
    const isaret = [0, 1000, 2000, 3000, 4000, 5000];
    const satir = s => {
      const m = s.marj;
      const [a1, a2] = m.alis_usd, [s1, s2] = m.satis_usd;
      return '<div class="harita-satir marj' + (m.zayif ? ' zayif' : '') + '" title="' + esc('Alış: ' + m.alis_metin + ' · Satış: ' + m.satis_metin + (m.hesap ? ' · ' + m.hesap : '')) + '">' +
        '<a class="harita-ad" href="#saatler/vitrin" data-saat-git="' + esc(s.id) + '">' + esc(s.marka) + ' <b>' + esc(s.model) + '</b></a>' +
        '<div class="harita-cubuk">' + isaret.map(v => '<i class="izgara" style="left:' + x(v) + '%"></i>').join('') +
        '<i class="bag" style="left:' + x(a2) + '%;width:' + Math.max(0, (s1 - a2) / UST * 100).toFixed(2) + '%"></i>' +
        (a2 > a1 ? '<b class="alis-aralik" style="left:' + x(a1) + '%;width:' + ((a2 - a1) / UST * 100).toFixed(2) + '%"></b>' : '') +
        '<b class="alis" style="left:' + x(a1) + '%"></b>' +
        (s2 > s1 ? '<b class="satis-aralik" style="left:' + x(s1) + '%;width:' + ((s2 - s1) / UST * 100).toFixed(2) + '%"></b>' : '<b class="satis" style="left:' + x(s1) + '%"></b>') +
        '</div><span class="marj-fark">' + esc(m.fark_metin) + '</span></div>';
    };
    return '<p class="not">Marj tablosundaki iyi alış fiyatı (halka) ile satış referansı (dolu; aralıksa çubuk). Büyükten küçüğe brüt fark; servis, komisyon ve kargo hariç. Satış tarafı global veri, Türkiye bandını ilan defteri gösterecek. Soluk olanların verisi zayıf.</p>' +
      '<div class="lejant"><span><i class="alis-lejant"></i>Alış</span><span><i class="satis-lejant"></i>Satış referansı</span></div>' +
      '<div class="harita marj-harita"><div class="harita-eksen"><span class="harita-bos"></span><div class="harita-cubuk">' +
      isaret.map(v => '<span style="left:' + x(v) + '%">' + (v ? nf.format(v / 1000) + 'k $' : '0') + '</span>').join('') + '</div><span class="marj-fark"></span></div>' +
      marjli.map(satir).join('') + '</div>';
  }

  function takipGorunumu(tum) {
    const t = takip();
    const gruplar = DURUMLAR.filter(([k]) => k !== 'izliyorum').map(([k, ad]) => ({ k, ad, s: tum.filter(s => durumu(s.id) === k) }));
    const izlenen = tum.filter(s => durumu(s.id) === 'izliyorum').length;
    const olaylar = Object.entries(t).flatMap(([id, x]) => (x.gecmis || []).map(o => Object.assign({ id }, o)))
      .sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 20);
    const ad = id => { const s = tum.find(x => x.id === id); return s ? s.marka + ' ' + s.model : id; };
    return '<div class="takip-seridi">' + gruplar.map(g => '<div class="takip-kutu"><span class="takip-sayi">' + g.s.length + '</span><span>' + g.ad + '</span></div>').join('') + '</div>' +
      '<p class="not">Diğer ' + izlenen + ' model "İzliyorum" durumunda. Durumu Vitrin\'deki kartlardan değiştir.</p>' +
      gruplar.filter(g => g.s.length).map(g => '<section><h2>' + g.ad + '</h2><div class="saat-izgara">' + g.s.map(kart).join('') + '</div></section>').join('') +
      (olaylar.length ? '<section><h2>Geçmiş</h2><ul class="liste">' + olaylar.map(o => '<li class="girdi"><span class="sayi">' + esc(o.t) + '</span> ' + esc(ad(o.id)) + ': ' +
        esc(durumAdi(o.durum)) + (o.fiyat ? ', ' + esc(nf.format(o.fiyat) + ' ' + (o.para || '')) : '') + (o.not ? ' · ' + esc(o.not) : '') + '</li>').join('') + '</ul></section>' : '');
  }

  function kutuGorunumu() {
    const k = kutu();
    if (!k || !(k.saatler || []).length) return '<p class="not">Elindeki saatlerin listesi onaylanınca burada görünecek.</p>';
    return '<div class="kutu">' + k.saatler.map(s => '<div class="kutu-yuva">' + kasaSimgesi(s.kasa || 'yuvarlak') +
      '<span class="kutu-ad">' + esc(s.ad) + '</span>' + (s.not ? '<small>' + esc(s.not) + '</small>' : '') + '</div>').join('') + '</div>';
  }

  function gorunum(arg) {
    const v = veri();
    if (!v) return D.bosDurum('Saat listesi yok', 'Eşitlemeden sonra tekrar bak.');
    const sekme = SEKMELER.some(s => s[0] === arg) ? arg : 'vitrin';
    const f = suzgec();
    const tum = v.saatler || [];
    const liste = tum.filter(s => uygun(s, f));
    const sec = (ad, secenekler, deger) => '<label class="alan satir-ici-alan">' + ad + '<select data-saat-suz="' + ad.toLowerCase() + '">' +
      secenekler.map(([k, e]) => '<option value="' + k + '"' + (String(deger) === String(k) ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></label>';
    const suzgecler = sekme === 'kutu' || sekme === 'takip' ? '' : '<div class="suzgec-satiri">' +
      sec('Liste', [['benim', 'Benim listem'], ['flip', 'Flip listesi'], ['hepsi', 'Hepsi']], f.liste) +
      sec('Boyut', [['hepsi', 'Hepsi'], ['36', '36 mm\'ye kadar'], ['38', '38 mm\'ye kadar'], ['40', '40 mm\'ye kadar']], f.mm) +
      (sekme === 'vitrin' ? sec('Sıra', [['fiyat', 'Fiyat'], ['marka', 'Marka']], f.sira) : '') +
      '<span class="not">' + liste.length + ' model' + (f.mm !== 'hepsi' ? ' (boyutu bilinmeyenler gizli)' : '') + '</span></div>';
    const govde = { vitrin: () => vitrin(liste, f), fiyat: () => fiyatHaritasi(liste), flip: () => flipMarji(liste), takip: () => takipGorunumu(tum), kutu: kutuGorunumu }[sekme]();
    return '<article class="saatler">' +
      '<header class="bolum-bas"><h1>Saatler</h1><span class="not">' + esc(v.kaynak || '') + '</span></header>' +
      '<nav class="alt-sekmeler">' + SEKMELER.map(([k, ad]) => '<a href="#saatler/' + k + '"' + (k === sekme ? ' aria-current="page"' : '') + '>' + ad + '</a>').join('') + '</nav>' +
      suzgecler + govde +
      (sekme === 'vitrin' ? '<details class="saat-notlar"><summary>Listenin notları</summary><ul>' + (v.notlar || []).map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></details>' : '') +
      '</article>';
  }

  D.gorunum('saatler', gorunum, 'daha');
  D.panel({ ad: 'Saatler', ac: 'Saatleri aç', href: '#saatler', proje: 'saat-arsivi', ikon: 'saat', aciklama: 'Liste, fiyat haritası, flip marjı, takip, kutu', sira: 40 });

  // ---------- durum değişikliği ----------
  function pencere() {
    let d = document.getElementById('saatDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'saatDialog';
    d.innerHTML = '<form id="saatForm" method="dialog"><h2 id="saat-baslik">Durum</h2><p class="not" id="saat-alt"></p><div id="saat-alanlar"></div>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt"><button type="button" class="metin-dugme" data-saat-vazgec>Vazgeç</button>' +
      '<button type="submit" class="dugme">Kaydet</button></div></form>';
    document.body.appendChild(d);
    d.querySelector('[data-saat-vazgec]').addEventListener('click', () => { d.close(); D.ciz(); });
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = new FormData(e.target);
      D.islemle(e.submitter || d.querySelector('[type=submit]'), () => durumYaz(String(v.get('id')), String(v.get('durum')), {
        fiyat: v.get('fiyat') ? Number(v.get('fiyat')) : null, para: String(v.get('para') || ''), not: String(v.get('not') || '').trim(),
      }), 'Kaydedildi').then(ok => { if (ok) d.close(); });
    });
    return d;
  }

  async function durumYaz(id, durum, ek) {
    const bugun = L.isoTarih(new Date());
    await D.degistirVeYaz('saat/takip.json', eski => {
      const v = eski ? JSON.parse(eski) : { saatler: {} };
      v.saatler = v.saatler || {};
      const x = v.saatler[id] = v.saatler[id] || { durum: 'izliyorum', gecmis: [] };
      x.durum = durum;
      const olay = { t: bugun, durum };
      if (ek.fiyat) { olay.fiyat = ek.fiyat; olay.para = ek.para || '$'; }
      if (ek.not) olay.not = ek.not;
      x.gecmis = (x.gecmis || []).concat(olay);
      v.guncelleme = bugun;
      return JSON.stringify(v, null, 1) + '\n';
    }, 'Saat: ' + id + ' ' + durum);
    return true;
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.saatSuz) {
      const f = suzgec();
      f[{ liste: 'liste', boyut: 'mm', 'sıra': 'sira' }[t.dataset.saatSuz]] = t.value;
      D.sakla.koy('saatSuzgec', f);
      D.ciz();
      return;
    }
    if (!t.dataset.saatDurum) return;
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); D.ciz(); return; }
    const s = (veri().saatler || []).find(x => x.id === t.dataset.saatDurum);
    const d = pencere();
    d.querySelector('#saat-baslik').textContent = durumAdi(t.value);
    d.querySelector('#saat-alt').textContent = s ? s.marka + ' ' + s.model : '';
    d.querySelector('#saat-alanlar').innerHTML = '<input type="hidden" name="id" value="' + esc(t.dataset.saatDurum) + '"><input type="hidden" name="durum" value="' + esc(t.value) + '">' +
      (FIYATLI.includes(t.value) ? '<div class="iki-alan"><label class="alan">Fiyat<input name="fiyat" type="number" inputmode="decimal" min="0" step="any"></label>' +
        '<label class="alan">Para birimi<select name="para"><option>$</option><option>€</option><option>£</option><option>TL</option><option>¥</option></select></label></div>' : '') +
      '<label class="alan">Not (isteğe bağlı)<input name="not" type="text"></label>';
    D.pencereAc('saatDialog');
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-saat-git]');
    if (!t) return;
    e.preventDefault();
    location.hash = '#saatler/vitrin';
    setTimeout(() => { const k = document.getElementById('saat-' + t.dataset.saatGit); if (k) { k.scrollIntoView({ block: 'center' }); k.classList.add('vurgulu'); } }, 60);
  });
});
