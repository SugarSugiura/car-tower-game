# コンテナの塔チャレンジ（車の物理ゲームの試作）

架空の車8台が、コンテナを積んだ階段の塔を登れるかに挑戦する 3D の物理ゲーム。ブラウザだけで動きます（PC・スマホ・インストール不要）。

- 遊ぶ：https://sugarsugiura.github.io/car-tower-game/
- 「見る」：8台が自動で順番に挑戦。登れたら✓（緑）、落ちたり燃えたりしたら✗（赤）
- 「挑戦」：自分で運転（PC は ↑↓←→ か WASD・スペースでブレーキ・R でやり直し／スマホは画面のボタン）。上のアイコンを押すとその車に替わる
- 「縦動画を書き出す」：「見る」を最初から 1080×1920 で録画して保存（YouTube ショート用）

※車名・メーカー・ロゴはすべて架空です。

## しくみ
- 物理：Rapier（WASM）／描画：Three.js（どちらも `vendor/` に同梱。ビルド不要）
- 設定：`config/tower.json`（段差・段の奥行き・塔の幅）、`config/cars.json`（8台の重さ・力・グリップ・タイヤ・車高・駆動）
- 道具：`node tools/tune.mjs`（描画なしで8台を走らせて結果を出す）、`node tools/shoot.mjs`（PC・スマホ幅のスクリーンショット）、`node tools/render_video.mjs out.mp4`（縦動画を1コマずつ作る）

手元で開くとき：このフォルダで `python3 -m http.server 8123` → http://localhost:8123/

ライセンス：three.js（MIT・vendor/LICENSE-three.txt）、Rapier（Apache-2.0）
