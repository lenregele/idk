from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime
from bson import ObjectId


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Employee(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    position: Optional[str] = "Staff"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EmployeeCreate(BaseModel):
    name: str
    position: Optional[str] = "Staff"

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None

class WorkSession(BaseModel):
    employee_id: str
    employee_name: str
    hours_worked: float

class TipCalculation(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = Field(default_factory=datetime.utcnow)
    total_tips: float
    currency: str = "RON"
    work_sessions: List[WorkSession]
    total_hours: float
    tip_per_hour: float
    individual_tips: Dict[str, float]  # employee_id -> tip_amount
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TipCalculationCreate(BaseModel):
    total_tips: float
    currency: str = "RON"
    work_sessions: List[WorkSession]

# Employee endpoints
@api_router.post("/employees", response_model=Employee)
async def create_employee(employee: EmployeeCreate):
    employee_dict = employee.dict()
    employee_obj = Employee(**employee_dict)
    result = await db.employees.insert_one(employee_obj.dict())
    return employee_obj

@api_router.get("/employees", response_model=List[Employee])
async def get_employees():
    employees = await db.employees.find().to_list(1000)
    return [Employee(**employee) for employee in employees]

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return Employee(**employee)

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee_update: EmployeeUpdate):
    update_data = {k: v for k, v in employee_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided for update")
    
    result = await db.employees.update_one(
        {"id": employee_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    updated_employee = await db.employees.find_one({"id": employee_id})
    return Employee(**updated_employee)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}

# Tip calculation endpoints
@api_router.post("/tip-calculations", response_model=TipCalculation)
async def create_tip_calculation(calculation: TipCalculationCreate):
    # Calculate total hours
    total_hours = sum(session.hours_worked for session in calculation.work_sessions)
    
    if total_hours == 0:
        raise HTTPException(status_code=400, detail="Total hours cannot be zero")
    
    # Calculate tip per hour
    tip_per_hour = calculation.total_tips / total_hours
    
    # Calculate individual tips
    individual_tips = {}
    for session in calculation.work_sessions:
        tip_amount = session.hours_worked * tip_per_hour
        individual_tips[session.employee_id] = round(tip_amount, 2)
    
    # Create calculation object
    calculation_data = calculation.dict()
    calculation_obj = TipCalculation(
        **calculation_data,
        total_hours=total_hours,
        tip_per_hour=round(tip_per_hour, 2),
        individual_tips=individual_tips
    )
    
    result = await db.tip_calculations.insert_one(calculation_obj.dict())
    return calculation_obj

@api_router.get("/tip-calculations", response_model=List[TipCalculation])
async def get_tip_calculations(limit: int = 50):
    calculations = await db.tip_calculations.find().sort("created_at", -1).limit(limit).to_list(limit)
    return [TipCalculation(**calc) for calc in calculations]

@api_router.get("/tip-calculations/{calculation_id}", response_model=TipCalculation)
async def get_tip_calculation(calculation_id: str):
    calculation = await db.tip_calculations.find_one({"id": calculation_id})
    if not calculation:
        raise HTTPException(status_code=404, detail="Tip calculation not found")
    return TipCalculation(**calculation)

@api_router.delete("/tip-calculations/{calculation_id}")
async def delete_tip_calculation(calculation_id: str):
    result = await db.tip_calculations.delete_one({"id": calculation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tip calculation not found")
    return {"message": "Tip calculation deleted successfully"}

# Statistics endpoint
@api_router.get("/statistics")
async def get_statistics():
    # Get recent calculations
    recent_calculations = await db.tip_calculations.find().sort("created_at", -1).limit(10).to_list(10)
    
    if not recent_calculations:
        return {
            "total_calculations": 0,
            "total_tips_distributed": 0,
            "average_tips_per_calculation": 0,
            "most_active_employee": None
        }
    
    total_calculations = len(recent_calculations)
    total_tips = sum(calc.get("total_tips", 0) for calc in recent_calculations)
    average_tips = round(total_tips / total_calculations, 2) if total_calculations > 0 else 0
    
    # Find most active employee (most hours worked in recent calculations)
    employee_hours = {}
    for calc in recent_calculations:
        for session in calc.get("work_sessions", []):
            employee_id = session.get("employee_id")
            hours = session.get("hours_worked", 0)
            if employee_id in employee_hours:
                employee_hours[employee_id] += hours
            else:
                employee_hours[employee_id] = hours
    
    most_active_employee = None
    if employee_hours:
        most_active_id = max(employee_hours.keys(), key=lambda k: employee_hours[k])
        # Get employee name
        for calc in recent_calculations:
            for session in calc.get("work_sessions", []):
                if session.get("employee_id") == most_active_id:
                    most_active_employee = {
                        "name": session.get("employee_name"),
                        "total_hours": employee_hours[most_active_id]
                    }
                    break
            if most_active_employee:
                break
    
    return {
        "total_calculations": total_calculations,
        "total_tips_distributed": round(total_tips, 2),
        "average_tips_per_calculation": average_tips,
        "most_active_employee": most_active_employee
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

