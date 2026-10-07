import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxGaugeModule } from 'ngx-gauge';
import { CyclingPowerService, PedalPowerBalance } from '../../services/cycling-power.service';

@Component({
  selector: 'app-pedal-power',
  standalone: true,
  imports: [CommonModule, NgxGaugeModule],
  template: `
    <div style="position: relative; text-align: center;">
      <ngx-gauge
          [value]="power"
          [min]="0"
          [max]="1000"
          [type]="'arch'"
          [thick]="20"
          [cap]="'round'"
          [label]="'Pedal Power'"
          [append]="'W'"
          [foregroundColor]="'#4a90d9ff'"
          >
      </ngx-gauge>
      <div *ngIf="balance as b" style="margin-top: 4px; font-size: 0.9em;">
        L {{ b.left | number:'1.0-0' }}% / R {{ b.right | number:'1.0-0' }}%
      </div>
    </div>
  `
})
export class PedalPowerComponent implements OnInit {

  power = 0
  balance: PedalPowerBalance | null = null

  constructor(private cyclingPowerService: CyclingPowerService) { }

  ngOnInit() {
    this.cyclingPowerService.power$.subscribe((power) => {
      this.power = power
    });

    this.cyclingPowerService.balance$.subscribe((balance) => {
      this.balance = balance
    });
  }
}
