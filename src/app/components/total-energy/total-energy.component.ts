// src/app/components/total-energy/total-energy.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Tetap butuhkan CommonModule jika ada *ngIf dll. di masa depan
// import { NgxGaugeModule } from 'ngx-gauge'; // <-- Hapus import ini
import { FITNESS_MACHINE_SERVICE, FitnessMachineService, IndoorBikeData } from '../../services/fitness-machine.service';

@Component({
  selector: 'app-total-energy',
  standalone: true,
  imports: [
    CommonModule
    // NgxGaugeModule // <-- Hapus dari imports
  ],
  // Kembalikan template ke teks biasa
  template: `
    ⚡️ {{ energyKJ }} kJ
  `
})
export class TotalEnergyComponent implements OnInit {

  energyKJ = "0.0"; // Gunakan properti biasa, bukan Observable

  constructor(@Inject(FITNESS_MACHINE_SERVICE) private fitnessMachineService: FitnessMachineService) { }

  ngOnInit() {
    // Langganan dan update properti energyKJ secara langsung
    this.fitnessMachineService.indoorBikeData$.subscribe(
      (data: IndoorBikeData) => {
        const joules = data.calculatedTotalEnergyJoules || 0;
        // Konversi ke kJ dan format string
        this.energyKJ = (joules / 1000).toFixed(1);
      }
    );
  }

  // Fungsi calculateMaxEnergy() tidak diperlukan lagi dan bisa dihapus
  // calculateMaxEnergy(): number { ... }
}