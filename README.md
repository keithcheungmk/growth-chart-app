# 兒童成長曲線 HK2020

一個以本機瀏覽器儲存資料的家庭成長記錄 PWA。第一版聚焦身長／身高，使用香港中文大學香港生長研究的 HK2020 Height Standard Table v2，並以 LMS 模型計算 Z-score 和百分位。

## 本機執行

由於 ES modules、Service Worker 和本機檔案限制，請使用靜態伺服器：

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080/`。

## 測試

```bash
npm test
```

## 資料來源

`data/hk2020-height.js` 由官方 CUHK HK2020 Standard Tables v2 轉換而成。轉換工具位於 `scripts/extract_hk2020_height.py`。發布公開版本前，請確認官方資料表的再發布條款。

官方來源：https://www.cuhk.edu.hk/proj/hkgrowth/data_tables.html

本工具只供家庭記錄及趨勢觀察，不能代替醫療專業評估。
