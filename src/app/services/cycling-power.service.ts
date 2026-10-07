import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';

export interface PedalPowerBalance {
  left: number  // persen (0-100)
  right: number // persen (0-100)
}

const default_device_name = '' // sengaja kosong, biar tidak menimpa label default gauge sebelum pedal tersambung

// Simpan sampel data crank terakhir untuk menghitung cadence (RPM) dari selisih antar notifikasi.
// Lihat Bluetooth Cycling Power Service spec, karakteristik Cycling Power Measurement (0x2A63).
interface CrankSample {
  cumulativeRevolutions: number // uint16, wrap di 65536
  lastEventTime: number         // uint16, satuan 1/1024 detik, wrap di 65536 (~64 detik)
}

@Injectable({
  providedIn: 'root'
})
export class CyclingPowerService {

  private powerSubject = new BehaviorSubject<number>(0)
  power$ = this.powerSubject.asObservable()

  private cadenceSubject = new BehaviorSubject<number>(0)
  cadence$ = this.cadenceSubject.asObservable()

  // null kalau pedal tidak mengirim data pedal power balance sama sekali
  private balanceSubject = new BehaviorSubject<PedalPowerBalance | null>(null)
  balance$ = this.balanceSubject.asObservable()

  private deviceNameSubject = new BehaviorSubject<string>(default_device_name)
  deviceName$ = this.deviceNameSubject.asObservable()

  constructor(private toastrService: ToastrService) { }

  private device: BluetoothDevice | undefined
  private server: BluetoothRemoteGATTServer | undefined
  private powerMeasurementCharacteristic: BluetoothRemoteGATTCharacteristic | undefined

  private previousCrankSample: CrankSample | undefined

  async connect(): Promise<string> {
    const options: RequestDeviceOptions = {
      acceptAllDevices: false,
      filters: [
        // Difilter berdasarkan nama, bukan cuma service, karena trainer seperti KICKR CORE
        // JUGA mengimplementasikan Cycling Power Service dan ikut muncul kalau filter cuma
        // berdasarkan service. Sesuaikan 'Assioma' ini kalau nama BLE asli pedalmu berbeda
        // (cek log "Bluetooth scan:" di terminal untuk lihat nama persisnya).
        { namePrefix: 'Assioma' }
      ],
      // optionalServices wajib diisi manual, karena begitu filter tidak lagi berbasis
      // service, browser tidak otomatis mengizinkan akses ke service ini setelah connect
      optionalServices: ['cycling_power']
    }

    this.device = await navigator.bluetooth.requestDevice(options)
    console.log('Pedal Device Selected:', this.device)
    this.toastrService.info('Device', this.device.name)

    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected())

    this.server = await this.device.gatt?.connect()

    const service = await this.server?.getPrimaryService('cycling_power')
    this.powerMeasurementCharacteristic = await service?.getCharacteristic('cycling_power_measurement')

    await this.startNotifications()

    const name = this.device.name || default_device_name
    this.deviceNameSubject.next(name)

    return name
  }

  disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect()
      console.log('Pedal Device Disconnected')
    } else {
      console.log('No Pedal Device Connected')
    }
    this.onDisconnected()
  }

  private onDisconnected(): void {
    this.previousCrankSample = undefined
    this.powerSubject.next(0)
    this.cadenceSubject.next(0)
    this.balanceSubject.next(null)
    this.deviceNameSubject.next(default_device_name)
  }

  async startNotifications(): Promise<void> {
    await this.powerMeasurementCharacteristic?.startNotifications()
    this.powerMeasurementCharacteristic?.addEventListener('characteristicvaluechanged', event => this.onPowerMeasurementChanged(event))
  }

  async stopNotifications(): Promise<void> {
    await this.powerMeasurementCharacteristic?.stopNotifications()
    this.powerMeasurementCharacteristic?.removeEventListener('characteristicvaluechanged', event => this.onPowerMeasurementChanged(event))
  }

  private onPowerMeasurementChanged(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic

    if (characteristic.value) {
      // DEBUG SEMENTARA: cetak byte mentah dari Assioma, buat memastikan notifikasi memang
      // masuk dan melihat persis field apa saja yang dikirim. Hapus/comment lagi kalau sudah
      // tidak perlu.
      const bytes = Array.from(new Uint8Array(characteristic.value.buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')
      console.log('[Pedal] Raw notification bytes:', bytes)

      this.parseCyclingPowerMeasurement(characteristic.value)
    }
  }

  // Format lengkap: Bluetooth SIG "Cycling Power Measurement" characteristic (UUID 0x2A63).
  // Cuma field yang kita butuhkan yang diambil nilainya; field lain tetap dilewati (offset digeser)
  // supaya posisi byte field sesudahnya tetap benar.
  private parseCyclingPowerMeasurement(data: DataView): void {
    let offset = 0

    const flags = data.getUint16(offset, true)
    offset += 2

    const balancePresent = (flags & 0x0001) !== 0
    const torquePresent = (flags & 0x0004) !== 0
    const wheelRevPresent = (flags & 0x0010) !== 0
    const crankRevPresent = (flags & 0x0020) !== 0

    // Instantaneous Power: selalu ada, sint16, satuan watt
    const instantaneousPower = data.getInt16(offset, true)
    offset += 2
    this.powerSubject.next(instantaneousPower)

    if (balancePresent) {
      // uint8, satuan 0.5% -> persentase pedal kiri
      const rawBalance = data.getUint8(offset)
      offset += 1

      const leftPercent = rawBalance / 2
      this.balanceSubject.next({
        left: leftPercent,
        right: 100 - leftPercent
      })
    }

    if (torquePresent) {
      offset += 2 // Accumulated Torque (uint16), tidak dipakai, cuma digeser posisinya
    }

    if (wheelRevPresent) {
      offset += 4 // Cumulative Wheel Revolutions (uint32)
      offset += 2 // Last Wheel Event Time (uint16)
    }

    if (crankRevPresent) {
      const cumulativeRevolutions = data.getUint16(offset, true)
      offset += 2
      const lastEventTime = data.getUint16(offset, true)
      offset += 2

      this.updateCadence({ cumulativeRevolutions, lastEventTime })
    }
    // Field lain (extreme force/torque/angles, energy) tidak diproses karena tidak dipakai di app ini.
  }

  private updateCadence(current: CrankSample): void {
    const previous = this.previousCrankSample
    this.previousCrankSample = current

    if (!previous) {
      // Sampel pertama, belum ada selisih untuk dihitung
      return
    }

    let revDiff = current.cumulativeRevolutions - previous.cumulativeRevolutions
    if (revDiff < 0) revDiff += 65536 // wrap-around uint16

    let timeDiff = current.lastEventTime - previous.lastEventTime
    if (timeDiff < 0) timeDiff += 65536 // wrap-around uint16

    if (timeDiff === 0) {
      // Tidak ada revolusi baru sejak notifikasi sebelumnya -> user berhenti mengayuh
      this.cadenceSubject.next(0)
      return
    }

    const timeDiffSeconds = timeDiff / 1024 // satuan waktu event: 1/1024 detik
    const cadenceRpm = (revDiff / timeDiffSeconds) * 60

    this.cadenceSubject.next(Math.round(cadenceRpm))
  }
}