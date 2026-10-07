/// <reference types="web-bluetooth" />

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FitnessMachineService, IndoorBikeData, ProcessingPipeline, SupportedResistanceLevelRange } from './fitness-machine.service';
import { SimulationStateService } from './simulation-state.service';

interface SupportedPowerRange {
  minimumPower: number,
  maximumPower: number,
  minimumIncrement: number
}

@Injectable({
  providedIn: 'root'
})
export class BluetoothFitnessMachineService implements FitnessMachineService {

  private readonly indoorBikeDataSubject = new Subject<IndoorBikeData>();
  public readonly indoorBikeData$ = this.indoorBikeDataSubject.asObservable();

  private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public readonly connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(
    private toastrService: ToastrService,
    private processingPipeline: ProcessingPipeline,
    private simulationStateService: SimulationStateService,
  ) { }

  private device: BluetoothDevice | undefined;
  private server: BluetoothRemoteGATTServer | undefined;
  private indoorBikeDataCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private fitnessMachineControlPointCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private wahooCyclingPowerCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

  public supportedResistanceLevelRange: SupportedResistanceLevelRange | undefined;
  public supportedPowerRange: SupportedPowerRange | undefined;
  
  private lastIndoorBikeData: Partial<IndoorBikeData> = {};
  lastGrade: number | undefined = 0;

  async connect(): Promise<void> {
    try {
      const wahooCyclingPowerServiceUUID = 'a026e005-0a7d-4ab3-97fa-f1500f9feb8b';
      const wahooCyclingPowerCharacteristicUUID = 'a026e006-0a7d-4ab3-97fa-f1500f9feb8b';

      const options: RequestDeviceOptions = {
        acceptAllDevices: false,
        filters: [{ services: ['fitness_machine'] }],
        optionalServices: ['fitness_machine', wahooCyclingPowerServiceUUID]
      };

      this.device = await navigator.bluetooth.requestDevice(options);
      console.log('Device selected:', this.device);
      this.toastrService.info("Device", this.device.name);
      this.device.addEventListener('gattserverdisconnected', () => this.onGattServerDisconnected());

      this.server = await this.device.gatt?.connect();

      const ftmsService = await this.server?.getPrimaryService('fitness_machine');
      this.indoorBikeDataCharacteristic = await ftmsService?.getCharacteristic('indoor_bike_data');
      this.fitnessMachineControlPointCharacteristic = await ftmsService?.getCharacteristic('fitness_machine_control_point');

      try {
        const wahooService = await this.server?.getPrimaryService(wahooCyclingPowerServiceUUID);
        this.wahooCyclingPowerCharacteristic = await wahooService?.getCharacteristic(wahooCyclingPowerCharacteristicUUID);
        console.log('Wahoo custom power/cadence service found!');
        this.toastrService.success('Wahoo Power/Cadence service connected.');
      } catch (error) {
        console.warn('Wahoo custom service not found. Power and Cadence might not be available.', error);
        this.toastrService.warning('Wahoo custom service not found.');
      }

      const supportedResistanceLevelRangeCharacteristic = await ftmsService?.getCharacteristic('supported_resistance_level_range');
      const supportedResistanceLevelRangeValue = await supportedResistanceLevelRangeCharacteristic?.readValue();
      if (supportedResistanceLevelRangeValue) {
        this.supportedResistanceLevelRange = this.parseSupportedResistanceLevelRange(supportedResistanceLevelRangeValue);
        console.log('Supported Resistance Level Range:', this.supportedResistanceLevelRange);
      }
      
      const supportedPowerRangeCharacteristic = await ftmsService?.getCharacteristic('supported_power_range');
      const supportedPowerRangeValue = await supportedPowerRangeCharacteristic?.readValue();
      if (supportedPowerRangeValue) {
        this.supportedPowerRange = this.parseSupportedPowerRange(supportedPowerRangeValue);
      }

      this.fitnessMachineControlPointCharacteristic?.addEventListener('characteristicvaluechanged', (event: Event) => this.onControlPointChanged(event));
      await this.fitnessMachineControlPointCharacteristic?.startNotifications();

      await this.requestControl();
      await this.reset();
      await this.setWheelCircumference(2200);

      this.processingPipeline.reset();
      this.connectionStatusSubject.next(true);
    } catch (error) {
      this.connectionStatusSubject.next(false);
      console.error('Error connecting and setting up FitnessMachineService:', error);
      throw error;
    }
  }

  async startNotifications(): Promise<void> {
    if (this.indoorBikeDataCharacteristic) {
        this.indoorBikeDataCharacteristic.addEventListener('characteristicvaluechanged', this.onIndoorBikeDataChanged.bind(this));
        await this.indoorBikeDataCharacteristic.startNotifications();
    }

    if (this.wahooCyclingPowerCharacteristic) {
        this.wahooCyclingPowerCharacteristic.addEventListener('characteristicvaluechanged', this.onWahooDataChanged.bind(this));
        await this.wahooCyclingPowerCharacteristic.startNotifications();
    }
  }

  async stopNotifications(): Promise<void> {
    if (this.indoorBikeDataCharacteristic) {
        this.indoorBikeDataCharacteristic.removeEventListener('characteristicvaluechanged', this.onIndoorBikeDataChanged.bind(this) as any);
        await this.indoorBikeDataCharacteristic.stopNotifications();
    }
    if (this.wahooCyclingPowerCharacteristic) {
        this.wahooCyclingPowerCharacteristic.removeEventListener('characteristicvaluechanged', this.onWahooDataChanged.bind(this) as any);
        await this.wahooCyclingPowerCharacteristic.stopNotifications();
    }
  }
  
  private onIndoorBikeDataChanged(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (characteristic.value) {
      const ftmsData = this.parseIndoorBikeData(characteristic.value);
      this.lastIndoorBikeData.instantaneousSpeed = ftmsData.instantaneousSpeed;
      this.lastIndoorBikeData.instantaneousSpeedPresent = ftmsData.instantaneousSpeedPresent;
      this.publishCombinedData();
    }
  }

  private onWahooDataChanged(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (characteristic.value) {
      const { power, cadence } = this.parseWahooData(characteristic.value);
      this.lastIndoorBikeData.instantaneousPower = power;
      this.lastIndoorBikeData.instantaneousPowerPresent = true;
      if (cadence !== null) {
        this.lastIndoorBikeData.instantaneousCadence = cadence;
        this.lastIndoorBikeData.instantaneousCadencePresent = true;
      }
      this.publishCombinedData();
    }
  }

  private publishCombinedData(): void {
    if (this.lastIndoorBikeData.instantaneousSpeed === undefined) {
      return; 
    }

    let combinedData: IndoorBikeData = {
      instantaneousSpeedPresent: false, instantaneousSpeed: 0,
      averageSpeedPresent: false, averageSpeed: 0,
      instantaneousCadencePresent: false, instantaneousCadence: 0,
      averageCadencePresent: false, averageCadence: 0,
      instantaneousPowerPresent: false, instantaneousPower: 0,
      averagePowerPresent: false, averagePower: 0,
      expendedEnergyPresent: false, totalEnergy: 0, energyPerHour: 0, energyPerMinute: 0,
      heartRatePresent: false, heartRate: 0,
      metabolicEquivalentPresent: false, metabolicEquivalent: 0,
      nativeElapsedTimePresent: false, nativeElapsedTime: 0,
      nativeResistanceLevelPresent: false, nativeResistanceLevel: 0,
      nativeTotalDistancePresent: false, nativeTotalDistance: 0,
      calculatedElapsedTime: 0, calculatedTotalDistance: 0, calculatedGrade: 0
    };

    combinedData = { ...combinedData, ...this.lastIndoorBikeData };
    const processedData = this.processingPipeline.process(combinedData);
    this.indoorBikeDataSubject.next(processedData);

    this.simulationStateService.updateState({
      speed: processedData.instantaneousSpeed,
      cadence: processedData.instantaneousCadence,
      power: processedData.instantaneousPower,
      heartRate: processedData.heartRate,
      elevation: 0,
      grade: processedData.calculatedGrade,
      distance: processedData.calculatedTotalDistance,
      simulationRunning: true
    });

    if (this.lastGrade !== processedData.calculatedGrade) {
        // this.setResistanceForGrade(processedData.calculatedGrade);
        this.lastGrade = processedData.calculatedGrade;
        this.updateSimulation();
        console.log("Grade berubah: ", processedData.calculatedGrade);
    }
  }
  
  private parseWahooData(data: DataView): { power: number, cadence: number | null } {
    let power = 0;
    let cadence = null;
    if (data.byteLength >= 4) {
      power = data.getUint16(2, true);
    }
    if (data.byteLength >= 5) {
      const flags = data.getUint8(1);
      if (flags & 0x10) {
        cadence = data.getUint8(4);
      }
    }
    return { power, cadence };
  }

  private setResistanceForGrade(grade: number): void {
    const validGrade = grade ?? 0;
    let resistance = 0;
    if (validGrade > 0) {
      const maxGradeForScaling = 20;
      resistance = (validGrade / maxGradeForScaling) * 10;
    }
    resistance = Math.max(0, Math.min(10, resistance));
    this.setTargetResistanceLevel(resistance)
      .then(() => console.log(`Successfully set resistance for grade ${validGrade.toFixed(1)}%`))
      .catch(error => console.error(`Error setting resistance for grade ${validGrade.toFixed(1)}%:`, error));
  }

  private onGattServerDisconnected(): void {
    this.toastrService.warning('Trainer disconnected.');
    this.connectionStatusSubject.next(false);
  }

  // NEW
    private decodeResultCode(code: number): string {

    switch (code) {

      case 1:
        return "SUCCESS";

      case 2:
        return "NOT SUPPORTED";

      case 3:
        return "INVALID PARAMETER";

      case 4:
        return "OPERATION FAILED";

      case 5:
        return "CONTROL NOT PERMITTED";

      default:
        return "UNKNOWN (" + code + ")";
    }
  }

  // Komen untuk debugging
  // private onControlPointChanged(event: Event): void {
  //   const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
  //   if (value) {
  //     const decodedValue = value.getUint8(0) + " " + value.getUint8(1) + " " + value.getUint8(2);
  //     console.info('FMCP value change:', decodedValue);
  //   } else {
  //     console.error('FMCP: Empty notification received');
  //   }
  // }

  private onControlPointChanged(event: Event): void {

    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;

    const value = characteristic.value;

    if (!value) {
      console.error("FMCP: Empty response");
      return;
    }

    const bytes: number[] = [];

    for (let i = 0; i < value.byteLength; i++) {
      bytes.push(value.getUint8(i));
    }

    console.log("=================================");
    console.log("FTMS Control Point Response");
    console.log("Raw Bytes :", bytes);
    console.log(
      "Hex       :",
      bytes.map(b => "0x" + b.toString(16).padStart(2, "0")).join(" ")
    );

    if (bytes.length >= 3 && bytes[0] === 0x80) {

        console.log("Response Opcode : 0x80");

        console.log(
            "Request Opcode  : 0x" +
            bytes[1].toString(16)
        );

        console.log(
            "Result          : " +
            this.decodeResultCode(bytes[2])
        );

    }
    console.log("=================================");

  }

  async disconnect(): Promise<void> {
    if (this.fitnessMachineControlPointCharacteristic) {
      this.fitnessMachineControlPointCharacteristic.removeEventListener('characteristicvaluechanged', this.onControlPointChanged as any);
      await this.fitnessMachineControlPointCharacteristic.stopNotifications();
    }
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
      console.log('Device disconnected');
    } else {
      console.log('No device connected');
      this.connectionStatusSubject.next(false);
    }
  }

  async requestControl(): Promise<void> {
    const requestControlMessage = Uint8Array.of(0x00);
    await this.fitnessMachineControlPointCharacteristic?.writeValue(requestControlMessage);
  }

  async reset(): Promise<void> {
    const resetMessage = Uint8Array.of(0x01);
    await this.fitnessMachineControlPointCharacteristic?.writeValue(resetMessage);
  }

  // *** FUNGSI INI DITAMBAHKAN KEMBALI UNTUK MENGATASI ERROR ***
  async setTargetResistancePercentage(percentage: number): Promise<void> {
    if (!this.supportedResistanceLevelRange) {
      return Promise.reject(new Error('Supported resistance level range not available.'));
    }
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const level = (clampedPercentage / 100) * this.supportedResistanceLevelRange.maximumResistanceLevel;
    console.log(`Setting resistance to ${clampedPercentage}%, which is level ${level.toFixed(2)}`);
    return this.setTargetResistanceLevel(level);
  }
  
  // *** FUNGSI INI KEMBALI MENGGUNAKAN LOGIKA ASLI ANDA (* 2) ***
  async setTargetResistanceLevel(resistanceLevel: number): Promise<void> {
    if (!this.supportedResistanceLevelRange) {
      return Promise.reject(new Error('No supported resistance level range present.'));
    }
    if (resistanceLevel < this.supportedResistanceLevelRange.minimumResistanceLevel || resistanceLevel > this.supportedResistanceLevelRange.maximumResistanceLevel) {
      return Promise.reject(new Error('Requested resistance level ' + resistanceLevel + " is out of range. " + JSON.stringify(this.supportedResistanceLevelRange)));
    }
    const setTargetResistanceLevelMessage = Uint8Array.of(0x04, resistanceLevel * 2);
    await this.fitnessMachineControlPointCharacteristic?.writeValue(setTargetResistanceLevelMessage);
  }

  async setTargetPower(power: number): Promise<void> {
    if (!this.supportedPowerRange) {
      return Promise.reject(new Error('No supported power range present.'));
    }
    if (power < this.supportedPowerRange.minimumPower || power > this.supportedPowerRange.maximumPower) {
      return Promise.reject(new Error('Requested power ' + power + " is out of range." + this.supportedPowerRange));
    }
    const setTargetPowerMessage = Uint8Array.of(0x05, power & 0xFF, (power >> 8) & 0xFF);
    await this.fitnessMachineControlPointCharacteristic?.writeValueWithResponse(setTargetPowerMessage);
  }
  
  async setIndoorBikeSimulationParameters(windSpeed: number, grade: number, crr: number, cw: number): Promise<void> {
    const scaledWindSpeed = Math.round(windSpeed * 1000);
    const scaledGrade = Math.round(grade * 100);
    const scaledCrr = Math.round(crr * 10000);
    const scaledCw = Math.round(cw * 100);
    const setIndoorBikeSimulationParametersMessage = Uint8Array.of(
      0x11,
      scaledWindSpeed & 0xFF, (scaledWindSpeed >> 8) & 0xFF,
      scaledGrade & 0xFF, (scaledGrade >> 8) & 0xFF,
      scaledCrr & 0xFF,
      scaledCw & 0xFF
    );
    await this.fitnessMachineControlPointCharacteristic?.writeValueWithResponse(setIndoorBikeSimulationParametersMessage);
  }

  // New Function
  async updateSimulation(): Promise<void> {
    const state = this.simulationStateService.getCurrentState();
    console.table(state);

    await this.setIndoorBikeSimulationParameters(
      state.windSpeed,
      state.grade,
      0.004,
      0.51
    );
  }

  async setWheelCircumference(circumference: number): Promise<void> {
    const scaledCircumference = Math.round(circumference * 10);
    const setWheelCircumferenceMessage = Uint8Array.of(
      0x12,
      scaledCircumference & 0xFF, (scaledCircumference >> 8) & 0xFF
    );
    await this.fitnessMachineControlPointCharacteristic?.writeValueWithResponse(setWheelCircumferenceMessage);
  }

  private parseIndoorBikeData(data: DataView): Partial<IndoorBikeData> {
    const flags = data.getUint16(0, true);
    const moreDataPresent = flags & 0x0001;
    let index = 2;
    let speed = 0;
    
    if (!moreDataPresent) {
        if (data.byteLength >= 4) {
            speed = data.getUint16(index, true) / 100;
        }
    }

    return { 
        instantaneousSpeed: speed,
        instantaneousSpeedPresent: !moreDataPresent
    };
  }
  
  private parseSupportedResistanceLevelRange(data: DataView): SupportedResistanceLevelRange {
    const result: SupportedResistanceLevelRange = {
      minimumResistanceLevel: 0,
      maximumResistanceLevel: 0,
      minimumIncrement: 0
    }
    let index = 0
    result.minimumResistanceLevel = data.getInt16(index, true) / 10
    index += 2
    result.maximumResistanceLevel = data.getInt16(index, true) / 10
    index += 2
    result.minimumIncrement = data.getUint16(index, true) / 10
    index += 2
    return result
  }

  private parseSupportedPowerRange(data: DataView): SupportedPowerRange {
    const result: SupportedPowerRange = {
      minimumPower: 0,
      maximumPower: 0,
      minimumIncrement: 0
    }
    let index = 0
    result.minimumPower = data.getInt16(index, true)
    index += 2
    result.maximumPower = data.getInt16(index, true)
    index += 2
    result.minimumIncrement = data.getUint16(index, true)
    index += 2
    return result
  }
}