# HPZ DESIGN SYSTEM V1

## Purpose
Visual source of truth cho HPZ Customer Ecosystem trong repo `nexora-product-catalog`.

Áp dụng cho customer-facing:
- Home / Catalog
- HPZWiki / Discover
- AquaCare
- HPZMarket
- Community
- My HPZ
- Login / Signup / Account recovery
- Policy

Admin hiện hữu không bị mass-refactor trong release này.

## Brand tokens

```css
--hpz-navy-950: #032b52;
--hpz-navy-900: #052f59;
--hpz-navy-800: #063d6f;
--hpz-ocean-700: #064f84;
--hpz-ocean-600: #07578f;
--hpz-ocean-500: #0b6aa8;
--hpz-aqua-500:  #0877a8;
--hpz-text:       #0a2942;
--hpz-text-soft:  #49697f;
--hpz-text-muted: #718b9d;
--hpz-surface:    #fafdff;
--hpz-surface-2:  #edf5f8;
--hpz-line:       #c4dae5;
```

Global customer background:

```css
linear-gradient(180deg,#dcebf3 0%,#c7dfeb 55%,#afd3e4 100%)
```

## Shared shell
Mọi customer-facing page phải đi qua:
- `HPZAppShell`
- `HPZHeader`
- `HPZBottomNav`
- `HPZContainer`

Desktop global navigation:

```text
Home | Catalog | HPZWiki | AquaCare | Market | Community | My HPZ
```

Mobile bottom navigation:

```text
Home | Care | Shop | Market | Me
```

## Shared components
Không tự tạo lại base style trong từng module:
- `HPZButton`
- `HPZCard`
- `HPZCardHeader`
- `HPZKpi`
- `HPZTabs`
- `HPZField`
- `HPZModal`
- `HPZNotice`
- `HPZStatus`
- `HPZTable`
- `HPZEmptyState`
- `HPZLoading`

Module CSS chỉ dùng cho visual/business interaction đặc thù, ví dụ:
- AquaCare 2D tank visual
- product gallery
- chart/layout đặc thù

Không định nghĩa lại global background, primary button, card base, modal base hoặc form base trong module CSS.

## Buttons
- Primary: navy → ocean gradient, action chính.
- Secondary: pale aqua, action phụ.
- Ghost: transparent, navigation/cancel.
- Danger: đỏ nhạt, destructive action hoặc critical acknowledgement.

Màu warning/success/error chỉ mang nghĩa trạng thái, không trở thành page theme.

## Page templates

### Discovery
Home, Catalog, Wiki, Market, Community.

### Workspace
My HPZ, AquaCare.

### Auth
Login, Signup, Forgot/Reset.

Cả ba template dùng cùng shell/tokens/components.

## Route compatibility
Canonical routes:
- `/catalog`
- `/wiki`
- `/care`
- `/market`
- `/community`
- `/me`

Legacy aliases tiếp tục hoạt động:
- `/beca.html`
- `/hpzwiki`
- `/zwmarket`
- `/account`
- `/register`

Không xóa legacy route nếu chưa có redirect/backward-compatibility plan.

## UI Kit
`/ui-kit` hiển thị component/token thật đang dùng trong production source.
Không tạo một UI kit tách rời rồi để page production dùng style khác.
