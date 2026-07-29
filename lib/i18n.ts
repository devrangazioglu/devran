export type UiLang = "en" | "tr";

const dict = {
  en: {
    languages: "Languages",
    from: "From",
    to: "To",
    autoDetect: "Auto Detect",
    translate: "Translate",
    translating: "Translating…",
    document: "Document",
    activity: "Activity",
    modeFile: "As File",
    modeText: "As Text",
    dropTitle: "Drop a PDF or image here",
    dropSub: "or tap to browse · max 20 MB",
    hintUpload: "Upload a document to translate its text",
    hintReady: "Tap Translate to start",
    translationLabel: "Translation",
    pageProgress: (p: number, t: number) => `Translating page ${p} of ${t}…`,
    preparing: "Preparing document…",
    assembling: "Building the translated file…",
    download: "Download",
    translatedFile: "Translated file",
    settings: "Settings",
    account: "Account",
    signInGoogle: "Continue with Google",
    signOut: "Sign out",
    guest: "Guest",
    continueGuest: "Continue as guest",
    welcomeTitle: "Welcome to Transivo",
    welcomeSub: "Translate PDFs and images into any language — the file stays the same, only the text changes.",
    appLanguage: "App language",
    history: "History",
    historyEmpty: "No translations yet.",
    clearHistory: "Clear history",
    delete: "Delete",
    back: "Back",
    image: "Image",
    pdf: "PDF",
    authNote: "Sign-in with Apple and email/password are coming soon.",
    errFileType: "Only PDF, PNG, JPEG, WebP and GIF files are supported.",
    errFileSize: (mb: number) => `File is too large. Maximum size is ${mb} MB.`,
    errGeneric: "Translation failed. Please try again.",
  },
  tr: {
    languages: "Diller",
    from: "Kaynak",
    to: "Hedef",
    autoDetect: "Otomatik Algıla",
    translate: "Çevir",
    translating: "Çevriliyor…",
    document: "Belge",
    activity: "Etkinlik",
    modeFile: "Dosya Olarak",
    modeText: "Metin Olarak",
    dropTitle: "PDF veya görsel bırakın",
    dropSub: "ya da seçmek için dokunun · en fazla 20 MB",
    hintUpload: "Metnini çevirmek için bir belge yükleyin",
    hintReady: "Başlamak için Çevir'e dokunun",
    translationLabel: "Çeviri",
    pageProgress: (p: number, t: number) => `Sayfa ${p}/${t} çevriliyor…`,
    preparing: "Belge hazırlanıyor…",
    assembling: "Çevrilmiş dosya oluşturuluyor…",
    download: "İndir",
    translatedFile: "Çevrilmiş dosya",
    settings: "Ayarlar",
    account: "Hesap",
    signInGoogle: "Google ile devam et",
    signOut: "Çıkış yap",
    guest: "Misafir",
    continueGuest: "Misafir olarak devam et",
    welcomeTitle: "Transivo'ya hoş geldiniz",
    welcomeSub: "PDF'leri ve görselleri istediğiniz dile çevirin — dosya aynı kalır, yalnızca metin değişir.",
    appLanguage: "Uygulama dili",
    history: "Geçmiş",
    historyEmpty: "Henüz çeviri yok.",
    clearHistory: "Geçmişi temizle",
    delete: "Sil",
    back: "Geri",
    image: "Görsel",
    pdf: "PDF",
    authNote: "Apple ile giriş ve e-posta/şifre üyeliği yakında eklenecek.",
    errFileType: "Yalnızca PDF, PNG, JPEG, WebP ve GIF dosyaları desteklenir.",
    errFileSize: (mb: number) => `Dosya çok büyük. En fazla ${mb} MB olabilir.`,
    errGeneric: "Çeviri başarısız oldu. Lütfen tekrar deneyin.",
  },
} as const;

type En = (typeof dict)["en"];
export type Dict = {
  [K in keyof En]: En[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string;
};

export function getDict(lang: UiLang): Dict {
  return dict[lang] as unknown as Dict;
}

export function detectUiLang(): UiLang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("transivo.uiLang");
  if (saved === "tr" || saved === "en") return saved;
  return navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function saveUiLang(lang: UiLang) {
  window.localStorage.setItem("transivo.uiLang", lang);
}
