/* Düzen: veri ve tarih yardımcıları. Tarayıcıda window.DuzenLib, Node'da module.exports. */
(function (kok, fabrika) {
  const lib = fabrika();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else kok.DuzenLib = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GUN_KODLARI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const BIRIM = { 'küçük': 1, 'orta': 2, 'büyük': 4 };
  const DURUM_ADI = { bitti: 'Bitti', devam: 'Devam', planlandi: 'Planlandı', baslanmadi: 'Başlanmadı', rafta: 'Rafta', dustu: 'Düştü' };

  const pad = n => String(n).padStart(2, '0');
  const isoTarih = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const sadeceGun = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function tarihAyristir(s) {
    const [y, m, g] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, g || 1);
  }
  function gunEkle(d, n) { const x = sadeceGun(d); x.setDate(x.getDate() + n); return x; }
  function gunFarki(a, b) {
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  }
  const tarihYazi = d => d.getDate() + ' ' + AY_ADLARI[d.getMonth()] + ' ' + GUN_ADLARI[d.getDay()];
  const kisaTarih = d => d.getDate() + ' ' + AY_ADLARI[d.getMonth()];
  const saatYazi = d => pad(d.getHours()) + ':' + pad(d.getMinutes());

  // Saat 20:00 ve sonrası Yarın sayfası
  function gunModu(simdi) {
    const yarin = simdi.getHours() >= 20;
    return { yarin, hedef: yarin ? gunEkle(simdi, 1) : sadeceGun(simdi) };
  }

  function degerCoz(v) {
    if (v === '') return '';
    try { return JSON.parse(v); } catch (e) { /* düz YAML değeri */ }
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    return v.replace(/^['"]|['"]$/g, '');
  }

  // "---" arasındaki "anahtar: değer" satırları
  function onYaziAyristir(metin) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(metin || '');
    if (!m) return { meta: {}, govde: metin || '' };
    const meta = {};
    for (const satir of m[1].split(/\r?\n/)) {
      if (/^\s/.test(satir)) continue;
      const i = satir.indexOf(':');
      if (i < 1) continue;
      meta[satir.slice(0, i).trim()] = degerCoz(satir.slice(i + 1).trim());
    }
    return { meta, govde: metin.slice(m[0].length) };
  }

  function bolumler(govde) {
    const sonuc = {};
    let baslik = null, tampon = [];
    for (const satir of (govde || '').split(/\r?\n/)) {
      const m = /^##\s+(.+?)\s*$/.exec(satir);
      if (m) {
        if (baslik !== null) sonuc[baslik] = tampon.join('\n').trim();
        baslik = m[1]; tampon = [];
      } else if (baslik !== null) tampon.push(satir);
    }
    if (baslik !== null) sonuc[baslik] = tampon.join('\n').trim();
    return sonuc;
  }

  function bolumBul(b, onEk) {
    const k = Object.keys(b).find(x => x.startsWith(onEk));
    return k ? b[k] : '';
  }

  function ilkParagraf(govde) {
    const s = (govde || '').split(/\r?\n/);
    let i = s.findIndex(x => /^#\s/.test(x));
    i = i < 0 ? 0 : i + 1;
    while (i < s.length && !s[i].trim()) i++;
    const out = [];
    while (i < s.length && s[i].trim() && !/^#/.test(s[i])) out.push(s[i++].trim());
    return out.join(' ');
  }

  // Gövdeden "# Başlık" satırını çıkarır (başlık antette gösteriliyor)
  function basliksizGovde(govde) {
    return (govde || '').replace(/^\s*#\s[^\n]*\n?/, '');
  }

  function projeOku(yol, metin) {
    const { meta, govde } = onYaziAyristir(metin);
    const b = bolumler(govde);
    return {
      slug: yol.split('/').pop().replace(/\.md$/, ''),
      yol, meta, govde,
      ozet: ilkParagraf(govde),
      sirada: bolumBul(b, 'Sıradaki adım').replace(/\s+/g, ' ').trim(),
    };
  }

  // "06:00-07:00" → 360; saat yazmayan bloklar kaba yerine oturur
  function saatAnahtari(s) {
    const m = /^(\d{1,2}):(\d{2})/.exec(s || '');
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const t = String(s || '').toLocaleLowerCase('tr');
    if (t.includes('öğleden sonra')) return 13 * 60;
    if (t.includes('gün içi')) return 10 * 60;
    if (t.includes('sabah')) return 8 * 60;
    if (t.includes('akşam')) return 19 * 60;
    return 24 * 60;
  }

  // Dakikadan "SS:DD" (1440 → 00:00)
  const dkYazi = n => pad(Math.floor(((n % 1440) + 1440) % 1440 / 60)) + ':' + pad(((n % 60) + 60) % 60);
  const dkAl = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

  // O tarihte geçerli uyku hedefi (iskeletteki en son başlayan)
  function uykuHedefi(iskelet, iso) {
    let uyku = null;
    for (const u of ((iskelet && iskelet.uyku) || [])) if (u.baslangic <= iso && (!uyku || u.baslangic >= uyku.baslangic)) uyku = u;
    return uyku;
  }

  // Haftalık iskeletten bir günün planı
  function gunPlani(iskelet, tarih) {
    if (!iskelet) return { bloklar: [], uyku: null, serbest: null, kod: GUN_KODLARI[tarih.getDay()] };
    const kod = GUN_KODLARI[tarih.getDay()];
    const iso = isoTarih(tarih);
    const bloklar = (iskelet.bloklar || []).filter(b => (b.gunler || []).includes(kod))
      .slice().sort((a, b) => saatAnahtari(a.saat) - saatAnahtari(b.saat));
    const uyku = uykuHedefi(iskelet, iso);
    // "ışıktan önceki 30 dk" gibi bloklar o günün ışık saatine göre gerçek saate çevrilir
    const cozulmus = bloklar.map(b => {
      const m = /ışıktan önceki\s+(\d+)\s*dk/i.exec(b.saat || '');
      if (!m || !uyku) return b;
      const bit = saatAnahtari(uyku.isik);
      return Object.assign({}, b, { saat: dkYazi(bit - Number(m[1])) + '-' + uyku.isik });
    }).sort((a, b) => saatAnahtari(a.saat) - saatAnahtari(b.saat));
    return { bloklar: cozulmus, uyku, serbest: iskelet.serbest_aksam || null, kod };
  }

  function jsonlOku(metin) {
    const out = [];
    for (const s of (metin || '').split(/\r?\n/)) {
      const t = s.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch (e) { /* bozuk satır atlanır */ }
    }
    return out;
  }

  // Bir günün eksik girdileri: o günün uykusu (dün geceki ışık, bu sabahki kalkış), hafta içi sabah bloğu
  // ve dün geceki okuma (okuma ışıktan önceki yarım saatte, günü kapattıktan sonra). Hariç günlerde (gezi, askerlik) hiçbiri.
  // Uyku hedefinde sabah bloğu için kalkış sınırı varsa, o saatten sonra kalkılan gün sabah bloğu beklenmez.
  function eksikGirdiler(kayitlar, tarih, haric, uykuH) {
    const iso = isoTarih(tarih);
    const dun = isoTarih(gunEkle(tarih, -1));
    const var_ = (tur, t) => kayitlar.some(k => k.t === t && k.tur === tur);
    const eksik = [];
    if (haricMi(iso, haric)) return eksik;
    if (!var_('uyku', iso)) eksik.push({ tur: 'uyku', t: iso });
    const g = tarih.getDay();
    if (g >= 1 && g <= 5 && !gecKalkti(kayitlar, iso, uykuH) && !var_('sabah_blogu', iso)) eksik.push({ tur: 'sabah_blogu', t: iso });
    if (!haricMi(dun, haric) && !var_('okuma', dun)) eksik.push({ tur: 'okuma', t: dun });
    return eksik;
  }

  // O gün sabah bloğunun kalkış sınırından sonra mı kalkıldı (saat girilmişse)
  function gecKalkti(kayitlar, iso, uykuH) {
    const sinir = uykuH ? dkAl(uykuH.sabah_blogu_kalkis_siniri) : null;
    if (sinir == null) return false;
    const u = gunlukSon(kayitlar.filter(k => k.tur === 'uyku' && k.t === iso))[0];
    return !!(u && u.kalkis && dkAl(u.kalkis) > sinir);
  }

  // Aynı güne birden çok girdi varsa sonuncusu geçerli
  function gunlukSon(ks) {
    const m = new Map();
    for (const k of ks) m.set(k.t, k);
    return Array.from(m.values());
  }

  // ---------- uyku hedefi ----------
  // Yeni biçim: hedef.isik ve hedef.kalkis [başlangıç, sınır] aralığı; sınırdan önce yatıp kalkmak hedefte sayılır,
  // daha erken de olur. Cumartesi ve Pazar tarihli kayıtlarda (Cuma ve Cumartesi geceleri) sınırlar hafta_sonu_kayma_dk kadar geç.
  // Eski biçim: tek saat (isik, kalkis), 15 dk tolerans.
  const haftaSonuMu = iso => { const g = tarihAyristir(iso).getDay(); return g === 0 || g === 6; };
  const geceDk = dk => (dk < 12 * 60 ? dk + 1440 : dk);   // akşam saatinde gece yarısı sonrası ertesi gün

  // t tarihli kaydın (dün gece ışık, bu sabah kalkış) sınırları, dakika; yeni biçim değilse null
  function uykuSinirlari(u, tIso) {
    if (!u || !u.hedef || !Array.isArray(u.hedef.isik) || !Array.isArray(u.hedef.kalkis)) return null;
    const kay = haftaSonuMu(tIso) ? (Number(u.hedef.hafta_sonu_kayma_dk) || 0) : 0;
    return {
      isikBas: geceDk(dkAl(u.hedef.isik[0])) + kay, isikSinir: geceDk(dkAl(u.hedef.isik[1])) + kay,
      kalkisBas: dkAl(u.hedef.kalkis[0]) + kay, kalkisSinir: dkAl(u.hedef.kalkis[1]) + kay,
    };
  }

  // Bir uyku girdisi hedefte mi: { isik, kalkis, hepsi }, her biri true / false / null (bilinmiyor)
  function uykuDegerlendir(k, u) {
    if (!k) return { isik: null, kalkis: null, hepsi: null };
    if (k.hedefte === true && !k.isik && !k.kalkis) return { isik: true, kalkis: true, hepsi: true };
    const s = uykuSinirlari(u, k.t);
    let isik = null, kalkis = null;
    if (s) {
      if (dkAl(k.isik) != null) isik = geceDk(dkAl(k.isik)) < s.isikSinir;
      if (dkAl(k.kalkis) != null) kalkis = dkAl(k.kalkis) < s.kalkisSinir;
    } else if (u) {
      if (k.isik) isik = !isikGecMi(k.isik, u.isik, 15);
      if (k.kalkis) kalkis = !isikGecMi(k.kalkis, u.kalkis, 15);
    }
    let hepsi;
    if (k.hedefte === false && isik === null && kalkis === null) hepsi = false;
    else if (s) hepsi = isik === false || kalkis === false ? false : (isik && kalkis ? true : null);
    else hepsi = isik;   // eski hedefte sadece ışık sayılırdı
    return { isik, kalkis, hepsi };
  }

  // Plan için D günü: bu sabahın kalkışı (D tarihli kayıt) ve bu gecenin ışığı (D+1 tarihli kayıt)
  function uykuPlani(iskelet, gun) {
    const iso = isoTarih(gun), yarinIso = isoTarih(gunEkle(gun, 1));
    const uS = uykuHedefi(iskelet, iso), uG = uykuHedefi(iskelet, yarinIso) || uS;
    if (!uS && !uG) return null;
    const sabah = uykuSinirlari(uS, iso), gece = uykuSinirlari(uG, yarinIso);
    const kalkis = sabah ? { bas: sabah.kalkisBas, sinir: sabah.kalkisSinir, yazi: dkYazi(sabah.kalkisBas) + '–' + dkYazi(sabah.kalkisSinir) }
      : (uS ? { bas: dkAl(uS.kalkis), sinir: dkAl(uS.kalkis), yazi: uS.kalkis } : null);
    const isik = gece ? { bas: gece.isikBas, sinir: gece.isikSinir, yazi: dkYazi(gece.isikBas) + '–' + dkYazi(gece.isikSinir) }
      : (uG ? { bas: dkAl(uG.isik), sinir: dkAl(uG.isik), yazi: uG.isik } : null);
    return { kalkis, isik };
  }

  // "Uyku hedefte" demek için kısa açıklama: "Dün gece 23:00'ten önce yattın, bu sabah 07:00'den önce kalktın"
  function uykuHedefYazisi(u, tIso) {
    const s = uykuSinirlari(u, tIso);
    if (!s) return u ? 'Işık ' + u.isik + ', kalkış ' + u.kalkis + ' civarı' : '';
    return 'Dün gece ' + dkYazi(s.isikSinir) + '\'' + ekTen(s.isikSinir) + ' önce yattım, bu sabah ' + dkYazi(s.kalkisSinir) + '\'' + ekTen(s.kalkisSinir) + ' önce kalktım';
  }
  // "23:00'ten", "00:00'dan", "07:00'den", "06:30'dan": saatin okunuşundaki son kelimeye göre ayrılma eki
  function ekTen(dk) {
    const sa = Math.floor((((dk % 1440) + 1440) % 1440) / 60), d = ((dk % 60) + 60) % 60;
    const BIRLER = { 1: 'den', 2: 'den', 3: 'ten', 4: 'ten', 5: 'ten', 6: 'dan', 7: 'den', 8: 'den', 9: 'dan' };
    const ONLAR = { 1: 'dan', 2: 'den', 3: 'dan', 4: 'tan', 5: 'den' };
    const n = d || sa;
    if (n === 0) return 'dan';   // sıfır
    return n % 10 ? BIRLER[n % 10] : ONLAR[Math.floor(n / 10)];
  }

  function haricMi(iso, haric) {
    return (haric || []).some(([a, b]) => iso >= a && iso <= b);
  }

  // Haftanın pazartesisi
  function haftaBasi(d) {
    const x = sadeceGun(d);
    return gunEkle(x, -((x.getDay() + 6) % 7));
  }

  // Gece yarısından sonra 04:00'e kadar hâlâ önceki gün sayılır (günü kapatırken)
  function kapanisGunu(simdi) {
    return simdi.getHours() < 4 ? gunEkle(simdi, -1) : sadeceGun(simdi);
  }

  // O günün okuma bloğu (iskelette "Okuma" geçen ve saati çözülmüş blok)
  function okumaBloku(plan) {
    return (plan.bloklar || []).find(b => /okuma/i.test(b.is || '') && /^\d{1,2}:\d{2}-/.test(b.saat || '')) || null;
  }

  // Haftanın albümü: sıradaki albüm bir önceki dinlendikten sonraki pazartesi başlar; dinlenmeyen albüm sonraki haftaya geçer.
  // Albüm haftası gelmeden de dinlenebilir; o zaman sıradaki, dinlendiği haftanın ardından gelen pazartesi başlar.
  function albumPlani(veri, bugun) {
    const albumler = (veri && veri.albumler) || [];
    const bas = haftaBasi(tarihAyristir((veri && veri.baslangic) || isoTarih(bugun)));
    const buHafta = haftaBasi(bugun);
    let hafta = bas, aktif = null;
    const plan = [];
    for (const a of albumler) {
      // Kuyruğa sonradan eklenen albüm eklendiği haftadan önce başlamış sayılmaz
      if (a.eklendi) { const e = haftaBasi(tarihAyristir(a.eklendi)); if (e > hafta) hafta = e; }
      const satir = { album: a, hafta: isoTarih(hafta) };
      if (a.dinlendi) {
        plan.push(satir);
        hafta = gunEkle(haftaBasi(tarihAyristir(a.dinlendi)), 7);
        continue;
      }
      if (!aktif) {
        if (hafta > buHafta) { satir.gelecek = true; plan.push(satir); hafta = gunEkle(hafta, 7); aktif = satir; continue; }
        satir.kacinci = Math.floor(gunFarki(hafta, buHafta) / 7) + 1;
        aktif = satir;
        plan.push(satir);
        hafta = gunEkle(buHafta, 7);
        continue;
      }
      satir.gelecek = true;
      plan.push(satir);
      hafta = gunEkle(hafta, 7);
    }
    return { plan, aktif: aktif && !aktif.gelecek ? aktif : null };
  }

  // [bas, bit] dahil, hariç aralıklar düşülmüş gün sayısı
  function etkinGun(bas, bit, haric) {
    let n = 0;
    for (let d = sadeceGun(bas); d <= bit; d = gunEkle(d, 1)) if (!haricMi(isoTarih(d), haric)) n++;
    return n;
  }

  // 2027 hızı: biten ve bugüne kadar beklenen birim
  function hiz(projeler, havuzMeta, bugun) {
    const birim = (havuzMeta && havuzMeta.birim) || BIRIM;
    const basIso = havuzMeta && havuzMeta.baslangic;
    let toplam = 0, biten = 0;
    for (const p of projeler) {
      const m = p.meta || {};
      if (m.durum === 'dustu') continue;
      if (m.durum === 'bitti' && basIso && m.bitis && m.bitis < basIso) continue;
      const u = birim[m.buyukluk] || 0;
      toplam += u;
      if (m.durum === 'bitti') biten += u;
    }
    if (!havuzMeta || !havuzMeta.baslangic || !havuzMeta.bitis_hedef) return { toplam, biten, beklenen: null, haftalik: null };
    const bas = tarihAyristir(havuzMeta.baslangic);
    const son = tarihAyristir(havuzMeta.bitis_hedef);
    const toplamGun = etkinGun(bas, son, havuzMeta.haric);
    const gecen = bugun < bas ? 0 : etkinGun(bas, bugun < son ? sadeceGun(bugun) : son, havuzMeta.haric);
    return {
      toplam, biten,
      beklenen: toplamGun ? toplam * gecen / toplamGun : 0,
      haftalik: toplamGun ? toplam / (toplamGun / 7) : 0,
      kalanHafta: Math.max(0, (toplamGun - gecen) / 7),
    };
  }

  // Işık saati hedeften toleranstan fazla geç mi? Akşam hedefinde gece yarısından sonrası ertesi gün sayılır.
  function isikGecMi(v, hedef, tolerans) {
    if (!v || !hedef) return false;
    let a = saatAnahtari(v);
    const b = saatAnahtari(hedef);
    if (b >= 18 * 60 && a < 12 * 60) a += 24 * 60;
    return a - b > (tolerans == null ? 15 : tolerans);
  }

  // Haftalık ölçüler ve kendi baseline'ın: son n hafta; baseline, bu haftadan önceki en fazla 4 geçerli haftanın ortalaması.
  // Geçerli hafta: takip başladıktan sonra ve en az 4 günü hariç (gezi, askerlik) olmayan hafta.
  const OLCULER = [
    { ad: 'uyku', baslik: 'Uyku hedefinde gece', birim: 'gece', tur: 'uyku', iyi: 1 },
    { ad: 'sabah', baslik: 'Sabah bloğu', birim: 'gün', tur: 'sabah_blogu', iyi: 1 },
    { ad: 'okuma', baslik: 'Okunan gece', birim: 'gece', tur: 'okuma', iyi: 1 },
    { ad: 'film', baslik: 'Film', birim: 'film', tur: 'film', iyi: 0 },
    { ad: 'bisiklet', baslik: 'Bisiklet', birim: 'km', tur: 'bisiklet', iyi: 1 },
    { ad: 'atolye', baslik: 'Atölye', birim: 'dk', tur: 'atolye', iyi: 1 },
    { ad: 'muzik', baslik: 'Haftanın albümü', birim: 'albüm', tur: 'muzik', iyi: 1 },
    { ad: 'dizi', baslik: 'Dizi', birim: 'bölüm', tur: 'dizi', iyi: 0 },
  ];
  function haftalikOlculer(kayitlar, bugun, ayar) {
    ayar = ayar || {};
    const n = ayar.n || 8, haric = ayar.haric || [];
    const uykuH = ayar.uykuHedefi || (() => null);
    const buHafta = haftaBasi(bugun);
    const ilk = kayitlar.map(k => k.t).filter(Boolean).sort()[0];
    const basHafta = ayar.baslangic ? haftaBasi(tarihAyristir(ayar.baslangic)) : (ilk ? haftaBasi(tarihAyristir(ilk)) : buHafta);
    const haftalar = [];
    for (let i = n - 1; i >= 0; i--) {
      const h = gunEkle(buHafta, -7 * i);
      let haricGun = 0;
      for (let g = 0; g < 7; g++) if (haricMi(isoTarih(gunEkle(h, g)), haric)) haricGun++;
      haftalar.push({ bas: isoTarih(h), son: isoTarih(gunEkle(h, 6)), gecerli: h >= basHafta && haricGun < 4, haricGun, buHafta: i === 0 });
    }
    const deger = (o, bas, son) => {
      const ks = kayitlar.filter(k => k.tur === o.tur && k.t >= bas && k.t <= son);
      if (o.ad === 'uyku') return gunlukSon(ks).filter(k => uykuDegerlendir(k, uykuH(k.t)).hepsi === true).length;
      if (o.ad === 'sabah' || o.ad === 'okuma') return ks.filter(k => k.yapildi !== false).length;
      if (o.ad === 'bisiklet') return Math.round(ks.reduce((a, k) => a + (Number(k.km) || 0), 0) * 10) / 10;
      if (o.ad === 'atolye') return ks.reduce((a, k) => a + (Number(k.dk) || 0), 0);
      return ks.length;
    };
    // Hafta bitmeden karşılaştırma: baseline haftanın geçen kısmına oranlanır (bugün, girdisi varsa sayılır)
    const bugunIso = isoTarih(bugun);
    const gecen = gunFarki(buHafta, sadeceGun(bugun));   // bugünden önceki günler
    return OLCULER.map(o => {
      const veriVar = kayitlar.some(k => k.tur === o.tur);
      const degerler = haftalar.map(h => (h.gecerli ? deger(o, h.bas, h.son) : null));
      const onceki = degerler.slice(0, -1).filter(v => v !== null).slice(-4);
      const baz = onceki.length ? onceki.reduce((a, b) => a + b, 0) / onceki.length : null;
      const bu = degerler[degerler.length - 1];
      const bugunVar = kayitlar.some(k => k.tur === o.tur && k.t === bugunIso);
      const gun = gecen + (bugunVar ? 1 : 0);
      const oran = o.ad === 'sabah' ? Math.min(gun, 5) / 5 : gun / 7;
      const beklenen = baz === null ? null : baz * oran;
      return Object.assign({}, o, { veriVar, haftalar, degerler, baz, bazHafta: onceki.length, bu, beklenen,
        fark: beklenen !== null && bu !== null ? bu - beklenen : null });
    });
  }

  function kalanGun(iso, bugun) { return iso ? gunFarki(sadeceGun(bugun), tarihAyristir(iso)) : null; }
  function kalanYazi(n) {
    if (n === null || n === undefined) return '';
    if (n === 0) return 'bugün';
    if (n === 1) return 'yarın';
    if (n > 1) return n + ' gün kaldı';
    if (n === -1) return 'dün geçti';
    return (-n) + ' gün geçti';
  }

  // Açık görevler: en yakın tarihi olan önce, tarihsizler sonda
  function gorevSirala(gorevler) {
    const ilk = g => [g.son_tarih, g.deadline].filter(Boolean).sort()[0] || '9999-99-99';
    return gorevler.slice().sort((a, b) => ilk(a).localeCompare(ilk(b)) || String(a.baslik).localeCompare(String(b.baslik), 'tr'));
  }

  // ---------- para ----------
  // Değerler TL'ye para/fiyatlar.json'daki fiyatlarla çevrilir (GitHub Actions doldurur). Altın ve gümüş has gram
  // karşılığından hesaplanır; kuyumcu işçiliği ve alış-satış farkı yok. Aynı tablolar araclar/para_guncelle.py'de de var.
  const ONS_GRAM = 31.1034768;
  const PARA_BIRIMLERI = { TRY: 'TL', USD: '$', EUR: '€', GBP: '£' };
  // ad: seçim listesinde; adi: varlık listesinde; olcu: miktarın birimi
  const ALTIN_BIRIM = {
    gram24: { ad: 'Gram, 24 ayar', adi: 'Altın, 24 ayar', olcu: 'gr', has: 1 },
    gram22: { ad: 'Gram, 22 ayar (bilezik)', adi: 'Altın, 22 ayar', olcu: 'gr', has: 0.916 },
    gram18: { ad: 'Gram, 18 ayar', adi: 'Altın, 18 ayar', olcu: 'gr', has: 0.75 },
    gram14: { ad: 'Gram, 14 ayar', adi: 'Altın, 14 ayar', olcu: 'gr', has: 0.585 },
    ceyrek: { ad: 'Çeyrek', adi: 'Çeyrek altın', olcu: 'adet', has: 1.754 * 0.916 },
    yarim: { ad: 'Yarım', adi: 'Yarım altın', olcu: 'adet', has: 3.508 * 0.916 },
    tam: { ad: 'Tam', adi: 'Tam altın', olcu: 'adet', has: 7.016 * 0.916 },
    ata: { ad: 'Ata (Cumhuriyet)', adi: 'Ata altın', olcu: 'adet', has: 7.216 * 0.916 },
    ons: { ad: 'Ons', adi: 'Altın, ons', olcu: 'ons', has: ONS_GRAM },
  };
  const GUMUS_BIRIM = {
    gram: { ad: 'Gram, saf', adi: 'Gümüş', olcu: 'gr', has: 1 },
    gram925: { ad: 'Gram, 925 ayar', adi: 'Gümüş, 925 ayar', olcu: 'gr', has: 0.925 },
    ons: { ad: 'Ons', adi: 'Gümüş, ons', olcu: 'ons', has: ONS_GRAM },
  };
  const VARLIK_TURLERI = [
    ['nakit', 'Nakit ve mevduat'], ['altin', 'Altın'], ['gumus', 'Gümüş'], ['hisse', 'Hisse'],
    ['fon', 'Fon'], ['kripto', 'Kripto'], ['diger', 'Diğer'],
  ];
  const BORC_TURLERI = [['kart', 'Kredi kartı'], ['kredi', 'Kredi'], ['taksit', 'Taksit'], ['kisi', 'Kişiye borç'], ['diger', 'Diğer']];

  function kurTry(para, f) {
    if (!para || para === 'TRY') return 1;
    const k = f && f.kur && f.kur[para];
    return typeof k === 'number' && k > 0 ? k : null;
  }

  // Bir varlığın birim fiyatı ve değeri (TL); fiyatı yoksa null. Elle girilen fiyat otomatik fiyatın önüne geçer.
  function varlikDegeri(v, f) {
    const miktar = Number(v.miktar) || 0;
    let birim = null, kaynak = null;
    if (v.elle_fiyat !== undefined && v.elle_fiyat !== null && v.elle_fiyat !== '' && Number(v.elle_fiyat) >= 0) {
      const k = kurTry(v.elle_para || 'TRY', f);
      if (k != null) { birim = Number(v.elle_fiyat) * k; kaynak = 'elle'; }
    }
    if (birim === null) {
      if (v.tur === 'nakit') {
        const k = kurTry(v.para || 'TRY', f);
        if (k != null) { birim = k; kaynak = 'otomatik'; }
      } else if (v.tur === 'altin' || v.tur === 'gumus') {
        const tablo = v.tur === 'altin' ? ALTIN_BIRIM : GUMUS_BIRIM;
        const b = tablo[v.birim] || tablo[v.tur === 'altin' ? 'gram24' : 'gram'];
        const g = f && f[v.tur] && f[v.tur].gram_try;
        if (g > 0) { birim = g * b.has; kaynak = 'otomatik'; }
      } else if (v.tur === 'hisse' || v.tur === 'kripto') {
        const s = f && f.semboller && f.semboller[String(v.sembol || '').trim().toUpperCase()];
        const k = s ? kurTry(s.para, f) : null;
        if (s && s.fiyat > 0 && k != null) { birim = s.fiyat * k; kaynak = 'otomatik'; }
      } else if (v.tur === 'fon') {
        const s = f && f.fonlar && f.fonlar[String(v.kod || '').trim().toUpperCase()];
        if (s && s.fiyat > 0) { birim = s.fiyat; kaynak = 'otomatik'; }
      }
    }
    return { birim, deger: birim === null ? null : birim * miktar, kaynak };
  }

  // Has gram (altın ve gümüş için), diğerlerinde null
  function hasGram(v) {
    const tablo = v.tur === 'altin' ? ALTIN_BIRIM : (v.tur === 'gumus' ? GUMUS_BIRIM : null);
    if (!tablo) return null;
    const b = tablo[v.birim] || tablo[v.tur === 'altin' ? 'gram24' : 'gram'];
    return (Number(v.miktar) || 0) * b.has;
  }

  function borcDegeri(b, f) {
    const k = kurTry(b.para || 'TRY', f);
    return k === null ? null : (Number(b.kalan) || 0) * k;
  }

  // Toplamlar: varlık, borç, net (TL); türe göre dağılım; fiyatı bulunamayanlar
  function paraOzeti(varliklar, borclar, f) {
    let varlik = 0, borc = 0;
    const tur = {}, eksik = [];
    for (const v of varliklar || []) {
      const d = varlikDegeri(v, f);
      if (d.deger === null) { eksik.push(v); continue; }
      varlik += d.deger;
      tur[v.tur] = (tur[v.tur] || 0) + d.deger;
    }
    const borcEksik = [];
    for (const b of borclar || []) {
      if (b.kapandi) continue;
      const d = borcDegeri(b, f);
      if (d === null) { borcEksik.push(b); continue; }
      borc += d;
    }
    return { varlik, borc, net: varlik - borc, tur, eksik, borcEksik };
  }

  // Sonraki son ödeme günü; bu dönem ödendi mi (son ödeme, bir önceki son ödeme gününden sonra yapıldıysa)
  function sonrakiOdeme(b, bugun) {
    const gun = Number(b.son_odeme_gunu);
    if (!gun || gun < 1 || gun > 31 || b.kapandi) return null;
    const bu = sadeceGun(bugun);
    const ayGunu = (y, m) => new Date(y, m, Math.min(gun, new Date(y, m + 1, 0).getDate()));
    let tarih = ayGunu(bu.getFullYear(), bu.getMonth());
    if (tarih < bu) tarih = ayGunu(bu.getFullYear(), bu.getMonth() + 1);
    const onceki = ayGunu(tarih.getFullYear(), tarih.getMonth() - 1);
    const odendi = !!(b.son_odeme && b.son_odeme > isoTarih(onceki));
    return { tarih, kalanGun: gunFarki(bu, tarih), odendi };
  }

  const HAVA = {
    0: 'Açık', 1: 'Çoğunlukla açık', 2: 'Parçalı bulutlu', 3: 'Kapalı', 45: 'Sisli', 48: 'Kırağılı sis',
    51: 'Hafif çisenti', 53: 'Çisenti', 55: 'Yoğun çisenti', 56: 'Donan çisenti', 57: 'Donan çisenti',
    61: 'Hafif yağmur', 63: 'Yağmurlu', 65: 'Kuvvetli yağmur', 66: 'Donan yağmur', 67: 'Donan yağmur',
    71: 'Hafif kar', 73: 'Karlı', 75: 'Yoğun kar', 77: 'Kar taneleri', 80: 'Hafif sağanak', 81: 'Sağanak',
    82: 'Şiddetli sağanak', 85: 'Kar sağanağı', 86: 'Yoğun kar sağanağı', 95: 'Gök gürültülü fırtına',
    96: 'Dolulu fırtına', 99: 'Dolulu fırtına',
  };

  return {
    GUN_KODLARI, GUN_ADLARI, AY_ADLARI, BIRIM, DURUM_ADI, HAVA,
    pad, isoTarih, sadeceGun, tarihAyristir, gunEkle, gunFarki, tarihYazi, kisaTarih, saatYazi, gunModu,
    onYaziAyristir, bolumler, bolumBul, ilkParagraf, basliksizGovde, projeOku, saatAnahtari, gunPlani,
    jsonlOku, eksikGirdiler, haricMi, haftaBasi, kapanisGunu, okumaBloku, albumPlani, etkinGun, hiz, kalanGun, kalanYazi, gorevSirala,
    isikGecMi, OLCULER, haftalikOlculer,
    dkAl, dkYazi, uykuHedefi, gunlukSon, gecKalkti, uykuSinirlari, uykuDegerlendir, uykuPlani, uykuHedefYazisi, ekTen,
    ONS_GRAM, PARA_BIRIMLERI, ALTIN_BIRIM, GUMUS_BIRIM, VARLIK_TURLERI, BORC_TURLERI, kurTry, varlikDegeri, hasGram, borcDegeri, paraOzeti, sonrakiOdeme,
  };
});
