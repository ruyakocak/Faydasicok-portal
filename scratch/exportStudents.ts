export async function exportStudentsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      search, university, grade, studentStatus, enrollmentStatus,
      hasPending, scholarshipGroup, includeGraduates,
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { user: { tcKimlikNo: { contains: search as string } } },
      ];
    }
    if (university) where.universityName = { contains: university as string, mode: 'insensitive' };
    if (grade) where.grade = parseInt(grade as string);
    
    if (studentStatus) {
      where.studentStatus = studentStatus;
    } else {
      if (includeGraduates !== 'true') {
        where.studentStatus = { not: 'GRADUATED' };
      }
    }
    
    if (enrollmentStatus) where.enrollmentStatus = enrollmentStatus;
    if (scholarshipGroup) where.scholarshipCategoryId = scholarshipGroup;

    if (hasPending === 'true') {
      const withPending = await prisma.approvableChange.findMany({
        where: { status: 'PENDING' },
        select: { studentProfileId: true },
        distinct: ['studentProfileId'],
      });
      const profileIds = withPending.map((p) => p.studentProfileId);
      if (profileIds.length === 0) {
         where.id = { in: [] };
      } else {
         where.id = { in: profileIds };
      }
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { tcKimlikNo: true, email: true, isActive: true } },
        scholarshipCategory: true,
        mentor: true,
        documents: {
          include: { period: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const activePeriods = await prisma.documentPeriod.findMany({ where: { isOpen: true } });
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Eğitim Vakfı';
    workbook.created = new Date();

    const statusTranslations: Record<string, string> = {
      ACTIVE: 'Aktif',
      PASSIVE: 'Pasif',
      GRADUATED: 'Mezun',
      INCOMPLETE: 'İlk Kayıt / Eksik',
    };

    function applyProfessionalStyle(sheet: ExcelJS.Worksheet, headerColorArgb = 'FF1E3A8A') {
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      sheet.properties.defaultRowHeight = 26;

      const headerRow = sheet.getRow(1);
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerColorArgb },
        };
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
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
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      });
    }

    // ───────────────────────────────────────────────
    // 1. TÜM BURSİYERLER DETAYLI SAYFASI
    // ───────────────────────────────────────────────
    const allStudentsSheet = workbook.addWorksheet('Tüm Bursiyerler');
    allStudentsSheet.columns = [
      { header: 'Tür', key: 'userType', width: 15 },
      { header: 'Sicil No (ilk 4 hane Programa Giriş yılı (eskilerin ilk 4 hanesi 0000 olacak) 5. hane (1 Bursiyer/2 Mentör/3 Gönüllü/5 Bursiyer (izden gelen)) bilgisi / 6-7-8 sıra nosu', key: 'sicilNo', width: 40 },
      { header: 'Program', key: 'program', width: 25 },
      { header: 'Adı', key: 'firstName', width: 20 },
      { header: 'Soyadı', key: 'lastName', width: 20 },
      { header: 'Cinsiyet', key: 'gender', width: 15 },
      { header: 'TCKN', key: 'tc', width: 20 },
      { header: 'IBAN', key: 'iban', width: 35 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Otomatik İnci Adı', key: 'inciName', width: 25 },
      { header: 'Doğum Tarihi', key: 'birthDate', width: 20 },
      { header: 'Aile İkamet Şehri', key: 'familyCity', width: 25 },
      { header: 'Anne/Baba Sağ', key: 'parentsStatus', width: 25 },
      { header: 'Referans Bilgisi / Hasçelik Çalışanı vb.', key: 'referenceInfo', width: 40 },
      { header: 'Aile İletişim Telefonu', key: 'familyPhone', width: 25 },
      { header: 'Okulu', key: 'universityName', width: 35 },
      { header: 'Bölümü', key: 'department', width: 30 },
      { header: 'Sınıfı', key: 'grade', width: 15 },
      { header: 'Okul Başlangıç Yılı', key: 'universityStartYear', width: 20 },
      { header: 'Üniversite Yerleştirme Sırası', key: 'universityPlacementRank', width: 25 },
      { header: 'Üni.Haz.Okudu mu?', key: 'hadPrepClass', width: 20 },
      { header: 'Okul Şehri', key: 'universityCity', width: 20 },
      { header: 'Konaklama', key: 'accommodationType', width: 25 },
      { header: 'Bursiyer Sözleşmesini İmzaladı mı?', key: 'isContractSigned', width: 25 },
      { header: 'Son Durumu', key: 'studentStatus', width: 20 },
      { header: 'Askı Baslangıcı', key: 'suspensionStartDate', width: 20 },
      { header: 'Askı Sonu', key: 'suspensionEndDate', width: 20 },
      { header: 'Askı notu', key: 'suspensionNote', width: 30 },
      { header: 'Erasmus\'a Gidiş Tarihi', key: 'erasmusStartDate', width: 20 },
      { header: 'Erasmus\'dan Dönüş Tarihi', key: 'erasmusEndDate', width: 20 },
      { header: 'Erasmus Ülkesi/ Okulu', key: 'erasmusSchoolCountry', width: 25 },
      { header: 'Mezun Şehri', key: 'graduateCity', width: 20 },
      { header: 'Mezun Şirketi', key: 'graduateCompany', width: 25 },
      { header: 'Linkedin Bağlantı', key: 'linkedinUrl', width: 35 },
      { header: 'MZN NOT', key: 'graduateNote', width: 30 },
      { header: 'İlgi Alanları', key: 'interests', width: 35 },
      { header: 'Nasıl Bir Mentör İster', key: 'mentorExpectation', width: 35 }
    ];

        students.forEach((s) => {
      allStudentsSheet.addRow({
        userType: s.userType || '',
        sicilNo: s.sicilNo || '',
        program: s.scholarshipCategory?.name || s.program || 'Tanımsız / Genel',
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        gender: s.gender || '',
        tc: s.user?.tcKimlikNo || '',
        iban: s.iban || '',
        email: s.user?.email || s.email || '',
        phone: s.phone || '',
        inciName: s.inciName || '',
        birthDate: s.birthDate ? format(new Date(s.birthDate), 'dd.MM.yyyy') : '',
        familyCity: s.familyCity || '',
        parentsStatus: s.parentsStatus || '',
        referenceInfo: s.referenceInfo || '',
        familyPhone: s.familyPhone || '',
        universityName: s.universityName || '',
        department: s.department || '',
        grade: s.grade || '',
        universityStartYear: s.universityStartYear || '',
        universityPlacementRank: s.universityPlacementRank || '',
        hadPrepClass: s.hadPrepClass || '',
        universityCity: s.universityCity || '',
        accommodationType: s.accommodationType || '',
        isContractSigned: s.isContractSigned ? 'Evet' : 'Hayır',
        studentStatus: statusTranslations[s.studentStatus] || s.studentStatus || '—',
        suspensionStartDate: s.suspensionStartDate ? format(new Date(s.suspensionStartDate), 'dd.MM.yyyy') : '',
        suspensionEndDate: s.suspensionEndDate ? format(new Date(s.suspensionEndDate), 'dd.MM.yyyy') : '',
        suspensionNote: s.suspensionNote || '',
        erasmusStartDate: s.erasmusStartDate ? format(new Date(s.erasmusStartDate), 'dd.MM.yyyy') : '',
        erasmusEndDate: s.erasmusEndDate ? format(new Date(s.erasmusEndDate), 'dd.MM.yyyy') : '',
        erasmusSchoolCountry: s.erasmusSchoolCountry || '',
        graduateCity: s.graduateCity || '',
        graduateCompany: s.graduateCompany || '',
        linkedinUrl: s.linkedinUrl || '',
        graduateNote: s.graduateNote || '',
        interests: s.interests || '',
        mentorExpectation: s.mentorExpectation || '',
      });
    });

    applyProfessionalStyle(allStudentsSheet, 'FF1E3A8A');

    // ───────────────────────────────────────────────
    // 2. EKSİK BELGELİ ÖĞRENCİLER SAYFASI
    // ───────────────────────────────────────────────
    const missingDocsSheet = workbook.addWorksheet('Eksik Belgeli Öğrenciler');
    missingDocsSheet.columns = [
      { header: 'T.C. Kimlik No', key: 'tc', width: 16 },
      { header: 'Adı', key: 'firstName', width: 16 },
      { header: 'Soyadı', key: 'lastName', width: 16 },
      { header: 'Bursiyer Kategorisi', key: 'category', width: 24 },
      { header: 'Üniversite', key: 'uni', width: 30 },
      { header: 'Bölüm', key: 'dept', width: 28 },
      { header: 'Sınıf', key: 'grade', width: 10 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'E-Posta', key: 'email', width: 28 },
      { header: 'Eksik Belge / Dönem', key: 'missingDoc', width: 32 },
    ];

    if (activePeriods.length > 0) {
      students.forEach((s) => {
        if (s.studentStatus !== 'GRADUATED' && s.studentStatus !== 'PASSIVE') {
          activePeriods.forEach((period) => {
            const hasDoc = s.documents.some(
              (d) => d.periodId === period.id && (d.status === 'APPROVED' || d.status === 'PENDING')
            );
            if (!hasDoc) {
              missingDocsSheet.addRow({
                tc: s.user?.tcKimlikNo || '',
                firstName: s.firstName || '',
                lastName: s.lastName || '',
                category: s.scholarshipCategory?.name || 'Genel',
                uni: s.universityName || '',
                dept: s.department || '',
                grade: s.grade ? `${s.grade}. Sınıf` : '',
                phone: s.phone || '',
                email: s.user?.email || s.email || '',
                missingDoc: `${period.label} (${period.type})`,
              });
            }
          });
        }
      });
    } else {
      missingDocsSheet.addRow({
        tc: '—',
        firstName: 'Aktif evrak yükleme dönemi bulunmuyor.',
      });
    }

    applyProfessionalStyle(missingDocsSheet, 'FFB91C1C'); // Crimson Red Header

    // ───────────────────────────────────────────────
    // 3. ÖZET İSTATİSTİKLER SAYFASI
    // ───────────────────────────────────────────────
    const statsSheet = workbook.addWorksheet('Özet İstatistikler');
    statsSheet.columns = [
      { header: 'Grup / Boyut', key: 'group', width: 24 },
      { header: 'Kategori / Değer', key: 'value', width: 36 },
      { header: 'Öğrenci Sayısı', key: 'count', width: 16 },
      { header: 'Yüzde (%)', key: 'percent', width: 14 },
    ];

    const categoryStats: Record<string, number> = {};
    const statusStats: Record<string, number> = {};
    const uniStats: Record<string, number> = {};
    const deptStats: Record<string, number> = {};
    let withMentor = 0;
    let withoutMentor = 0;

    const totalStudents = students.length;

    students.forEach((s) => {
      const cat = s.scholarshipCategory?.name || 'Tanımsız / Genel';
      const status = statusTranslations[s.studentStatus] || s.studentStatus || 'Bilinmiyor';
      const uni = s.universityName || 'Belirtilmemiş';
      const dept = s.department || 'Belirtilmemiş';

      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      statusStats[status] = (statusStats[status] || 0) + 1;
      uniStats[uni] = (uniStats[uni] || 0) + 1;
      deptStats[dept] = (deptStats[dept] || 0) + 1;

      if (s.mentorId) withMentor++;
      else withoutMentor++;
    });

    // Add Category Stats
    Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bursiyer Kategorisi',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Add Status Stats
    Object.entries(statusStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bursiyerlik Durumu',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Mentorship Stats
    statsSheet.addRow({
      group: 'Mentörlük Eşleşmesi',
      value: 'Mentörü Olan Bursiyerler',
      count: withMentor,
      percent: totalStudents ? `%${((withMentor / totalStudents) * 100).toFixed(1)}` : '0',
    });
    statsSheet.addRow({
      group: 'Mentörlük Eşleşmesi',
      value: 'Mentör Bekleyen Bursiyerler',
      count: withoutMentor,
      percent: totalStudents ? `%${((withoutMentor / totalStudents) * 100).toFixed(1)}` : '0',
    });
    statsSheet.addRow({});

    // University Stats
    Object.entries(uniStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Üniversite Dağılımı',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Department Stats (Top 15)
    Object.entries(deptStats).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bölüm Dağılımı (İlk 15)',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });

    applyProfessionalStyle(statsSheet, 'FF047857'); // Emerald Green Header

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="faydasicok_bursiyer_raporu.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// ── Document Type Config (Dynamic Document Types) ────────────────────

