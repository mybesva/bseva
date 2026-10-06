import { CalendarDays, Flame, Home, User, Wifi } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LotusMark, MandalaOutline } from "./DevotionalPatterns";

/**
 * Crisp, vector redraw of the B-SEVA phone that is baked into the landing hero photo.
 * It is laid out at 230×470 and warped with a homography onto the phone's measured
 * corners in the 2048×1150 photo, so it sits exactly on top of the photographed device
 * (replacing it, not adding a second phone) and stays sharp on Retina screens.
 * Corners (photo px): TL 1780.6,570.5 · TR 1994.9,565.2 · BR 1938.6,1047.2 · BL 1703.7,1032.2
 */
const PHONE_MATRIX =
  "matrix3d(0.592646,-0.119116,0,-0.00016998,-0.515475,0.769164,0,-0.000206526,0,0,1,0,1780.6,570.5,0,1)";

const NAVY = "#17325A";

export default function LandingHeroAppPreview() {
  const { t } = useI18n();

  const tiles = [
    { key: "pujas", label: t("services.pujas"), icon: <LotusMark className="h-[26px] w-[26px] text-[#1B2B44]" /> },
    {
      key: "havans",
      label: t("services.havans"),
      icon: <Flame aria-hidden className="h-[26px] w-[26px] fill-[#FF8A1E] text-[#E86A00]" strokeWidth={1.6} />,
    },
    { key: "ceremonies", label: t("services.ceremonies"), icon: <TempleGlyph /> },
  ];

  const tabs = [
    { key: "home", icon: Home, label: t("nav.home"), active: true },
    { key: "bookings", icon: CalendarDays, label: t("mobile.bookings") },
    { key: "profile", icon: User, label: t("nav.profile") },
  ];

  return (
    <div
      aria-hidden
      className="absolute left-0 top-0 h-[470px] w-[230px] select-none"
      style={{ transform: PHONE_MATRIX, transformOrigin: "0 0" }}
    >
      {/* Bezel */}
      <div className="absolute inset-0 rounded-[32px] bg-[#0A0B0E] p-[7px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),inset_0_0_0_2.5px_#1d1f24]">
        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[25px] bg-[#FFFDFB] font-sans text-[#1B2B44] antialiased">
          <MandalaOutline className="absolute -right-12 -top-10 h-36 w-36 text-[#E8B15A] opacity-[0.22]" />
          <MandalaOutline className="absolute -left-16 top-[248px] h-40 w-40 text-[#E8B15A] opacity-[0.12]" />

          {/* Notch + status bar */}
          <span className="absolute left-1/2 top-0 h-[17px] w-[78px] -translate-x-1/2 rounded-b-[12px] bg-[#0A0B0E]" />
          <span className="absolute left-[20px] top-[6px] text-[9.5px] font-bold tracking-tight">9:41</span>
          <span className="absolute right-[16px] top-[8px] flex items-end gap-[3px]">
            <span className="flex items-end gap-[1px]">
              {[3, 4.5, 6, 7.5].map((h) => (
                <span key={h} className="w-[2px] rounded-[1px] bg-[#1B2B44]" style={{ height: h }} />
              ))}
            </span>
            <Wifi aria-hidden className="h-[10px] w-[10px] text-[#1B2B44]" strokeWidth={3} />
            <span className="relative h-[8px] w-[16px] rounded-[2.5px] border border-[#1B2B44]/70 p-[1px]">
              <span className="block h-full w-[80%] rounded-[1px] bg-[#1B2B44]" />
            </span>
          </span>

          {/* Brand */}
          <img
            src="/bseva-mark.png"
            alt=""
            width={590}
            height={590}
            className="absolute left-1/2 top-[44px] h-[86px] w-[86px] -translate-x-1/2 object-contain"
          />
          <p className="absolute inset-x-0 top-[131px] text-center text-[23px] font-extrabold leading-none tracking-[-0.01em]">
            <span style={{ color: NAVY }}>B-</span>
            <span className="text-[#F07A12]">SEVA</span>
          </p>
          <p className="absolute inset-x-0 top-[157px] text-center text-[9.5px] font-semibold leading-none" style={{ color: NAVY }}>
            Book. Believe. Bless
          </p>

          {/* Primary action */}
          <div className="absolute inset-x-[14px] top-[192px] flex h-[44px] items-center justify-center rounded-[11px] bg-gradient-to-b from-[#FF8A1A] to-[#F47100] text-[16px] font-semibold text-white shadow-[0_6px_12px_-6px_rgba(232,106,0,0.7)]">
            {t("lp.cta.book")}
          </div>

          {/* Categories */}
          <div className="absolute inset-x-[12px] top-[264px] grid grid-cols-3 gap-[9px]">
            {tiles.map(({ key, label, icon }) => (
              <div key={key} className="flex flex-col items-center">
                <span className="flex h-[54px] w-full items-center justify-center rounded-[11px] bg-[#F9ECDD]">{icon}</span>
                <span className="mt-[8px] whitespace-nowrap text-[10px] font-bold leading-none">{label}</span>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="absolute inset-x-0 bottom-0 flex h-[58px] items-start justify-around border-t border-[#F1E6DA] bg-white/95 px-[10px] pt-[9px]">
            {tabs.map(({ key, icon: Icon, label, active }) => (
              <span key={key} className="flex flex-col items-center gap-[4px]">
                <Icon
                  aria-hidden
                  strokeWidth={1.9}
                  className={active ? "h-[19px] w-[19px] fill-[#8A4B22] text-[#6E3A18]" : "h-[19px] w-[19px] text-[#1B2B44]"}
                />
                <span className="text-[8px] font-semibold leading-none">{label}</span>
              </span>
            ))}
          </div>

          {/* Warm ambient light from the havan so the flat screen sits in the photo */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(105deg, rgba(255,214,170,0.10) 0%, rgba(255,255,255,0) 40%, rgba(255,190,130,0.10) 100%), linear-gradient(180deg, rgba(255,255,255,0) 70%, rgba(120,60,10,0.06) 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TempleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[28px] w-[28px]" aria-hidden>
      <path d="M12 1.5 13 4h-2l1-2.5Z" fill="#E86A00" />
      <path d="M9.5 4h5l.8 3h-6.6l.8-3Z" fill="#2A3A55" />
      <path d="M8 7.5h8l1 3.5H7l1-3.5Z" fill="#33445F" />
      <path d="M6.2 11.5h11.6l1.2 4H5l1.2-4Z" fill="#2A3A55" />
      <path d="M4.5 16h15v6.5h-15V16Z" fill="#1F2D45" />
      <path d="M10.3 22.5v-3.6a1.7 1.7 0 0 1 3.4 0v3.6h-3.4Z" fill="#E86A00" />
      <path d="M3.5 22.5h17" stroke="#1F2D45" strokeWidth="1.2" />
    </svg>
  );
}
