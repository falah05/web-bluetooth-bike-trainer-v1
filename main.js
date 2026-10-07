const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const url = require('url');

// Aturan nama tampilan: kalau nama asli BLE DIAWALI teks ini (tanpa peduli besar/kecil huruf
// atau spasi di ujung), tampilkan sebagai alias. Pakai prefix, bukan cocok persis, karena
// trainer ini menambahkan sufiks ID unik di belakang nama (mis. "KICKR CORE 97B0"), dan
// pencocokan persis gagal kalau ada spasi tersembunyi atau perbedaan besar/kecil huruf.
const DEVICE_DISPLAY_RULES = [
  { prefix: 'kickr core', alias: 'SPARK Device' },
];

function getDisplayName(realName) {
  if (!realName) return '(tanpa nama)';
  const normalized = realName.trim().toLowerCase();
  const rule = DEVICE_DISPLAY_RULES.find(r => normalized.startsWith(r.prefix));
  return rule ? rule.alias : realName;
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'dist/web-bluetooth-bike-trainer/browser/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Pemilihan perangkat Bluetooth (pengganti dialog Chrome)
  let selecting = false;
  let latestList = [];

  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault(); // wajib
    latestList = deviceList;
    // JSON.stringify pada nama asli supaya spasi tersembunyi di awal/akhir ikut terlihat
    console.log('Bluetooth scan:', deviceList.map(d => `${getDisplayName(d.deviceName)} (nama asli: ${JSON.stringify(d.deviceName || null)}) [${d.deviceId}]`));
    if (selecting) return; // scan masih mengirim event, cukup perbarui daftar
    selecting = true;

    const startedAt = Date.now();

    const finish = async () => {
      const list = latestList.slice(0, 8);
      let chosen = ''; // string kosong = batal

      if (list.length > 0) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Pilih perangkat Bluetooth',
          message: 'Perangkat yang ditemukan:',
          buttons: [...list.map(d => getDisplayName(d.deviceName)), 'Batal'],
          cancelId: list.length,
        });
        if (response < list.length) {
          chosen = list[response].deviceId;
          console.log(`Perangkat dipilih: ${getDisplayName(list[response].deviceName)} [${chosen}]`);
        } else {
          console.log('Pemilihan perangkat dibatalkan.');
        }
      } else {
        console.log('Tidak ada perangkat yang ditemukan saat scan.');
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Bluetooth',
          message: 'Tidak ada perangkat yang ditemukan.',
          detail: 'Pastikan perangkat menyala, sedang advertising, dan tidak tersambung ke aplikasi atau perangkat lain. Khusus ESP32, nama BLE-nya harus diawali "ESP32".',
        });
      }

      selecting = false;
      callback(chosen);
    };

    // Tunggu minimal 3 detik, lalu terus menunggu sampai ada perangkat (maksimal 20 detik)
    const waitForDevices = () => {
      if (latestList.length === 0 && Date.now() - startedAt < 20000) {
        setTimeout(waitForDevices, 1000);
      } else {
        finish();
      }
    };
    setTimeout(waitForDevices, 3000);
  });

  // Buka DevTools untuk debugging (hapus tanda // kalau perlu)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Pairing Bluetooth (dipakai kalau perangkat meminta pairing)
app.on('session-created', (session) => {
  session.setBluetoothPairingHandler((details, callback) => {
    callback({ confirmed: true });
  });
});