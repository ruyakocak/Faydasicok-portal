export async function exportGraduatesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { year, categoryId } = req.query;
    const where: any = { studentStatus: 'GRADUATED' };
    if (year && year !== 'ALL') where.graduationYear = parseInt(year as string);
    if (categoryId && categoryId !== 'ALL') where.scholarshipCategoryId = categoryId as string;

    const graduates = await prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { tcKimlikNo: true, email: true } },
        scholarshipCategory: true,
        mentor: true,
      },
      orderBy: [{ graduationYear: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Eğitim Vakfı';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Mezunlar Listesi');
    sheet.columns = [
      { header: 'T.C. Kimlik No', key: 'tc', width: 20 },
      { header: 'Adı', key: 'firstName', width: 20 },
      { header: 'Soyadı', key: 'lastName', width: 20 },
      { header: 'Mezuniyet Yılı', key: 'graduationYear', width: 18 },
      { header: 'Bursiyer Kategorisi', key: 'category', width: 28 },
      { header: 'Telefon Numarası', key: 'phone', width: 20 },
      { header: 'E-Posta Adresi', key: 'email', width: 34 },
      { header: 'İkametgâh Adresi', key: 'address', width: 40 },
      { header: 'Nüfusa Kayıtlı İl', key: 'registeredCity', width: 20 },
      { header: 'Üniversite', key: 'universityName', width: 36 },
      { header: 'Fakülte', key: 'faculty', width: 30 },
      { header: 'Bölüm', key: 'department', width: 32 },
      { header: 'Banka Adı', key: 'bankName', width: 26 },
      { header: 'IBAN Numarası', key: 'iban', width: 36 },
      { header: 'Mentör Adı Soyadı', key: 'mentorName', width: 28 },
      { header: 'Mezuniyete Aktarılma Tarihi', key: 'graduatedAt', width: 26 },
    ];

    graduates.forEach((g) => {
      const mentorFullName = g.mentor ? `${g.mentor.firstName} ${g.mentor.lastName}`.trim() : '—';
      sheet.addRow({
        tc: g.user?.tcKimlikNo || '',
        firstName: g.firstName || '',
        lastName: g.lastName || '',
        graduationYear: g.graduationYear ? `${g.graduationYear} Mezunu` : 'Belirtilmedi',
        category: g.scholarshipCategory?.name || 'Genel',
        phone: g.phone || '',
        email: g.user?.email || g.email || '',
        address: g.address || '',
        registeredCity: g.registeredCity || '',
        universityName: g.universityName || '',
        faculty: g.faculty || '',
        department: g.department || '',
        bankName: g.bankName || '',
        iban: g.iban || '',
        mentorName: mentorFullName,
        graduatedAt: g.graduatedAt ? format(new Date(g.graduatedAt), 'dd.MM.yyyy HH:mm') : (g.updatedAt ? format(new Date(g.updatedAt), 'dd.MM.yyyy') : '—'),
      });
    });

    // Apply professional styling
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    sheet.properties.defaultRowHeight = 26;
    const headerRow = sheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo header
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 24;
      const isEven = rowNumber % 2 === 0;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeYear = year && year !== 'ALL' ? `_${year}` : '_tum';
    res.setHeader('Content-Disposition', `attachment; filename="faydasicok_mezunlar${safeYear}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}


// ── Excel Column Mapping ──────────────────────────────────────────────
type ExcelColumnDef = {
  header: string;
  aliases: string[];
  dbField: string;
  section: string;
  type: string;
  sample1?: any;
  sample2?: any;
};

const EXCEL_COLUMN_MAP: ExcelColumnDef[] = [
  // KİŞİSEL BİLGİLER
  { header: 'Tür', aliases: ['tur', 'usertype'], dbField: 'userType', section: 'profile', type: 'string' },
  { header: 'Sicil No (ilk 4 hane Programa Giriş yılı (eskilerin ilk 4 hanesi 0000 olacak) 5. hane (1 Bursiyer/2 Mentör/3 Gönüllü/5 Bursiyer (izden gelen)) bilgisi / 6-7-8 sıra nosu', aliases: ['sicil', 'sicilno'], dbField: 'sicilNo', section: 'profile', type: 'string' },
  { header: 'Program', aliases: ['programi', 'bursprogrami', 'programadi', 'kategori'], dbField: 'program', section: 'profile', type: 'string' },
  
  // AİLE BİLGİLERİ
  { header: 'Adı', aliases: ['adi', 'isim', 'ogrenciadi'], dbField: 'firstName', section: 'profile', type: 'string' },
  { header: 'Soyadı', aliases: ['soyadi', 'ogrencisoyadi'], dbField: 'lastName', section: 'profile', type: 'string' },
  { header: 'Cinsiyet', aliases: ['gender'], dbField: 'gender', section: 'profile', type: 'string' },
  { header: 'TCKN', aliases: ['tc', 'tckn', 'tckimlik', 'tckimlikno', 'tcno'], dbField: 'tcKimlikNo', section: 'user', type: 'string' },
  { header: 'IBAN', aliases: ['ibanno', 'bankaiban'], dbField: 'iban', section: 'profile', type: 'string' },
  { header: 'Email', aliases: ['email', 'mail', 'eposta'], dbField: 'email', section: 'profile', type: 'string' },
  { header: 'Telefon', aliases: ['tel', 'cep', 'ceptel'], dbField: 'phone', section: 'profile', type: 'string' },
  { header: 'Otomatik İnci Adı', aliases: ['inciladi', 'inciadi', 'otomatikinci'], dbField: 'inciName', section: 'profile', type: 'string' },
  { header: 'Doğum Tarihi', aliases: ['dogum', 'dtarih'], dbField: 'birthDate', section: 'profile', type: 'date' },
  { header: 'Aile İkamet Şehri', aliases: ['aileikamet', 'ailesehir'], dbField: 'familyCity', section: 'profile', type: 'string' },
  { header: 'Anne/Baba Sağ', aliases: ['annebabasag', 'sağ', 'saglik', 'parentsstatus'], dbField: 'parentsStatus', section: 'profile', type: 'string' },
  { header: 'Referans Bilgisi / Hasçelik Çalışanı vb.', aliases: ['referansbilgisi', 'referans'], dbField: 'referenceInfo', section: 'profile', type: 'string' },
  { header: 'Aile İletişim Telefonu', aliases: ['ailetel', 'ailetelefonu'], dbField: 'familyPhone', section: 'profile', type: 'string' },
  
  // OKUL BİLGİLERİ
  { header: 'Okulu', aliases: ['okul', 'uni', 'üniversite', 'universityname'], dbField: 'universityName', section: 'profile', type: 'string' },
  { header: 'Bölümü', aliases: ['bolumu', 'department', 'fakulte', 'fakültesi'], dbField: 'department', section: 'profile', type: 'string' },
  { header: 'Sınıfı', aliases: ['sinifi', 'grade'], dbField: 'grade', section: 'profile', type: 'int' },
  { header: 'Okul Başlangıç Yılı', aliases: ['okulbaslangic', 'unibaslangic'], dbField: 'universityStartYear', section: 'profile', type: 'int' },
  { header: 'Üniversite Yerleştirme Sırası', aliases: ['uniyerlestirme', 'yerlestirmesirasi'], dbField: 'universityPlacementRank', section: 'profile', type: 'int' },
  { header: 'Üni.Haz.Okudu mu?', aliases: ['hazirlikokudumu', 'hazirlik'], dbField: 'hadPrepClass', section: 'profile', type: 'string' },
  { header: 'Okul Şehri', aliases: ['okulsehri', 'unisehri'], dbField: 'universityCity', section: 'profile', type: 'string' },
  { header: 'Konaklama', aliases: ['konaklamaturu', 'konaklama'], dbField: 'accommodationType', section: 'profile', type: 'string' },
  { header: 'Bursiyer Sözleşmesini İmzaladı mı?', aliases: ['sozlesme', 'sozlesmeimzaladimi'], dbField: 'isContractSigned', section: 'profile', type: 'boolean' },
  { header: 'Son Durumu', aliases: ['sondurumu', 'durumu', 'ogrencidurumu', 'bursiyerdurumu', 'statü', 'statu'], dbField: 'studentStatus', section: 'profile', type: 'string' },

  // ASKI BİLGİSİ ALANI
  { header: 'Askı Baslangıcı', aliases: ['askibaslangic', 'askibasi'], dbField: 'suspensionStartDate', section: 'profile', type: 'date' },
  { header: 'Askı Sonu', aliases: ['askisonu'], dbField: 'suspensionEndDate', section: 'profile', type: 'date' },
  { header: 'Askı notu', aliases: ['askinotu', 'askiaciklama'], dbField: 'suspensionNote', section: 'profile', type: 'string' },

  // ERASMUS BİLGİLERİ
  { header: 'Erasmus\'a Gidiş Tarihi', aliases: ['erasmusgidis'], dbField: 'erasmusStartDate', section: 'profile', type: 'date' },
  { header: 'Erasmus\'dan Dönüş Tarihi', aliases: ['erasmusdonus'], dbField: 'erasmusEndDate', section: 'profile', type: 'date' },
  { header: 'Erasmus Ülkesi/ Okulu', aliases: ['erasmusulke', 'erasmusokul'], dbField: 'erasmusSchoolCountry', section: 'profile', type: 'string' },

  // MEZUN İLETİŞİMİ
  { header: 'Mezun Şehri', aliases: ['mezunsehri'], dbField: 'graduateCity', section: 'profile', type: 'string' },
  { header: 'Mezun Şirketi', aliases: ['mezunsirket'], dbField: 'graduateCompany', section: 'profile', type: 'string' },
  { header: 'Linkedin Bağlantı', aliases: ['linkedin', 'linkedinurl'], dbField: 'linkedinUrl', section: 'profile', type: 'string' },
  { header: 'MZN NOT', aliases: ['mznnot', 'mezunnot'], dbField: 'graduateNote', section: 'profile', type: 'string' },

  // DİĞER
  { header: 'İlgi Alanları', aliases: ['ilgi'], dbField: 'interests', section: 'profile', type: 'string' },
  { header: 'Nasıl Bir Mentör İster', aliases: ['mentorister', 'mentorexpectation'], dbField: 'mentorExpectation', section: 'profile', type: 'string' }
];

function normalizeHeader(str: string): string {
  return str
    .replace(/i/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'I')
    .replace(/I/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseExcelCellValue(value: any, type: string): any {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (str === '') return null;

  switch (type) {
    case 'int': {
      const n = parseInt(str.replace(/\\D/g, ''), 10);
      return isNaN(n) ? null : n;
    }
    case 'float': {
      const f = parseFloat(str.replace(',', '.').replace(/[^\\d.]/g, ''));
      return isNaN(f) ? null : f;
    }
    case 'date': {
      if (value instanceof Date) return value;
      if (/^\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}$/.test(str)) {
        const parts = str.split(/[./-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    case 'boolean': {
      const lower = str.toLowerCase();
      if (['evet', 'yes', 'true', '1', 'e'].includes(lower)) return true;
      if (['hayır', 'hayir', 'no', 'false', '0', 'h'].includes(lower)) return false;
      return false;
    }
    default:
      return str;
  }
}

// ── Import Students from Excel ───────────────────────────────────────
