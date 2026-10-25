import os
from collections.abc import Mapping

from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_DEFAULT = "change-me-in-production-min-32-chars!!"
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str
    jwt_secret: str = INSECURE_JWT_DEFAULT
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
    # QA-only OTP test delivery: addresses in these domains (e.g. "@bseva.test", non-routable) receive no email;
    # their OTP is the secret OTP_TEST_CODE instead. Ignored outside qa/test; refused at startup in production.
    otp_test_email_domains: str = ""
    otp_test_code: str = ""

    @property
    def wallet_self_topup_allowed(self) -> bool:
        mode = (self.wallet_self_topup or "").strip().lower()
        if mode == "unverified":
            return True
        if mode == "off":
            return False
        return (self.environment or "").strip().lower() in ("development", "qa", "test")

    def otp_test_code_for(self, email: str) -> str | None:
        """The QA test code when this address is a configured test address on a QA/test deployment, else None."""
        if (self.environment or "").strip().lower() not in ("qa", "test"):
            return None
        code = (self.otp_test_code or "").strip()
        domains = [d.strip().lower() for d in self.otp_test_email_domains.split(",") if d.strip().startswith("@")]
        addr = (email or "").strip().lower()
        if not (len(code) == 6 and code.isdigit() and domains and any(addr.endswith(d) for d in domains)):
            return None
        return code

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def insecure_settings_problems(s: Settings, env: Mapping[str, str] | None = None) -> list[str]:
    """Configuration that must never reach a hosted deployment. Messages never include secret values."""
    env = os.environ if env is None else env
    problems: list[str] = []
    environment = (s.environment or "").strip().lower()
    hosted = env.get("VERCEL") == "1" or bool(env.get("BSEVA_HOSTED"))
    if hosted and environment == "development":
        problems.append("ENVIRONMENT must be set (e.g. qa or production) on hosted deployments")
    if environment != "development":
        secret = s.jwt_secret or ""
        if secret == INSECURE_JWT_DEFAULT or len(secret) < MIN_JWT_SECRET_LENGTH:
            problems.append(
                f"JWT_SECRET must be set to a random value of at least {MIN_JWT_SECRET_LENGTH} characters"
            )
    if environment == "production" and (s.otp_test_email_domains or s.otp_test_code):
        problems.append("OTP_TEST_EMAIL_DOMAINS / OTP_TEST_CODE are QA-only and must not be set in production")
    return problems


settings = Settings()

_problems = insecure_settings_problems(settings)
if _problems:
    # Refuse to serve with forgeable tokens or development behaviour on a real deployment.
    raise RuntimeError("Insecure configuration: " + "; ".join(_problems))
