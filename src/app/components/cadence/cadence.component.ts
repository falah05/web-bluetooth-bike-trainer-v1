import { Component, OnInit } from '@angular/core';
import { NgxGaugeModule } from 'ngx-gauge';
import { CyclingPowerService } from '../../services/cycling-power.service';

const default_cadence = 0

@Component({
  selector: 'app-cadence',
  standalone: true,
  imports: [NgxGaugeModule],
  template: `
    <ngx-gauge
        [value]="cadence"
        [min]="0"
        [max]="200"
        [type]="'arch'"
        [thick]="20"
        [cap]="'round'"
        [label]="'Cadence'"
        [append]="'RPM'"
        [foregroundColor]="'#ff8859ff'"
        >
    </ngx-gauge>
  `
})
export class CadenceComponent implements OnInit {

  cadence = default_cadence

  constructor(private cyclingPowerService: CyclingPowerService) { }

  ngOnInit() {
    this.cyclingPowerService.cadence$.subscribe((cadence) => {
      this.cadence = cadence
    });
  }
}