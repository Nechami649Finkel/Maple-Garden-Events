import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Gallery.module.css';

const catalogData = [
  {
    categoryId: 'tablecloths',
    items: [
      { id: 't1', modelCode: 'דגם 101', name: 'קטיפה שמפניה', desc: 'מפת קטיפה יוקרתית בגוון שמפניה, מתאימה לאירועי ערב קלאסיים.', imageUrl: '' },
      { id: 't2', modelCode: 'דגם כלנית', name: 'סאטן שחור', desc: 'מפת סאטן שחורה ומבריקה למראה מודרני ונקי.', imageUrl: '' },
      { id: 't3', modelCode: 'דגם 103', name: 'פשתן טבעי', desc: 'מפת פשתן קלאסית בטקסטורה טבעית ורכה.', imageUrl: '' },
    ],
  },
  {
    categoryId: 'napkins',
    items: [
      { id: 'n1', modelCode: 'דגם 201', name: 'מרווה עדין', desc: 'מפית כותנה רכה בגוון ירוק מרווה.', imageUrl: '' },
      { id: 'n2', modelCode: 'דגם שושן', name: 'זהב חגיגי', desc: 'מפית בשילוב חוטים מוזהבים לאווירה חגיגית.', imageUrl: '' },
      { id: 'n3', modelCode: 'דגם 203', name: 'לבן קלאסי', desc: 'מפית כותנה לבנה עם חבק מתכת אלגנטי.', imageUrl: '' },
    ],
  },
  {
    categoryId: 'centerpieces',
    items: [
      { id: 'c1', modelCode: 'דגם 301', name: 'פמוטי קריסטל 5 קנים', desc: 'פמוטים גבוהים ומרשימים מזכוכית קריסטל.', imageUrl: '' },
      { id: 'c2', modelCode: 'דגם סחלב', name: 'חישוק פרחים זהב', desc: 'חישוק מתכת מודרני מעוטר בשזירת פרחי משי.', imageUrl: '' },
      { id: 'c3', modelCode: 'דגם 303', name: 'עששיות וינטג\'', desc: 'סט עששיות בגדלים שונים עם נרות לד בפנים.', imageUrl: '' },
    ],
  },
];

const Gallery = () => {
  const { t, T } = useTranslation();
  const [activeCategory, setActiveCategory] = useState(catalogData[0].categoryId);

  const categoryLabels = useMemo(
    () => ({
      tablecloths: t(T.EVENT_FORM.LABEL_TABLECLOTHS),
      napkins: t(T.EVENT_FORM.LABEL_NAPKINS),
      centerpieces: t(T.EVENT_FORM.LABEL_CENTERPIECES),
    }),
    [t, T],
  );

  const currentCategoryData = catalogData.find((c) => c.categoryId === activeCategory);

  return (
    <div className={styles.galleryContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t(T.NAV.GALLERY)}</h1>
        <p className={styles.subtitle}>
          מצאתם עיצוב שאהבתם? שלחו למנהל האירוע שלכם את <strong>מספר הדגם</strong> והוא יעדכן זאת בתיק האירוע שלכם!
        </p>
      </div>

      <div className={styles.tabs}>
        {catalogData.map((category) => (
          <button
            key={category.categoryId}
            className={`${styles.tabBtn} ${activeCategory === category.categoryId ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveCategory(category.categoryId)}
          >
            {categoryLabels[category.categoryId as keyof typeof categoryLabels]}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {currentCategoryData?.items.map((item) => (
          <div key={item.id} className={styles.card}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className={styles.image} loading="lazy" />
            ) : (
              <div className={styles.imagePlaceholder}>📷</div>
            )}
            <div className={styles.cardContent}>
              <div className={styles.modelBadge}>{item.modelCode}</div>
              <h3 className={styles.itemName}>{item.name}</h3>
              <p className={styles.itemDesc}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Gallery;
