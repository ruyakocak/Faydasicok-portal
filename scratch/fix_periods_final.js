const fs = require('fs');

const file = 'c:\\Users\\zekaz\\OneDrive\\Desktop\\Projeler - Eklentiler\\vakıf öğrenci yönetimi\\frontend\\src\\pages\\admin\\PeriodsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix states
content = content.replace(/grade: number \| '';/g, "grades: number[];");
content = content.replace(/grade: '', categoryIds/g, "grades: [], categoryIds");

// 2. Fix variable declarations (delete newLabel, newCategoryIds, creating)
content = content.replace(/  const \[newLabel, setNewLabel\] = useState\(''\);\r?\n  const \[newCategoryIds, setNewCategoryIds\] = useState<string\[\]>\(\[\]\);\r?\n  const \[creating, setCreating\] = useState\(false\);\r?\n/, "");

// 3. Fix openPeriodEditor and toggle methods
content = content.replace(
  /grade: period\.grade \|\| '',/g,
  "grades: period.grades ? JSON.parse(period.grades) : [],"
);
content = content.replace(
  /grade: existingPeriod\.grade \|\| '',/g,
  "grades: existingPeriod.grades ? JSON.parse(existingPeriod.grades) : [],"
);

// 4. Add methods before openSemesterEditor
const methods = `
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
`;
content = content.replace("  function openSemesterEditor(label: string) {", methods + "\n  function openSemesterEditor(label: string) {");

// 5. Replace handleSaveSemester completely
const oldSaveSemesterRegex = /  async function handleSaveSemester\(e: React\.FormEvent\) \{[\s\S]*?    \} finally \{\r?\n      setSavingSemester\(false\);\r?\n    \}\r?\n  \}/;
const newSaveSemester = `  async function handleSaveSemester(e: React.FormEvent) {
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

        const newLabelStr = \`\${semesterForm.academicYear} \${semesterForm.semester === 'GUZ' ? 'Güz' : semesterForm.semester === 'BAHAR' ? 'Bahar' : ''}\`.trim();
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
  }`;
content = content.replace(oldSaveSemesterRegex, newSaveSemester);

// 6. Delete handleCreateSemester
const createSemesterRegex = /  async function handleCreateSemester\(e: React\.FormEvent\) \{[\s\S]*?    \} finally \{\r?\n      setCreating\(false\);\r?\n    \}\r?\n  \}/;
content = content.replace(createSemesterRegex, "");

// 7. Delete showCreate modal
const showCreateModalRegex = /      \{\/\* Create Semester Modal \*\/\}[\s\S]*?\{\/\* Semester Edit Modal \*\/\}/;
content = content.replace(showCreateModalRegex, "      {/* Semester Edit Modal */}");

// 8. Update edit modal title
content = content.replace(
  /<h3 className="font-semibold text-lg text-gray-900">Dönemi Düzenle<\/h3>/,
  "<h3 className=\"font-semibold text-lg text-gray-900\">{editSemesterLabel === 'NEW' ? 'Yeni Dönem Ekle' : 'Dönemi Düzenle'}</h3>"
);

// 9. Update openSemesterCreator calls
content = content.replace(/setShowCreate\(true\); setNewCategoryIds\(\[\]\);/g, "openSemesterCreator();");

// 10. Update payloads for edit and add period
content = content.replace(
  /grade: editPeriodForm\.grade === '' \? null : Number\(editPeriodForm\.grade\),/g,
  "grades: editPeriodForm.grades,"
);
content = content.replace(
  /grade: addPeriodForm\.grade === '' \? null : Number\(addPeriodForm\.grade\),/g,
  "grades: addPeriodForm.grades,"
);

// 11. Checkboxes replacements
const sem_checkboxes = `
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
                  </div>`;

function replace_input(form_name, toggle_func, text) {
  const patternStr = '<input type="number" min="1" max="6" className="form-input text-sm p-2" value=\\{__FORM__\\.grade\\} onChange=\\{e => set__SETTER__\\(f => \\(\\{\\.\\.\\.f, grade: e\\.target\\.value === \'\' \\? \'\' : Number\\(e\\.target\\.value\\)\\}\\)\\)\\} placeholder="Örn: 1" \\/>';
  const regexStr = patternStr.replace(/__FORM__/g, form_name).replace(/__SETTER__/g, form_name[0].toUpperCase() + form_name.slice(1));
  const regex = new RegExp(regexStr);
  const replacement = sem_checkboxes.replace(/__FORM__/g, form_name).replace(/__TOGGLE__/g, toggle_func);
  return text.replace(regex, replacement);
}

content = replace_input("semesterForm", "toggleSemesterGrade", content);
content = replace_input("editPeriodForm", "toggleEditPeriodGrade", content);
content = replace_input("addPeriodForm", "toggleAddPeriodGrade", content);

// 12. Fix "Sınıf Kısıtlaması" label
content = content.replace(/Sınıf Kısıtlaması \(Boş bırakılırsa tüm sınıflar\)/g, "Sınıf Kısıtlaması");

// 13. Fix setAddPeriodForm missing grades
content = content.replace(
  /setAddPeriodForm\(\{ type: '', startDate: '', endDate: '', grade: '', categoryIds: \[\] \}\);/g,
  "setAddPeriodForm({ type: '', startDate: '', endDate: '', grades: [], categoryIds: [] });"
);

// 14. Delete showCreate state
content = content.replace(/  const \[showCreate, setShowCreate\] = useState\(false\);\r?\n/, "");

fs.writeFileSync(file, content);
console.log("Done");
