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
    captcha_token: Optional[str] = None
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
    referral_code: Optional[str] = Field(default=None, max_length=40)


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
    package_type: Literal["basic", "standard", "premium"]
    mode: Literal["in_person", "temple", "virtual"]
    booking_date: date
    start_time: time
    location_label: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    special_instructions: Optional[str] = None
    terms_accepted: bool
    recurring: Optional[Literal["none", "weekly", "monthly", "selected_dates"]] = "none"
    recurring_count: Optional[int] = Field(default=None, ge=1, le=52)
    selected_dates: Optional[list[date]] = None
    referral_code: Optional[str] = Field(default=None, max_length=40)
    # Optional add-ons: pujari buys materials and is reimbursed from customer payment
    include_samagri: bool = False
    include_alankaram: bool = False
    include_food: bool = False


class WalletLoadIn(BaseModel):
    amount_paise: int = Field(gt=0, le=500_000_00)


class BlockIn(BaseModel):
    blocked: bool
    reason: Optional[str] = None


class VerifyPujariIn(BaseModel):
    verification_status: Literal["approved", "rejected", "under_review", "correction_required", "pending"]
    approved_level: Optional[int] = Field(default=None, ge=1, le=4)
    rejection_reason: Optional[str] = None
    internal_note: Optional[str] = None


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
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    benefits: Optional[str] = None
    local_name: Optional[str] = None
    spiritual_meaning: Optional[str] = None
    common_occasions: Optional[str] = None
    deity: Optional[str] = None
    tradition_notes: Optional[str] = None
    location_notes: Optional[str] = None
    whats_included: Optional[str] = None
    admin_notes: Optional[str] = None
    process_steps: Optional[list[dict]] = None
    priests_min: Optional[int] = Field(default=None, ge=1, le=20)
    priests_max: Optional[int] = Field(default=None, ge=1, le=20)
    homa_included: Optional[bool] = False
    prasadam_included: Optional[bool] = True
    sankalpa_required: Optional[bool] = True
    languages: Optional[list[str]] = None
    online_nri_price_paise: Optional[int] = None
    category: Optional[str] = "puja"  # legacy coarse tag
    category_slugs: Optional[list[str]] = None  # multi-category assignment
    required_level: int = Field(ge=1, le=4)
    standard_price_paise: Optional[int] = None
    premium_price_paise: Optional[int] = None
    basic_price_paise: Optional[int] = None
    main_puja_price_paise: Optional[int] = None
    samagri_price_paise: Optional[int] = 0
    alankaram_price_paise: Optional[int] = 0
    food_price_paise: Optional[int] = 0
    # included | customer | pujari | reimbursable
    samagri_provider: Optional[Literal["included", "customer", "pujari", "reimbursable"]] = "included"
    alankaram_provider: Optional[Literal["included", "customer", "pujari", "reimbursable"]] = "included"
    food_provider: Optional[Literal["included", "customer", "pujari", "reimbursable"]] = "included"
    muhurta_consultation_enabled: Optional[bool] = False
    muhurta_fee_paise: Optional[int] = None
    requires_muhurta: Optional[bool] = False
    duration_minutes: int = 90
    pujaris_required: Optional[int] = Field(default=1, ge=1, le=20)
    virtual_available: bool = False
    active: bool = True
    samagri_available: Optional[bool] = True
    alankaram_available: Optional[bool] = False
    food_available: Optional[bool] = False
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    search_aliases: Optional[list[str]] = None
    is_popular: Optional[bool] = False
    is_featured_home: Optional[bool] = False
    is_seasonal: Optional[bool] = False
    display_order: Optional[int] = 1000
    homepage_rank: Optional[int] = None
    pricing_status: Optional[Literal["priced", "awaiting_pricing"]] = None
    samagri_review_status: Optional[Literal["UNVERIFIED", "VERIFIED", "NEEDS_REVIEW"]] = None
    # Optional EN translation payload (also stored on services columns for defaults)
    translation_en: Optional[dict] = None


class ServiceCategoryIn(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    sort_order: int = 0
    active: bool = True


class DocumentMetaIn(BaseModel):
    document_type: Literal["certificate", "identity", "supporting", "driving_licence"]
    storage_path: str


class PujariProfileIn(BaseModel):
    full_name: Optional[str] = None
    father_name: Optional[str] = None
    gotra: Optional[str] = None
    pravara: Optional[str] = None
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
    licence_type: Optional[Literal["driving_licence", "cab_commercial", "other", "none"]] = None
    licence_number: Optional[str] = Field(default=None, max_length=40)


class JoiningFeeWaiveIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class BookingRejectIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class NoShowPenaltyIn(BaseModel):
    waive: bool = False
    reason: Optional[str] = Field(default=None, max_length=500)


class MuhurtaConsultationIn(BaseModel):
    service_id: UUID
    appointment_date: date
    appointment_time: str = Field(min_length=4, max_length=16)  # HH:MM or HH:MM:SS
    preferred_dates: Optional[list[date]] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class ServiceRecommendationIn(BaseModel):
    service_id: UUID
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    audience: Optional[str] = "customer"
    month_number: Optional[int] = Field(default=None, ge=1, le=12)
    recurrence_hint: Optional[str] = None
    active: bool = True
    sort_order: int = 0


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
    # When True, mark under_review so admin can finish profile then verify.
    # When False (default), create as pending / profile incomplete ("complete later").
    complete_profile_now: bool = False


class AdminCustomerUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=10, max_length=15)
    location: Optional[str] = None
    preferred_language: Optional[Literal["en", "hi", "te"]] = None


class BookingAssignIn(BaseModel):
    pujari_id: str
