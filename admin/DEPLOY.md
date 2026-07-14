# Admin Panel Deployment (Dokploy / Nixpacks)

## Build Environment Variables

Build sırasında aşağıdaki değişken **mutlaka** tanımlanmalıdır. Aksi halde `Eksik environment degiskeni` hatası alırsınız.

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL'i (örn: `https://api.dekoartizan.com`) |

### Dokploy'da ayarlama

1. Uygulama → **Environment Variables** veya **Build Settings**
2. **Build Environment Variables** bölümüne ekleyin:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://api.example.com
   ```
3. Kendi backend URL'inizi yazın (örn: `https://api.dekoartizan.com`)

> **Not:** `NEXT_PUBLIC_*` değişkenleri build sırasında bundle'a gömülür. Runtime'da değiştirilemez; doğru URL'i build öncesi ayarlayın.
