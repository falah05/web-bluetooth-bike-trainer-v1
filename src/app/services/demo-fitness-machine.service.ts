import { Injectable } from '@angular/core';
import { FitnessMachineService, IndoorBikeData, ProcessingPipeline } from './fitness-machine.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

const MIN_SPEED = 5
const MAX_SPEED = 50
const MIN_CADENCE = 60
const MAX_CADENCE = 110
const MIN_POWER = 20
const MAX_POWER = 300

@Injectable({
  providedIn: 'root'
})
export class DemoFitnessMachineService implements FitnessMachineService {

  public supportedResistanceLevelRange = {
    minimumResistanceLevel: 0,
    maximumResistanceLevel: 100,
    minimumIncrement: 1
  };

  private readonly indoorBikeDataSubject = new Subject<IndoorBikeData>()
  indoorBikeData$ = this.indoorBikeDataSubject.asObservable()

  private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public readonly connectionStatus$ = this.connectionStatusSubject.asObservable();

  intervalId: any | undefined;

  speed = 30
  cadence = 90
  power = 150

  constructor(
    private toastrService: ToastrService,
    private processingPipeline: ProcessingPipeline
  ) {
  }

  connect(): Promise<void> {
    this.toastrService.success('Demo connected.')
    this.connectionStatusSubject.next(true);
    this.processingPipeline.reset()
    return Promise.resolve()
  }

  disconnect(): void {
    this.toastrService.success('Demo disconnected.')
    this.connectionStatusSubject.next(false);
  }

  startNotifications(): Promise<void> {
    return new Promise(resolve => {
      this.intervalId = setInterval(() => {
        this.simulateValues()

        let indoorBikeData: IndoorBikeData = {
          instantaneousSpeedPresent: true,
          instantaneousSpeed: this.speed,
          averageSpeedPresent: false,
          averageSpeed: 0,
          instantaneousCadencePresent: true,
          instantaneousCadence: this.cadence,
          averageCadencePresent: false,
          averageCadence: 0,
          instantaneousPowerPresent: true,
          instantaneousPower: this.power,
          averagePowerPresent: false,
          averagePower: 0,
          expendedEnergyPresent: false,
          totalEnergy: 0,
          energyPerHour: 0,
          energyPerMinute: 0,
          heartRatePresent: false,
          heartRate: 0,
          metabolicEquivalentPresent: false,
          metabolicEquivalent: 0,
          nativeElapsedTimePresent: false,
          nativeElapsedTime: 0,
          nativeResistanceLevelPresent: false,
          nativeResistanceLevel: 0,
          nativeTotalDistancePresent: false,
          nativeTotalDistance: 0, // in m

          calculatedElapsedTime: 0,
          calculatedTotalDistance: 0, // m
          calculatedGrade: 0 // %
        };

        // Apply all processors that augment the data.
        indoorBikeData = this.processingPipeline.process(indoorBikeData)

        this.indoorBikeDataSubject.next(indoorBikeData);
      }, 500);
      resolve()
    })
  }

  stopNotifications(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = undefined
        resolve()
      } else {
        reject()
      }
    })
  }

  async setTargetResistancePercentage(percentage: number): Promise<void> {
    console.log(`[DEMO] Setting target resistance to ${percentage}%`);
    return this.setTargetResistanceLevel(percentage);
  }

  async setTargetResistanceLevel(resistanceLevel: number): Promise<void> {
    console.log(`[DEMO] Setting target resistance level to ${resistanceLevel}`);
    return Promise.resolve();
  }

  async setTargetPower(power: number): Promise<void> {
    console.log(`[DEMO] Setting target power to ${power}W`);
    this.power = power;
    return Promise.resolve();
  }

  // NEW
  async setIndoorBikeSimulationParameters(
    windSpeed: number,
    grade: number,
    crr: number,
    cw: number
  ): Promise<void> {

    console.log('Demo Trainer');
    console.log({
      windSpeed,
      grade,
      crr,
      cw
    });

  }

  private simulateValues() {
    this.speed += Math.random() * 10 - 5
    if (this.speed < MIN_SPEED) {
      this.speed = MIN_SPEED
    } else if (this.speed > MAX_SPEED) {
      this.speed = MAX_SPEED
    }

    this.cadence += Math.random() * 10 - 5
    if (this.cadence < MIN_CADENCE) {
      this.cadence = MIN_CADENCE
    } else if (this.cadence > MAX_CADENCE) {
      this.cadence = MAX_CADENCE
    }

    this.power += Math.random() * 10 - 5
    if (this.power < MIN_POWER) {
      this.power = MIN_POWER
    } else if (this.power > MAX_POWER) {
      this.power = MAX_POWER
    }
  }
}