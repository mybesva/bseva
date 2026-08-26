from datetime import date, time
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    account_type: Literal["customer", "pujari"]
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=8, max_length=128)
    otp: str = Field(min_length=4, max_length=8)
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    language: Literal["en", "hi", "te"] = "en"
    calendar_preference: Literal["north", "south", "lunar"] = "north"
    requested_level: Optional[int] = Field(default=None, ge=1, le=4)
    backup_phone: Optional[str] = None
    address: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = "India"
    registration_consent: bool = False
    terms_version: Optional[str] = None
    privacy_version: Optional[str] = None


class MePatchIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    preferred_language: Optional[Literal["en", "hi", "te"]] = None
    calendar_preference: Optional[Literal["north", "south", "lunar"]] = None


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AddressIn(BaseModel):
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    location_label: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CustomerProfileIn(AddressIn):
    preferred_language: Optional[Literal["en", "hi", "te"]] = None
    calendar_preference: Optional[Literal["north", "south", "lunar"]] = None


class LoginIn(BaseModel):
    identifier: str
    password: str


class OtpRequestIn(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    purpose: Literal["register", "login", "verify"] = "register"


class OtpVerifyIn(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    code: str
    purpose: Literal["register", "login", "verify"] = "register"


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class BookingCreateIn(BaseModel):
    service_id: UUID
    pujari_id: UUID
    package_type: Literal["standard", "premium"]
    mode: Literal["in_person", "virtual"]
    booking_date: date
    start_time: time
    location_label: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    terms_accepted: bool


class WalletLoadIn(BaseModel):
    amount_paise: int = Field(gt=0, le=500_000_00)


class BlockIn(BaseModel):
    blocked: bool
    reason: Optional[str] = None


class VerifyPujariIn(BaseModel):
    verification_status: Literal["approved", "rejected", "under_review"]
    approved_level: Optional[int] = Field(default=None, ge=1, le=4)
    rejection_reason: Optional[str] = None


class PujariLevelIn(BaseModel):
    approved_level: int = Field(ge=1, le=4)


class PricingIn(BaseModel):
    gst_percent: float
    peak_day_fee_paise: int


class PujariRoleIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    summary: Optional[str] = None
    examples: list[str] = Field(default_factory=list)


class PujariRoleUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    summary: Optional[str] = None
    examples: Optional[list[str]] = None


class LegalPointIn(BaseModel):
    title: str = Field(default="", max_length=200)
    body: str = Field(min_length=1, max_length=4000)


class LegalPolicyUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    version: Optional[str] = Field(default=None, min_length=1, max_length=40)
    points: list[LegalPointIn]


class ServiceIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    required_level: int = Field(ge=1, le=4)
    standard_price_paise: int
    premium_price_paise: int
    duration_minutes: int = 90
    virtual_available: bool = True
    active: bool = True


class DocumentMetaIn(BaseModel):
    document_type: Literal["certificate", "identity", "supporting"]
    storage_path: str


class PujariProfileIn(BaseModel):
    full_name: Optional[str] = None
    father_name: Optional[str] = None
    gotra: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    native_place: Optional[str] = None
    permanent_address: Optional[str] = None
    present_address: Optional[str] = None
    mobile_number: Optional[str] = None
    whatsapp_number: Optional[str] = None
    qualifications: Optional[list[str]] = None
    qualification_year: Optional[int] = Field(default=None, ge=1950, le=2100)
    sampradaya: Optional[Literal["smartha", "madhwa", "vaishnava"]] = None
    website_publication_consent: Optional[bool] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    location_label: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    languages: Optional[list[str]] = None
    specializations: Optional[list[str]] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=80)
    available: Optional[bool] = None
    service_radius_km: Optional[float] = Field(default=None, ge=1, le=100)
    bank_account_last4: Optional[str] = Field(default=None, max_length=4)
    bank_ifsc: Optional[str] = Field(default=None, max_length=11)
    bank_holder_name: Optional[str] = Field(default=None, max_length=120)
    onboarding_step: Optional[int] = Field(default=None, ge=1, le=6)


class PujariProfileSubmitIn(BaseModel):
    final_submission_consent: bool
    terms_version: Optional[str] = None
    privacy_version: Optional[str] = None


class PujariApplyLevelIn(BaseModel):
    requested_level: int = Field(ge=1, le=4)


class PujariBlockDateIn(BaseModel):
    blocked_date: date
    reason: Optional[str] = Field(default=None, max_length=500)


class AdminUserIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["customer", "pujari"]
    requested_level: Optional[int] = Field(default=2, ge=1, le=4)
    location: Optional[str] = None
