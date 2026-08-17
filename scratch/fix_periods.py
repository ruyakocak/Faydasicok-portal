import re
import os

filepath = r"C:\Users\zekaz\OneDrive\Desktop\Projeler - Eklentiler\vakıf öğrenci yönetimi\frontend\src\pages\admin\PeriodsPage.tsx"

with open(filepath, 'r', encoding='utf8') as f:
    content = f.read()

# 1. State definitions
content = re.sub(r"grade: number \| '';", r"grades: number[];", content)
content = re.sub(r"grade: '', categoryIds: \[\]", r"grades: [], categoryIds: []", content)
content = re.sub(r"grade: period\.grade \|\| '',", r"grades: period.grades ? JSON.parse(period.grades) : [],", content)
content = re.sub(r"grade: existingPeriod\.grade \|\| '',", r"grades: existingPeriod.grades ? JSON.parse(existingPeriod.grades) : [],", content)

# 2. Delete unused variables
content = re.sub(r"  const \[showCreate, setShowCreate\] = useState\(false\);\n", "", content)
content = re.sub(r"  const \[newLabel, setNewLabel\] = useState\(''\);\n  const \[newCategoryIds, setNewCategoryIds\] = useState<string\[\]>\(\[\]\);\n  const \[creating, setCreating\] = useState\(false\);\n", "", content)

# 3. Add openSemesterCreator and toggle grade methods before openSemesterEditor
methods_to_add = """
  function openSemesterCreator() {
    setEditSemesterLabel('NEW');
    setSemesterForm({
      label: '', semester: 'GUZ', academicYear: '', startDate: '', endDate: '', grades: [], categoryIds: []
    });
  }

  function toggleSemesterGrade(g: number) {
    setSemesterForm(prev => ({ ...prev, grades: prev.grades.includes(g) ? prev.grades.filter(gr => gr !== g) : [...prev.grades, g] }));
  }

  function toggleEditPeriodGrade(g: number) {
    setEditPeriodForm(prev => ({ ...prev, grades: prev.grades.includes(g) ? prev.grades.filter(gr => gr !== g) : [...prev.grades, g] }));
  }

  function toggleAddPeriodGrade(g: number) {
    setAddPeriodForm(prev => ({ ...prev, grades: prev.grades.includes(g) ? prev.grades.filter(gr => gr !== g) : [...prev.grades, g] }));
  }
"""
content = content.replace("  function openSemesterEditor(label: string) {", methods_to_add + "\n  function openSemesterEditor(label: string) {")

# 4. Replace handleSaveSemester completely
old_save_semester_start = content.find("  async function handleSaveSemester(e: React.FormEvent) {")
old_save_semester_end = content.find("  function confirmDeleteSemester(label: string) {", old_save_semester_start)

new_save_semester = """  async function handleSaveSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!editSemesterLabel) return;
    setSavingSemester(true);
    try {
      if (editSemesterLabel === 'NEW') {
        const activeTypes = docTypes.filter(t => t.isActive);
        if (activeTypes.length === 0) {
          toast.error('Aktif bir belge türü bulunamadı. Lütfen önce belge türü ekleyin.');
          setSavingSemester(false);
          return;
        }

        const newLabelStr = `${semesterForm.academicYear} ${semesterForm.semester === 'GUZ' ? 'Güz' : semesterForm.semester === 'BAHAR' ? 'Bahar' : ''}`.trim();
        if (!newLabelStr) {
          toast.error('Dönem etiketi oluşturulamadı. Akademik yıl ve dönem bilgilerini kontrol edin.');
          setSavingSemester(false);
          return;
        }

        await Promise.all(
          activeTypes.map(t => {
            let documentCatIds: string[] = [];
            try { documentCatIds = t.categoryIds ? JSON.parse(t.categoryIds) : []; } catch {}
            let finalCatIds = semesterForm.categoryIds.length > 0 ? [...semesterForm.categoryIds] : [];
            if (documentCatIds.length > 0) {
              if (semesterForm.categoryIds.length > 0) {
                finalCatIds = documentCatIds.filter(id => semesterForm.categoryIds.includes(id));
              } else {
                finalCatIds = documentCatIds;
              }
            } else {
               finalCatIds = semesterForm.categoryIds;
            }

            return adminApi.createPeriod({
              type: t.code,
              label: newLabelStr,
              semester: semesterForm.semester,
              academicYear: semesterForm.academicYear,
              startDate: semesterForm.startDate ? new Date(semesterForm.startDate).toISOString() : null,
              endDate: semesterForm.endDate ? new Date(semesterForm.endDate).toISOString() : null,
              grades: semesterForm.grades,
              categoryIds: finalCatIds,
              isOpen: false
            } as any);
          })
        );
        toast.success('Yeni dönem başarıyla oluşturuldu.');
        setEditSemesterLabel(null);
        const data = await adminApi.listPeriods();
        setPeriods(data);
        setSelectedSemester(newLabelStr);
      } else {
        const payload: any = {
          oldLabel: editSemesterLabel,
          label: semesterForm.label,
          semester: semesterForm.semester,
          academicYear: semesterForm.academicYear,
          startDate: semesterForm.startDate ? new Date(semesterForm.startDate).toISOString() : null,
          endDate: semesterForm.endDate ? new Date(semesterForm.endDate).toISOString() : null,
          grades: semesterForm.grades,
          categoryIds: semesterForm.categoryIds,
        };

        await adminApi.updateSemester(payload);
        toast.success('Dönem bilgileri güncellendi.');
        setEditSemesterLabel(null);
        const data = await adminApi.listPeriods();
        setPeriods(data);
        if (semesterForm.label !== selectedSemester) {
          setSelectedSemester(semesterForm.label);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSavingSemester(false);
    }
  }

"""
content = content[:old_save_semester_start] + new_save_semester + content[old_save_semester_end:]

# 5. Remove handleCreateSemester completely
old_create_semester_start = content.find("  async function handleCreateSemester(e: React.FormEvent) {")
old_create_semester_end = content.find("  function openSemesterCreator() {", old_create_semester_start)
if old_create_semester_start != -1 and old_create_semester_end != -1:
    content = content[:old_create_semester_start] + content[old_create_semester_end:]

# 6. Delete showCreate modal completely
show_create_modal_start = content.find("{/* Create Semester Modal */}")
show_create_modal_end = content.find("{/* Semester Edit Modal */}", show_create_modal_start)
if show_create_modal_start != -1 and show_create_modal_end != -1:
    content = content[:show_create_modal_start] + content[show_create_modal_end:]

# 7. Update Edit Modal Title
content = content.replace(
    '<h3 className="font-semibold text-lg text-gray-900">Dönemi Düzenle</h3>',
    '<h3 className="font-semibold text-lg text-gray-900">{editSemesterLabel === \'NEW\' ? \'Yeni Dönem Ekle\' : \'Dönemi Düzenle\'}</h3>'
)

# 8. Update editPeriodForm API call payload
content = content.replace("grade: editPeriodForm.grade === '' ? null : Number(editPeriodForm.grade),", "grades: editPeriodForm.grades,")

# 9. Update addPeriodForm API call payload
content = content.replace("grade: addPeriodForm.grade === '' ? null : Number(addPeriodForm.grade),", "grades: addPeriodForm.grades,")

# 10. Change setShowCreate calls to openSemesterCreator
content = content.replace("setShowCreate(true); setNewCategoryIds([]);", "openSemesterCreator();")

# 11. Replace all grade inputs with checkboxes
sem_checkboxes = '''
                  <p className="text-[11px] text-gray-500 mb-2">
                    Hiçbiri seçilmezse tüm sınıflara açık olur.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: 0, label: 'Hazırlık' },
                      { val: 1, label: '1. Sınıf' },
                      { val: 2, label: '2. Sınıf' },
                      { val: 3, label: '3. Sınıf' },
                      { val: 4, label: '4. Sınıf' },
                      { val: 5, label: '5. Sınıf' },
                      { val: 6, label: '6. Sınıf' },
                    ].map(g => (
                      <label key={g.val} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 w-4 h-4"
                          checked={__FORM__.grades.includes(g.val)}
                          onChange={() => __TOGGLE__(g.val)}
                        />
                        <span className="text-sm font-medium text-gray-700">{g.label}</span>
                      </label>
                    ))}
                  </div>'''

def replace_input(form_name, toggle_func, text):
    pattern = r'<input type="number" min="1" max="6" className="form-input text-sm p-2" value=\{' + form_name + r'\.grade\} onChange=\{e => set' + form_name[0].upper() + form_name[1:] + r'\(f => \(\{\.\.\.f, grade: e\.target\.value === \'\' \? \'\' : Number\(e\.target\.value\)\}\)\)\} placeholder="Örn: 1" />'
    replacement = sem_checkboxes.replace("__FORM__", form_name).replace("__TOGGLE__", toggle_func)
    return re.sub(pattern, replacement, text)

content = replace_input("semesterForm", "toggleSemesterGrade", content)
content = replace_input("editPeriodForm", "toggleEditPeriodGrade", content)
content = replace_input("addPeriodForm", "toggleAddPeriodGrade", content)

# 12. Fix Sınıf Kısıtlaması texts
content = content.replace("Sınıf Kısıtlaması (Boş bırakılırsa tüm sınıflar)", "Sınıf Kısıtlaması")

with open(filepath, 'w', encoding='utf8') as f:
    f.write(content)
