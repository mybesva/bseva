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
    # iPhone push straight to Apple (app.services.apns_push). Key file on servers: /run/bseva-secrets/apns_auth_key.p8
    apns_key_id: str = ""
    apns_team_id: str = ""
    apns_auth_key_file: str = ""
    apns_auth_key: str = ""
    apns_topics: str = ""
    # Customer self top-up via POST /wallet/load credits money without a payment gateway.
    # "" = automatic (allowed only in development/qa/test), "off" = always refused,
    # "unverified" = always allowed (explicit risk acceptance until a gateway exists).
    wallet_self_topup: str = ""
    # QA-only OTP test delivery: addresses in these domains (e.g. "@bseva.test", non-routable) receive no email;
    # their OTP is the secret OTP_TEST_CODE instead. Ignored outside qa/test; refused at startup in production.
    otp_test_email_domains: str = ""
    # Refuse sign-up OTPs to email domains that cannot receive mail (DNS check, app.email_domain). Tests turn it off.
    email_domain_check: bool = True
    otp_test_code: str = ""
    # Self-hosted image CAPTCHA (app.captcha). Contact Us and Custom Puja always ask signed-out visitors; no
    # setting turns that off. The Super Admin switches for registration and password sign-in (customer and
    # pujari, app.captcha_settings) are enforced only when this is true. Keep it false until the web and the
    # mobile app builds that show the CAPTCHA are released: older app builds send none.
    captcha_settings_enforcement: bool = False
    # Circuit breakers on mail that anonymous visitors can trigger (per clock hour, whole deployment).
    otp_public_emails_per_hour: int = 300
    # OTP requests one client address may make per rolling day (raise on QA if testers share one office IP).
    otp_requests_per_ip_per_day: int = 60
    # Registration / email-verification codes: their own site-wide hourly budget (separate from the one above, so
    # they cannot use up sign-in, reset or deletion mail) and a tighter per-client daily cap.
    otp_register_emails_per_hour: int = 100
    otp_register_requests_per_ip_per_day: int = 20
    contact_team_emails_per_hour: int = 30
    # WhatsApp Cloud API (app.whatsapp). Everything is off until configured. The webhook answers only when its
    # verify token (GET challenge) and app secret (POST signatures) are set; sending also needs the flag below.
    whatsapp_webhook_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_graph_api_version: str = "v26.0"
    whatsapp_send_enabled: bool = False
    # Comma-separated recipients (digits with country code, e.g. 919876543210) the app may message. Outside
    # production an empty list sends nothing at all, so QA can never reach a real customer.
    whatsapp_recipient_allowlist: str = ""
    whatsapp_request_timeout_seconds: float = 10.0
    # Extra attempts after a send that certainly did not reach Meta (connection refused, 429, 5xx).
    whatsapp_send_retries: int = 2
    # Online payments. PAYMENT_GATEWAY names the gateway new checkouts use ("cashfree"; empty = wallet only).
    # Each stored payment keeps its own provider, so refunds and status checks never follow this setting.
    payment_gateway: str = ""
    payment_order_ttl_minutes: int = 20
    # Public HTTPS origin Cashfree calls back (defaults to PUBLIC_APP_URL; set to a tunnel for local tests).
    payment_webhook_base_url: str = ""
    # Cashfree Payment Gateway (collection). sandbox | production; production is refused outside production.
    cashfree_pg_env: str = "sandbox"
    cashfree_pg_app_id: str = ""
    cashfree_pg_secret_key: str = ""
    cashfree_pg_api_version: str = "2026-01-01"
    # Cashfree Payouts (pujari bank/UPI transfers): a separate product with its own keys.
    cashfree_payout_env: str = "sandbox"
    cashfree_payout_client_id: str = ""
    cashfree_payout_client_secret: str = ""
    # 2FA public key (PEM) from Payouts > Developers > Two-Factor Authentication, inline or as a file path.
    cashfree_payout_public_key: str = ""
    cashfree_payout_public_key_file: str = ""
    cashfree_payout_api_version: str = "2024-01-01"

    @property
    def cashfree_pg_configured(self) -> bool:
        return bool(self.cashfree_pg_app_id.strip() and self.cashfree_pg_secret_key.strip())

    @property
    def cashfree_payouts_configured(self) -> bool:
        return bool(self.cashfree_payout_client_id.strip() and self.cashfree_payout_client_secret.strip())

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
    for label, mode, key in (
        ("CASHFREE_PG_ENV", s.cashfree_pg_env, s.cashfree_pg_app_id),
        ("CASHFREE_PAYOUT_ENV", s.cashfree_payout_env, s.cashfree_payout_client_id),
    ):
        mode = (mode or "").strip().lower()
        if mode not in ("sandbox", "production"):
            problems.append(f"{label} must be sandbox or production")
        elif mode == "production" and environment != "production":
            problems.append(f"{label}=production (live money) is allowed only when ENVIRONMENT=production")
        elif mode == "sandbox" and (key or "").strip().upper().startswith("PROD"):
            problems.append(f"{label}=sandbox but a production key is configured")
    if environment == "production" and (s.otp_test_email_domains or s.otp_test_code):
        problems.append("OTP_TEST_EMAIL_DOMAINS / OTP_TEST_CODE are QA-only and must not be set in production")
    if environment == "production" and s.whatsapp_send_enabled:
        # Lift only with the approved Production rollout (templates, billing and the number decision in place).
        problems.append("WHATSAPP_SEND_ENABLED is QA-only until the Production WhatsApp rollout is approved")
    return problems


settings = Settings()

_problems = insecure_settings_problems(settings)
if _problems:
    # Refuse to serve with forgeable tokens or development behaviour on a real deployment.
    raise RuntimeError("Insecure configuration: " + "; ".join(_problems))
