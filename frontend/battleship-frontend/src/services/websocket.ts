/**
 * WebSocket Service cho Battle Ship Game
 * Quản lý kết nối và communication với backend server
 */

import { Message, Position, Ship } from "../types/game";

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectionState: "connecting" | "connected" | "disconnected" =
    "disconnected";

  constructor(url?: string) {
    // Thay đổi tham số url thành optional
    // Xây dựng URL động dựa trên host hiện tại của trình duyệt
    // và thêm đường dẫn '/ws/' mà Nginx sẽ proxy.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host; // Lấy host và port của Nginx (ví dụ: localhost:80 hoặc example.com)
    this.url = url || `${protocol}//${host}/ws/`; // Sử dụng URL được truyền vào hoặc URL động
  }

  // Kết nối WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = "connecting";
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.connectionState = "connected";
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.connectionState = "disconnected";
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.connectionState = "disconnected";
          reject(error);
        };

        // Timeout sau 10 giây
        setTimeout(() => {
          if (this.connectionState !== "connected") {
            reject(new Error("Connection timeout"));
          }
        }, 10000);
      } catch (error) {
        this.connectionState = "disconnected";
        reject(error);
      }
    });
  }

  // Ngắt kết nối
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = "disconnected";
    this.messageHandlers.clear();
  }

  // Xử lý reconnect
  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }, this.reconnectInterval);
    } else {
      console.error("Max reconnection attempts reached");
      this.triggerHandler("connection_error", {
        message: "Không thể kết nối lại server",
      });
    }
  }

  // Gửi message
  private send(message: Message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket not connected");
      throw new Error("WebSocket not connected");
    }
  }

  // Xử lý message nhận được
  private handleMessage(data: string) {
    try {
      const message: Message = JSON.parse(data);
      console.log("Received message:", message);

      this.triggerHandler(message.type, message.data);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  // Đăng ký handler cho message type
  on(messageType: string, handler: (data: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  // Bỏ đăng ký handler
  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  // Trigger handler
  private triggerHandler(messageType: string, data: any) {
    const handler = this.messageHandlers.get(messageType);
    if (handler) {
      handler(data);
    } else {
      console.warn("No handler for message type:", messageType);
    }
  }

  // API Methods - Gửi các loại message cụ thể

  // Tham gia queue
  joinQueue(playerName: string) {
    this.send({
      type: "join_queue",
      data: { player_name: playerName },
    });
  }

  // Rời queue
  leaveQueue() {
    this.send({
      type: "leave_queue",
      data: {},
    });
  }

  // Đặt tàu
  placeShips(ships: Ship[]) {
    const shipData = ships.map((ship) => ({
      type: ship.type,
      positions: ship.positions.map((pos) => [pos.row, pos.col]),
    }));

    this.send({
      type: "place_ships",
      data: { ships: shipData },
    });
  }

  // Bắn
  fireShot(row: number, col: number) {
    this.send({
      type: "fire_shot",
      data: { row, col },
    });
  }

  // Gửi chat message
  sendChatMessage(message: string) {
    this.send({
      type: "chat_message",
      data: { message },
    });
  }

  // Đầu hàng
  surrender() {
    this.send({
      type: "surrender",
      data: {},
    });
  }

  // Getter cho connection state
  get isConnected(): boolean {
    return (
      this.connectionState === "connected" &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  get connectionStatus(): string {
    return this.connectionState;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
