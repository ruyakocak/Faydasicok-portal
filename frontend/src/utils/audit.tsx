import type { AuditLog } from '../types';
import React from 'react';
import { Link } from 'react-router-dom';

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

export function generateActionSummary(log: AuditLog): React.ReactNode {
  const newVal = tryParseJSON(log.newValue);
  const isStudent = log.user?.role === 'STUDENT';
  
  let studentName: React.ReactNode = 'Bir kullanıcı';
  if (isStudent) {
    if (log.user?.studentProfile?.id) {
      const nameText = log.user.studentProfile.firstName 
        ? `${log.user.studentProfile.firstName} ${log.user.studentProfile.lastName}`
        : log.user.tcKimlikNo || log.user.username || 'Öğrenci';
      studentName = <Link to={`/admin/students/${log.user.studentProfile.id}`} className="text-gray-900 font-semibold hover:underline">{nameText}</Link>;
    } else {
      studentName = log.user?.tcKimlikNo || log.user?.username || 'Bir kullanıcı';
    }
  }

  const adminName = !isStudent 
    ? (log.user?.username || log.user?.email || 'Sistem Yöneticisi') 
    : null;
  
  if (log.module === 'DocumentPeriod') {
    if (log.action === 'CREATE') return `Yeni dönem oluşturuldu${newVal?.label ? ` (${newVal.label})` : ''}`;
    if (log.action === 'UPDATE') {
      if (newVal?.isOpen === true) return 'Dönem erişime açıldı';
      if (newVal?.isOpen === false) return 'Dönem erişime kapatıldı';
      return 'Dönem bilgileri güncellendi';
    }
  }
  
  if (log.module === 'Semester') {
    if (log.action === 'UPDATE') return 'Dönem grubu (Semester) güncellendi';
    if (log.action === 'DELETE') return 'Dönem grubu silindi';
  }

  if (log.module === 'Auth' || log.module === 'User') {
    if (log.action === 'LOGIN') return 'Sisteme giriş yapıldı';
    if (log.newValue?.includes('Password')) return 'Kullanıcı şifresi değiştirildi';
  }
  
  if (log.module === 'Student' || log.module === 'StudentProfile') {
    if (log.action === 'CREATE') return 'Öğrenci hesabı oluşturuldu';
    if (log.action === 'UPDATE') {
      if (log.newValue === 'Photo Updated') return 'Öğrenci fotoğrafı güncellendi';
      return 'Öğrenci profili güncellendi';
    }
  }
  
  if (log.module === 'VolunteerForm') {
    if (log.action === 'CREATE') return <>{isStudent ? studentName : (adminName || 'Bir kullanıcı')}, sisteme yeni bir Gönüllülük Formu doldurdu.</>;
  }

  if (log.module === 'Document' || log.action === 'UPLOAD') {
    return <>{isStudent ? studentName : (adminName || 'Bir kullanıcı')}, sisteme yeni bir evrak yükledi.</>;
  }
  
  if (log.module === 'DOCUMENT' || log.module === 'ApprovableChange') {
    if (log.action === 'APPROVE') return <>{isStudent ? <>{studentName} profili veya evrakı onaylandı.</> : `${adminName} bir işlemi onayladı.`}</>;
    if (log.action === 'REJECT') return <>{isStudent ? <>{studentName} profili veya evrakı reddedildi.</> : `${adminName} bir işlemi reddetti.`}</>;
  }

  const actionStr = actionLabels[log.action] || log.action;
  const moduleStr = moduleLabels[log.module] || log.module;

  return `${actionStr} (${moduleStr})`;
}
