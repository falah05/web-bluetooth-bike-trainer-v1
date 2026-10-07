import { Injectable } from "@angular/core";
import { SimulationState } from "../models/simulation-state";
import { ESPControlPacket } from "../models/esp-packet";

@Injectable({
    providedIn: 'root'
})

export class SimulationController {
    buildPacket(state: SimulationState): ESPControlPacket{
        return {
            grade: state.grade,
            elevation: state.elevation,
            speed: state.speed,
            weight: state.weight
        }
    }
}