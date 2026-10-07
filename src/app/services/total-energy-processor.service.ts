// src/app/services/total-energy-processor.service.ts
import { Injectable } from "@angular/core";
import { DataProcessor, IndoorBikeData } from "./fitness-machine.service";

@Injectable({
    providedIn: 'root'
})
export class TotalEnergyProcessorService implements DataProcessor {

    private totalEnergyJoules: number = 0;
    private lastElapsedTime: number = 0;

    process(indoorBikeData: IndoorBikeData): IndoorBikeData {
        // Pastikan kita punya waktu dan power yang valid
        if (!indoorBikeData.calculatedElapsedTime || !indoorBikeData.instantaneousPowerPresent) {
             // Jika salah satu tidak ada, kembalikan data apa adanya
             // dengan nilai energi yang sudah terakumulasi sebelumnya
             return {
                ...indoorBikeData,
                calculatedTotalEnergyJoules: this.totalEnergyJoules
             };
        }

        // Hitung selisih waktu dari pemrosesan terakhir
        let timeDelta = 0;
        if (this.lastElapsedTime > 0) { // Hindari perhitungan aneh di awal
            timeDelta = indoorBikeData.calculatedElapsedTime - this.lastElapsedTime;
        }

        // Hitung energi yang ditambahkan pada interval ini (Joule = Watt * Sekon)
        // Gunakan power saat ini (atau 0 jika tidak bergerak/tidak ada power)
        const currentPower = indoorBikeData.instantaneousSpeed > 0 ? indoorBikeData.instantaneousPower : 0;
        const energyDelta = currentPower * timeDelta;

        // Tambahkan ke total energi
        this.totalEnergyJoules += energyDelta;

        // Simpan waktu saat ini untuk perhitungan selanjutnya
        this.lastElapsedTime = indoorBikeData.calculatedElapsedTime;

        // Kembalikan data yang sudah ditambahkan total energi
        return {
            ...indoorBikeData,
            calculatedTotalEnergyJoules: this.totalEnergyJoules
        };
    }

    reset(): void {
        // Reset total energi dan waktu terakhir saat simulasi dimulai ulang
        this.totalEnergyJoules = 0;
        this.lastElapsedTime = 0;
        console.log("TotalEnergyProcessorService reset.");
    }
}