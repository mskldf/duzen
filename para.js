/* Para: varlıklar (nakit, altın, gümüş, hisse, fon, kripto, diğer) ve borçlar; net değer ve geçmişi.
   Varlık ve borçları uygulama yazar (para/varliklar.json, para/borclar.json). Fiyatlar ve günlük geçmiş
   GitHub Actions'tan gelir (araclar/para_guncelle.py: para/fiyatlar.json, para/gecmis.jsonl). */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const L = D.L, esc = D.esc;
  const YOL_V = 'para/varliklar.json', YOL_B = 'para/borclar.json', YOL_F = 'para/fiyatlar.json', YOL_G = 'para/gecmis.jsonl';
  const varliklar = () => (D.jsonOku(YOL_V) || {}).varliklar || [];
  const borclar = () => (D.jsonOku(YOL_B) || {}).borclar || [];
  const fiyat = () => D.jsonOku(YOL_F);
  const gecmis = () => L.jsonlOku(D.metin(YOL_G) || '').filter(g => g && g.t).sort((a, b) => a.t.localeCompare(b.t));
  const gizli = () => !!D.sakla.al('paraGizli', false);
  const birimSecili = () => D.sakla.al('paraBirim', 'TRY');   // TRY | USD | XAU

  // ---------- biçim ----------
  const tamSayi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const ikiHane = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esnek = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
  const kucukFiyat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const birimFiyat = x => (Math.abs(x) < 10 ? kucukFiyat : ikiHane).format(x);   // fon payı gibi küçük fiyatlarda kuruş altı da
  const ayYil = s => { const m = /^(\d{4})-(\d{2})/.exec(s || ''); return m ? L.AY_ADLARI[Number(m[2]) - 1] + ' ' + m[1] : s; };
  const GIZ = '••••';
  const tl = x => (gizli() ? GIZ : (x === null || x === undefined ? '–' : tamSayi.format(Math.round(x)) + ' TL'));
  const BIRIM_ADI = { TRY: 'TL', USD: '$', XAU: 'Altın' };
  // TL tutarı seçili birime: dolar ya da gram has altın; çevrilemiyorsa null
  function cevir(x, birim, kurUsd, gramAltin) {
    if (x === null || x === undefined) return null;
    if (birim === 'USD') return kurUsd ? x / kurUsd : null;
    if (birim === 'XAU') return gramAltin ? x / gramAltin : null;
    return x;
  }
  function birimYazi(x, birim) {
    if (gizli()) return GIZ;
    if (x === null || x === undefined) return '–';
    if (birim === 'USD') return tamSayi.format(x) + ' $';
    if (birim === 'XAU') return ikiHane.format(x) + ' gr altın';
    return tamSayi.format(Math.round(x)) + ' TL';
  }
  // Eksen için kısa: 12.500 → 12,5 B; 1.250.000 → 1,25 Mn
  function kisaSayi(x) {
    const a = Math.abs(x);
    if (a >= 1e6) return (x / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Mn';
    if (a >= 1e3) return (x / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' B';
    return x.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  }
  const PARA_ADI = { TRY: 'TL', USD: 'Dolar', EUR: 'Euro', GBP: 'Sterlin' };
  const turAdi = t => (L.VARLIK_TURLERI.find(x => x[0] === t) || [t, t])[1];
  const borcTurAdi = t => (L.BORC_TURLERI.find(x => x[0] === t) || [t, t])[1];
  function varlikAdi(v) {
    if (v.ad) return v.ad;
    if (v.tur === 'nakit') return PARA_ADI[v.para || 'TRY'] || v.para;
    if (v.tur === 'altin') return (L.ALTIN_BIRIM[v.birim] || L.ALTIN_BIRIM.gram24).adi;
    if (v.tur === 'gumus') return (L.GUMUS_BIRIM[v.birim] || L.GUMUS_BIRIM.gram).adi;
    if (v.tur === 'hisse' || v.tur === 'kripto') return String(v.sembol || '').toUpperCase() || turAdi(v.tur);
    if (v.tur === 'fon') return String(v.kod || '').toUpperCase() || 'Fon';
    return 'Diğer';
  }
  function miktarYazi(v) {
    if (gizli()) return '';
    const m = esnek.format(Number(v.miktar) || 0);
    if (v.tur === 'nakit') return (v.para || 'TRY') === 'TRY' ? '' : m + ' ' + (L.PARA_BIRIMLERI[v.para] || v.para);
    if (v.tur === 'altin' || v.tur === 'gumus') {
      const tablo = v.tur === 'altin' ? L.ALTIN_BIRIM : L.GUMUS_BIRIM;
      const b = tablo[v.birim] || tablo[v.tur === 'altin' ? 'gram24' : 'gram'];
      const has = L.hasGram(v);
      return m + ' ' + b.olcu + (b.has !== 1 ? ' · ' + ikiHane.format(has) + ' gr has' : '');
    }
    if (v.tur === 'hisse') return m + ' adet';
    if (v.tur === 'fon') return m + ' pay';
    if (v.tur === 'kripto') return m + ' ' + String(v.sembol || '').toUpperCase().replace(/-USD$|-TRY$/, '');
    return m + ' adet';
  }
  const tarihSaat = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + L.AY_ADLARI[d.getMonth()] + ' ' + L.saatYazi(d); };

  // ---------- özet ve geçmiş ----------
  function durumu() {
    const f = fiyat();
    const vs = varliklar(), bs = borclar();
    const oz = L.paraOzeti(vs, bs, f);
    const kurUsd = L.kurTry('USD', f);
    const kurUsdGecerli = f && f.kur && f.kur.USD ? kurUsd : null;
    const gramAltin = f && f.altin ? f.altin.gram_try : null;
    return { f, vs, bs, oz, kurUsd: kurUsdGecerli, gramAltin };
  }

  // Grafik noktaları: günlük geçmiş ve bugünün canlı değeri (seçili birimde)
  function noktalar(s, birim) {
    const bugun = L.isoTarih(new Date());
    const nokta = (t, g, usd, altin) => ({ t, net: cevir(g.net, birim, usd, altin), varlik: cevir(g.varlik, birim, usd, altin), borc: cevir(g.borc, birim, usd, altin) });
    const liste = gecmis().filter(g => g.t < bugun).map(g => nokta(g.t, g, g.usd, g.gram_altin));
    if (s.f && (s.vs.length || s.bs.length)) liste.push(nokta(bugun, s.oz, s.kurUsd, s.gramAltin));
    return liste.filter(n => n.net !== null);
  }

  function ozetKarti(s) {
    if (!s.vs.length && !s.bs.length) {
      return '<section class="kart para-ozet" aria-label="Net değer"><div class="kart-ust"><h2>Net değer</h2></div>' +
        '<p class="not">Aşağıdan varlık ve borç ekleyince net değerin burada çıkar. Her gün bir nokta eklenir, zamanla grafiğe döner.</p></section>';
    }
    const birim = birimSecili();
    const net = cevir(s.oz.net, birim, s.kurUsd, s.gramAltin);
    const digerleri = ['TRY', 'USD', 'XAU'].filter(b => b !== birim).map(b => birimYazi(cevir(s.oz.net, b, s.kurUsd, s.gramAltin), b)).filter(x => x !== '–');
    const secim = ['TRY', 'USD', 'XAU'].map(b => '<button type="button" class="cip' + (b === birim ? ' secili' : '') + '" data-para-birim="' + b + '" aria-pressed="' + (b === birim) + '">' + BIRIM_ADI[b] + '</button>').join('');
    const pts = noktalar(s, birim);
    return '<section class="kart para-ozet" aria-label="Net değer">' +
      '<div class="kart-ust"><h2>Net değer</h2><div class="cipler para-birim" role="group" aria-label="Birim">' + secim + '</div></div>' +
      '<p class="para-net">' + birimYazi(net, birim) + '</p>' +
      (digerleri.length ? '<p class="para-net-alt">≈ ' + digerleri.map(esc).join(' · ') + '</p>' : '') +
      '<p class="not">Varlık ' + tl(s.oz.varlik) + ' · Borç ' + tl(s.oz.borc) + '</p>' +
      (s.oz.eksik.length ? '<p class="not uyari-yazi">' + s.oz.eksik.length + ' varlığın fiyatı yok, toplama girmedi.</p>' : '') +
      (pts.length >= 2 ? '<div class="para-grafik" id="paraGrafik" data-birim="' + birim + '"></div>' + tabloGorunumu(pts, birim)
        : '<p class="not">Grafik birkaç günlük kayıt birikince çıkar; her gün kendiliğinden bir nokta eklenir.</p>') +
      '</section>';
  }

  function tabloGorunumu(pts, birim) {
    const son = pts.slice(-31).reverse();
    return '<details class="tablo-ac"><summary>Tablo</summary><div class="tablo-sar"><table class="kucuk-tablo"><thead><tr><th>Gün</th><th>Net</th><th>Varlık</th><th>Borç</th></tr></thead><tbody>' +
      son.map(n => '<tr><td>' + esc(L.kisaTarih(L.tarihAyristir(n.t))) + '</td>' + [n.net, n.varlik, n.borc].map(x => '<td class="sayi">' + esc(birimYazi(x, birim)) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></details>';
  }

  // ---------- grafik: net değer çizgisi, artı imleç; ipucunda varlık ve borç da ----------
  // Tek seri olduğu için lejant yok (kartın başlığı adını söylüyor). Eksen sıfırdan değil verinin aralığından:
  // çizgide değişim görünsün diye.
  const SERI = { ad: 'Net değer', renk: 'var(--seri-1)' };
  function temizAdim(aralik, hedef) {
    const ham = aralik / Math.max(1, hedef);
    const us = Math.pow(10, Math.floor(Math.log10(ham)));
    const n = ham / us;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * us;
  }
  function grafikCiz(kap) {
    const s = durumu();
    const birim = kap.dataset.birim;
    const pts = noktalar(s, birim);
    if (pts.length < 2) { kap.innerHTML = ''; return; }
    const G = Math.max(280, kap.clientWidth), Y = 180;
    const sol = 56, sag = 72, ust = 12, alt = 26;
    const w = G - sol - sag, h = Y - ust - alt;
    const t0 = L.tarihAyristir(pts[0].t), tN = L.tarihAyristir(pts[pts.length - 1].t);
    const gunler = Math.max(1, L.gunFarki(t0, tN));
    const xOf = t => sol + L.gunFarki(t0, L.tarihAyristir(t)) / gunler * w;
    const nets = pts.map(p => p.net);
    let mn = Math.min(...nets), mx = Math.max(...nets);
    const pay = Math.max(Math.abs(mn), Math.abs(mx), 1) * 0.02;
    if (mx - mn < pay) { mn -= pay; mx += pay; }   // neredeyse düz çizgi ortada dursun
    const adim = temizAdim(mx - mn, 3);
    mn = Math.floor(mn / adim) * adim; mx = Math.ceil(mx / adim) * adim;
    const yOf = v => ust + (mx - v) / (mx - mn) * h;
    const izler = [];
    for (let v = mn; v <= mx + adim / 2; v += adim) izler.push(Math.round(v / adim) * adim);
    const grid = izler.map(v => '<line x1="' + sol + '" x2="' + (sol + w) + '" y1="' + yOf(v).toFixed(1) + '" y2="' + yOf(v).toFixed(1) + '" class="' + (v === 0 ? 'g-sifir' : 'g-cizgi') + '"/>' +
      '<text x="' + (sol - 8) + '" y="' + (yOf(v) + 4).toFixed(1) + '" class="g-eksen" text-anchor="end">' + esc(gizli() ? '' : kisaSayi(v)) + '</text>').join('');
    const yol = pts.map((p, i) => (i ? 'L' : 'M') + xOf(p.t).toFixed(1) + ' ' + yOf(p.net).toFixed(1)).join(' ');
    const son = pts[pts.length - 1];
    const uc = '<circle cx="' + xOf(son.t).toFixed(1) + '" cy="' + yOf(son.net).toFixed(1) + '" r="4" class="g-uc" style="fill:' + SERI.renk + '"/>' +
      (gizli() ? '' : '<text x="' + (xOf(son.t) + 9).toFixed(1) + '" y="' + (yOf(son.net) + 4).toFixed(1) + '" class="g-etiket">' + esc(kisaSayi(son.net)) + '</text>');
    const svg = '<svg width="' + G + '" height="' + Y + '" viewBox="0 0 ' + G + ' ' + Y + '" role="img" aria-label="' + esc('Net değer, ' + L.kisaTarih(t0) + ' – ' + L.kisaTarih(tN) + '; ayrıntı için Tablo') + '" tabindex="0">' +
      grid + '<path d="' + yol + '" class="g-cizgi-seri" style="stroke:' + SERI.renk + '"/>' + uc +
      '<text x="' + sol + '" y="' + (Y - 6) + '" class="g-eksen">' + esc(L.kisaTarih(t0)) + '</text>' +
      '<text x="' + (sol + w) + '" y="' + (Y - 6) + '" class="g-eksen" text-anchor="end">' + esc(L.kisaTarih(tN)) + '</text>' +
      '<line class="g-imlec" x1="0" x2="0" y1="' + ust + '" y2="' + (ust + h) + '" hidden/>' +
      '<circle class="g-imlec-nokta" r="4" cx="0" cy="0" hidden style="fill:' + SERI.renk + '"/>' +
      '<rect class="g-alan" x="' + sol + '" y="' + ust + '" width="' + w + '" height="' + h + '"/></svg>';
    kap.innerHTML = '<div class="g-govde">' + svg + '<div class="g-ipucu" role="status" hidden></div></div>';
    const svgEl = kap.querySelector('svg'), imlec = kap.querySelector('.g-imlec'), nokta = kap.querySelector('.g-imlec-nokta'), ipucu = kap.querySelector('.g-ipucu');
    let secili = null;
    function satir(renk, deger, ad) {
      const r = document.createElement('div'); r.className = 'g-ipucu-satir';
      const anahtar = document.createElement('i'); if (renk) anahtar.style.background = renk;
      const b = document.createElement('b'); b.textContent = deger;
      const a = document.createElement('span'); a.textContent = ad;
      r.append(anahtar, b, a);
      return r;
    }
    function goster(i) {
      secili = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[secili], x = xOf(p.t);
      imlec.setAttribute('x1', x); imlec.setAttribute('x2', x); imlec.removeAttribute('hidden');
      nokta.setAttribute('cx', x); nokta.setAttribute('cy', yOf(p.net)); nokta.removeAttribute('hidden');
      ipucu.replaceChildren();
      const baslik = document.createElement('div'); baslik.className = 'g-ipucu-baslik'; baslik.textContent = L.tarihYazi(L.tarihAyristir(p.t));
      ipucu.append(baslik, satir(SERI.renk, birimYazi(p.net, birim), 'net'));
      if (p.varlik !== null) ipucu.append(satir('', birimYazi(p.varlik, birim), 'varlık'));
      if (p.borc !== null) ipucu.append(satir('', birimYazi(p.borc, birim), 'borç'));
      ipucu.hidden = false;
      const iw = ipucu.offsetWidth;
      ipucu.style.left = Math.max(0, Math.min(G - iw, x + (x + 12 + iw > G ? -iw - 12 : 12))) + 'px';
    }
    function gizle() { imlec.setAttribute('hidden', ''); nokta.setAttribute('hidden', ''); ipucu.hidden = true; secili = null; }
    function enYakin(cx) {
      let en = 0, fark = Infinity;
      pts.forEach((p, i) => { const f2 = Math.abs(xOf(p.t) - cx); if (f2 < fark) { fark = f2; en = i; } });
      return en;
    }
    svgEl.addEventListener('pointermove', e => { const r = svgEl.getBoundingClientRect(); goster(enYakin((e.clientX - r.left) * G / r.width)); });
    svgEl.addEventListener('pointerdown', e => { const r = svgEl.getBoundingClientRect(); goster(enYakin((e.clientX - r.left) * G / r.width)); });
    svgEl.addEventListener('pointerleave', gizle);
    svgEl.addEventListener('focus', () => goster(pts.length - 1));
    svgEl.addEventListener('blur', gizle);
    svgEl.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); goster((secili === null ? pts.length - 1 : secili) + (e.key === 'ArrowLeft' ? -1 : 1)); }
      else if (e.key === 'Escape') gizle();
    });
  }

  // ---------- bölümler ----------
  function odemeYazisi(b, bugun) {
    const so = L.sonrakiOdeme(b, bugun);
    if (!so) return '';
    return 'son ödeme ' + L.kisaTarih(so.tarih) + (so.odendi ? ' · bu dönem ödendi' : ' (' + L.kalanYazi(so.kalanGun) + ')');
  }

  function yaklasanlar(bs, bugun, gun) {
    return bs.filter(b => !b.kapandi && (Number(b.kalan) || 0) > 0).map(b => ({ b, so: L.sonrakiOdeme(b, bugun) }))
      .filter(x => x.so && !x.so.odendi && x.so.kalanGun <= gun).sort((a, b) => a.so.kalanGun - b.so.kalanGun);
  }

  function yaklasanSatiri(x) {
    const b = x.b;
    return '<li class="para-yaklasan"><div class="para-satir-ust"><span class="para-ad">' + esc(b.ad) + '</span>' +
      '<span class="para-deger">' + esc(L.kisaTarih(x.so.tarih)) + '</span></div>' +
      '<span class="para-alt">' + esc(L.kalanYazi(x.so.kalanGun)) + (b.aylik ? ' · aylık ' + esc(tl(Number(b.aylik))) : '') + ' · kalan ' + esc(tl(L.borcDegeri(b, fiyat()))) + '</span>' +
      '<div class="para-dugmeler"><button type="button" class="dugme kucuk" data-borc-ode="' + esc(b.id) + '">Ödedim</button></div></li>';
  }

  function varlikBolumu(s) {
    if (!s.vs.length) {
      return '<section><div class="kart-ust bolum-ust"><h2>Varlıklar</h2><button type="button" class="dugme kucuk" data-varlik-ekle>Ekle</button></div>' +
        '<p class="not">Nakit, döviz, altın, gümüş, hisse, fon ya da kripto ekle. Fiyatlar gün içinde kendiliğinden güncellenir; altın ve gümüş has gram üzerinden hesaplanır.</p></section>';
    }
    const gruplar = L.VARLIK_TURLERI.map(([tur, ad]) => ({ tur, ad, v: s.vs.filter(v => v.tur === tur) })).filter(g => g.v.length);
    const satir = v => {
      const d = L.varlikDegeri(v, s.f);
      const birim = d.birim === null ? 'fiyat yok, dokun ve elle gir' : (v.tur === 'nakit' && (v.para || 'TRY') === 'TRY' ? '' :
        (gizli() ? '' : 'birim ' + birimFiyat(d.birim) + ' TL') + (d.kaynak === 'elle' ? ' · elle' : ''));
      const alt = [miktarYazi(v), birim].filter(Boolean).join(' · ');
      return '<li><button type="button" class="para-satir" data-varlik-duzenle="' + esc(v.id) + '">' +
        '<span class="para-satir-ust"><span class="para-ad">' + esc(varlikAdi(v)) + '</span><span class="para-deger' + (d.deger === null ? ' soluk-yazi' : '') + '">' + tl(d.deger) + '</span></span>' +
        (alt ? '<span class="para-alt' + (d.birim === null ? ' uyari-yazi' : '') + '">' + esc(alt) + '</span>' : '') + '</button></li>';
    };
    return '<section><div class="kart-ust bolum-ust"><h2>Varlıklar</h2><button type="button" class="dugme kucuk" data-varlik-ekle>Ekle</button></div>' +
      gruplar.map(g => '<div class="para-grup"><div class="para-grup-bas"><span>' + esc(g.ad) + '</span><span class="sayi">' + tl(s.oz.tur[g.tur] || 0) + '</span></div>' +
        '<ul class="liste">' + g.v.map(satir).join('') + '</ul></div>').join('') + '</section>';
  }

  function dagilim(s) {
    const turler = L.VARLIK_TURLERI.filter(([t]) => s.oz.tur[t] > 0);
    if (turler.length < 2 || !(s.oz.varlik > 0)) return '';
    const enBuyuk = Math.max(...turler.map(([t]) => s.oz.tur[t]));
    return '<section><h2>Dağılım</h2><ul class="para-dagilim">' + turler.map(([t, ad]) => {
      const pay = s.oz.tur[t] / s.oz.varlik;
      return '<li><span class="dagilim-ad">' + esc(ad) + '</span><span class="dagilim-cubuk" aria-hidden="true"><i style="width:' + (s.oz.tur[t] / enBuyuk * 100).toFixed(1) + '%"></i></span>' +
        '<span class="dagilim-deger sayi">%' + Math.round(pay * 100) + (gizli() ? '' : ' · ' + esc(tl(s.oz.tur[t]))) + '</span></li>';
    }).join('') + '</ul></section>';
  }

  function borcBolumu(s, bugun) {
    const acik = s.bs.filter(b => !b.kapandi);
    const kapali = s.bs.filter(b => b.kapandi);
    const satir = b => {
      const faiz = Number(b.faiz_aylik) > 0 ? 'aylık faiz %' + esnek.format(Number(b.faiz_aylik)) + (gizli() ? '' : ' (~' + tl(L.borcDegeri(b, s.f) * Number(b.faiz_aylik) / 100) + ')') : '';
      const tur = borcTurAdi(b.tur);
      const alt = [tur.toLocaleLowerCase('tr') === String(b.ad).toLocaleLowerCase('tr') ? '' : tur, odemeYazisi(b, bugun),
        b.aylik ? 'aylık ' + tl(Number(b.aylik)) : '', faiz, b.bitis ? 'bitiş ' + ayYil(b.bitis) : ''].filter(Boolean).join(' · ');
      return '<li class="para-borc"><div class="para-satir-ust"><span class="para-ad">' + esc(b.ad) + '</span><span class="para-deger">' + tl(L.borcDegeri(b, s.f)) + '</span></div>' +
        '<span class="para-alt">' + esc(alt) + '</span>' +
        '<div class="para-dugmeler"><button type="button" class="dugme kucuk" data-borc-ode="' + esc(b.id) + '">Ödedim</button>' +
        '<button type="button" class="metin-dugme" data-borc-duzenle="' + esc(b.id) + '">Düzenle</button></div></li>';
    };
    return '<section><div class="kart-ust bolum-ust"><h2>Borçlar</h2><button type="button" class="dugme kucuk" data-borc-ekle>Ekle</button></div>' +
      (acik.length ? '<ul class="liste">' + acik.map(satir).join('') + '</ul>' : '<p class="not">Kredi kartı, kredi, taksit ya da kişiye borç ekle. Son ödeme günü girersen yaklaşınca Bugün\'de hatırlatır.</p>') +
      (kapali.length ? '<details class="para-kapali"><summary>Kapanan borçlar (' + kapali.length + ')</summary><ul class="liste soluk">' +
        kapali.map(b => '<li class="para-borc"><div class="para-satir-ust"><span class="para-ad">' + esc(b.ad) + '</span><span class="para-deger">kapandı</span></div>' +
          '<span class="para-alt">' + esc(b.kapanis ? L.kisaTarih(L.tarihAyristir(b.kapanis)) + ' ' + b.kapanis.slice(0, 4) : '') + '</span>' +
          '<div class="para-dugmeler"><button type="button" class="metin-dugme" data-borc-duzenle="' + esc(b.id) + '">Düzenle</button></div></li>').join('') + '</ul></details>' : '') +
      '</section>';
  }

  function fiyatBolumu(s) {
    const f = s.f;
    if (!f) return '<section><h2>Fiyatlar</h2><p class="not">Fiyatlar henüz gelmedi. İlk güncelleme birkaç dakika sürer.</p>' +
      '<button type="button" class="dugme ikincil" data-para-guncelle>Şimdi güncelle</button></section>';
    const satirlar = [];
    for (const p of ['USD', 'EUR', 'GBP']) if (f.kur && f.kur[p]) satirlar.push([p + '/TRY', ikiHane.format(f.kur[p])]);
    if (f.altin && f.altin.gram_try) satirlar.push(['Gram altın (has)', ikiHane.format(f.altin.gram_try) + ' TL']);
    if (f.gumus && f.gumus.gram_try) satirlar.push(['Gram gümüş', ikiHane.format(f.gumus.gram_try) + ' TL']);
    const ref = (f.referans || []).map(r => [r.ad, ikiHane.format(r.fiyat)]);
    const eski = f.guncelleme && (Date.now() - new Date(f.guncelleme).getTime()) > 2 * 864e5;
    return '<section><h2>Fiyatlar</h2>' +
      '<p class="not' + (eski ? ' uyari-yazi' : '') + '">Son güncelleme ' + esc(tarihSaat(f.guncelleme)) + (eski ? '; iki günden eski' : '') + '. Hafta içi dört, hafta sonu bir kez kendiliğinden güncellenir.</p>' +
      '<ul class="para-fiyatlar">' + satirlar.concat(ref).map(([a, b]) => '<li><span>' + esc(a) + '</span><b class="sayi">' + esc(b) + '</b></li>').join('') + '</ul>' +
      ((f.hatalar || []).length ? '<p class="not uyari-yazi">' + f.hatalar.map(esc).join('; ') + '.' +
        (f.hatalar.some(x => /bulunamad|alınamad/.test(x)) ? ' Fiyatı gelmeyen varlığa dokunup fiyatı elle girebilirsin.' : '') + '</p>' : '') +
      '<button type="button" class="dugme ikincil" data-para-guncelle>Şimdi güncelle</button>' +
      '<p class="not">Altın ve gümüş has gram üzerinden; kuyumcu işçiliği ve alış-satış farkı dahil değil. Kaynaklar: ' + esc(Object.values(f.kaynaklar || {}).filter((x, i, a) => a.indexOf(x) === i).join(', ')) + '.</p></section>';
  }

  function gorunum() {
    if (!Object.keys(D.durum.dosyalar).length) return D.bosDurum('Veri geliyor', 'İlk eşitleme birkaç saniye sürer.');
    const s = durumu();
    const bugun = L.sadeceGun(new Date());
    const yk = yaklasanlar(s.bs, bugun, 14);
    return '<article class="para">' +
      '<header class="bolum-bas"><h1>Para</h1><button type="button" class="metin-dugme" data-para-gizle>' + (gizli() ? 'Tutarları göster' : 'Tutarları gizle') + '</button></header>' +
      ozetKarti(s) +
      (yk.length ? '<section><h2>Yaklaşan ödemeler</h2><ul class="liste">' + yk.map(yaklasanSatiri).join('') + '</ul></section>' : '') +
      varlikBolumu(s) + dagilim(s) + borcBolumu(s, bugun) + fiyatBolumu(s) +
      '</article>';
  }

  D.gorunum('para', gorunum, 'daha');
  D.panel({ ad: 'Para', href: '#para', ikon: 'para', aciklama: 'Varlıklar, borçlar, net değer', sira: 5 });
  // Bugün: son ödeme günü üç gün içinde olan ve bu dönem ödenmemiş borçlar
  D.kart('bugun-ust', simdi => {
    const yk = yaklasanlar(borclar(), L.sadeceGun(simdi), 3);
    if (!yk.length) return '';
    return '<section class="kart kart-vurgu para-hatirlat"><div class="kart-ust"><h2>Ödeme yaklaşıyor</h2><a class="metin-dugme" href="#para">Para</a></div>' +
      '<ul class="liste">' + yk.map(yaklasanSatiri).join('') + '</ul></section>';
  });

  let boyutZaman = null;
  D.sonra(sayfa => {
    if (sayfa !== 'para') return;
    const kap = document.getElementById('paraGrafik');
    if (kap) grafikCiz(kap);
  });
  window.addEventListener('resize', () => {
    clearTimeout(boyutZaman);
    boyutZaman = setTimeout(() => { const kap = document.getElementById('paraGrafik'); if (kap) grafikCiz(kap); }, 150);
  });

  // ---------- yazma ----------
  function jsonDegistir(yol, anahtar, fn, mesaj) {
    return D.degistirVeYaz(yol, eski => {
      let v = {};
      if (eski) { try { v = JSON.parse(eski); } catch (e) { throw new Error(yol + ' okunamadı.'); } }
      v[anahtar] = v[anahtar] || [];
      fn(v[anahtar], v);
      v.guncelleme = L.isoTarih(new Date());
      return JSON.stringify(v, null, 1) + '\n';
    }, mesaj);
  }
  const yeniId = onEk => onEk + '-' + L.isoTarih(new Date()) + '-' + Math.random().toString(36).slice(2, 6);
  // "1.234,56", "1234,56", "1234.56" ve binlik ayraçlı "12.500" hepsi olur; "0.015" ondalık sayılır
  function sayi(x) {
    const s = String(x === null || x === undefined ? '' : x).trim().replace(/\s/g, '');
    if (!s) return null;
    let n;
    if (/,/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
    else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ''));
    else n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  // ---------- pencereler ----------
  function pencere(id, html) {
    let d = document.getElementById(id);
    if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); }
    d.innerHTML = html;
    return d;
  }
  const secenek = (liste, secili) => liste.map(([k, a]) => '<option value="' + esc(k) + '"' + (k === secili ? ' selected' : '') + '>' + esc(a) + '</option>').join('');
  const paraSecenek = secili => secenek(Object.keys(L.PARA_BIRIMLERI).map(k => [k, k + ' (' + L.PARA_BIRIMLERI[k] + ')']), secili || 'TRY');
  const ALANLAR_TURE = {
    nakit: ['para', 'miktar'], altin: ['altin_birim', 'miktar'], gumus: ['gumus_birim', 'miktar'],
    hisse: ['sembol', 'miktar', 'elle'], fon: ['kod', 'miktar', 'elle'], kripto: ['sembol', 'miktar', 'elle'], diger: ['miktar', 'elle_zorunlu'],
  };
  const MIKTAR_ADI = { nakit: 'Tutar', altin: 'Adet ya da gram', gumus: 'Miktar', hisse: 'Adet', fon: 'Pay adedi', kripto: 'Miktar', diger: 'Adet' };

  function varlikPenceresi(v) {
    const yeni = !v;
    v = v || { tur: 'nakit', para: 'TRY' };
    const turSec = L.VARLIK_TURLERI.map(([k, a]) => '<label class="cip cip-radyo"><input type="radio" name="tur" value="' + k + '"' + (k === v.tur ? ' checked' : '') + '> ' + esc(a) + '</label>').join('');
    const elleVar = v.elle_fiyat !== undefined && v.elle_fiyat !== null && v.elle_fiyat !== '';
    const d = pencere('varlikDialog', '<form id="varlikForm" method="dialog" novalidate><h2>' + (yeni ? 'Varlık ekle' : 'Varlığı düzenle') + '</h2>' +
      '<input type="hidden" name="id" value="' + esc(v.id || '') + '">' +
      '<div class="cipler" role="radiogroup" aria-label="Tür">' + turSec + '</div>' +
      '<label class="alan">Ad (isteğe bağlı)<input name="ad" type="text" autocomplete="off" value="' + esc(v.ad || '') + '" placeholder="Ör. Vadeli hesap, Annemden çeyrekler"></label>' +
      '<label class="alan" data-alan="para">Para birimi<select name="para">' + paraSecenek(v.para) + '</select></label>' +
      '<label class="alan" data-alan="altin_birim">Birim<select name="altin_birim">' + secenek(Object.keys(L.ALTIN_BIRIM).map(k => [k, L.ALTIN_BIRIM[k].ad]), v.tur === 'altin' ? v.birim : 'gram24') + '</select></label>' +
      '<label class="alan" data-alan="gumus_birim">Birim<select name="gumus_birim">' + secenek(Object.keys(L.GUMUS_BIRIM).map(k => [k, L.GUMUS_BIRIM[k].ad]), v.tur === 'gumus' ? v.birim : 'gram') + '</select></label>' +
      '<label class="alan" data-alan="sembol">Sembol<input name="sembol" type="text" autocomplete="off" autocapitalize="characters" value="' + esc(v.sembol || '') + '" placeholder="THYAO.IS, AAPL, BTC-USD"><small>BIST hisseleri sonuna .IS alır (THYAO.IS). Kripto: BTC-USD gibi. Semboller Yahoo Finance\'tekiyle aynı.</small></label>' +
      '<label class="alan" data-alan="kod">Fon kodu<input name="kod" type="text" autocomplete="off" autocapitalize="characters" value="' + esc(v.kod || '') + '" placeholder="TTE"><small>TEFAS\'taki üç harfli kod.</small></label>' +
      '<label class="alan" data-alan="miktar"><span class="miktar-adi">' + esc(MIKTAR_ADI[v.tur] || 'Miktar') + '</span><input name="miktar" type="text" inputmode="decimal" autocomplete="off" value="' + esc(v.miktar === undefined ? '' : String(v.miktar).replace('.', ',')) + '"></label>' +
      '<details class="alan" data-alan="elle"' + (elleVar ? ' open' : '') + '><summary>Fiyatı elle gir</summary><p class="not">Otomatik fiyat yoksa ya da yanlışsa. Girersen otomatik fiyatın yerine geçer.</p>' +
      '<div class="iki-alan"><label class="alan">Birim fiyat<input name="elle_fiyat" type="text" inputmode="decimal" autocomplete="off" value="' + esc(elleVar ? String(v.elle_fiyat).replace('.', ',') : '') + '"></label>' +
      '<label class="alan">Para birimi<select name="elle_para">' + paraSecenek(v.elle_para) + '</select></label></div></details>' +
      '<label class="alan">Not (isteğe bağlı)<input name="not" type="text" autocomplete="off" value="' + esc(v.not || '') + '"></label>' +
      '<p class="not">Hesap ya da kart numarası yazma; adı yeter.</p>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt">' +
      (yeni ? '' : '<button type="button" class="metin-dugme sil-dugme" data-varlik-sil="' + esc(v.id) + '">Sil</button>') +
      '<button type="button" class="metin-dugme" data-kapat="varlikDialog">Vazgeç</button><button type="submit" class="dugme">Kaydet</button></div></form>');
    const form = d.querySelector('form');
    function alanlariAyarla() {
      const tur = (form.querySelector('[name=tur]:checked') || {}).value || 'nakit';
      const acik = ALANLAR_TURE[tur];
      form.querySelectorAll('[data-alan]').forEach(el => {
        const a = el.dataset.alan;
        el.hidden = !(acik.includes(a) || (a === 'elle' && acik.includes('elle_zorunlu')));
      });
      const elle = form.querySelector('[data-alan=elle]');
      if (acik.includes('elle_zorunlu')) { elle.open = true; elle.querySelector('summary').textContent = 'Birim fiyat'; }
      else elle.querySelector('summary').textContent = 'Fiyatı elle gir';
      form.querySelector('.miktar-adi').textContent = miktarAdi(tur);
    }
    // Altın ve gümüşte miktarın adı seçilen birime göre: gram, adet ya da ons
    function miktarAdi(tur) {
      if (tur !== 'altin' && tur !== 'gumus') return MIKTAR_ADI[tur] || 'Miktar';
      const tablo = tur === 'altin' ? L.ALTIN_BIRIM : L.GUMUS_BIRIM;
      const b = tablo[form.querySelector('[name=' + tur + '_birim]').value] || {};
      return { gr: 'Gram', adet: 'Adet', ons: 'Ons' }[b.olcu] || 'Miktar';
    }
    form.addEventListener('change', e => { if (['tur', 'altin_birim', 'gumus_birim'].includes(e.target.name)) alanlariAyarla(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      D.islemle(e.submitter || form.querySelector('[type=submit]'), () => varlikKaydet(form), yeni ? 'Eklendi' : 'Kaydedildi').then(ok => { if (ok) d.close(); });
    });
    alanlariAyarla();
    D.pencereAc('varlikDialog');
  }

  async function varlikKaydet(form) {
    const f = new FormData(form);
    const s = ad => String(f.get(ad) || '').trim();
    const tur = s('tur') || 'nakit';
    const miktar = sayi(s('miktar'));
    if (miktar === null || isNaN(miktar) || miktar < 0) { D.hataGoster('Miktarı sayı olarak yaz (ör. 1.250,50).'); return false; }
    const v = { id: s('id') || yeniId(tur), tur, miktar };
    if (s('ad')) v.ad = s('ad');
    if (tur === 'nakit') v.para = s('para') || 'TRY';
    if (tur === 'altin') v.birim = s('altin_birim') || 'gram24';
    if (tur === 'gumus') v.birim = s('gumus_birim') || 'gram';
    if (tur === 'hisse' || tur === 'kripto') {
      v.sembol = s('sembol').toUpperCase().replace(/\s+/g, '');
      if (!v.sembol) { D.hataGoster('Sembolü yaz (ör. THYAO.IS ya da AAPL).'); return false; }
    }
    if (tur === 'fon') {
      v.kod = s('kod').toUpperCase().replace(/\s+/g, '');
      if (!v.kod) { D.hataGoster('Fon kodunu yaz (ör. TTE).'); return false; }
    }
    const elle = sayi(s('elle_fiyat'));
    if (elle !== null && (isNaN(elle) || elle < 0)) { D.hataGoster('Birim fiyatı sayı olarak yaz.'); return false; }
    if (tur === 'diger' && elle === null) { D.hataGoster('Diğer türünde birim fiyatı girmen gerekiyor.'); return false; }
    if (elle !== null && tur !== 'nakit' && tur !== 'altin' && tur !== 'gumus') { v.elle_fiyat = elle; v.elle_para = s('elle_para') || 'TRY'; v.elle_tarih = L.isoTarih(new Date()); }
    if (s('not')) v.not = s('not');
    await jsonDegistir(YOL_V, 'varliklar', liste => {
      const i = liste.findIndex(x => x.id === v.id);
      if (i >= 0) { v.eklendi = liste[i].eklendi; liste[i] = v; } else { v.eklendi = L.isoTarih(new Date()); liste.push(v); }
    }, 'Para: ' + varlikAdi(v) + (s('id') ? ' güncellendi' : ' eklendi'));
    return true;
  }

  function borcPenceresi(b) {
    const yeni = !b;
    b = b || { tur: 'kart', para: 'TRY' };
    const turSec = L.BORC_TURLERI.map(([k, a]) => '<label class="cip cip-radyo"><input type="radio" name="tur" value="' + k + '"' + (k === b.tur ? ' checked' : '') + '> ' + esc(a) + '</label>').join('');
    const deger = x => esc(x === undefined || x === null ? '' : String(x).replace('.', ','));
    const d = pencere('borcDialog', '<form id="borcForm" method="dialog" novalidate><h2>' + (yeni ? 'Borç ekle' : 'Borcu düzenle') + '</h2>' +
      '<input type="hidden" name="id" value="' + esc(b.id || '') + '">' +
      '<div class="cipler" role="radiogroup" aria-label="Tür">' + turSec + '</div>' +
      '<label class="alan">Ad<input name="ad" type="text" autocomplete="off" required value="' + esc(b.ad || '') + '" placeholder="VakıfBank kartı"><small>Kart numarası yazma; adı yeter.</small></label>' +
      '<div class="iki-alan"><label class="alan">Kalan borç<input name="kalan" type="text" inputmode="decimal" autocomplete="off" value="' + deger(b.kalan) + '"></label>' +
      '<label class="alan">Para birimi<select name="para">' + paraSecenek(b.para) + '</select></label></div>' +
      '<div class="iki-alan"><label class="alan">Son ödeme günü (ayın kaçı)<input name="son_odeme_gunu" type="number" inputmode="numeric" min="1" max="31" value="' + deger(b.son_odeme_gunu) + '"></label>' +
      '<label class="alan">Aylık ödeme (isteğe bağlı)<input name="aylik" type="text" inputmode="decimal" autocomplete="off" value="' + deger(b.aylik) + '"></label></div>' +
      '<div class="iki-alan"><label class="alan">Aylık faiz, % (isteğe bağlı)<input name="faiz_aylik" type="text" inputmode="decimal" autocomplete="off" value="' + deger(b.faiz_aylik) + '"></label>' +
      '<label class="alan">Bitiş (isteğe bağlı)<input name="bitis" type="month" value="' + esc(b.bitis || '') + '"></label></div>' +
      '<label class="alan">Not (isteğe bağlı)<input name="not" type="text" autocomplete="off" value="' + esc(b.not || '') + '"></label>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt">' +
      (yeni ? '' : '<button type="button" class="metin-dugme sil-dugme" data-borc-sil="' + esc(b.id) + '">Sil</button>') +
      '<button type="button" class="metin-dugme" data-kapat="borcDialog">Vazgeç</button><button type="submit" class="dugme">Kaydet</button></div></form>');
    const form = d.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      D.islemle(e.submitter || form.querySelector('[type=submit]'), () => borcKaydet(form), yeni ? 'Eklendi' : 'Kaydedildi').then(ok => { if (ok) d.close(); });
    });
    D.pencereAc('borcDialog');
  }

  async function borcKaydet(form) {
    const f = new FormData(form);
    const s = ad => String(f.get(ad) || '').trim();
    if (!s('ad')) { D.hataGoster('Borcun adını yaz.'); return false; }
    const kalan = sayi(s('kalan'));
    if (kalan === null || isNaN(kalan) || kalan < 0) { D.hataGoster('Kalan borcu sayı olarak yaz.'); return false; }
    const b = { id: s('id') || yeniId('borc'), tur: s('tur') || 'kart', ad: s('ad'), kalan, para: s('para') || 'TRY' };
    const gun = Number(s('son_odeme_gunu'));
    if (s('son_odeme_gunu')) { if (!(gun >= 1 && gun <= 31)) { D.hataGoster('Son ödeme günü 1 ile 31 arasında olmalı.'); return false; } b.son_odeme_gunu = Math.round(gun); }
    for (const ad of ['aylik', 'faiz_aylik']) {
      const n = sayi(s(ad));
      if (n !== null) { if (isNaN(n) || n < 0) { D.hataGoster((ad === 'aylik' ? 'Aylık ödemeyi' : 'Faizi') + ' sayı olarak yaz.'); return false; } b[ad] = n; }
    }
    if (s('bitis')) b.bitis = s('bitis');
    if (s('not')) b.not = s('not');
    await jsonDegistir(YOL_B, 'borclar', liste => {
      const i = liste.findIndex(x => x.id === b.id);
      if (i >= 0) {
        const o = liste[i];
        Object.assign(b, { eklendi: o.eklendi, hareketler: o.hareketler || [], son_odeme: o.son_odeme });
        if (o.kalan !== kalan) b.hareketler = b.hareketler.concat({ t: L.isoTarih(new Date()), kalan, not: 'düzenlendi' });
        if (kalan > 0) delete b.kapandi; else { b.kapandi = true; b.kapanis = o.kapanis || L.isoTarih(new Date()); }
        liste[i] = b;
      } else {
        b.eklendi = L.isoTarih(new Date()); b.hareketler = [];
        if (kalan === 0) { b.kapandi = true; b.kapanis = b.eklendi; }
        liste.push(b);
      }
      for (const k of Object.keys(b)) if (b[k] === undefined) delete b[k];
    }, 'Para: ' + b.ad + (s('id') ? ' güncellendi' : ' eklendi'));
    return true;
  }

  function odemePenceresi(b) {
    const oneri = Number(b.aylik) > 0 ? Math.min(Number(b.aylik), Number(b.kalan) || 0) : (Number(b.kalan) || '');
    const d = pencere('odemeDialog', '<form id="odemeForm" method="dialog" novalidate><h2>Ödedim</h2><p class="not">' + esc(b.ad) + ' · kalan ' + esc(tl(L.borcDegeri(b, fiyat()))) + '</p>' +
      '<div class="iki-alan"><label class="alan">Tutar (' + esc(L.PARA_BIRIMLERI[b.para || 'TRY']) + ')<input name="tutar" type="text" inputmode="decimal" autocomplete="off" value="' + esc(String(oneri).replace('.', ',')) + '"></label>' +
      '<label class="alan">Tarih<input name="t" type="date" value="' + L.isoTarih(new Date()) + '"></label></div>' +
      '<label class="alan">Not (isteğe bağlı)<input name="not" type="text" autocomplete="off"></label>' +
      '<p class="dialog-hata" role="alert" hidden></p><div class="dialog-alt"><button type="button" class="metin-dugme" data-kapat="odemeDialog">Vazgeç</button><button type="submit" class="dugme">Kaydet</button></div></form>');
    const form = d.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      let onceki = null;
      D.islemle(e.submitter || form.querySelector('[type=submit]'), async () => { onceki = await odemeKaydet(b.id, form); return !!onceki; }).then(ok => {
        if (!ok || !onceki) return;
        d.close();
        D.tost('Ödeme kaydedildi', false, { ad: 'Geri al', fn: () => D.islemle(null, () => jsonDegistir(YOL_B, 'borclar', liste => {
          const i = liste.findIndex(x => x.id === onceki.id); if (i >= 0) liste[i] = onceki;
        }, 'Para: ' + onceki.ad + ' ödemesi geri alındı'), 'Geri alındı') });
      });
    });
    D.pencereAc('odemeDialog');
  }

  async function odemeKaydet(id, form) {
    const f = new FormData(form);
    const tutar = sayi(f.get('tutar'));
    if (tutar === null || isNaN(tutar) || tutar <= 0) { D.hataGoster('Ödediğin tutarı yaz.'); return null; }
    const t = String(f.get('t') || '') || L.isoTarih(new Date());
    const not = String(f.get('not') || '').trim();
    let onceki = null;
    await jsonDegistir(YOL_B, 'borclar', liste => {
      const b = liste.find(x => x.id === id);
      if (!b) throw new Error('Borç bulunamadı; önce yenile.');
      onceki = JSON.parse(JSON.stringify(b));
      b.kalan = Math.max(0, Math.round(((Number(b.kalan) || 0) - tutar) * 100) / 100);
      b.son_odeme = !b.son_odeme || t > b.son_odeme ? t : b.son_odeme;
      b.hareketler = (b.hareketler || []).concat(Object.assign({ t, tutar: -tutar }, not ? { not } : {}));
      if (b.kalan === 0) { b.kapandi = true; b.kapanis = t; }
    }, 'Para: ' + id + ' ödeme');
    return onceki;
  }

  async function sil(yol, anahtar, id, mesaj) {
    let geri = null;
    await jsonDegistir(yol, anahtar, liste => {
      const i = liste.findIndex(x => x.id === id);
      if (i < 0) return;
      geri = { sira: i, x: liste[i] };
      liste.splice(i, 1);
    }, mesaj);
    return geri;
  }

  // ---------- olaylar ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-para-birim], [data-para-gizle], [data-para-guncelle], [data-varlik-ekle], [data-varlik-duzenle], [data-varlik-sil], [data-borc-ekle], [data-borc-duzenle], [data-borc-ode], [data-borc-sil]');
    if (!t || t.disabled) return;
    if (t.dataset.paraBirim) { D.sakla.koy('paraBirim', t.dataset.paraBirim); D.ciz(); return; }
    if (t.hasAttribute('data-para-gizle')) { D.sakla.koy('paraGizli', !gizli()); D.ciz(); return; }
    if (!D.durum.anahtar) { D.tost('Önce anahtar gir', true); return; }
    if (t.hasAttribute('data-para-guncelle')) {
      D.islemle(t, async () => {
        await D.degistirVeYaz('para/istek.json', () => JSON.stringify({ t: new Date().toISOString() }) + '\n', 'Para: fiyat isteği');
        setTimeout(() => D.esitle(true), 90000);
        return true;
      }, 'İstek gönderildi; fiyatlar bir iki dakika içinde gelir');
    } else if (t.hasAttribute('data-varlik-ekle')) varlikPenceresi(null);
    else if (t.dataset.varlikDuzenle) { const v = varliklar().find(x => x.id === t.dataset.varlikDuzenle); if (v) varlikPenceresi(v); }
    else if (t.dataset.varlikSil) {
      const id = t.dataset.varlikSil;
      let geri = null;
      D.islemle(t, async () => { geri = await sil(YOL_V, 'varliklar', id, 'Para: varlık silindi'); return true; }).then(ok => {
        if (!ok) return;
        const dl = document.getElementById('varlikDialog'); if (dl && dl.open) dl.close();
        if (geri) D.tost(varlikAdi(geri.x) + ' silindi', false, { ad: 'Geri al', fn: () => D.islemle(null, () => jsonDegistir(YOL_V, 'varliklar', liste => {
          liste.splice(Math.min(geri.sira, liste.length), 0, geri.x); }, 'Para: varlık geri alındı'), 'Geri alındı') });
      });
    }
    else if (t.hasAttribute('data-borc-ekle')) borcPenceresi(null);
    else if (t.dataset.borcDuzenle) { const b = borclar().find(x => x.id === t.dataset.borcDuzenle); if (b) borcPenceresi(b); }
    else if (t.dataset.borcOde) { const b = borclar().find(x => x.id === t.dataset.borcOde); if (b) odemePenceresi(b); }
    else if (t.dataset.borcSil) {
      const id = t.dataset.borcSil;
      let geri = null;
      D.islemle(t, async () => { geri = await sil(YOL_B, 'borclar', id, 'Para: borç silindi'); return true; }).then(ok => {
        if (!ok) return;
        const dl = document.getElementById('borcDialog'); if (dl && dl.open) dl.close();
        if (geri) D.tost(geri.x.ad + ' silindi', false, { ad: 'Geri al', fn: () => D.islemle(null, () => jsonDegistir(YOL_B, 'borclar', liste => {
          liste.splice(Math.min(geri.sira, liste.length), 0, geri.x); }, 'Para: borç geri alındı'), 'Geri alındı') });
      });
    }
  });
});
