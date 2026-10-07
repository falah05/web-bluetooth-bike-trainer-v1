import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HeartRateService {

  private heartRateMeasurementSubject = new Subject<number>();
  heartRateMeasurement$ = this.heartRateMeasurementSubject.asObservable();

  // Status koneksi, dipakai untuk mewarnai tombol Connect di UI
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(private toastrService: ToastrService) { }

  private device: BluetoothDevice | undefined
  private server: BluetoothRemoteGATTServer | undefined
  private heartRateMeasurementCharacteristic: BluetoothRemoteGATTCharacteristic | undefined

  async connect(): Promise<string> {
    // Prompt the user to select a Bluetooth device offering a Heart Rate service.
    const options: RequestDeviceOptions = {
      acceptAllDevices: false,
      filters: [
        { services: ['heart_rate'] }
      ]
    }

    this.device = await navigator.bluetooth.requestDevice(options)
    console.log('Device selected:', this.device);
    this.toastrService.info("Device", this.device.name)

    // Kalau koneksi putus (device dimatikan, keluar jangkauan, dll), status ikut diperbarui
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected())

    // Connect to the GATT server on the device.
    this.server = await this.device.gatt?.connect()

    const service = await this.server?.getPrimaryService('heart_rate')
    this.heartRateMeasurementCharacteristic = await service?.getCharacteristic('heart_rate_measurement')

    this.connectionStatusSubject.next(true)

    return this.device.name || 'unknown'
  }

  disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
      console.log('Device disconnected');
    } else {
      console.log('No device connected');
    }
    this.onDisconnected()
  }

  private onDisconnected(): void {
    this.connectionStatusSubject.next(false)
    this.heartRateMeasurementSubject.next(0)
  }

  async startNotifications(): Promise<void> {
    await this.heartRateMeasurementCharacteristic?.startNotifications()
    this.heartRateMeasurementCharacteristic?.addEventListener('characteristicvaluechanged', event => this.onHeartRateMeasuermentChanged(event))
  }

  async stopNotifications(): Promise<void> {
    await this.heartRateMeasurementCharacteristic?.stopNotifications()
    this.heartRateMeasurementCharacteristic?.removeEventListener('characteristicvaluechanged', event => this.onHeartRateMeasuermentChanged(event))
  }

  private onHeartRateMeasuermentChanged(event: Event) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;

    if (characteristic.value) {
      this.heartRateMeasurementSubject.next(this.parseHeartRate(characteristic.value))
    }
  }

  // see https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/
  private parseHeartRate(data: DataView): number {
    const flags = data.getUint8(0)
    const rate16Bits = flags & 0x1

    if (rate16Bits) {
      return data.getUint16(1, /*littleEndian=*/ true)
    } else {
      return data.getUint8(1)
    }
  }
}
