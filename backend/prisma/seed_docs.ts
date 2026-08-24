import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const STANDARD_DOCUMENT_TYPES = [
  {
    code: 'TAAHHUTNAME',
    name: 'Bursiyer Taahhütnamesi',
    description: 'Vakıf bursiyer taahhütnamesinin imzalanmış kopyası.',
    isStatic: true,
    isRequired: true,
    hasTemplate: true,
    templateName: 'Bursiyer_Taahhutnamesi.pdf',
    order: 1,
  },
  {
    code: 'AYDINLATMA_METNI',
    name: 'Bursiyer Aydınlatma ve Açık Rıza Metni',
    description: 'KVKK aydınlatma ve açık rıza metninin imzalanmış kopyası.',
    isStatic: true,
    isRequired: true,
    hasTemplate: true,
    templateName: 'Aydinlatma_ve_Acik_Riza_Metni.pdf',
    order: 2,
  },
  {
    code: 'YKS_SONUC',
    name: 'YKS Sonuç Belgesi',
    description: 'ÖSYM yerleştirme sonuç belgesi (ÖSYM barkodlu).',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 3,
  },
  {
    code: 'ADLI_SICIL',
    name: 'Adli Sicil Kaydı',
    description: 'e-Devlet üzerinden alınmış barkodlu adli sicil kaydı.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 4,
  },
  {
    code: 'IKAMETGAH',
    name: 'İkametgah (Yerleşim Yeri Belgesi)',
    description: 'e-Devlet üzerinden alınmış barkodlu yerleşim yeri belgesi.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 5,
  },
  {
    code: 'VUKUATLI_NUFUS',
    name: 'Vukuatlı Nüfus Kayıt Örneği',
    description: 'e-Devlet üzerinden tüm aile bireylerini gösteren nüfus kayıt örneği.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 6,
  },
  {
    code: 'ANNE_SGK',
    name: 'Anne - SGK Tescil ve Hizmet Dökümü',
    description: 'Anneye ait e-Devlet SGK 4A/4B/4C tescil ve hizmet dökümü.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 7,
  },
  {
    code: 'BABA_SGK',
    name: 'Baba - SGK Tescil ve Hizmet Dökümü',
    description: 'Babaya ait e-Devlet SGK 4A/4B/4C tescil ve hizmet dökümü.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 8,
  },
  {
    code: 'TAPU_TESCIL',
    name: 'Tapu Tescil Belgesi',
    description: 'e-Devlet üzerinden alınan tapu bilgisi sorgulama belgesi.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 9,
  },
  {
    code: 'ARAC_TESCIL',
    name: 'Araç Tescil Belgesi',
    description: 'e-Devlet üzerinden adıma tescilli araç sorgulama belgesi.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 10,
  },
  {
    code: 'SGK_EMEKLILIK',
    name: 'SGK Emeklilik Belgesi (Anne-Baba)',
    description: 'Anne veya babanın emeklilik durumunu gösteren belge.',
    isStatic: true,
    isRequired: true,
    hasTemplate: false,
    order: 11,
  },
  {
    code: 'YURT_BELGESI',
    name: 'Yurt Belgesi (Varsa)',
    description: 'Devlet veya özel yurtta kalındığına dair güncel yurt belgesi.',
    isStatic: true,
    isRequired: false,
    hasTemplate: false,
    order: 12,
  },
  {
    code: 'KIRA_KONTRATI',
    name: 'Kira Kontratı (Varsa)',
    description: 'Kirada ikamet ediliyorsa kira kontratı fotokopisi.',
    isStatic: true,
    isRequired: false,
    hasTemplate: false,
    order: 13,
  },
  {
    code: 'TRANSCRIPT',
    name: 'Transkript',
    description: 'Öğrencinin güncel not dökümü belgesi.',
    isStatic: false,
    isRequired: true,
    hasTemplate: false,
    order: 14,
  },
  {
    code: 'STUDENT_CERTIFICATE',
    name: 'Öğrenci Belgesi',
    description: 'Öğrencinin aktif olarak okula kayıtlı olduğunu gösteren belge.',
    isStatic: false,
    isRequired: true,
    hasTemplate: false,
    order: 15,
  },
];

export async function seedStandardDocumentTypes() {
  console.log('Seeding standard document types...');
  for (const dt of STANDARD_DOCUMENT_TYPES) {
    await prisma.documentTypeConfig.upsert({
      where: { code: dt.code },
      create: {
        code: dt.code,
        name: dt.name,
        description: dt.description,
        isStatic: dt.isStatic,
        isRequired: dt.isRequired,
        hasTemplate: dt.hasTemplate,
        templateName: dt.templateName || null,
        order: dt.order,
        isActive: true,
      },
      update: {
        name: dt.name,
        description: dt.description,
        isStatic: dt.isStatic,
        isRequired: dt.isRequired,
        hasTemplate: dt.hasTemplate,
        templateName: dt.templateName || null,
        order: dt.order,
        isActive: true,
      },
    });
  }
  console.log('✅ Standard document types seeded successfully!');
}

// @ts-ignore
if (typeof require !== 'undefined' && require.main === module) {
  seedStandardDocumentTypes()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      // @ts-ignore
      process.exit(1);
    });
}
