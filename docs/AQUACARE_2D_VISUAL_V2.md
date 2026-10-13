# AQUACARE_2D_VISUAL_V2

## Scope
Chỉ thay khu vực visual của bể trong AquaCare. Không thay:
- page shell / navigation / tabs;
- tank CRUD;
- care log;
- issue workflow;
- reminder;
- purchased-item attachment;
- customer/session ownership.

## 1. Data model

V2 không cần migration mới.

AquaCare tiếp tục dùng `aquacare.tank_item` hiện tại:
- `tank_item_id`
- `tank_id`
- `item_type`
- `species_id`
- `product_id`
- `species_name`
- `product_name`
- `source`
- `source_order_id`
- `quantity`

Backend read-model bổ sung runtime field:

```json
{
  "visual_asset": {
    "mode": "CATALOG_PRIMARY | ANIMATED_FALLBACK",
    "image_url": "/media/...",
    "source": "catalog_media | generated_2d"
  }
}
```

Nếu tank item có `product_id`, backend tìm ảnh IMAGE primary/đầu tiên trong `catalog_media`.
Không copy ảnh hoặc tạo bảng media riêng cho AquaCare.

## 2. Rule render số lượng cá

`quantity` là source of truth.

Client tạo đúng một visual instance cho mỗi con:
- Ranchu quantity=5 -> 5 instance;
- Neon quantity=12 -> 12 instance;
- tổng visual instance = tổng quantity của tất cả active FISH tank items.

Không giới hạn số con bằng cách cắt mất dữ liệu.
Khi mật độ cao, hệ thống giảm sprite size và FPS, không giảm count:
- <= 40: 30 FPS;
- <= 120: 24 FPS;
- <= 300: 20 FPS;
- > 300: 16 FPS.

## 3. Fallback asset

Thứ tự:
1. `product_id` có Catalog IMAGE -> dùng ảnh thật.
2. Không có ảnh -> cá vector 2D được generate từ species name.
3. Màu fallback deterministic theo species để cùng loài nhìn ổn định giữa các lần render.

Không gọi API ảnh bên ngoài và không sinh asset mới vào production DB.

## 4. Animation

Canvas 2D:
- mỗi fish instance có seed deterministic;
- vị trí ban đầu, hướng, tốc độ và phase khác nhau;
- bơi ngang + dao động nhẹ theo trục Y;
- chạm biên thì wrap/đổi hướng;
- `prefers-reduced-motion` -> static frame;
- issue `gasp` -> số cá bị ảnh hưởng được kéo lên vùng gần mặt nước;
- bubble animation giữ theo `has_air`.

Swim zone heuristic V2:
- bottom: Cory/chuột/Pleco/tỳ bà/loach/chạch/Botia;
- top: Betta/lía thia/Arowana/cá rồng/Guppy/bảy màu/Molly/Platy;
- còn lại: middle.

Đây chỉ là visual placement, không phải biological diagnosis/business data.

## 5. Layout

Không đổi bố cục AquaCare workspace hiện tại.

Chỉ thay:

```text
OLD:
emoji fish visual

NEW:
real-image / animated-vector Canvas 2D
+ exact fish count
+ species legend
+ water state
+ bubbles
+ issue badge
```

Card, action bar, right-side metrics và các section bên dưới giữ nguyên.

## 6. Production safety plan

1. Fetch latest `main`.
2. Branch từ exact main SHA.
3. Không migration DB.
4. Backend chỉ mở rộng read response, backward-compatible.
5. Frontend chỉ thay `TankVisualizer`.
6. Unit regression:
   - exact quantity;
   - real-image/fallback;
   - swim zone;
   - density policy;
   - existing AquaCare safety tests.
7. CI + frontend build + production images + data-safety.
8. Merge khi xanh.
9. Deploy existing production pipeline.
10. Verify release SHA, DB ready, AquaCare 401 isolation, public `/care` 200, backup smoke.
11. Không reset/reseed/backfill dữ liệu.
