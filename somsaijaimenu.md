# 🍊 Som Sai Jai (ส้มสายใจ) - Product Menu & SKU Catalog

This document lists all the products sold at **Som Sai Jai** cold-press juice bar branches, along with their database keys (SKUs), retail prices, and mapped raw materials.

---

## 🥤 1. Cups (Juices served in cups)

| Database SKU | Product Name (EN) | Product Name (TH) | Price (฿) | Mapped Raw Material |
| :--- | :--- | :--- | :---: | :--- |
| `or` | Orange Cup (Regular) | น้ำส้ม (แก้วธรรมดา) | 60 ฿ | Orange - Baskets (`uo`) |
| `or_100` | Orange Premium Cup | น้ำส้มพรีเมียม 100% | 100 ฿ | Orange - Baskets (`uo`) |
| `wm` | Watermelon Cup | น้ำแตงโม | 50 ฿ | Watermelon - Pcs (`uw`) |
| `mg` | Mango Cup | น้ำมะม่วง | 90 ฿ | Mango - Kg (`umg`) |
| `co` | Coconut Cup | น้ำมะพร้าว | 60 ฿ | Coconut - Pcs (`uco_raw`, `uco_meat`, etc.) |
| `yco` | Young Coconut Cup | น้ำมะพร้าวอ่อน | 90 ฿ | Young Coconut - Pcs (`uyco`) |
| `ap` | Apple Cup | น้ำแอปเปิ้ล | 60 ฿ | Apple - Pcs (`uap`) |
| `guava` | Guava Cup | น้ำฝรั่ง | 60 ฿ | Guava - Pcs (`uguava`) |
| `pineapple` | Pineapple Cup | น้ำสับปะรด | 60 ฿ | Pineapple - Pcs (`upine`) |

---

## 🍾 2. Bottles (Juices served in bottles)

These products are tracked in the database but are not displayed in the dashboard's product mix charts.

| Database SKU | Product Name (EN) | Product Name (TH) | Price (฿) | Handwritten Label |
| :--- | :--- | :--- | :---: | :--- |
| `bs` | Small Bottle | น้ำผลไม้บรรจุขวด (เล็ก) | 40 ฿ | `Bot(40)` |
| `bb` | Big Bottle | น้ำผลไม้บรรจุขวด (ใหญ่) | 200 ฿ | `Bot(200)` |

---

## 📋 3. Ingredient Yield & Operational References

To maintain financial control and audit tracking, the visual OCR pipeline uses standard conversion ratios to calculate theoretical revenue and raw material burn.

| Raw Material | Database Field | Unit | Standard Cost / Unit | Mapped Cup SKU | Target Yield Ratio (Cups/Unit) |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **Orange** | `uo` | Basket | 700 ฿ | `or`, `or_100` | **29.3 cups** per basket |
| **Watermelon** | `uw` | Pcs | 35 ฿ | `wm` | **3.5 cups** per piece |
| **Apple** | `uap` | Pcs | 30 ฿ | `ap` | **0.5 cups** per piece |
| **Mango** | `umg` | Kg | 150 ฿ | `mg` | **0.5 cups** per kg |
| **Coconut (Raw)** | `uco_raw` | Pcs | 35 ฿ | `co` | Derived by branch usage |
| **Young Coconut** | `uyco` | Pcs | 50 ฿ | `yco` | Derived by branch usage |
| **Guava** | `uguava` | Pcs | 30 ฿ | `guava` | Derived by branch usage |
| **Pineapple** | `upine` | Pcs | 30 ฿ | `pineapple` | Derived by branch usage |

---

## 🧮 4. Key Calculations & Audit Rules

- **Total Sales Revenue:**
  $$\text{Revenue} = \text{Cash} + \text{Scan}$$
- **Theoretical Revenue (cups sold $\times$ price):**
  $$\begin{aligned}
  \text{Theoretical Rev} = &\,(\text{or} - \text{or\_100}) \times 60 + \text{or\_100} \times 100 + \text{wm} \times 50 + \text{mg} \times 90 \\
  &\,+ \text{ap} \times 60 + \text{co} \times 60 + \text{yco} \times 90 + \text{guava} \times 60 + \text{pineapple} \times 60
  \end{aligned}$$
- **Audit Flag Trigger:** Mismatch between recorded revenue (`rev`) and theoretical revenue (`theoretical_rev`) exceeding **±500 ฿** is automatically flagged for review.
