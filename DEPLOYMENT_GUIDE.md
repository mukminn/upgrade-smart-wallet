# Deployment Guide - Smart Wallet Upgrader

## Masalah: Commit Ter-Deploy ke Multiple Projects

Jika Anda melihat commit yang sama muncul di multiple projects di Vercel dashboard (seperti `kirim-masal-celo-78xk`, `smart-wallet-upgrader`, `upgrade-smart-wallet`), ini terjadi karena:

1. **Multiple repositories terhubung ke Vercel account yang sama**
2. **Commit yang sama ter-push ke multiple repositories**

## Solusi: Pastikan Hanya Repository Ini yang Ter-Deploy

### 1. Verifikasi Git Remote
Pastikan hanya terhubung ke repository yang benar:
```bash
git remote -v
```
Harus menunjukkan: `https://github.com/mukminn/upgrade-smart-wallet.git`

### 2. Verifikasi Vercel Project
Cek project yang terhubung:
```bash
cat .vercel/project.json
```
Harus menunjukkan: `"projectName":"smart-wallet-upgrader"`

### 3. Di Vercel Dashboard
1. Buka https://vercel.com/ber4mins-s-projects
2. Untuk setiap project (`kirim-masal-celo-78xk`, dll):
   - Buka Project Settings > Git
   - Pastikan hanya terhubung ke repository yang sesuai
   - Jika `kirim-masal-celo-78xk` terhubung ke `upgrade-smart-wallet`, DISCONNECT

### 4. Pastikan Hanya Push ke Repository Ini
**JANGAN** push commit yang sama ke multiple repositories. Setiap repository harus memiliki commit history sendiri.

## Repository yang Benar
- **Repository**: `https://github.com/mukminn/upgrade-smart-wallet.git`
- **Vercel Project**: `smart-wallet-upgrader`
- **Project ID**: `prj_A9EhS2ApWkIPZ2477FfdW5Qqw36U`

## Cara Deploy yang Benar
```bash
# 1. Pastikan di repository yang benar
git remote -v

# 2. Commit perubahan
git add .
git commit -m "Your commit message"

# 3. Push hanya ke repository ini
git push origin main

# 4. Deploy ke Vercel
vercel --prod
```

## Catatan Penting
- `.vercel` folder sudah di-ignore (tidak ter-commit)
- Setiap project di Vercel harus terhubung ke repository yang berbeda
- Jangan link satu Vercel project ke multiple repositories
