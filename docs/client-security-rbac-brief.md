# Security & Access Control Brief

**Prepared for:** Rise and Shine (and other institutions evaluating the platform)  
**Prepared by:** Nexium Technologies  
**Topic:** How roles, permissions, and campus isolation protect school data  

This note answers a common question: *If many people use the system (admins, teachers, reception, accounts, parents, students), how do we keep each person from seeing or changing more than they should?*

---

## Why this matters

A school management system holds student records, fees, attendance, and staff data. Access must follow **least privilege**: each person sees and does only what their job requires.

Having many roles is not a risk by itself. The risk is **shared passwords** or **one account that can do everything**. This platform gives each person their own login, a clear role, and (for staff) a campus/branch scope.

---

## How access works

1. **Identity** — Each user has their own email and password. Password reset is self-service; there is no need for a single “school password.”
2. **Role** — Each account is assigned a role (for example Teacher or Accountant). The role defines what menus appear and what actions the server allows.
3. **Campus scope** — Most staff are limited to one branch/campus. They cannot browse another campus’s students, fees, or reports.
4. **Linked records** — Parents see only their linked children. Students see only their own record.

Hiding a menu is for convenience. **The server also refuses unauthorized requests**, even if someone types a URL or calls the API directly.

---

## Roles at a glance

| Role | Typical access |
|------|----------------|
| **Super Admin** | Full institution: all campuses, users, settings, audit. Can create branches. |
| **Branch Admin** | Day-to-day management of **one campus**: students, fees, academics, staff ops for that branch. Cannot create new campuses. |
| **Teacher** | Students (read), attendance, assessments/marks, learning, timetable, own leave. **No** fees, users, or accounting. |
| **Accountant** | Fees collection, payroll, accounting, related reports. **No** student admissions or attendance marking. |
| **Receptionist** | Front office (inquiries, visitors, complaints), student create/update, documents. **No** fees or accounting. |
| **Parent** | Parent portal only: linked children’s attendance, fees, learning, timetable; online payment where enabled. |
| **Student** | Student portal only: own attendance, results, fees, learning, timetable. |

Permissions can be adjusted per institution during setup. The matrix above reflects the default product configuration.

---

## Security controls you can rely on

| Control | What it means for the school |
|---------|------------------------------|
| **Individual logins** | Accountability: actions are tied to a person, not a shared desk account. |
| **Admin MFA** | Super Admin and Branch Admin can be required to use a second factor (app-based one-time code) in addition to the password. |
| **Campus / branch isolation** | Islamabad staff do not see Lahore data (and vice versa), unless they are Super Admin. |
| **Audit trail** | Important changes (fees, marks, users, settings, and similar) can be reviewed: who did what, and when. |
| **Encrypted transport** | Production access uses HTTPS (TLS). |
| **Encrypted data at rest** | The managed database encrypts stored data as part of the hosting platform. |
| **Session control** | Users can sign out; admins can revoke sessions when someone leaves or loses a device. |

---

## Moving from older desktop software

Many schools still run systems designed when software lived on one office PC. Those setups often depended on **who could sit at the computer**, or on a **small number of shared accounts**.

A modern multi-role system separates three things:

- **Who you are** (login)
- **What you may do** (role / permissions)
- **Which campus’s data you may see** (branch scope)

That separation is what makes it safe to give teachers, reception, accounts, parents, and students online access at the same time — without giving everyone “full admin.”

---

## What we can show live

In a short follow-up demo we can log in as Teacher, Accountant, Receptionist, Branch Admin (two campuses), Super Admin, Parent, and Student, and show:

- Menus that appear or disappear by role  
- Denied access when a role tries a restricted page  
- Different campus data for different branch admins  
- Audit and institution-wide scope for Super Admin  

**Internal demo script:** [rise-shine-security-demo-script.md](rise-shine-security-demo-script.md)  
**Demo accounts:** [demo-seed.md](demo-seed.md)

---

## Appendix — For IT staff (optional)

| Layer | Mechanism |
|-------|-----------|
| Authentication | Email/password via managed auth; short-lived access tokens; refresh handled by the client |
| Authorization | Role → permission codes (e.g. `fees.collect`, `students.create`); enforced on every protected API route |
| Branch scope | Server-side branch guard + query filtering; defense-in-depth database policies on branch-scoped tables |
| Admin MFA | TOTP; elevated assurance required for Super Admin and Branch Admin on protected API calls |
| Audit | Append-only style audit records for critical mutations |

**Technical leave-behind (JWT, sessions, guards):** [client-security-technical-note.md](client-security-technical-note.md)  
Full engineering detail: [08-auth-and-rbac.md](08-auth-and-rbac.md) · [12-security.md](12-security.md)
