import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class CommunicationService {
    private socket: WebSocket | null = null;

    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    connect(ip: string, port: number): void {
        this.socket = new WebSocket(`ws://${ip}:${port}`);

        this.socket.onopen = () => {
            console.log("ESP32 Connected");
        };

        this.socket.onmessage = (event) => {
            console.log("Receive; ", event.data);
        };

        this.socket.onerror = (error) => {
            console.error(error);
        };

        this.socket.onclose = () => {
            console.log("ESP32 Disconnected")
        }
    }

    disconnect(): void {
        this.socket?.close();
    }

    send(data: any): void {
        if(!this.isConnected()){
            return;
        }

        this.socket?.send(JSON.stringify(data));
    }
}
