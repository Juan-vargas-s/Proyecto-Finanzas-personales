import os

from dotenv import load_dotenv
from fastapi import FastAPI
import httpx

load_dotenv()

app = FastAPI(title="Servicio de Reportes", version="1.0.0")

JAVA_SERVICE_URL = os.getenv("JAVA_SERVICE_URL", "http://servicio-java:8080")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reportes"}
