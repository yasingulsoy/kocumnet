import { Amblem } from "@/components/Amblem";

const SINAVLAR = ["YKS", "LGS", "MSÜ", "ALES", "DGS", "KPSS"];

export default function Home() {
  return (
    <>
      {/* Üst bilgilendirme şeridi */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <div className="status-indicator">
            <span className="status-dot" aria-hidden="true" />
            <span>Web Sitemiz Hazırlanıyor</span>
          </div>
          <span className="top-bar-note">Kurumsal Dijital Altyapı ve İçerik Platformu</span>
        </div>
      </div>

      {/* Kurumsal logo ve başlık */}
      <header className="site-header">
        <div className="container brand-wrapper">
          <div className="brand">
            <Amblem className="brand-logo" />
            <div className="brand-text">
              <span className="brand-name">VERİATİK</span>
              <span className="brand-sub">EĞİTİM HİZMETLERİ VE YAYINCILIK A.Ş.</span>
            </div>
          </div>
          <div className="header-tag">Ölçme-Değerlendirme &amp; İçerik AR-GE</div>
        </div>
      </header>

      {/* Karşılama */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <span className="eyebrow">Web Sitemiz Hazırlanıyor</span>
            <h1>Eğitim Yayıncılığında, Ölçme ve Değerlendirmede Yeni Bir AR-GE Merkezi</h1>
            <p>
              <strong>VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş.</strong> olarak kurumsal yapılanmamızı tamamladık.
              Çeyrek asırlık sınav deneyimi, yazarlık birikimi ve mühendislik yaklaşımını aynı çatı altında
              buluşturuyoruz. Yeni nesil içerik üretim merkezimiz ve dijital altyapımız çok yakında bu adreste yayında
              olacak.
            </p>
          </div>
        </div>
      </section>

      <main>
        <div className="container">
          {/* Biz kimiz */}
          <section className="section-block" aria-labelledby="biz-kimiz-baslik">
            <h2 className="section-title" id="biz-kimiz-baslik">
              Biz Kimiz?
            </h2>
            <div className="manifesto-card">
              <p>
                Biz yalnızca soru veya kitap üreten klasik bir yayınevi değiliz. Ölçme ve değerlendirmeyi analize, veriye
                ve sağlam bir editöryal mutfağa dayandıran bir <strong>Eğitim AR-GE Merkeziyiz</strong>. Ülkemizdeki
                sınav sistemlerinin değişen yapısını yakından izliyoruz. Yayıncılar, eğitim kurumları ve öğrenciler için
                ayağı yere basan ve güvenilir çözümler geliştiriyoruz.
              </p>
            </div>
          </section>

          {/* Neler yapıyoruz */}
          <section className="section-block" aria-labelledby="neler-yapiyoruz-baslik">
            <h2 className="section-title" id="neler-yapiyoruz-baslik">
              Neler Yapıyoruz?
            </h2>
            <div className="services-grid">
              <article className="service-card">
                <div>
                  <div className="service-header">
                    <div>
                      <span className="service-num">İÇERİK &amp; ÖLÇME AR-GE</span>
                      <h3>Merkezi Sınavlar İçin Soru ve İçerik Üretimi</h3>
                    </div>
                  </div>
                  <p>
                    <strong>YKS, LGS, MSÜ, ALES, DGS ve KPSS</strong> başta olmak üzere birçok merkezi sınava yönelik{" "}
                    <strong>Matematik</strong> ve <strong>Türkçe</strong> branşlarında özgün soru havuzları ve yayın
                    içerikleri hazırlıyoruz. Her bir soruyu kazanım uyumu, ölçme gücü, çeldirici kurgusu ve zorluk
                    dengesi açısından titizlikle işledikten sonra yayına hazır hale getiriyoruz.
                  </p>
                </div>
                <div className="exam-tags" aria-label="Kapsanan sınavlar">
                  {SINAVLAR.map((s) => (
                    <span key={s} className="exam-tag">
                      {s}
                    </span>
                  ))}
                </div>
              </article>

              <article className="service-card">
                <div>
                  <div className="service-header">
                    <div>
                      <span className="service-num">DİJİTAL TANI SİSTEMİ</span>
                      <h3>Matematik Check-Up Uygulaması</h3>
                    </div>
                    <span className="badge-soon">Çok Yakında</span>
                  </div>
                  <p>
                    Öğrencinin matematikteki mevcut durumunu yüzeysel testlerle değil, derinlemesine bir analizle ortaya
                    koyan yeni bir sistem üzerinde çalışıyoruz. Kavram eksiklerini, işlem alışkanlıklarını ve hata
                    nedenlerini en ince ayrıntısına kadar tespit ederek öğrencinin adeta{" "}
                    <strong>matematiğinin röntgenini çeken</strong> Check-Up uygulamamızı yakında hizmete açıyoruz.
                  </p>
                </div>
                <div className="exam-tags" aria-label="Odak alanları">
                  <span className="exam-tag">Hazır Bulunuşluk Analizi</span>
                  <span className="exam-tag">Bireysel Yol Haritası</span>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>

      {/* Alt bilgi */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-legal">
            <strong>VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş.</strong>
            <span>&copy; 2026 — Tüm Hakları Saklıdır.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
