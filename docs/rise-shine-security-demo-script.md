# Rise and Shine — Security & RBAC Demo Script

**Audience:** School decision-maker (non-technical)  
**Duration:** ~10–15 minutes  
**Goal:** Prove that many roles does **not** mean everyone sees everything.

**Client brief (leave-behind):** [client-security-rbac-brief.md](client-security-rbac-brief.md)  
**Accounts & seed:** [demo-seed.md](demo-seed.md) — password for all demos: `Nexium@2026!`  
**Full negative-access table:** [demo-feature-checklist.md](demo-feature-checklist.md#negative-access-quick-client-trust-checks)

### Prep (before the meeting)

1. Run seed and start the app (`npm run db:seed:all` → `npm run db:seed:verify` → `npm run dev`).
2. Open http://localhost:3000 (or the staging URL).
3. For a smoother admin flow in demos, MFA skip flags may be set (see demo-seed). If you want to **show** MFA, leave those flags off and complete TOTP once for an admin account.
4. Log out between roles (or use a private window per role) so the sidebar clearly resets.

### Opening line (30 seconds)

> “You asked about security because the system has many roles. That is intentional. We will log in as different people and show that each person only gets their job — and that another campus’s data stays separate.”

---

## Step 1 — Teacher (2 min)

| | |
|--|--|
| **Login** | `ahmed.teacher@nexium.edu.pk` |
| **Lands on** | `/dashboard` |

**Show**

- Sidebar includes Students, Attendance, Assessments, Learning, Timetable (and similar teaching tools).
- Sidebar does **not** include Fees, Users, Accounting, Settings.

**Optional proof**

- Paste `/dashboard/fees` in the address bar → denied / redirected / no access (not fee data).

**Talk track**

> “A teacher can mark attendance and enter marks. They cannot collect fees or manage user accounts — even if they know the URL. That is role-based access control.”

---

## Step 2 — Accountant (2 min)

| | |
|--|--|
| **Login** | `fees@nexium.edu.pk` |
| **Lands on** | `/dashboard` |

**Show**

- Fees (and Accounting / Payroll if visible) are available.
- Students and Attendance are **not** in the menu (or open and get denied).

**Optional proof**

- Try `/dashboard/students` and `/dashboard/attendance` → denied / no menu.

**Talk track**

> “Accounts can collect fees and work finance modules. They do not get admissions or classroom attendance. Each role is a different key, not the master key.”

---

## Step 3 — Receptionist (2 min)

| | |
|--|--|
| **Login** | `reception@nexium.edu.pk` |
| **Lands on** | `/dashboard` |

**Show**

- Front office is available; Students create/update is available for desk work.
- Fees and Accounting are **not** available.

**Optional proof**

- Try `/dashboard/fees` and `/dashboard/accounting` → denied / no menu.

**Talk track**

> “Reception handles inquiries, visitors, and front-desk student updates. They cannot open the fee cash or the books.”

---

## Step 4 — Branch isolation (3 min)

| | |
|--|--|
| **Login A** | `branchadmin@nexium.edu.pk` (Islamabad / MAIN) |
| **Login B** | `lahore.admin@nexium.edu.pk` (Lahore / LAHORE) |

**Show**

1. As MAIN branch admin: open Students (or Fees). Note counts / names for Islamabad.
2. Log out; log in as LAHORE branch admin.
3. Open the same module. Counts and records differ — Lahore campus only.
4. Point out the header: branch is **locked** to their campus (no “All branches” for them).

**Optional proof**

- Branch Admin cannot create a new campus: open `/dashboard/branches/new` → denied (no `branches.manage`).

**Talk track**

> “Same job title, different campus. Each branch admin only manages their own campus data. That is branch isolation — as important as roles.”

---

## Step 5 — Super Admin: scope + audit (2–3 min)

| | |
|--|--|
| **Login** | `admin@nexium.edu.pk` |
| **Lands on** | `/dashboard` |

**Show**

1. **Branch scope selector** in the header — All branches / one / many. Switch scope and show a list (e.g. Students or Dashboard) changing with selection.
2. **Audit** at `/dashboard/audit` — recent actions with who / what / when (if data is present after earlier demos, even better).

**Talk track**

> “Only Super Admin sees across campuses and can review the audit trail. If something changes in fees or users, you can ask who did it.”

---

## Step 6 — Parent & Student portals (2 min)

| | |
|--|--|
| **Parent** | `rashid.ahmad@nexium.edu.pk` → `/portal/parent` |
| **Student** | `ali.khan@nexium.edu.pk` → `/portal/student` |

**Show**

1. Parent portal: linked children only (demo parent is linked to Ali Khan and Zainab Hussain). No staff sidebar.
2. Try opening `/dashboard` as parent → redirected / not the staff shell.
3. Student portal: own record only. No parent nav for another family’s data; no staff dashboard.

**Talk track**

> “Parents and students get portals, not the office system. A parent cannot browse other families. A student cannot open another student’s fees.”

---

## Closing (30 seconds)

> “Many roles means **controlled** access, not open access. Identity, role, and campus scope work together. We can leave you a one-page brief that says the same in writing.”

Hand over or email: [client-security-rbac-brief.md](client-security-rbac-brief.md).

---

## Quick reference — demo accounts

| Role | Email |
|------|-------|
| Super Admin | `admin@nexium.edu.pk` |
| Branch Admin (MAIN) | `branchadmin@nexium.edu.pk` |
| Branch Admin (LAHORE) | `lahore.admin@nexium.edu.pk` |
| Teacher | `ahmed.teacher@nexium.edu.pk` |
| Accountant | `fees@nexium.edu.pk` |
| Receptionist | `reception@nexium.edu.pk` |
| Parent | `rashid.ahmad@nexium.edu.pk` |
| Student | `ali.khan@nexium.edu.pk` |

**Password:** `Nexium@2026!`

---

## If something fails

| Symptom | Check |
|---------|--------|
| Wrong menus / data for a role | Re-run `npm run db:seed:auth` and `npm run db:seed:verify` |
| Admin stuck on MFA | Set skip flags per demo-seed, or complete TOTP enrollment |
| Cross-branch data looks the same | Confirm you switched accounts (MAIN vs LAHORE), not only refreshed |
| Permission leak (role sees forbidden module) | Stop the sales narrative; capture role + URL + screenshot; treat as a product bug |

Do not invent access during the meeting. If a check fails, say you will confirm and follow up — then file it against the negative-access checklist.
