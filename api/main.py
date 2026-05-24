from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from model_utils import recommend

app = FastAPI(title="Customer Service Suggestion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict

class QueryRequest(BaseModel):
    text: str

@app.post("/recommend")
def get_recommendation(req: QueryRequest):
    return recommend(req.text)

class ConnectionManager:
    def __init__(self):
        # Maps client_id to WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            # data could have { "to": "agent" or "customer_id", "text": "...", "sender": client_id }
            
            # If the sender is a customer, send to "agent"
            # If the sender is an agent, send to the specified "to" (customer_id)
            target = data.get("to", "agent")
            message_payload = {
                "sender": client_id,
                "text": data.get("text", ""),
                "timestamp": data.get("timestamp", "")
            }
            
            if target == "agent" and "agent" in manager.active_connections:
                await manager.send_personal_message(message_payload, "agent")
            elif target in manager.active_connections:
                await manager.send_personal_message(message_payload, target)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
