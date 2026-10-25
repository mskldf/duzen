/* Kılavuz: Düzen'in kısa kullanım kılavuzu (#kilavuz); üstteki ? simgesinden ve Daha'dan açılır. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const adres = () => location.origin + location.pathname.replace(/index\.html$/, '');

  function metin() {
    const kisa = adres().replace(/^https?:\/\//, '');
    return [
      'Düzen\'de projelerin, iş görevlerin, günlük girdilerin ve koçun bir arada. Veri GitHub\'daki **duzen-veri** deposunda durur; Claude da oradan okur ve oraya yazar.',
      '',
      '## Bir gün',
      '- **Sabah:** Bugün\'e bak. En üstte şu anki ve sıradaki blok var.',
      '- **Gün içinde:** kutucuklara dokun. Albümü bitirince **Dinledim**, dizi bölümü bitince dizinin kutucuğu (**+1 bölüm**), film izleyince **Film izledim**. Yanlış dokunursan altta çıkan bildirimdeki **Geri al**.',
      '- **Akşam 21:50:** telefona "Günü kapat" hatırlatması gelir. **Günü kapat** kutucuğuna dokun: uyku, sabah bloğu ve dün geceki okuma tek pencerede. Boş bıraktığın kaydedilmez.',
      '- **20:00\'den sonra** Bugün\'ün altında yarının planı çıkar.',
      '',
      '## Pazar',
      '- 19:47\'de haftalık özet bildirimi gelir.',
      '- 20:41\'de koç haftayı değerlendirir. Koç sayfasında okursun; önerilere **Kabul** ya da **Reddet** dersin. Bir haftadan eski öneri gizlenir.',
      '',
      '## Bölümler',
      '- **Bugün:** şimdi ve sıradaki, kutucuklar, açık işler, projelerde sıradaki adım, günün planı.',
      '- **Defter:** 2027 projeleri, durumları ve sıradaki adımları. Değiştirmek için sohbette "güncelle" de.',
      '- **İş:** görevler. **Görev ekle**, bitince **Bitti olarak işaretle**. Cuma günü haftalık döküm hazır olur.',
      '- **Koç:** 2027 hızı, haftalık grafikler (her ölçü kendi ortalamanla), uyku, son girdiler, değerlendirme.',
      '- **Daha:** Müzik, Diziler, Film defteri, Saatler, Gelen kutusu, Odak modu, Ayarlar.',
      '',
      '## Kısayollar',
      '- Ana ekrandaki Düzen simgesine basılı tut: **Günü kapat**, **Albüm dinledim**, **Film izledim**, **Görev ekle**.',
      '- Bir linki ya da fotoğrafı paylaşırken **Düzen**\'i seç: Gelen kutusuna düşer, Pazar günü koç yerine taşır.',
      '',
      '## Yeni cihaz',
      '1. Chrome\'da **' + kisa + '** adresini aç.',
      '2. ⋮ menüsünden **Ana ekrana ekle** (ya da **Uygulamayı yükle**).',
      '3. Anahtar için: anahtarı olan cihazda Ayarlar, sonra **Başka cihaza aktar (QR)**; yeni cihazda **QR\'ı okut**.',
      '',
      '## Sorun olursa',
      '- Üstte kırmızı şerit "Anahtar geçersiz" diyorsa: GitHub\'da yeni anahtar oluştur, Ayarlar\'dan gir.',
      '- Veri eski görünüyorsa: sağ üstteki yenile simgesi.',
      '- Film defterinde tür ve yönetmen gelmiyorsa: TMDB anahtarı duzen-veri\'de `TMDB_API_KEY` sırrı olarak eklenmeli.',
    ].join('\n');
  }

  D.gorunum('kilavuz', () => '<article class="kilavuz"><header class="bolum-bas"><h1>Kılavuz</h1></header>' +
    '<div class="metin">' + D.md(metin()) + '</div>' +
    '<p class="kilavuz-bag"><button type="button" class="dugme ikincil" data-kopyala="' + D.esc(adres()) + '">Düzen\'in linkini kopyala</button></p>' +
    '</article>', 'daha');
});
