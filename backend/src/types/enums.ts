export type Role = 'STUDENT' | 'REVIEWER' | 'ADMIN' | 'MENTOR';
export const Role = {
  STUDENT: 'STUDENT' as const,
  REVIEWER: 'REVIEWER' as const,
  ADMIN: 'ADMIN' as const,
  MENTOR: 'MENTOR' as const,
};

export type StudentStatus = 'INCOMPLETE' | 'ACTIVE' | 'PASSIVE' | 'GRADUATED';
export const StudentStatus = {
  INCOMPLETE: 'INCOMPLETE' as const,
  ACTIVE: 'ACTIVE' as const,
  PASSIVE: 'PASSIVE' as const,
  GRADUATED: 'GRADUATED' as const,
};

export type EnrollmentStatus = 'ENROLLED' | 'ON_LEAVE' | 'GRADUATED' | 'DROPPED';
export const EnrollmentStatus = {
  ENROLLED: 'ENROLLED' as const,
  ON_LEAVE: 'ON_LEAVE' as const,
  GRADUATED: 'GRADUATED' as const,
  DROPPED: 'DROPPED' as const,
};

export type DocumentType =
  | 'APPLICATION_FORM'
  | 'YKS_RESULT'
  | 'UNIVERSITY_PLACEMENT'
  | 'MOTHER_INCOME'
  | 'FATHER_INCOME'
  | 'ID_PHOTOCOPY'
  | 'CRIMINAL_RECORD'
  | 'GRADUATION_CERTIFICATE'
  | 'TRANSCRIPT'
  | 'STUDENT_CERTIFICATE'
  | 'VOLUNTEER_REPORT';

export const DocumentType = {
  APPLICATION_FORM: 'APPLICATION_FORM' as const,
  YKS_RESULT: 'YKS_RESULT' as const,
  UNIVERSITY_PLACEMENT: 'UNIVERSITY_PLACEMENT' as const,
  MOTHER_INCOME: 'MOTHER_INCOME' as const,
  FATHER_INCOME: 'FATHER_INCOME' as const,
  ID_PHOTOCOPY: 'ID_PHOTOCOPY' as const,
  CRIMINAL_RECORD: 'CRIMINAL_RECORD' as const,
  GRADUATION_CERTIFICATE: 'GRADUATION_CERTIFICATE' as const,
  TRANSCRIPT: 'TRANSCRIPT' as const,
  STUDENT_CERTIFICATE: 'STUDENT_CERTIFICATE' as const,
  VOLUNTEER_REPORT: 'VOLUNTEER_REPORT' as const,
};

export type DocumentPeriodType = 'TRANSCRIPT' | 'STUDENT_CERTIFICATE' | 'VOLUNTEER_REPORT';
export const DocumentPeriodType = {
  TRANSCRIPT: 'TRANSCRIPT' as const,
  STUDENT_CERTIFICATE: 'STUDENT_CERTIFICATE' as const,
  VOLUNTEER_REPORT: 'VOLUNTEER_REPORT' as const,
};

export type Semester = 'GUZ' | 'BAHAR';
export const Semester = {
  GUZ: 'GUZ' as const,
  BAHAR: 'BAHAR' as const,
};

export type ApprovableEntityType = 'PERSONAL_INFO' | 'FAMILY_INFO' | 'EDUCATION_INFO' | 'BANK_INFO' | 'DOCUMENT';
export const ApprovableEntityType = {
  PERSONAL_INFO: 'PERSONAL_INFO' as const,
  FAMILY_INFO: 'FAMILY_INFO' as const,
  EDUCATION_INFO: 'EDUCATION_INFO' as const,
  BANK_INFO: 'BANK_INFO' as const,
  DOCUMENT: 'DOCUMENT' as const,
};

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'UPLOAD';
export const AuditAction = {
  CREATE: 'CREATE' as const,
  UPDATE: 'UPDATE' as const,
  DELETE: 'DELETE' as const,
  APPROVE: 'APPROVE' as const,
  REJECT: 'REJECT' as const,
  LOGIN: 'LOGIN' as const,
  LOGOUT: 'LOGOUT' as const,
  UPLOAD: 'UPLOAD' as const,
};
