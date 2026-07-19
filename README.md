# APK Dönüştürücü Prototipi

Bu proje, bir dosya yolunu alan ve bu dosyadan Termux üzerinde derlenebilecek Android proje şablonu üreten bir Node.js sunucusudur.

## Özellikler
- `/api/health` sağlık kontrolü
- `/api/convert` ile dosyadan Android proje şablonu üretme
- `/` adresinde web arayüzü
- Üretilen proje klasöründe Termux için `build-apk.sh` betiği

## Sunucuyu çalıştırma
```bash
npm start
```

Ardından tarayıcıda http://127.0.0.1:3101/ adresini açın.

## Termux kurulumu
```bash
pkg update -y
pkg install -y nodejs git
cd ~/storage/shared
git clone <repo-url>
cd <repo-folder>
npm install
npm start
```

Üretilen proje klasörüne girip:
```bash
bash build-apk.sh
```

çalıştırarak APK üretmeye başlayabilirsiniz.

## Not
Gerçek `.apk` üretimi için Android SDK, platform araçları ve adb ortamı gereklidir. Bu sürüm, Termux’ta kurulum ve derleme akışı sağlayan güçlü bir prototiptir.
