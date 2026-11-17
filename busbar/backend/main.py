
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from calc import calculate

app = FastAPI(title="Busbar current calculator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class Load(BaseModel):
    name: str = Field(default="", max_length=50)
    current: float = Field(gt=0, le=1e6)
    cos: float = Field(gt=0, le=1)
    connection: Literal["L1", "L2", "L3", "L1-L2", "L2-L3", "L3-L1", "3P"]
    leading: bool = False


class Request(BaseModel):
    loads: list[Load] = Field(min_length=1, max_length=100)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/calculate")
def calculate_endpoint(req: Request):
    return calculate([ld.model_dump() for ld in req.loads])
