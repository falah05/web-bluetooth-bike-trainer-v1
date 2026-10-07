export interface ESPPacket {
  // Trainer
  speed: number;
  cadence: number;
  power: number;
  heartRate: number;

  // GPX
  grade: number;
  elevation: number;
  distance: number;

  // Environment
  windSpeed: number;
  temperature: number;

  // Control
  resistance: number;

  // Timestamp
  timestamp: number;
}

export interface ESPControlPacket {
  grade: number;
  elevation: number;
  speed: number;
  weight: number;
}