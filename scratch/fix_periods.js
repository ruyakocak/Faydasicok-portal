const fs = require('fs');
const file = 'c:\\Users\\zekaz\\OneDrive\\Desktop\\Projeler - Eklentiler\\vakıf öğrenci yönetimi\\frontend\\src\\pages\\admin\\PeriodsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix openPeriodEditor
content = content.replace(
  /grade: existingPeriod\.grade \|\| '',/g,
  "grades: existingPeriod.grades ? JSON.parse(existingPeriod.grades) : [],"
);

content = content.replace(
  /grade: period\.grade \|\| '',/g,
  "grades: period.grades ? JSON.parse(period.grades) : [],"
);

// Add toggleEditPeriodGrade
content = content.replace(
  /function toggleEditPeriodCatId\(catId: string\) \{/g,
  `function toggleEditPeriodGrade(g: number) {
    setEditPeriodForm(prev => ({
      ...prev,
      grades: prev.grades.includes(g) ? prev.grades.filter(gr => gr !== g) : [...prev.grades, g]
    }));
  }
  function toggleEditPeriodCatId(catId: string) {`
);

// Fix handleSavePeriod
content = content.replace(
  /grade: editPeriodForm\.grade === '' \? null : Number\(editPeriodForm\.grade\),/g,
  "grades: editPeriodForm.grades,"
);

// Add toggleAddPeriodGrade
content = content.replace(
  /function toggleAddPeriodCatId\(catId: string\) \{/g,
  `function toggleAddPeriodGrade(g: number) {
    setAddPeriodForm(prev => ({
      ...prev,
      grades: prev.grades.includes(g) ? prev.grades.filter(gr => gr !== g) : [...prev.grades, g]
    }));
  }
  function toggleAddPeriodCatId(catId: string) {`
);

// Fix handleAddPeriod
content = content.replace(
  /grade: addPeriodForm\.grade === '' \? null : Number\(addPeriodForm\.grade\),/g,
  "grades: addPeriodForm.grades,"
);

// Fix create period clear
content = content.replace(
  /setAddPeriodForm\(\{ type: '', startDate: '', endDate: '', grade: '', categoryIds: \[\] \}\);/g,
  "setAddPeriodForm({ type: '', startDate: '', endDate: '', grades: [], categoryIds: [] });"
);

fs.writeFileSync(file, content);
console.log("Done");
