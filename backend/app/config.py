from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str
    jwt_secret: str = "change-me-in-production-min-32-chars!!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    storage_bucket: str = "bseva"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://0.0.0.0:3000,http://localhost:8081"
    otp_dev_code: str = "123456"
    environment: str = "development"
    public_app_url: str = "http://localhost:5173"
    admin_ui_path: str = "/bseva-ops-m8k4q"
    google_application_credentials: str = ""
    firebase_service_account_file: str = ""
    firebase_service_account_json: str = ""
    firebase_web_api_key: str = ""
    firebase_web_auth_domain: str = ""
    firebase_web_project_id: str = ""
    firebase_web_storage_bucket: str = ""
    firebase_web_messaging_sender_id: str = ""
    firebase_web_app_id: str = ""
    firebase_web_vapid_key: str = ""
    # Customer self top-up via POST /wallet/load credits money without a payment gateway.
    # "" = automatic (allowed only in development/qa/test), "off" = always refused,
    # "unverified" = always allowed (explicit risk acceptance until a gateway exists).
    wallet_self_topup: str = ""

    @property
    def wallet_self_topup_allowed(self) -> bool:
        mode = (self.wallet_self_topup or "").strip().lower()
        if mode == "unverified":
            return True
        if mode == "off":
            return False
        return (self.environment or "").strip().lower() in ("development", "qa", "test")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
