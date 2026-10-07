import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatSliderModule} from '@angular/material/slider';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatDialogRef} from '@angular/material/dialog';
import {MatInput, MatInputModule} from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';

import { FITNESS_MACHINE_SERVICE, FitnessMachineService } from '../../services/fitness-machine.service';

@Component({
  selector: 'app-control-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSliderModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatInput,
    MatDividerModule,
  ],
  templateUrl: './control-dialog.component.html',
  styleUrl: './control-dialog.component.scss'
})
export class ControlDialogComponent {
  resistance = 20;
  grade = 5;
  temperature = 27;
  windSpeed = 10;
  debugGrade = 0;

  constructor(
    private dialogRef: MatDialogRef<ControlDialogComponent>,
    @Inject(FITNESS_MACHINE_SERVICE)
    private fitnessMachineService: FitnessMachineService
  ) {

  }

  increaseTemperature() {
    this.temperature++;
  }
  
  decreaseTemperature() {
    this.temperature--;
  }

  increaseWind() {
    this.windSpeed++;
  }

  decreaseWind() {
    this.windSpeed--;
  }

  restoreDefault() {
    this.resistance = 20;
    this.grade = 5;
    this.temperature = 27;
    this.windSpeed = 10;
  }

  close() {
    this.dialogRef.close();
  }

  apply(): void {
    console.log({
      resistance: this.resistance,
      grade: this.grade,
      temperature: this.temperature,
      windSpeed: this.windSpeed
    });

    this.dialogRef.close()
  }

  sendGrade(): void {
    this.fitnessMachineService.setIndoorBikeSimulationParameters(
          0,
          this.debugGrade,
          0.004,
          0.51
        )
        .then(() => {
            console.log(
                `Grade ${this.debugGrade}% berhasil dikirim`
            );
        })
        .catch((err: unknown) => {
            console.error(err);
        });
  }
}
