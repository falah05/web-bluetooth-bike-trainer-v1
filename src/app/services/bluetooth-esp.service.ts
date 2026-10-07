import { Injectable } from "@angular/core";
import { ESPControlPacket } from "../models/esp-packet";
import { BehaviorSubject, Subscription } from "rxjs";
import { ESP32_BLE_CONFIG } from "../config/ble-config";

// Kalau tidak ada data baru dari bike trainer selama waktu ini, speed yang dikirim ke ESP32 dipaksa 0
const TRAINER_DATA_TIMEOUT_MS = 2000;

@Injectable({
    providedIn: 'root'
})
export class BluetoothESPService {

    private device?: BluetoothDevice;
    private server?: BluetoothRemoteGATTServer;

    private latestPacket?: ESPControlPacket;

    // Waktu terakhir data asli dari bike trainer (Wahoo) diterima
    private lastTrainerDataMs = 0;

    private sendSubscription?: Subscription;
    private sendInterval?: ReturnType<typeof setInterval>;

    private serviceUUID = ESP32_BLE_CONFIG.serviceUUID;

    private characteristicUUID = ESP32_BLE_CONFIG.characteristicUUID;

    private characteristic?: BluetoothRemoteGATTCharacteristic;

    // Status koneksi, dipakai untuk mewarnai tombol Connect di UI
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    connectionStatus$ = this.connectionStatusSubject.asObservable();


    constructor() {}

    async connect(): Promise<void> {

        this.device = await navigator.bluetooth.requestDevice({

            filters: [
                {
                    namePrefix: 'ESP32'
                }
            ],

            optionalServices: [
                this.serviceUUID
            ]

        });


        console.log(`ESP32 Selected: ${this.device.name}`);

        // Kalau koneksi putus (device dimatikan, keluar jangkauan, dll), status ikut diperbarui
        this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());


        this.server = await this.device.gatt?.connect();

        console.log('GATT Connected');


        const service = await this.server?.getPrimaryService(
            this.serviceUUID
        );

        console.log('Service Found');


        this.characteristic = await service?.getCharacteristic(
            this.characteristicUUID
        );

        console.log('Characteristic Found');


        this.sendInterval = setInterval(() => {

            this.sendPacket();

        }, 100);


        this.connectionStatusSubject.next(true);

        console.log('ESP32 Connected');

    }

    async disconnect(): Promise<void> {

        if(this.device?.gatt?.connected){

            this.device.gatt.disconnect();

        }

        this.onDisconnected();

        console.log('ESP32 Disconnected');

    }


    private onDisconnected(): void {

        if(this.sendInterval){
            clearInterval(this.sendInterval);
            this.sendInterval = undefined;
        }

        this.characteristic = undefined;
        this.connectionStatusSubject.next(false);

    }


    updatePacket(packet: ESPControlPacket): void {

        this.latestPacket = packet;

    }


    // Dipanggil setiap kali ada data BARU dari bike trainer (bukan dari perubahan GPX/state lain)
    markTrainerData(): void {

        this.lastTrainerDataMs = Date.now();

    }


    async sendPacket(): Promise<void> {
        if(!this.latestPacket){
            return;
        }
        if(!this.characteristic){
            console.warn('ESP32 Not Connected');
            return;
        }

        // Kalau data trainer sudah basi, jangan kirim speed lama: paksa 0 supaya fan mati
        const trainerDataStale = Date.now() - this.lastTrainerDataMs > TRAINER_DATA_TIMEOUT_MS;

        const packet: ESPControlPacket = trainerDataStale
            ? { ...this.latestPacket, speed: 0 }
            : this.latestPacket;

        const json = JSON.stringify(packet);

        console.log(`Sending Packet: ${json}`);

        const encoder = new TextEncoder();
        const data = encoder.encode(json);

        await this.characteristic.writeValue(data);
    }
}
