export const PERSON_NAMES = ["גל+תמר", "אלון", "דפנה", "שרונה+שמעון"] as const;

export type PersonName = (typeof PERSON_NAMES)[number];

export interface FurnitureItem {
  id: string;
  name: string;
}

export interface FurnitureCategory {
  id: string;
  title: string;
  items: FurnitureItem[];
}

export interface FurnitureSection {
  id: string;
  title: string;
  categories: FurnitureCategory[];
}

function items(names: string[], prefix: string): FurnitureItem[] {
  return names.map((name, index) => ({
    id: `${prefix}-${index}`,
    name,
  }));
}

export const FURNITURE_SECTIONS: FurnitureSection[] = [
  {
    id: "storage",
    title: "לאיכסון",
    categories: [
      {
        id: "storage-general",
        title: "פריטים לאיכסון",
        items: items(
          [
            "שידת טלויזיה סלון/ילדים",
            "2 כורסאות עור חרדל",
            "ספה עור חומה + הדום",
            "2 כורסאות + ספה זוגית",
            "ספה דו טולמנס",
            "שולחן עם מדפים שחור גל",
            "ספריית מדפים קנדה",
            "כורסא איקאה",
          ],
          "storage",
        ),
      },
    ],
  },
  {
    id: "sale",
    title: "רשימת רהיטים וציוד למכירה",
    categories: [
      {
        id: "parents-bedroom",
        title: "חדר שינה הורים",
        items: items(
          ["2 שידות לבנות עם מגירות", "וילונות לחדר שינה"],
          "parents-bedroom",
        ),
      },
      {
        id: "dafna-room",
        title: "חדר דפנה",
        items: items(
          [
            "מיטה",
            "ארון",
            "כוורת",
            "שולחן",
            "כיסא",
            "שידה",
            "שידת איפור",
            "כורסא",
            "מראה",
            "שידה ליד מיטה",
          ],
          "dafna-room",
        ),
      },
      {
        id: "alon-room",
        title: "חדר אלון",
        items: items(
          ["ארון", "כוורת", "שידה ליד מיטה", "מיטת תינוק"],
          "alon-room",
        ),
      },
      {
        id: "tamar-room",
        title: "חדר תמר",
        items: items(
          [
            "שידת מגירות כפולה",
            "כוורת",
            "בסיס מיטה",
            "מראת גוף",
            "כיסא משרדי",
          ],
          "tamar-room",
        ),
      },
      {
        id: "kitchen",
        title: "מטבח",
        items: items(
          [
            "מקרר",
            "מקרר יין",
            "תנור",
            "כיריים",
            "מדיח כלים",
            "תמי 4",
            "3 כיסאות בר",
            "2 מדפים צפים מעץ",
            "2 מיקרוגלים",
          ],
          "kitchen",
        ),
      },
      {
        id: "living-dining",
        title: "סלון ופינת אוכל",
        items: items(
          [
            "שידת כניסה",
            "מראה לכניסה",
            "שולחן אוכל נפתח",
            "8 כיסאות אוכל",
            "מזנון שחור",
            "שולחן סלון חום כהה",
            "כורסאות סלון בצבע שמנת",
            "גופי תאורה",
          ],
          "living-dining",
        ),
      },
      {
        id: "guest-bathroom",
        title: "שירותי אורחים",
        items: items(["ארונית שירותי אורחים"], "guest-bathroom"),
      },
      {
        id: "garden",
        title: "גינה וחוץ",
        items: items(
          [
            "פינת ישיבה בצורת ר'",
            "שולחן נמוך לבן",
            "ברביקיו",
            "שולחן פינג פונג",
            "6 כיסאות גינה",
            "שולחן עגול גרין",
            "עציצים (כל מה שלא עובר לדירה החדשה)",
            "כיסאות חוץ ירוקים (כמות לא ידועה)",
          ],
          "garden",
        ),
      },
      {
        id: "basement",
        title: "מרתף",
        items: items(
          [
            "שידת טלוויזיה",
            "שולחן כתיבה",
            "שידת מגירות",
            "כיסא משרדי לבן",
          ],
          "basement",
        ),
      },
      {
        id: "shimon-office",
        title: "משרד שמעון",
        items: items(
          [
            "מזנון טלוויזיה",
            "2 כיסאות כחולים",
            "כוורת",
            "2 מדפים צפים",
            "שידה שחורה עם מגירה",
            "שידת מגירות",
            "שולחן עבודה",
          ],
          "shimon-office",
        ),
      },
      {
        id: "electronics",
        title: "מוצרי חשמל ואביזרים נוספים",
        items: items(
          [
            "טלוויזיה למשרד",
            "רדיאטורים",
            "מאוורר דמוי עץ כהה (גדול)",
            "מאוורר שחור לחדר סטנדרטי",
            "מאוורר לבן לחדר סטנדרטי",
          ],
          "electronics",
        ),
      },
    ],
  },
];

export function getAllItemIds(): string[] {
  return FURNITURE_SECTIONS.flatMap((section) =>
    section.categories.flatMap((category) =>
      category.items.map((item) => item.id),
    ),
  );
}

export function getItemById(id: string): FurnitureItem | undefined {
  for (const section of FURNITURE_SECTIONS) {
    for (const category of section.categories) {
      const item = category.items.find((entry) => entry.id === id);
      if (item) return item;
    }
  }
  return undefined;
}

export function getItemLocation(id: string): {
  section: string;
  category: string;
} | null {
  for (const section of FURNITURE_SECTIONS) {
    for (const category of section.categories) {
      if (category.items.some((item) => item.id === id)) {
        return { section: section.title, category: category.title };
      }
    }
  }
  return null;
}
