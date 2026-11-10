# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Токен сообщества VK
    VK_GROUP_TOKEN: str = ""
    # ID пользователя или беседы, куда шлём уведомление админу
    ADMIN_VK_PEER_ID: int = 0

    # Версия API VK
    VK_API_VERSION: str = "5.199"
    VK_API_URL: str = "https://api.vk.com/method"

    YANDEX_DISK_TOKEN: str = ""
    YANDEX_DISK_FOLDER: str = "zerna-cafe-orders"

    model_config = SettingsConfigDict(
        env_file=("vk_secrets.env", ".env"),
        env_file_encoding="utf-8",
    )


settings = Settings()