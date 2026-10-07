import { Injectable } from "@angular/core";
import { DataProcessor, IndoorBikeData } from "./fitness-machine.service";

// --- Konstanta Fisika (Sebagian besar tetap) ---
const CADENCE_FACTOR_NEW = 3.5;
const CADENCE_OFFSET_NEW = 0;
const MIN_CADENCE = 0; 
const MAX_CADENCE = 130;

// Konstanta fisika dasar
const GRAVITY = 9.81; // m/s^2
const CRR = 0.005; // Coefficient of Rolling Resistance (ban jalan raya)
const K_AERO = 0.214; // Konstanta Aero (dari 0.5 * 1.225 * 0.35 CdA) - KITA ANGGAP TETAP
const BASE_POWER = 10; 

@Injectable({
    providedIn: 'root'
})
export class DummyDataProcessorService implements DataProcessor {

    // --- VARIABEL UNTUK BERAT ---
    // Menyediakan nilai default yang wajar (75kg rider + 10kg sepeda)
    private totalMassKg: number = 85.0; 

    constructor() { }

    // --- FUNGSI PUBLIK UNTUK MENERIMA DATA DARI DIALOG ---
    /**
     * Atur parameter berat pengendara untuk perhitungan fisika.
     * @param riderMass Berat pengendara dalam KG
     * @param bikeMass Berat sepeda dalam KG (default 10kg)
     */
    public setRiderMass(riderMass: number, bikeMass: number = 10): void {
        if (riderMass > 0) {
            this.totalMassKg = riderMass + bikeMass;
            console.log(`DummyDataProcessor: Total mass set to ${this.totalMassKg} kg`);
        } else {
            // Gunakan default jika datanya tidak valid (misal, 0 atau null)
            this.totalMassKg = 85.0; 
            console.warn(`DummyDataProcessor: Invalid rider mass, using default 85kg total.`);
        }
    }


    process(indoorBikeData: IndoorBikeData): IndoorBikeData {
        
        const isMoving = indoorBikeData.instantaneousSpeed > 0;

        // --- PERBAIKAN LOGIKA "COASTING" ---
        // Kita HANYA membuat data dummy jika flag 'Present' == false.
        const isPowerMissing = !indoorBikeData.instantaneousPowerPresent;
        const isCadenceMissing = !indoorBikeData.instantaneousCadencePresent;

        if (isMoving && (isPowerMissing || isCadenceMissing)) {
            
            const speed_kmh = indoorBikeData.instantaneousSpeed;
            const speed_ms = speed_kmh / 3.6; 

            let calculatedPower = indoorBikeData.instantaneousPower;
            let calculatedCadence = indoorBikeData.instantaneousCadence;
            
            let wasCadencePresent = indoorBikeData.instantaneousCadencePresent;
            let wasPowerPresent = indoorBikeData.instantaneousPowerPresent;

            // Hitung Cadence dummy HANYA JIKA BENAR-BENAR HILANG
            if (isCadenceMissing) {
                calculatedCadence = Math.round((speed_kmh * CADENCE_FACTOR_NEW) + CADENCE_OFFSET_NEW);
                // calculatedCadence = Math.max(MIN_CADENCE, Math.min(MAX_CADENCE, calculatedCadence));
                calculatedCadence = Math.min(MAX_CADENCE, calculatedCadence);
                wasCadencePresent = true; 
            }

            // Hitung Power dummy HANYA JIKA BENAR-BENAR HILANG
            if (isPowerMissing) {
                
                // --- PERBAIKAN BERAT BADAN ---
                // Hitung K_ROLLING secara dinamis menggunakan totalMassKg
                const K_ROLLING_DYNAMIC = this.totalMassKg * GRAVITY * CRR;

                // Hitung power
                const rollingPower = K_ROLLING_DYNAMIC * speed_ms;
                const aeroPower = K_AERO * Math.pow(speed_ms, 3); // K_AERO tetap
                
                calculatedPower = Math.round(BASE_POWER + rollingPower + aeroPower);
                wasPowerPresent = true;
            }

            return {
                ...indoorBikeData,
                instantaneousCadence: calculatedCadence,
                instantaneousCadencePresent: wasCadencePresent,
                instantaneousPower: calculatedPower,
                instantaneousPowerPresent: wasPowerPresent
            };
        }

        // Kembalikan data apa adanya (termasuk 0 RPM saat coasting)
        return indoorBikeData;
    }

    reset(): void {
        // Saat reset, kembalikan ke nilai default
        this.totalMassKg = 85.0;
    }
}