import type { NextConfig } from "next";

/*
 * Server action gövde sınırı bilerek VARSAYILANDA (1 MB): öğrenci uygulaması
 * dosya almıyor. Şekil yükleme yönetim panelinde (kocumnet/admin) ve 10 MB'lık
 * sınır oradaki next.config.ts'te. Buraya geri eklemek, hiçbir işe yaramadan
 * herkese açık action'ların kabul ettiği gövdeyi on katına çıkarır.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
