# SomSaiJai Bot — setup for the LINE account you already have

This connects the existing LINE Official Account **SomSaiJai Bot** (`@744byxku`) to the dashboard. You do not create a second account.

Staff send the day's photos **as pictures in the group chat**. The bot reads them, stores the original files, and sends you a short summary in a private chat with Approve / Reject buttons. Nothing is written into the Excel books and nothing is published to https://somsaijailive.vercel.app until you tap **อนุมัติ**.

The bot is part of the same Vercel project as the dashboard. Vercel builds this repo from the root, so the live routes are `api/webhook.js` and `api/review.js` at the root, and the settings for them are in the root `vercel.json`. After this code is deployed, the webhook address is:

`https://somsaijailive.vercel.app/api/webhook`

The Excel workbooks, bank statements, and receipt photos are not part of that deployment. The public site serves `index.html`, `data.json`, `reports_data.json`, and `stock_ledger.json`.

Deploy this branch before you press Verify in LINE. Until the code is live, Verify will fail.

## Free-plan limits that matter

SomSaiJai Bot is on the free plan (Communication plan). For Thailand, LINE's help page says that plan includes **300 counted messages a month**, and that number **cannot be raised** while you stay on the free plan. Open the account and check the counter anyway: **Settings (ตั้งค่า) → Activity and billing / การใช้งานและใบเสร็จ** (wording varies). The number on that screen is the one LINE will actually enforce.

What counts:

- A **push** message counts. The review summary is a push, because it is sent to you in the private chat and you did not just message the bot. One completed batch = **1** message, because it goes to one person. Several bubbles in that one push still count as one.
- A **reply** does not count. The bot uses replies for the "got the photos" note in the group, for the `id` command, for **สรุป** when you ask to see the latest batch again, and for the confirmation after you tap Approve or Reject.

A busy month of one batch per branch per day is on the order of 90 pushes, inside 300. What burns the quota is lots of separate sends (each send becomes its own batch and its own push). Ask staff to select the day's photos and send them together in one go.

Each fruit order Ming sends the bot is **one more push** (the summary plus the copy-ready drafts travel together, and several bubbles in that one push still count as one). A busy month of one order a day is about 30, on top of the photo summaries. Her confirmation, and a later `ออเดอร์` to show the drafts again, are replies and do not count. If you paste the order into the bot yourself, the drafts come back as a reply and that one does not count either.

If the 300 run out, LINE rejects further pushes until next month. The reading and the fruit drafts are still saved. Open the private chat with SomSaiJai Bot and send `สรุป` for the latest photo batch, or `ออเดอร์` for the latest fruit drafts. Those answers are replies, so they do not use the quota.

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

## 4. Add the bot to the staff groups

There are two report groups. One is the Platinum shop group (the Daily Shop Report). The other is the group where B1 and B2 both post the Daily Sales Record. Invite **SomSaiJai Bot** (`@744byxku`) into each group that should be read. A group can hold only one Official Account, so this bot cannot join a group that already has a different one.

In each group, send `id`. The reply contains that group's id (starts with `C`).

`LINE_GROUP_ID` can list more than one group, separated by commas. A branch after a colon is a hint for photos that do not already name a branch:

`Cxxxx:B3,Cyyyy`

`Cxxxx:B3` means that group is allowed, and a form with no branch printed is reported as "this group is mapped to B3". The hint is not written into the books as the branch. `Cyyyy` with no branch is the right shape for the group that receives both B1 and B2, because the paper itself says B-1 or B-2. If the paper says B2 and the hint says B1, the bot keeps the paper's branch and flags the clash. It does not import that photo until you resolve it.

Tell staff, and the bot will say this itself whenever it replies in a group:

- Send photos **directly in the chat** (pick several at once if they belong together).
- Do **not** put them in a LINE album. The 16 Oct samples were posted as "1 item added to album". LINE does not notify the bot about group albums, so an album is invisible to it.

When the bot joins, it replies with the group id if you have not locked the groups yet. That reply is free. Sending `ช่วย` in the group repeats the album warning, also as a reply.

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
| `LINE_GROUP_ID` | One group id, or several separated by commas. Add `:B1`, `:B2`, or `:B3` only as a hint. The B1/B2 group should have no branch suffix. |
| `LINE_ORDER_SENDER_USER_IDS` | Ming's userId from her `id` reply. Several ids are separated by commas. Your own id does not need to be in this list. |
| `MINIMAX_API_KEY` | Optional. Turns on questions. Leave it unset and the bot stays silent on questions. |
| `MINIMAX_MODEL` | Optional. Default `MiniMax-M2`. |
| `GEMINI_API_KEY` | The Gemini key already used for reading reports |
| `GEMINI_MODEL` | Optional. Default `gemini-3.5-flash`. `GEMINI_OCR_MODEL` still works if `GEMINI_MODEL` is unset |
| `GEMINI_MODEL_FALLBACK` | Optional. Default `gemini-3.8-flash`, used after the first model returns 503 or 429 |
| `BLOB_READ_WRITE_TOKEN` | Filled in when the Blob store is connected |
| `LINE_BOT_ALLOW_DEPLOY` | Set to exactly `1` only when you want Approve to write the books and publish. Leave it unset while you are still testing the summaries. |
| `LINE_BOT_VERCEL_DEPLOY` | Optional. Set to exactly `1` to also call the Vercel deployments API after the git push. Leave unset: pushing to `main` already starts the Git integration deploy, and Approve waits for that deploy in the live readback. |
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
4. Commits those files to `main`. That push is what deploys the dashboard. A second deploy through the Vercel API runs only when `LINE_BOT_VERCEL_DEPLOY` is `1`.
5. Reads `https://somsaijailive.vercel.app/data.json` back and tells you whether the live numbers match. It will not say the dashboard is updated if they do not. The readback runs either way.

If `LINE_BOT_ALLOW_DEPLOY` is not `1`, or the GitHub token is missing, tapping Approve **saves your decision and writes nothing**. The reply says what is missing.

Unclear photos, unbalanced totals, profit-share transfers, mixed receipts without line amounts, stock sheets, and anything dated January–March are kept in the review and are **not** written. A blank cell is not stored as zero. Scan is not filled in as "total minus cash".

## 7. Day to day

1. Staff send the photos in the group (not as an album).
2. The group gets a short "received" reply.
3. You get the summary and the two buttons in the private chat. The link in that message opens a redacted review. Do not forward the link.
4. **อนุมัติ** writes the clear rows and publishes. **ไม่รับ** writes nothing.
5. The bot replies in that same private chat with the result, including the live check. That confirmation is a reply, so it does not use the monthly quota.

Sending `สรุป` in the private chat shows the latest batch again, also as a free reply.

## 8. Fruit orders

Ming cannot add this bot to the shareholder group, because that group already has another Official Account. She sends the same order text to **SomSaiJai Bot in a private chat**.

1. Send her the account **SomSaiJai Bot** (`@744byxku`) and ask her to add it as a friend.
2. She opens the private chat and sends `id`. The reply contains her userId (starts with `U`).
3. Put that id in `LINE_ORDER_SENDER_USER_IDS` on Vercel and redeploy. Until it is set, the bot ignores her order text. You can send an order yourself without being in that list.
4. She sends the order the way she already writes it, for example:

```
Orders for tomorrow, please @Parn
Watermelon -40
Pomegranate -3
Apple-3
Guava-50Kg
```

Thai names work too (`แตงโม`, `ทับทิม`, `แอปเปิ้ล`, `องุ่น`, `สาลี่`, `มะม่วง`, `ฝรั่ง`), and so do spaces around the dash (`Apple - 3`, `Apple-3`) and a unit when she writes one (`50Kg`, `3 กล่อง`, `40 ลูก`).

The bot replies to her, for free, with what it read. You get **one** push. The first bubble is the summary. Each bubble after that is one supplier message, with nothing extra in it, so a long-press copies the text you send.

From the example above the bubbles are:

- พี่กบ: `วันนี้ 40 ลูกครับผม`
- เจ๊เภา: a greeting, then `ทับทิม - 3` and `แอปเปิ้ล - 3`, then `ส่งร้านแตงโมครับผม`

ฝรั่ง is listed in the summary as ordered by Ming and is not given a supplier message. A fruit the list does not know (ส้ม, สับปะรด, anything new) is named in the summary and left out of the drafts. The bot does not pick a shop for it.

If the order includes mango, the เจ๊พร bubble is only `วันนี้ราคาเท่าไหร่ครับ`. The summary still shows how many kilos she asked for, so you can order after you have the price.

Nothing is sent to พี่กบ, เจ๊เภา, or เจ๊พร. เจ๊เภา is an Official Account, so this bot could not message her anyway, and the others only if they had added SomSaiJai Bot as a friend. You copy each bubble into the chat you already use.

Sending `ออเดอร์` in your private chat with the bot shows those bubbles again. That answer is a reply, so it does not use the monthly quota. Use it when a push does not arrive.

The shops, the fruit names, and the wording live in `line_bot/orders/suppliers.json`. Change `delivery_line` if the delivery line should say more than `ส่งร้านแตงโมครับผม`. Add a fruit by copying an item and setting `supplier` to `kob`, `phao`, or `porn`. A fruit Ming orders herself stays `handled_by` `ming` and has no supplier. Redeploy after saving the file.

## 9. Questions

If `MINIMAX_API_KEY` is not set, this does nothing. The bot does not reply to ordinary chat.

Anyone can ask in a private chat. A message that is already a command (`id`, `help`, `สรุป` / `summary`, `ออเดอร์` / `order`) stays that command. A fruit order from you or from someone in `LINE_ORDER_SENDER_USER_IDS` stays an order. In a group, the bot answers only when it is mentioned, or when the message starts with `bot` or `@bot`. It does not answer every group message. Photos are unchanged.

The answer is a reply, so it does not use the monthly quota. Each person gets 30 answers a day.

You (`LINE_OWNER_USER_ID`) can ask about recent sales in the private chat. The bot reads the live `data.json` and gives the model the last 14 days per branch: date, revenue, cash, and scan. Staff, including Ming, get general help only (how to send photos one by one, simple translations, shop questions). Their answers are not given those figures, and the model is told not to invent numbers. A question you ask in the group is treated like a staff question, so sales figures are not posted in the group.
