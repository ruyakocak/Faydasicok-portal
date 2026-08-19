import api from './client';
import type { StudentProfile, Document, PaginatedResponse, DashboardStats, ApprovableChange, AuditLog, DocumentPeriod, Event } from '../types';

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (identifier: string, password: string) =>
    api.post('/auth/login', { identifier, password }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api.post(`/auth/reset-password/${token}`, { newPassword }).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

// ── Student Profile ───────────────────────────────────────────────────
export const studentApi = {
  getProfile: (profileId: string): Promise<StudentProfile> =>
    api.get(`/students/${profileId}/profile`).then((r) => r.data),

  getDocuments: (profileId: string): Promise<Document[]> =>
    api.get(`/students/${profileId}/documents`).then((r) => r.data),

  updateContact: (profileId: string, data: Partial<StudentProfile>) =>
    api.patch(`/students/${profileId}/contact`, data).then((r) => r.data),

  updatePersonal: (profileId: string, data: Partial<StudentProfile>) =>
    api.patch(`/students/${profileId}/personal`, data).then((r) => r.data),

  updateFamily: (profileId: string, data: Partial<StudentProfile>) =>
    api.patch(`/students/${profileId}/family`, data).then((r) => r.data),

  updateEducation: (profileId: string, data: Partial<StudentProfile>) =>
    api.patch(`/students/${profileId}/education`, data).then((r) => r.data),

  updateBankInfo: (profileId: string, iban: string, bankName: string) =>
    api.patch(`/students/${profileId}/bank-info`, { iban, bankName }).then((r) => r.data),

  listScholarshipCategories: (): Promise<import('../types').ScholarshipCategory[]> =>
    api.get('/students/scholarship-categories').then((r) => r.data),

  uploadPhoto: (profileId: string, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post(`/students/${profileId}/photo`, fd).then((r) => r.data);
  },
};

// ── Documents ─────────────────────────────────────────────────────────
export const documentApi = {
  getPeriods: (): Promise<DocumentPeriod[]> =>
    api.get('/documents/periods').then((r) => r.data),

  getActiveTypes: () =>
    api.get('/documents/types').then((r) => r.data),

  uploadStatic: (profileId: string, type: string, file: File, dynamicFields?: any) => {
    const fd = new FormData();
    fd.append('profileId', profileId);
    fd.append('type', type);
    if (dynamicFields) {
      fd.append('dynamicFields', JSON.stringify(dynamicFields));
    }
    fd.append('file', file);
    return api.post('/documents/static', fd).then((r) => r.data);
  },

  uploadTranscript: (profileId: string, data: Record<string, string>, file: File) => {
    const fd = new FormData();
    fd.append('profileId', profileId);
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', file);
    return api.post('/documents/transcript', fd).then((r) => r.data);
  },

  uploadStudentCertificate: (profileId: string, data: Record<string, string>, file: File) => {
    const fd = new FormData();
    fd.append('profileId', profileId);
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', file);
    return api.post('/documents/student-certificate', fd).then((r) => r.data);
  },

  uploadVolunteerReport: (profileId: string, data: Record<string, string>, file: File) => {
    const fd = new FormData();
    fd.append('profileId', profileId);
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', file);
    return api.post('/documents/volunteer-report', fd).then((r) => r.data);
  },

  uploadDynamicDocument: (profileId: string, periodId: string, type: string, dynamicFields: any, file: File) => {
    const fd = new FormData();
    fd.append('profileId', profileId);
    fd.append('periodId', periodId);
    fd.append('type', type);
    if (dynamicFields) {
      fd.append('dynamicFields', JSON.stringify(dynamicFields));
    }
    fd.append('file', file);
    return api.post('/documents/dynamic', fd).then((r) => r.data);
  },
};

// ── Approvals ─────────────────────────────────────────────────────────
export const approvalApi = {
  getQueue: (params?: Record<string, string>): Promise<PaginatedResponse<ApprovableChange>> =>
    api.get('/approvals/queue', { params }).then((r) => r.data),

  approve: (id: string) =>
    api.post(`/approvals/${id}/approve`).then((r) => r.data),

  reject: (id: string, rejectionNote: string) =>
    api.post(`/approvals/${id}/reject`, { rejectionNote }).then((r) => r.data),

  bulkApprove: (ids: string[]) =>
    api.post('/approvals/bulk-approve', { ids }).then((r) => r.data),
};

// ── Admin ─────────────────────────────────────────────────────────────
export const adminApi = {
  getDashboard: (): Promise<DashboardStats> =>
    api.get('/admin/dashboard').then((r) => r.data),

  listStudents: (params?: Record<string, string>): Promise<PaginatedResponse<StudentProfile>> =>
    api.get('/admin/students', { params }).then((r) => r.data),

  createStudent: (data: { tcKimlikNo: string; firstName: string; lastName: string; scholarshipCategoryId?: string }) =>
    api.post('/admin/students', data).then((r) => r.data),

  updateStudentProfile: (id: string, data: any) =>
    api.patch(`/admin/students/${id}`, data).then((r) => r.data),

  uploadStudentPhoto: (id: string, file: File): Promise<{ photoPath: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/students/${id}/photo`, fd).then((r) => r.data);
  },

  getCsvTemplate: () =>
    api.get('/admin/students/csv-template', { responseType: 'blob' }).then((r) => r.data),

  bulkCreate: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/students/bulk-create', fd, {
      responseType: 'blob',
    }).then((r) => r.data);
  },

  bulkCreateJson: (data: { tcs: string; scholarshipCategoryId: string }) =>
    api.post('/admin/students/bulk-create', data).then((r) => r.data),

  resetPassword: (id: string): Promise<{ password: string }> =>
    api.post(`/admin/students/${id}/reset-password`).then((r) => r.data),

  exportStudentsReport: () =>
    api.get('/admin/reports/students-export', { responseType: 'blob' }).then((r) => r.data),

  bulkRemindStudents: (studentIds: string[]) =>
    api.post('/admin/students/bulk-remind', { studentIds }).then(r => r.data),

  listPeriods: (): Promise<DocumentPeriod[]> =>
    api.get('/admin/periods').then((r) => r.data),

  createPeriod: (data: Omit<Partial<DocumentPeriod>, 'categoryIds' | 'grades'> & { categoryIds?: string[]; grades?: number[] }) =>
    api.post<DocumentPeriod>('/admin/periods', data).then(res => res.data),

  updatePeriod: (id: string, data: Omit<Partial<DocumentPeriod>, 'categoryIds' | 'grades'> & { categoryIds?: string[]; grades?: number[] }) =>
    api.patch(`/admin/periods/${id}`, data).then((r) => r.data),

  deletePeriod: (id: string) =>
    api.delete(`/admin/periods/${id}`).then((r) => r.data),

  updateSemester: (data: { oldLabel: string; label?: string; semester?: string; academicYear?: string; startDate?: string | null; endDate?: string | null; grades?: number[]; categoryIds?: string[]; isVolunteerFormOpen?: boolean }) =>
    api.patch('/admin/semesters', data).then((r) => r.data),

  deleteSemester: (label: string) =>
    api.post('/admin/semesters/delete', { label }).then((r) => r.data),

  updatePeriodCategories: (id: string, categoryIds: string[]) =>
    api.patch(`/admin/periods/${id}`, { categoryIds }).then((r) => r.data),

  // Scholarship Categories
  listScholarshipCategories: (): Promise<import('../types').ScholarshipCategory[]> =>
    api.get('/admin/scholarship-categories').then((r) => r.data),

  createScholarshipCategory: (data: { name: string; description?: string }) =>
    api.post('/admin/scholarship-categories', data).then((r) => r.data),

  updateScholarshipCategory: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch(`/admin/scholarship-categories/${id}`, data).then((r) => r.data),

  deleteScholarshipCategory: (id: string) =>
    api.delete(`/admin/scholarship-categories/${id}`).then((r) => r.data),

  listUsers: () =>
    api.get('/admin/users').then((r) => r.data),

  createUser: (data: { email: string; username?: string; password: string; role?: string; firstName?: string; lastName?: string; title?: string; expertise?: string }) =>
    api.post('/admin/users', data).then((r) => r.data),

  updateUser: (id: string, data: { email?: string; username?: string; password?: string; role?: string }) =>
    api.patch(`/admin/users/${id}`, data).then((r) => r.data),

  deleteUser: (id: string) =>
    api.delete(`/admin/users/${id}`).then((r) => r.data),

  listMentors: () =>
    api.get('/admin/mentors').then((r) => r.data),

  createMentor: (formData: FormData) =>
    api.post('/admin/mentors', formData).then((r) => r.data),

  updateMentor: (id: string, formData: FormData) =>
    api.patch(`/admin/mentors/${id}`, formData).then((r) => r.data),

  deleteMentor: (id: string) =>
    api.delete(`/admin/mentors/${id}`).then((r) => r.data),

  assignMentor: (studentId: string, mentorId: string | null) =>
    api.post('/admin/assign-mentor', { studentId, mentorId }).then((r) => r.data),

  listDocumentTypes: () =>
    api.get('/admin/document-types').then((r) => r.data),

  createDocumentType: (data: any) =>
    api.post('/admin/document-types', data).then((r) => r.data),

  updateDocumentType: (id: string, data: any) =>
    api.patch(`/admin/document-types/${id}`, data).then((r) => r.data),

  deleteDocumentType: (id: string) =>
    api.delete(`/admin/document-types/${id}`).then((r) => r.data),

  initStandardDocumentTypes: () =>
    api.post('/admin/document-types/init-standard').then((r) => r.data),

  // Settings
  getSmtpSettings: () =>
    api.get('/admin/settings/smtp').then((r) => r.data),
  saveSmtpSettings: (data: any) =>
    api.post('/admin/settings/smtp', data).then((r) => r.data),
  testSmtpSettings: (data: { to: string }) =>
    api.post('/admin/settings/smtp/test', data).then((r) => r.data),
};

// ── Audit Logs ────────────────────────────────────────────────────────
export const auditApi = {
  getLogs: (params?: Record<string, string>): Promise<PaginatedResponse<AuditLog>> =>
    api.get('/audit-logs', { params }).then((r) => r.data),
};

// ── Events & Trainings ────────────────────────────────────────────────
export const eventApi = {
  listEvents: (): Promise<Event[]> =>
    api.get('/events').then((r) => r.data),

  createEvent: (formData: FormData): Promise<Event> =>
    api.post('/events', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  updateEvent: (id: string, formData: FormData): Promise<Event> =>
    api.patch(`/events/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  deleteEvent: (id: string): Promise<void> =>
    api.delete(`/events/${id}`).then((r) => r.data),
};

// ── Mentorship ────────────────────────────────────────────────────────
export const mentorshipApi = {
  getProfile: () =>
    api.get('/mentorship/profile').then((r) => r.data),

  getNotes: (studentId?: string) =>
    api.get('/mentorship/notes', { params: { studentId } }).then((r) => r.data),

  createNote: (noteText: string, studentId?: string) =>
    api.post('/mentorship/notes', { noteText, studentId }).then((r) => r.data),
};

// ── Announcements ─────────────────────────────────────────────────────
export const announcementApi = {
  listAnnouncements: (): Promise<import('../types').Announcement[]> =>
    api.get('/admin/announcements').then((r) => r.data),

  createAnnouncement: (data: { title: string; content: string; categoryIds?: string[]; isActive?: boolean }): Promise<import('../types').Announcement> =>
    api.post('/admin/announcements', data).then((r) => r.data),

  updateAnnouncement: (id: string, data: { title?: string; content?: string; categoryIds?: string[]; isActive?: boolean }): Promise<import('../types').Announcement> =>
    api.patch(`/admin/announcements/${id}`, data).then((r) => r.data),

  deleteAnnouncement: (id: string): Promise<void> =>
    api.delete(`/admin/announcements/${id}`).then((r) => r.data),

  getStudentAnnouncements: (profileId: string): Promise<import('../types').Announcement[]> =>
    api.get(`/students/${profileId}/announcements`).then((r) => r.data),
};

// ── Volunteer Forms ───────────────────────────────────────────────────
export const volunteerApi = {
  // Student
  submit: (formData: FormData) =>
    api.post('/volunteer-forms', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  getMyForms: () =>
    api.get('/volunteer-forms/my').then((r) => r.data),

  // Admin
  adminList: (params?: Record<string, string>) =>
    api.get('/volunteer-forms', { params }).then((r) => r.data),

  adminGet: (id: string) =>
    api.get(`/volunteer-forms/${id}`).then((r) => r.data),

  adminUpdate: (id: string, data: Record<string, any>) =>
    api.patch(`/volunteer-forms/${id}`, data).then((r) => r.data),

  adminDelete: (id: string) =>
    api.delete(`/volunteer-forms/${id}`).then((r) => r.data),

  exportExcel: (params?: Record<string, string>) =>
    api.get('/volunteer-forms/export/excel', { params, responseType: 'blob' }).then((r) => r.data),

  getSettingsSchema: () =>
    api.get('/volunteer-forms/settings/schema').then((r) => r.data),

  saveSettingsSchema: (schema: any) =>
    api.put('/volunteer-forms/settings/schema', schema).then((r) => r.data),
};
