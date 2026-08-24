const fs = require('fs');

function fixFrontend() {
  // StudentDocumentsPage.tsx
  let docPage = fs.readFileSync('frontend/src/pages/student/StudentDocumentsPage.tsx', 'utf-8');
  const target1 = \      if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
        return false;
      }
      if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
        return false;
      }\;
  const replace1 = \      if (dtCatIds.length === 0) {
        return false; // Kimseye acik degil
      }
      if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
        return false;
      }
      if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
        return false;
      }\;
  
  if (docPage.includes(target1)) {
    docPage = docPage.replace(target1, replace1);
    fs.writeFileSync('frontend/src/pages/student/StudentDocumentsPage.tsx', docPage);
    console.log('Fixed StudentDocumentsPage.tsx');
  }

  // ProfileTabs.tsx
  let profileTabs = fs.readFileSync('frontend/src/components/ProfileTabs.tsx', 'utf-8');
  const target2 = \    if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
      return false;
    }
    if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
      return false;
    }\;
  const replace2 = \    if (dtCatIds.length === 0) {
      return false; // Kimseye acik degil
    }
    if (dtCatIds.length > 0 && profile.scholarshipCategoryId && !dtCatIds.includes(profile.scholarshipCategoryId)) {
      return false;
    }
    if (dtCatIds.length > 0 && !profile.scholarshipCategoryId) {
      return false;
    }\;

  if (profileTabs.includes(target2)) {
    profileTabs = profileTabs.replace(target2, replace2);
    fs.writeFileSync('frontend/src/components/ProfileTabs.tsx', profileTabs);
    console.log('Fixed ProfileTabs.tsx');
  }

  // PeriodsTab.tsx texts
  let periodsTab = fs.readFileSync('frontend/src/pages/admin/PeriodsTab.tsx', 'utf-8');
  periodsTab = periodsTab.replace(/Hiçbiri seçilmezse tüm evraklar <strong>tüm kategorilere<\/strong> açýk olur\./g, 'Hiçbiri seçilmezse <strong>kimseye açýk olmaz</strong>.');
  periodsTab = periodsTab.replace(/Hiçbiri seçilmezse tüm kategorilere açýk olur\./g, 'Hiçbiri seçilmezse kimseye açýk olmaz.');
  
  fs.writeFileSync('frontend/src/pages/admin/PeriodsTab.tsx', periodsTab);
  console.log('Fixed PeriodsTab.tsx texts');
}

fixFrontend();

