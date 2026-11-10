"""Загрузка JSON заказа на Яндекс.Диск (REST API v1)."""
from __future__ import annotations

import json
from typing import Any

import httpx

_API = "https://cloud-api.yandex.net/v1/disk"


def _auth_headers(oauth_token: str) -> dict[str, str]:
    return {"Authorization": f"OAuth {oauth_token.strip()}"}


async def _mkdir(token: str, path: str) -> None:
    """Создать одну папку. 201 — создана, 409 — уже существует."""
    path = path.strip("/")
    if not path:
        return
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(
            f"{_API}/resources",
            params={"path": path},
            headers=_auth_headers(token),
        )
    if r.status_code in (201, 409):
        return
    r.raise_for_status()


async def _mkdir_recursive(token: str, folder: str) -> None:
    folder = folder.strip().strip("/")
    if not folder:
        return
    parts = [p for p in folder.split("/") if p]
    acc: list[str] = []
    for part in parts:
        acc.append(part)
        await _mkdir(token, "/".join(acc))


async def _get_upload_href(token: str, remote_path: str, *, overwrite: bool) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_API}/resources/upload",
            params={
                "path": remote_path,
                "overwrite": str(overwrite).lower(),
            },
            headers=_auth_headers(token),
        )
    r.raise_for_status()
    return r.json()["href"]


async def _put_upload(href: str, data: bytes, content_type: str) -> None:
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.put(
            href,
            content=data,
            headers={"Content-Type": content_type},
        )
    r.raise_for_status()


async def upload_order_json(
    oauth_token: str,
    folder: str,
    order_id: str,
    payload: dict[str, Any],
) -> None:
    """
    Сохраняет заказ как файл {folder}/{order_id}.json на Яндекс.Диске.

    oauth_token — OAuth-токен с правом cloud_api:disk.write
    folder — путь к каталогу без ведущего «/», например zerna-cafe/orders
    """
    folder = folder.strip().strip("/")
    remote_path = f"{folder}/{order_id}.json" if folder else f"{order_id}.json"

    await _mkdir_recursive(oauth_token, folder)

    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    href = await _get_upload_href(oauth_token, remote_path, overwrite=True)
    await _put_upload(href, body, "application/json; charset=utf-8")
