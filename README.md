# Faydasıçok Vakfı — Bursiyer Yönetim Sistemi

Eğitim vakfı için geliştirilmiş bursiyer yönetim sistemi. React + TypeScript frontend, Node.js + Express + Prisma backend, PostgreSQL veritabanı.

---

## ⚠️ ÖNEMLİ GÜVENLİK UYARISI

**Test hesapları production ortamında KULLANILMAMALIDIR.**
- `admin / admin` — sadece development seed verisi
- `10091231962 / 145325` — test öğrenci hesabı

Production'a geçmeden önce tüm test hesaplarının şifrelerini değiştirin ve `/prisma/seed.ts` dosyasını çalıştırmayın.

---

## 📋 Gereksinimler

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

---

## 🚀 Kurulum

### 1. Depoyu indirin ve dizine girin

```bash
cd "vakıf öğrenci yönetimi"
```

### 2. Backend kurulumu

```bash
cd backend
npm install
```

#### Veritabanı yapılandırması

`.env` dosyasını düzenleyin:

```env
DATABASE_URL="postgresql://KULLANICI:SIFRE@localhost:5432/vakif_db?schema=public"
JWT_SECRET="guclu-bir-secret-yazin"
JWT_REFRESH_SECRET="baska-bir-guclu-secret-yazin"
```

#### Veritabanı migrasyonu ve seed

```bash
# Veritabanını oluştur ve migrate et
npm run db:migrate

# Prisma client oluştur
npm run db:generate

# Test verilerini ekle
npm run db:seed
```

#### Backend'i başlat

```bash
npm run dev
# → http://localhost:3001
```

### 3. Frontend kurulumu

```bash
cd ../frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🔑 Test Hesapları

| Rol | Giriş Bilgisi | Şifre |
|-----|---------------|-------|
| Admin | `admin` | `admin` |
| Değerlendirici | `reviewer@faydasi-cok.org` | `reviewer123` |
| Bursiyer (test) | `10091231962` | `145325` |

---

## 📁 Proje Yapısı

```
vakıf öğrenci yönetimi/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Veri modeli
│   │   └── seed.ts            # Test verileri
│   ├── src/
│   │   ├── controllers/       # İş mantığı
│   │   ├── routes/            # API rotaları
│   │   ├── middleware/        # Auth, upload, hata yönetimi
│   │   └── lib/               # Prisma, JWT, e-posta, depolama
│   └── uploads/               # Yüklenen dosyalar (gitignore'da)
└── frontend/
    └── src/
        ├── api/               # API servis katmanı
        ├── components/        # Ortak bileşenler
        ├── context/           # React context (Auth)
        ├── layouts/           # Sayfa düzenleri
        ├── pages/             # Sayfalar
        └── types/             # TypeScript tipleri
```

---

## 🏗️ Mimari Kararlar

### Birleşik Giriş
TC Kimlik No, kullanıcı adı veya e-posta — sistem identifier'ı üç alanda arar ve kullanıcıyı rolüne göre yönlendirir. Kullanıcı "admin/öğrenci" seçmek zorunda değil.

### ApprovableChange Tablosu
Hem profil alanı güncellemeleri hem de belge yüklemeleri tek bir `approvable_changes` tablosundan geçer. Bu, onay akışının tek bir yerden yönetilmesini ve audit trail birleşikliğini sağlar.

### Depolama Interface'i
`StorageService` interface'i ile local `/uploads` klasörü kullanılır. S3 veya benzeri bir depolamaya geçmek için sadece yeni bir adaptör yazılması yeterli — tüm controller'lar aynı interface'i kullanır.

### Append-Only Audit Log
`audit_logs` tablosuna Prisma üzerinden UPDATE/DELETE işlemi yapılmaz. Kimse (admin dahil) geçmiş kayıtları silip değiştiremez — bu vakfın hesap verebilirliği için kritik.

### CSV Toplu Oluşturma
Şifreler `crypto.randomBytes` ile server-side üretilir. Sonuç CSV tek seferlik response olarak döner; server-side plain-text şifre saklanmaz.

---

## 🔌 API Endpoints

### Auth
- `POST /api/auth/login` — Giriş
- `POST /api/auth/refresh` — Token yenileme
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `POST /api/auth/change-password`

### Öğrenci
- `GET /api/students/:id/profile`
- `PATCH /api/students/:id/personal` (onay akışı)
- `PATCH /api/students/:id/family` (onay akışı)
- `PATCH /api/students/:id/education` (onay akışı)
- `PATCH /api/students/:id/bank-info` (onay akışı)
- `PATCH /api/students/:id/contact` (direkt)
- `POST /api/students/:id/photo`

### Belgeler
- `GET /api/documents/periods`
- `POST /api/documents/static`
- `POST /api/documents/transcript`
- `POST /api/documents/student-certificate`
- `POST /api/documents/volunteer-report`

### Onay
- `GET /api/approvals/queue`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/approvals/bulk-approve`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/students`
- `POST /api/admin/students/bulk-create` (CSV)
- `GET /api/admin/students/csv-template`
- `GET/POST /api/admin/periods`
- `PATCH /api/admin/periods/:id`
- `GET/POST/DELETE /api/admin/users`

### Audit Log
- `GET /api/audit-logs`

---

## 📧 E-posta Yapılandırması

Geliştirme ortamında SMTP yapılandırılmamışsa, e-postalar konsolda loglanır:

```
📧 [EMAIL - CONSOLE LOG]
To: ornek@eposta.com
Subject: Şifre Sıfırlama
...
```

Production için `.env` dosyasında SMTP ayarlarını doldurun.

---

## 🛡️ Güvenlik

- Şifreler bcrypt (cost 12) ile hashlenir
- JWT access token: 15 dakika ömürlü
- JWT refresh token: 7 gün ömürlü, rotasyonlu
- Dosya yüklemeleri: sadece PDF/JPG/PNG, max 10MB
- RBAC middleware her API endpoint'inde zorunlu
- TC Kimlik No API loglarına/hata mesajlarına sızmaz
