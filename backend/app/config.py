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

    # AI Writer (Bedrock — auth via Lambda IAM role, no API key needed)
    # Set LLM_MODEL to the exact Bedrock model ID for Claude Sonnet 4.6.
    # Find it in: AWS Console → Bedrock → Model catalog, or via:
    #   aws bedrock list-foundation-models --query 'modelSummaries[?contains(modelId,`claude`)]'
    LLM_MODEL: str = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    AWS_DEFAULT_REGION: str = "us-east-1"
    NEWSAPI_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""

    # Beehiiv newsletter
    BEEHIIV_API_KEY: str = ""
    BEEHIIV_PUBLICATION_ID: str = ""

    # CORS
    CORS_ORIGINS: str = "https://breakingchanges.dev,https://www.breakingchanges.dev"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
