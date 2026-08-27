import type { AuditLog } from '../types';
import React from 'react';

export const actionLabels: Record<string, string> = {
  CREATE: 'Oluşturuldu',
  UPDATE: 'Güncellendi',
  DELETE: 'Silindi',
  APPROVE: 'Onaylandı',
  REJECT: 'Reddedildi',
  LOGIN: 'Giriş',
  LOGOUT: 'Çıkış',
  UPLOAD: 'Belge Yüklendi',
};

export const moduleLabels: Record<string, string> = {
  DocumentPeriod: 'Evrak Dönemi',
  Semester: 'Yarıyıl Grubu',
  Auth: 'Oturum',
  User: 'Kullanıcı',
  Student: 'Öğrenci',
  StudentProfile: 'Öğrenci Profili',
  Document: 'Öğrenci Evrakı',
  DOCUMENT: 'Öğrenci Evrakı',
  ApprovableChange: 'Profil Değişiklik Talebi',
  EDUCATION_INFO: 'Eğitim Bilgileri',
  PERSONAL_INFO: 'Kişisel Bilgiler',
  BANK_INFO: 'Banka Bilgileri',
  CONTACT_INFO: 'İletişim Bilgileri',
  Event: 'Eğitim ve Etkinlik',
  Mentor: 'Mentör',
  Announcement: 'Duyuru',
  ScholarshipCategory: 'Bursiyer Kategorisi',
  VolunteerForm: 'Gönüllülük Formu'
};

export const fieldTranslations: Record<string, string> = {
  isOpen: 'Durum',
  label: 'Dönem Adı',
  semester: 'Yarıyıl',
  academicYear: 'Akademik Yıl',
  startDate: 'Başlangıç Tarihi',
  endDate: 'Bitiş Tarihi',
  grade: 'Sınıf',
  categoryIds: 'Kategoriler',
  deleted: 'Silindi',
  count: 'Kayıt Sayısı',
  name: 'Kategori Adı',
  description: 'Açıklama',
  isActive: 'Aktiflik Durumu',
  raw: 'Değer',
  
  // Student Profile Fields
  universityName: 'Üniversite',
  faculty: 'Fakülte',
  department: 'Bölüm',
  universityType: 'Üniversite Türü',
  universityCity: 'Okul Şehri',
  universityStartYear: 'Okul Başlangıç Yılı',
  universityPlacementRank: 'YKS Sırası',
  hadPrepClass: 'Hazırlık',
  accommodationType: 'Konaklama',
  sicilNo: 'Sicil No',
  scholarshipCategoryId: 'Bursiyer Kategorisi',
  birthDate: 'Doğum Tarihi',
  birthPlace: 'Doğum Yeri',
  inciName: 'İnci Adı',
  gender: 'Cinsiyet',
  firstName: 'Ad',
  lastName: 'Soyad',
  tcKimlikNo: 'TC Kimlik No',
  iban: 'IBAN',
  phone: 'Telefon',
  email: 'E-posta',
  userType: 'Bursiyer Türü',
  program: 'Program',
  highSchoolName: 'Lise',
  highSchoolCity: 'Lise Şehri',
  highSchoolGradYear: 'Lise Mez. Yılı',
  graduationYear: 'Mezuniyet Yılı',
  fatherAlive: 'Baba Hayatta',
  motherAlive: 'Anne Hayatta',
  familyMemberCount: 'Aile Kişi Sayısı',
  siblingCount: 'Kardeş Sayısı',
  fatherIncome: 'Baba Geliri',
  motherIncome: 'Anne Geliri',
  homeOwnership: 'Ev Durumu',
  
  // New Enhanced Log Fields
  filePath: 'Dosya / Belge',
  studentName: 'İlgili Öğrenci',
  documentType: 'Belge Türü',
  rejectNote: 'Ret Sebebi (Not)',
  periodLabel: 'Dönem Adı',
  actionValue: 'Gerçekleşen Değer',
  deletedDocsCount: 'Silinen Öğrenci Evrak Sayısı',
  forceDeletedDocs: 'Zorla Silinen Evrak Sayısı',
  forceDeleted: 'Zorla (Kalıcı) Silme',
  sentCount: 'Başarıyla Gönderilen Hatırlatma',
  totalRequested: 'Seçilen Hedef Kişi Sayısı',
  isBulkReminder: 'Toplu Hatırlatma İşlemi',
  retentionYears: 'Veri Saklama Süresi (Yıl)',
};

export function formatValue(key: string, val: any) {
  if (val === undefined || val === null || val === '') return '—';
  if (key === 'isOpen' || key === 'isActive') return val ? 'Açık / Aktif' : 'Kapalı / Pasif';
  if (typeof val === 'boolean') return val ? 'Evet' : 'Hayır';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

export function tryParseJSON(val: string | null | undefined) {
  if (!val) return null;
  try {
    const p = JSON.parse(val);
    return typeof p === 'object' && p !== null ? p : { raw: p };
  } catch {
    return { raw: val };
  }
}

export function generateActionSummary(log: AuditLog, onPreview?: (url: string) => void): React.ReactNode {
  const newVal = tryParseJSON(log.newValue);
  const isStudent = log.user?.role === 'STUDENT';
  const studentName = newVal?.studentName || log.user?.tcKimlikNo || 'Bilinmeyen Öğrenci';
  const adminName = log.user?.username || log.user?.email;

  if (log.module === 'DocumentPeriod') {
    if (log.action === 'CREATE') return `Yeni evrak talebi açıldı${newVal?.label ? ` (${newVal.label})` : ''}`;
    if (log.action === 'DELETE') return `${newVal?.periodLabel || 'Bir dönem'} için "${newVal?.documentType || 'Evrak Talebi'}" kalıcı olarak silindi.`;
    if (log.action === 'UPDATE') {
      if (newVal?.isOpen === true) return 'Evrak talebi erişime açıldı';
      if (newVal?.isOpen === false) return 'Evrak talebi erişime kapatıldı';
      return 'Evrak talebi güncellendi';
    }
  }
  
  if (log.module === 'Semester' || log.module === 'DocumentPeriodGroup') {
    if (log.action === 'UPDATE') return 'Dönem grubu (Semester) güncellendi';
    if (log.action === 'DELETE') return `${newVal?.periodLabel || 'Bir dönem'} tüm evraklarıyla birlikte kalıcı olarak silindi.`;
  }

  if (log.module === 'Auth' || log.module === 'User') {
    if (log.action === 'LOGIN') return 'Sisteme giriş yapıldı';
    if (log.newValue?.includes('Password')) return 'Kullanıcı şifresi değiştirildi';
  }
  
  if (log.module === 'Student' || log.module === 'StudentProfile') {
    if (log.action === 'CREATE') return 'Öğrenci hesabı oluşturuldu';
    if (log.action === 'UPDATE') {
      if (log.newValue === 'Photo Updated') return 'Öğrenci fotoğrafı güncellendi';
      if (newVal?.isBulkReminder) return `${newVal.totalRequested || 'Tüm'} öğrenciye toplu evrak hatırlatma e-postası gönderildi.`;
      return 'Öğrenci profili güncellendi';
    }
  }

  if (log.module === 'Settings') {
    if (log.action === 'UPDATE') {
      if (log.entityId === 'smtp_settings') return 'E-posta (SMTP) ayarları güncellendi.';
      if (log.entityId === 'retention_years') return 'Veri saklama süresi (Retention) güncellendi.';
      if (log.entityId === 'VOLUNTEER_FORM_SCHEMA') return 'Gönüllülük formu şablon ayarları güncellendi.';
      return 'Sistem ayarları güncellendi.';
    }
  }
  
  if (log.module === 'VolunteerForm') {
    if (log.action === 'CREATE') return <>{isStudent ? studentName : (adminName || 'Bir kullanıcı')}, sisteme yeni bir Gönüllülük Formu doldurdu.</>;
  }

  const renderLink = (text: string, path: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\/+/, '')}`;
    return (
      <span 
        className="text-primary-600 font-semibold hover:underline cursor-pointer" 
        onClick={(e) => {
          e.stopPropagation();
          if (onPreview) { e.preventDefault(); onPreview(url); }
          else { window.open(url, '_blank'); }
        }}
      >
        {text}
      </span>
    );
  };

  if (log.module === 'Document' || log.action === 'UPLOAD') {
    const docText = newVal?.documentType || newVal?.raw || 'yeni bir evrak';
    const docNode = newVal?.filePath ? renderLink(docText, newVal.filePath) : `"${docText}"`;
    return <>{isStudent ? studentName : (adminName || 'Bir kullanıcı')}, sisteme {docNode} yükledi.</>;
  }
  
  if (log.module === 'DOCUMENT' || log.module === 'ApprovableChange') {
    const docText = newVal?.documentType || newVal?.raw || 'evrakı/profili';
    const docNode = newVal?.filePath ? renderLink(docText, newVal.filePath) : docText;
      
    if (log.action === 'APPROVE') return <>{newVal?.studentName || studentName} kişisinin {docNode} onaylandı.</>;
    if (log.action === 'REJECT') return <>{newVal?.studentName || studentName} kişisinin {docNode} reddedildi.</>;
  }

  const actionStr = actionLabels[log.action] || log.action;
  return `${isStudent ? studentName : (adminName || 'Bir kullanıcı')}, sisteme ${actionStr} işlemi yaptı.`;
}
