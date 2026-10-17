# SomSaiJai Bot — setup for the LINE account you already have

This connects the existing LINE Official Account **SomSaiJai Bot** (`@744byxku`) to the dashboard. You do not create a second account.

Staff send the day's photos **as pictures in the group chat**. The bot reads them, stores the original files, and sends you a short summary in a private chat with Approve / Reject buttons. Nothing is written into the Excel books and nothing is published to https://somsaijailive.vercel.app until you tap **อนุมัติ**.

The bot is part of the same Vercel project as the dashboard. After this code is deployed, the webhook address is:

`https://somsaijailive.vercel.app/api/webhook`

Deploy this branch before you press Verify in LINE. Until the code is live, Verify will fail.

## Free-plan limits that matter

SomSaiJai Bot is on the free plan (Communication plan). For Thailand, LINE's help page says that plan includes **300 counted messages a month**, and that number **cannot be raised** while you stay on the free plan. Open the account and check the counter anyway: **Settings (ตั้งค่า) → Activity and billing / การใช้งานและใบเสร็จ** (wording varies). The number on that screen is the one LINE will actually enforce.

What counts:

- A **push** message counts. The review summary is a push, because it is sent to you in the private chat and you did not just message the bot. One completed batch = **1** message, because it goes to one person. Several bubbles in that one push still count as one.
- A **reply** does not count. The bot uses replies for the "got the photos" note in the group, for the `id` command, for **สรุป** when you ask to see the latest batch again, and for the confirmation after you tap Approve or Reject.

A busy month of one batch per branch per day is on the order of 90 pushes, inside 300. What burns the quota is lots of separate sends (each send becomes its own batch and its own push). Ask staff to select the day's photos and send them together in one go.

If the 300 run out, LINE rejects further pushes until next month. The reading is still saved. Open the private chat with SomSaiJai Bot and send `สรุป`. That answer is a reply, so it does not use the quota.

Do not let the bot push into the staff group. A group push is counted **once per member**.

## 1. Turn on Messaging API for this account

1. Open [LINE Official Account Manager](https://manager.line.biz/) and choose **SomSaiJai Bot** (`@744byxku`).
2. Go to **Settings (ตั้งค่า) → Messaging API**.
3. Choose **Enable Messaging API (เปิดใช้งาน Messaging API)**. This links the account to a provider and a Messaging API channel in [LINE Developers Console](https://developers.line.biz/console/). If it asks you to create a provider, name it `SomSaiJai` and accept the terms. If you already have a provider, pick that one.
4. On the same Messaging API page, copy:
   - **Channel secret**
   - **Channel access token** — issue a long-lived token (**Issue / ออก Channel access token**). Copy it once and keep it. This is `LINE_CHANNEL_ACCESS_TOKEN`.
5. Open the channel in LINE Developers Console (the link is on that same page). On the **Messaging API** tab:
   - Turn **Allow bot to join group chats** **ON**. It is off by default. Without it, the group invite will not stick. A group can hold only one Official Account.
   - Leave **Auto-reply** and greeting messages off here as well if those toggles are shown.

Chat mode can stay on. You can still see the private chat in LINE Official Account Manager. The webhook and chat mode work together.

## 2. Stop the messages that would spam the group

Still in LINE Official Account Manager, open **Settings → Response settings (ตั้งค่าการตอบกลับ)**:

- **Greeting message (ข้อความทักทาย):** Off
- **Auto-response (ข้อความตอบกลับอัตโนมัติ):** Off
- **Webhooks / Use webhook (ใช้เว็บฮุค):** On
- **Chat:** leave on

Greeting and auto-response fire when the bot joins or when someone talks to it. Off means the group only sees what this bot deliberately replies.

## 3. Set the webhook

On the Messaging API page (Official Account Manager or Developers Console — they edit the same channel):

- Webhook URL: `https://somsaijailive.vercel.app/api/webhook`
- **Use webhook:** On
- Press **Verify**. It should succeed only after this code is deployed and `LINE_CHANNEL_SECRET` is set. A failed verify means the secret does not match or the deploy is not live yet.

You can turn on webhook redelivery if it is offered. Repeating the same event does not download or import twice.

## 4. Add the bot to the staff group

In the staff group: invite → search **SomSaiJai Bot** or `@744byxku`.

Tell staff:

- Send photos **directly in the chat** (pick several at once if they belong together).
- Do **not** put them in a LINE album. LINE does not notify the bot about group albums, so an album is invisible to it.

When the bot joins, it replies with the group id if you have not locked the group yet. That reply is free.

## 5. Get your userId and the groupId

The bot answers the message `id` (or `/id`).

- In the **staff group**, send `id`. It replies with the **groupId** (starts with `C`) and your user id.
- In a **1:1 chat** with SomSaiJai Bot, send `id`. It replies with your **userId** (starts with `U`). That userId is the only one allowed to tap Approve or Reject.

Until `LINE_GROUP_ID` is set, the bot will not read photos. It only answers `id`, so a stranger's group cannot fill the quota or the books. After you set the group id, photos from every other group are ignored.

## 6. Environment variables

Set these on the Vercel project that serves `somsaijailive.vercel.app`, team **parn**, environment **Production**.

Vercel → that project → **Settings → Environment Variables**.

Then **Storage → Blob → Create** (or connect) a store and link it to this project. Vercel adds `BLOB_READ_WRITE_TOKEN` for you. The original photos and the review files live there. They are not published on the dashboard.

After saving variables, redeploy once so the webhook can see them.

| Variable | What to put |
|---|---|
| `LINE_CHANNEL_SECRET` | Channel secret from the Messaging API page |
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived channel access token |
| `LINE_OWNER_USER_ID` | Your userId from the `id` reply (starts with `U`) |
| `LINE_GROUP_ID` | The staff group's id from the `id` reply (starts with `C`) |
| `GEMINI_API_KEY` | The Gemini key already used for reading reports |
| `GEMINI_OCR_MODEL` | Optional. Default `gemini-3.5-flash` |
| `BLOB_READ_WRITE_TOKEN` | Filled in when the Blob store is connected |
| `LINE_BOT_ALLOW_DEPLOY` | Set to exactly `1` only when you want Approve to write the books and publish. Leave it unset while you are still testing the summaries. |
| `GITHUB_TOKEN` | A GitHub token that can write to `metasith-blessme/Somsaijai-Dashboard` (contents permission) |
| `GITHUB_REPO` | `metasith-blessme/Somsaijai-Dashboard` |
| `GITHUB_BRANCH` | `main` |
| `VERCEL_TOKEN` | A Vercel token that can deploy this project |
| `VERCEL_SCOPE` | `parn` |
| `VERCEL_PROJECT_ID` | The project id (Vercel → Project → Settings → General) |
| `LINE_BOT_PUBLIC_URL` | `https://somsaijailive.vercel.app` |

Approve does all of this, in order, and only for the rows that were actually readable:

1. Checks that you are `LINE_OWNER_USER_ID` and that the approval still matches these exact photos.
2. Writes only those rows with the safe importers (`safe_import_sales.js` / `safe_import_expenses.js`). It does not run `verify-sales`, `process-expenses`, `sync`, or `pipeline`.
3. Rebuilds `data.json` and `reports_data.json` from the Excel files.
4. Commits those files to `main` and asks Vercel to deploy.
5. Reads `https://somsaijailive.vercel.app/data.json` back and tells you whether the live numbers match. It will not say the dashboard is updated if they do not.

If `LINE_BOT_ALLOW_DEPLOY` is not `1`, or the GitHub token is missing, tapping Approve **saves your decision and writes nothing**. The reply says what is missing.

Unclear photos, unbalanced totals, profit-share transfers, mixed receipts without line amounts, stock sheets, and anything dated January–March are kept in the review and are **not** written. A blank cell is not stored as zero. Scan is not filled in as "total minus cash".

## 7. Day to day

1. Staff send the photos in the group (not as an album).
2. The group gets a short "received" reply.
3. You get the summary and the two buttons in the private chat. The link in that message opens a redacted review. Do not forward the link.
4. **อนุมัติ** writes the clear rows and publishes. **ไม่รับ** writes nothing.
5. The bot replies in that same private chat with the result, including the live check. That confirmation is a reply, so it does not use the monthly quota.

Sending `สรุป` in the private chat shows the latest batch again, also as a free reply.
