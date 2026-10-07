import { Component, OnInit } from '@angular/core';
import { NgxGaugeModule } from 'ngx-gauge';
import { HeartRateService } from '../../services/heart-rate.service';

const default_heart_rate = 0;

@Component({
  selector: 'app-heart-rate',
  standalone: true,
  imports: [NgxGaugeModule],
  template: `
    <ngx-gauge
        [value]="heartRate"
        [min]="0"
        [max]="250"
        [type]="'arch'"
        [thick]="15"
        [cap]="'round'"
        [label]="'Heart Rate'"
        [append]="'BPM'"
        [foregroundColor]="'#ff8859ff'"
        >
    </ngx-gauge>
  `
})
export class HeartRateComponent implements OnInit {

  heartRate = default_heart_rate

  constructor(private heartRateService: HeartRateService) { }

  ngOnInit() {
    this.heartRateService.heartRateMeasurement$.subscribe((heartRate) => {
      this.heartRate = heartRate
    });
  }
}
