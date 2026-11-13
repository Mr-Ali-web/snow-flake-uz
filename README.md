# snow-flake-uz

Ish stolida qor yog'adi (Windows va macOS). Qor ochiq oynalarning tepasiga va Dock/taskbar ustiga qo'nib uyum bo'ladi, kursor bilan supurib tashlasa bo'ladi.

## Yuklab olish
[Releases](../../releases) bo'limidan: Windows uchun `.exe`, Mac uchun `.dmg`.

- Windows: o'rnatishda "Windows protected your PC" chiqsa, *More info → Run anyway*.
- Mac: ilova imzolanmagan, birinchi marta o'ng tugma → *Open*.

## Boshqaruv
Tray (Windows) yoki menyu qatoridagi (Mac) qor belgisi: qor kuchi, shamol, qor uyumi, oynalar ustida qor, pauza, tozalash, avtostart.

## Kod bilan ishga tushirish
```
npm install
npm start
```
Sozlamalar `renderer.js` tepasidagi `TUNE` ichida.

## O'yin rejimi

Tray/menu bar menyusidan **O'yin rejimi**ni yoqing yoki `Ctrl+Shift+S` (Windows) / `Cmd+Shift+S` (macOS) bosing. Qor uyumini bosib sudrab qor to'pini yasang; mavjud to'pni ham sudrashingiz mumkin. Uchta kichrayib boruvchi to'pni ustma-ust qo'yib qor odam yasang. `Esc` yoki shortcut click-through rejimni qaytaradi. **Uyumni tozalash** to'plar va qor odamni ham o'chiradi.

## Vizual sozlamalar

Tray menyusida shamol kuchini (kuchsiz/o'rtacha/kuchli) va qor rangini (oq/sovuq ko'k) tanlash mumkin; tanlovlar saqlanadi. Qor parchalari turli kristall shakllari va mayin yaltirashga ega. Kursor tinch turganda frame rate tushadi, fullscreen oyna aniqlansa yanada kamayadi.

## Tekshirish

`npm start` bilan ilovani ishga tushirib, tray menyusidan shamol, rang va play mode'ni tekshiring. O'yin rejimida qorni bosib tortib to'pni kattalashtiring, uch xil o'lchamdagi to'pni ustma-ust qo'ying. `Esc` bilan click-through rejimiga qayting va oynalarda bosish overlay tomonidan to'silmasligini tekshiring. Fullscreen ilovada animatsiya sekinlashganini kuzating.

## OS-ийн онцлог

- **Windows:** oynalar skaneri PowerShell va DWM ishlatadi. DPI masshtablari turlicha monitorlarda koordinatalar, shortcut boshqa ilovada band bo'lsa esa shortcut ishlashi farq qilishi mumkin.
- **macOS:** oynalarni o'qish uchun System Events/Accessibility ruxsati kerak. Ruxsatsiz holatda ekran pastidagi qor ishlaydi, ammo oyna chetidagi qor uyumi va fullscreen aniqlash ishlamasligi mumkin.

## Litsenziya
MIT
