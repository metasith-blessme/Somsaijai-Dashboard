# 🍊 Som Sai Jai - Dashboard Setup Summary

## 🌐 Live Dashboard Link
**URL:** [https://somsaijailive.vercel.app](https://somsaijailive.vercel.app)

---

## 🤖 Automation Details
The dashboard is set to update **automatically every day at 10:00 AM**.

### How it works:
1. At 10:00 AM, your Mac runs `update_dashboard.js`.
2. It reads the latest data from `SomSaiJai_Dashboard_Q1_2026.xlsx`.
3. It updates `index.html` and pushes it to the live link using Vercel.

### Files Involved:
- **Data Source:** `SomSaiJai_Dashboard_Q1_2026.xlsx`
- **Script:** `update_dashboard.js`
- **Automation Config:** `~/Library/LaunchAgents/com.somsaijai.dashboard.update.plist`
- **Logs:** Check `update_log.log` for success messages or `update_error.log` for issues.

---

## 🛠 Manual Update Command
If you want to update the website immediately (without waiting for 10 AM), open your terminal and run:
```bash
node "/Users/metasithjumpatip/Desktop/Blessme/Somsaijai/Sale report/update_dashboard.js"
```

---
*Setup completed on Tuesday, March 24, 2026.*
