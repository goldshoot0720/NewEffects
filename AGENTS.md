# Agent notes

## Git 提交

使用者說「自動提交」或「提交」時，提交目前工作區的變更到目前分支。同一句寫了 `https://github.com/goldshoot0720/NewEffects`，或說「提交至」或「自動提交至」這個網址時，提交後推上 `origin`（`main`）。稍後說「推上」或「推上去」時，把已提交的變更推上同一個遠端。

提交訊息用英文祈使句，與既有 `main` 歷史一致。歌詞 PV 的 mp4 發到 GitHub Release，不進 commit。

## 歌詞與畫面

畫面上的那一句就是正在唱的那一句。人聲即將進入時，先把歌詞卡放上，只開始填第一個字。

動畫 OP／ED 用該作品自己的角色。名牌用官方日文：漢字與假名依官方寫法，姓名之間不空格。已擺好姿勢的立繪整張畫（`cast.json` 的 `intact`）。

英文或日文主詞底下的中文不大過主詞，只略小。中文與粵文主詞維持原本的翻譯大小。歌曲選單 `#song` 只與文字同寬，不隨控制列拉長。

## 介面設計參考

新建網頁、改版既有介面或檢視 UI 設計時，自動讀取本機的 Hallmark 技能（`~/.agents/skills/hallmark/SKILL.md`），作為設計與驗收參考。依任務範圍及專案既有設計系統，檢查視覺層級、主要操作、桌面與手機排版，以及觸控和鍵盤操作。[Hallmark 來源](https://github.com/Nutlope/hallmark)

## 工程技能參考

規劃需求、撰寫規格、實作、除錯、測試、重構或審查變更時，依目前任務自動選讀相符的 AI Hero 技能。從本機 `~/.agents/skills/<技能名稱>/SKILL.md` 讀取，需要確認用途時查閱 [AI Hero 技能目錄](https://www.aihero.dev/skills)。
