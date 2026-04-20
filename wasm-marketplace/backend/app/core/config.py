from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://wasmuser:wasmpass@postgres:5432/wasmdb"

    # Redis
    REDIS_URL: str = "redis://redis:6379"

    # Pinata
    PINATA_API_KEY: str = ""
    PINATA_API_SECRET: str = ""
    PINATA_JWT: str = ""
    PINATA_GATEWAY: str = "https://gateway.pinata.cloud"

    # Auth
    SECRET_KEY: str = "change-this-to-a-long-random-secret-value"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Platform
    PLATFORM_FEE_PERCENT: float = 20.0


settings = Settings()
