# Treasure Hunt Asset Pack

Đặt production assets thật vào các thư mục dưới đây khi đã sẵn sàng. Game shell hiện vẫn chạy được nếu chưa có asset, bằng cách fallback sang CSS/SVG/emoji prototype visuals.

## Nhân Vật

Đặt character sprites trong `characters/`:

- `player-1-idle.png`
- `player-1-run.png`
- `player-1-win.png`
- `player-1-lose.png`
- `player-2-idle.png`
- `player-2-run.png`
- `player-2-win.png`
- `player-2-lose.png`
- `player-3-idle.png`
- `player-3-run.png`
- `player-3-win.png`
- `player-3-lose.png`

Kích thước khuyến nghị: transparent PNG, canvas vuông, `256x256` hoặc `512x512`.

## Bản Đồ

Đặt map assets trong `map/`:

- `background.png`
- `path-overlay.png`

Kích thước khuyến nghị: background tỷ lệ `16:9`, tối thiểu `1600x900`.

## Vật Thể

Đặt game objects trong `objects/`:

- `cave-closed.png`
- `cave-open.png`
- `treasure-chest.png`

Kích thước khuyến nghị: transparent PNG.

## Hiệu Ứng

Đặt feedback effects trong `effects/`:

- `correct-sparkle.png`
- `wrong-shake.png`

Kích thước khuyến nghị: transparent PNG hoặc animated GIF/WebP nhẹ.
