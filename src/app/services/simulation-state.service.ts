import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { SimulationState } from "../models/simulation-state";

@Injectable({
    providedIn: 'root'
})
export class SimulationStateService {
    private readonly initialState: SimulationState = {
        // Trainer Data
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: 0,

        // GPX Data
        elevation: 0,
        grade: 0,
        distance: 0,

        // Environment
        windSpeed: 0,
        temperature: 27,

        // Trainer Control
        resistance: 0,

        // User Data
        weight: 50,

        // Simulation
        simulationRunning: false,
        timestamp: Date.now()
    };

    private simulationStateSubject = new BehaviorSubject<SimulationState>(this.initialState);

    simulationState$: Observable<SimulationState> = this.simulationStateSubject.asObservable();

    getState(): SimulationState {
        return this.simulationStateSubject.value;
    }

    updateState(partial: Partial<SimulationState>): void {
        this.simulationStateSubject.next({
            ...this.getState(),
            ...partial,
            timestamp: Date.now()
        });
    }

    getCurrentState(): SimulationState {
        return this.simulationStateSubject.value;
    }

    reset(): void {
        this.simulationStateSubject.next(this.initialState);
    }
}