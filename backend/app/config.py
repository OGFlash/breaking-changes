import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AWS
    AWS_REGION: str = "us-east-1"
    CONTENT_BUCKET: str = "breaking-changes-content"
    MEDIA_BUCKET: str = "breaking-changes-media"
    FRONTEND_BUCKET: str = "breaking-changes-frontend"
    DYNAMODB_TABLE: str = "breaking-changes-views"

    # Auth
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    ADMIN_PASSWORD: str = "change-me-in-production"

    # SES
    SES_SENDER_EMAIL: str = "noreply@breakingchanges.dev"
    ADMIN_EMAIL: str = "admin@breakingchanges.dev"

    # CORS
    CORS_ORIGINS: str = "https://breakingchanges.dev,https://www.breakingchanges.dev"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
