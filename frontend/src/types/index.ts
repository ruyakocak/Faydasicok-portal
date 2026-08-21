export interface User {
  id: string;
  role: 'STUDENT' | 'REVIEWER' | 'ADMIN' | 'MENTOR';
  profileId?: string;
  tcKimlikNo?: string;
  email?: string;
  username?: string;
  forcePasswordChange?: boolean;
  studentProfile?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ScholarshipCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  registeredCity?: string;
  scholarshipSources?: string;
  scholarshipDate?: string;
  scholarshipCategoryId?: string;
  scholarshipCategory?: ScholarshipCategory;
  studentStatus: string;
  enrollmentStatus: string;
  isInitialDocsExempt?: boolean;
  phone?: string;
  email?: string;
  address?: string;
  photoPath?: string;
  iban?: string;
  bankName?: string;
  // ── Ek Kişisel / Sicil Bilgileri ──
  userType?: string;
  sicilNo?: string;
  program?: string;
  inciName?: string;
  referenceInfo?: string;
  // Family
  fatherName?: string;
  fatherAge?: number;
  fatherAlive?: boolean;
  fatherMaritalStatus?: string;
  fatherOccupation?: string;
  fatherIncome?: number;
  motherName?: string;
  motherAge?: number;
  motherAlive?: boolean;
  motherMaritalStatus?: string;
  motherOccupation?: string;
  motherIncome?: number;
  familyMemberCount?: number;
  siblingCount?: number;
  siblingsInEducation?: number;
  socialSecurity?: string;
  homeOwnership?: string;
  homeAddress?: string;
  familyDescription?: string;
  familyCity?: string;
  parentsStatus?: string;
  familyPhone?: string;
  // Education
  universityName?: string;
  faculty?: string;
  department?: string;
  grade?: number;
  universityType?: string;
  universityStartYear?: number;
  universityPlacementRank?: number;
  hadPrepClass?: string;
  universityCity?: string;
  accommodationType?: string;
  isContractSigned?: boolean;
  highSchoolName?: string;
  highSchoolCity?: string;
  highSchoolGradYear?: number;
  graduationYear?: number;
  graduatedAt?: string;
  // Askı Bilgisi
  suspensionStartDate?: string;
  suspensionEndDate?: string;
  suspensionNote?: string;
  // Erasmus
  erasmusStartDate?: string;
  erasmusEndDate?: string;
  erasmusSchoolCountry?: string;
  // Mezun
  graduateCity?: string;
  graduateCompany?: string;
  linkedinUrl?: string;
  graduateNote?: string;
  // Mentörlük & İlgi Alanları
  interests?: string;
  mentorExpectation?: string;
  // Relations
  user?: Partial<User>;
  approvableChanges?: ApprovableChange[];
  mentorId?: string;
  mentor?: MentorProfile;
  documentStatus?: {
    completed: boolean;
    missingCount: number;
    pendingCount: number;
  };
}

export interface MentorProfile {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  photoPath?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    students: number;
  };
  students?: { id: string; firstName: string; lastName: string; universityName?: string | null }[];
}

export interface DocumentTypeConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  isStatic?: boolean;
  isRequired?: boolean;
  hasTemplate?: boolean;
  templatePath?: string | null;
  templateName?: string | null;
  order?: number;
  customFields?: string; // JSON array string
  categoryIds?: string | null; // JSON array of scholarship category IDs
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  studentProfileId: string;
  type: string;
  isStatic: boolean;
  periodId?: string | null;
  period?: DocumentPeriod | null;
  grade?: number | null;
  semester?: string | null;
  academicYear?: string | null;
  transcriptNote?: string | null;
  volunteerOrg?: string | null;
  volunteerNote?: string | null;
  dynamicFields?: string | null; // JSON string of custom answers
  filePath: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  rejectionNote?: string | null;
  uploadedAt: string;
  updatedAt: string;
}

export interface DocumentPeriod {
  id: string;
  type: string;
  label: string;
  semester: string;
  academicYear: string;
  grade?: number | null;
  grades?: string | null; // JSON array of numbers
  startDate?: string | null;
  endDate?: string | null;
  isOpen: boolean;
  isVolunteerFormOpen?: boolean;
  categoryIds?: string | null; // JSON array of scholarship category IDs (null = all)
  createdAt: string;
  updatedAt: string;
  documents?: Document[];
  approvableChanges?: ApprovableChange[];
}

export interface ApprovableChange {
  id: string;
  entityType: string;
  studentProfileId: string;
  studentProfile?: Partial<StudentProfile>;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  documentId?: string;
  document?: Partial<Document>;
  changedById: string;
  changedBy?: Partial<User>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  approvedById?: string;
  approvedBy?: Partial<User>;
  reviewedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: Partial<User>;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  oldValue?: string;
  newValue?: string;
  approverId?: string;
  approver?: Partial<User>;
  ipAddress?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  years?: number[];
  counts?: {
    pendingDocuments?: number;
    pendingProfiles?: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  stats: {
    totalStudents: number;
    pendingChanges: number;
    activePeriods: number;
    thisMonthDocs: number;
  };
  recentActivity: AuditLog[];
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  meetingUrl: string | null;
  imagePath: string | null;
  categoryIds?: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  categoryIds?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
