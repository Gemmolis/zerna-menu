import asyncio
import json
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from yandex_disk_upload import upload_order_json as yandex_upload_order_json


app = FastAPI(title="Cafe Orders API")

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # на проде заменить на конкретные домены
    allow_credentials=False,  # иначе с allow_origins=["*"] браузер ведёт себя некорректно
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Pydantic-схемы =====


class OrderItem(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    price: float
    quantity: int
    total: float


class Customer(BaseModel):
    name: str
    phone: str
    vk: Optional[str] = None


class OrderData(BaseModel):
    pickupType: str = Field(..., description="in_cafe / takeaway / preorder")
    comment: Optional[str] = None
    items: List[OrderItem]
    totalCount: int
    totalPrice: float


class Consents(BaseModel):
    policyAccepted: bool
    vkNotify: bool = False


class Meta(BaseModel):
    source: str = "website"


class IncomingOrder(BaseModel):
    customer: Customer
    order: OrderData
    consents: Consents
    meta: Meta


class OutgoingResponse(BaseModel):
    status: str
    orderId: str
    message: str


DATA_DIR = Path(__file__).resolve().parent / "data"
ORDERS_LOG_PATH = DATA_DIR / "orders_log.jsonl"
_orders_write_lock = asyncio.Lock()

_rate_lock = asyncio.Lock()
_rate_by_ip: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=48))
ORDER_RATE_WINDOW_SEC = 60.0
ORDER_RATE_MAX = 12


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"


async def enforce_order_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    async with _rate_lock:
        q = _rate_by_ip[client_ip]
        while q and now - q[0] > ORDER_RATE_WINDOW_SEC:
            q.popleft()
        if len(q) >= ORDER_RATE_MAX:
            raise HTTPException(
                status_code=429,
                detail="Слишком много заявок с этого адреса. Подождите минуту и попробуйте снова.",
            )
        q.append(now)


def _append_order_line_sync(order_id: str, payload: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    record = {
        "ts_utc": datetime.now(timezone.utc).isoformat(),
        "orderId": order_id,
        "payload": payload,
    }
    with open(ORDERS_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


async def persist_order_to_file(order_id: str, order: IncomingOrder) -> None:
    payload = order.model_dump(mode="json")
    try:
        async with _orders_write_lock:
            await asyncio.to_thread(_append_order_line_sync, order_id, payload)
    except OSError as exc:
        print("[ORDER LOG ERROR]", exc)
        raise HTTPException(
            status_code=503,
            detail="Не удалось сохранить заказ. Попробуйте через минуту или позвоните в кафе.",
        ) from exc


def validate_order_totals(order: IncomingOrder) -> None:
    items = order.order.items
    computed_count = sum(i.quantity for i in items)
    computed_price = sum(float(i.price) * int(i.quantity) for i in items)
    if computed_count != order.order.totalCount:
        raise HTTPException(
            status_code=400,
            detail="Неверное количество позиций в заказе",
        )
    if abs(computed_price - float(order.order.totalPrice)) > 0.02:
        raise HTTPException(
            status_code=400,
            detail="Неверная сумма заказа",
        )
    for i in items:
        expected = float(i.price) * int(i.quantity)
        if abs(expected - float(i.total)) > 0.02:
            raise HTTPException(
                status_code=400,
                detail=f"Неверная сумма по позиции: {i.name}",
            )


# ===== Вспомогательные функции =====


def generate_order_id() -> str:
    """ID вида RZ-YYYYMMDD-HHMMSS."""
    now = datetime.now()
    return now.strftime("RZ-%Y%m%d-%H%M%S")


def build_admin_message(order_id: str, data: IncomingOrder) -> str:
    lines = [
        f"Новый заказ {order_id}",
        "",
        f"Имя: {data.customer.name}",
        f"Телефон: {data.customer.phone}",
    ]

    if data.customer.vk:
        lines.append(f"VK: {data.customer.vk}")

    pickup_map = {
        "in_cafe": "В кафе",
        "takeaway": "С собой",
        "preorder": "Предзаказ ко времени",
    }
    pickup_label = pickup_map.get(data.order.pickupType, data.order.pickupType)
    lines.append(f"Способ получения: {pickup_label}")
    lines.append("")

    lines.append("Состав заказа:")
    for idx, item in enumerate(data.order.items, start=1):
        line = f"{idx}. {item.name} × {item.quantity} = {int(item.total)} ₽"
        if item.category:
            line += f" ({item.category})"
        lines.append(line)

    lines.append("")
    if data.order.comment:
        lines.append("Комментарий:")
        lines.append(data.order.comment)
        lines.append("")

    lines.append("Итого:")
    lines.append(
        f"{data.order.totalCount} позиций / {int(data.order.totalPrice)} ₽"
    )

    return "\n".join(lines)


def build_client_message(order_id: str, data: IncomingOrder) -> str:
    lines = [
        "Спасибо, ваш заказ принят.",
        "",
        f"Номер заказа: {order_id}",
        f"Сумма: {int(data.order.totalPrice)} ₽",
    ]

    pickup_map = {
        "in_cafe": "в кафе",
        "takeaway": "с собой",
        "preorder": "предзаказ ко времени",
    }
    pickup_label = pickup_map.get(data.order.pickupType, data.order.pickupType)
    lines.append(f"Способ получения: {pickup_label}")
    lines.append("")
    lines.append(
        "Мы скоро свяжемся с вами для подтверждения. "
        "Если нужно что-то уточнить, ответьте на это сообщение."
    )

    return "\n".join(lines)


async def send_vk_message(peer_id: int, text: str) -> None:
    """
    Отправка сообщения в VK.
    Если токен или peer_id не заданы — просто логируем (для dev).
    """
    if not settings.VK_GROUP_TOKEN or peer_id <= 0:
        print("\n[VK MOCK SEND]")
        print(f"peer_id: {peer_id}")
        print(text)
        print("[/VK MOCK SEND]\n")
        return

    async with httpx.AsyncClient(timeout=10) as client:
        payload = {
            "access_token": settings.VK_GROUP_TOKEN,
            "v": settings.VK_API_VERSION,
            "peer_id": peer_id,
            "random_id": secrets.randbelow(2**31),
            "message": text,
        }
        resp = await client.post(
            f"{settings.VK_API_URL}/messages.send", data=payload
        )
        data = resp.json()
        print("[VK RAW RESPONSE]", data)
        if "error" in data:
            print("[VK ERROR]", data["error"])


# ===== Endpoint =====


@app.post("/api/orders/from-site", response_model=OutgoingResponse)
async def create_order(order: IncomingOrder, request: Request):
    # 1. Бизнес-валидация
    if not order.consents.policyAccepted:
        raise HTTPException(
            status_code=400, detail="Нет согласия на обработку заявки"
        )

    if not order.order.items:
        raise HTTPException(status_code=400, detail="Корзина пуста")

    if not order.customer.name.strip():
        raise HTTPException(status_code=400, detail="Не указано имя")

    if not order.customer.phone.strip():
        raise HTTPException(status_code=400, detail="Не указан телефон")

    if not order.order.pickupType:
        raise HTTPException(
            status_code=400, detail="Не указан способ получения"
        )

    validate_order_totals(order)
    await enforce_order_rate_limit(_client_ip(request))

    order_id = generate_order_id()
    await persist_order_to_file(order_id, order)

    token = settings.YANDEX_DISK_TOKEN.strip()
    if token:
        folder = settings.YANDEX_DISK_FOLDER.strip().strip("/")
        try:
            await yandex_upload_order_json(
                token,
                folder,
                order_id,
                order.model_dump(mode="json"),
            )
            print(f"[YANDEX DISK] Заказ {order_id} загружен в папку «{folder}»")
        except Exception as exc:
            print("[YANDEX DISK ERROR]", repr(exc))

    print("\n[NEW ORDER]")
    print("ID:", order_id)
    print(json.dumps(order.model_dump(), indent=2, ensure_ascii=False))
    print("[/NEW ORDER]\n")

    admin_text = build_admin_message(order_id, order)

    # Отправка в VK админу
    try:
        if settings.ADMIN_VK_PEER_ID > 0:
            await send_vk_message(settings.ADMIN_VK_PEER_ID, admin_text)
        else:
            print(
                "[INFO] ADMIN_VK_PEER_ID не задан, сообщение админу не отправлено."
            )
    except Exception as exc:
        print("[VK SEND ERROR]", exc)

    return OutgoingResponse(
        status="success",
        orderId=order_id,
        message="Заказ принят в обработку",
    )