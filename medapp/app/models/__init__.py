from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class User:
    id: Optional[int] = None
    full_name: str = ""
    email: str = ""
    role: str = "staff"
    is_active: bool = True
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        return cls(
            id=data.get("id"),
            full_name=data.get("full_name", ""),
            email=data.get("email", ""),
            role=data.get("role", "staff"),
            is_active=data.get("is_active", True),
            created_at=data.get("created_at"),
        )


@dataclass
class Doctor:
    id: Optional[int] = None
    full_name: str = ""
    specialty: str = ""
    email: str = ""
    phone: str = ""
    license_number: str = ""
    is_active: bool = True
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Doctor":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Patient:
    id: Optional[int] = None
    full_name: str = ""
    email: str = ""
    phone: str = ""
    birth_date: Optional[str] = None
    gender: str = ""
    address: str = ""
    blood_type: str = ""
    allergies: str = ""
    insurance_number: str = ""
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Patient":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Appointment:
    id: Optional[int] = None
    doctor_id: Optional[int] = None
    patient_id: Optional[int] = None
    appointment_date: str = ""
    appointment_time: str = ""
    duration_minutes: int = 30
    status: str = "pending"
    reason: str = ""
    notes: str = ""
    cancellation_reason: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Appointment":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Payment:
    id: Optional[int] = None
    appointment_id: Optional[int] = None
    patient_id: Optional[int] = None
    amount: float = 0.0
    currency: str = "USD"
    status: str = "pending"
    method: str = ""
    reference: str = ""
    created_at: Optional[str] = None
    paid_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Payment":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
