export interface SimulationState {
    // Trainer Data
    speed: number,
    cadence: number,
    power: number,
    heartRate: number,

    // GPX Data
    elevation: number,
    grade: number,
    distance: number

    // Environment
    windSpeed: number,
    temperature: number,

    // Trainer Control
    resistance: number,

    // User Data
    weight: number,

    // Simulation
    simulationRunning: boolean,
    timestamp: number
}