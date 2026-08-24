const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ProfileTabs.tsx', 'utf-8');

const startMarker = '{/* Periodic Document Items (Identical design to static documents) */}';
const endMarker = '      </section>';
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) throw new Error('Start marker not found');

// Find the first endMarker after the startMarker
const endIndex = code.indexOf(endMarker, startIndex);
if (endIndex === -1) throw new Error('End marker not found');

// Plus the length of the endMarker to include it
const before = code.substring(0, startIndex);
const after = code.substring(endIndex + endMarker.length);

const replacement = `{/* Periodic Document Items */}
        <div className="p-6 divide-y divide-gray-100">
          {(() => {
            const visiblePeriodicDocTypes = readOnly
              ? periodicDocTypes
              : periodicDocTypes.filter(dt => 
                  periods.some(p => p.type === dt.code && p.isOpen) || 
                  documents.some(d => d.type === dt.code)
                );

            if (visiblePeriodicDocTypes.length === 0) {
              return <p className="text-sm text-gray-400 text-center py-6">Tanımlı veya aktif dönemsel belge bulunmuyor.</p>;
            }

            return visiblePeriodicDocTypes.flatMap((dt) => {
              const typePeriods = periods.filter(p => p.type === dt.code);
              const typeDocs = documents.filter(d => d.type === dt.code).sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

              const periodsToDisplayMap = new Map();
              typePeriods.forEach(p => {
                if (p.isOpen) periodsToDisplayMap.set(p.id, p);
              });
              typeDocs.forEach(d => {
                if (d.periodId) {
                  const p = typePeriods.find(tp => tp.id === d.periodId);
                  if (p) periodsToDisplayMap.set(p.id, p);
                }
              });

              const periodsToDisplay = Array.from(periodsToDisplayMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const legacyDocs = typeDocs.filter(d => !d.periodId);

              const items = [];
              periodsToDisplay.forEach(p => {
                const docForPeriod = typeDocs.find(d => d.periodId === p.id);
                items.push({ key: \`\${dt.code}-\${p.id}\`, dt, period: p, doc: docForPeriod, isUploaded: !!docForPeriod });
              });
              legacyDocs.forEach(d => {
                items.push({ key: \`\${dt.code}-legacy-\${d.id}\`, dt, period: null, doc: d, isUploaded: true });
              });

              if (items.length === 0 && readOnly) {
                items.push({ key: \`\${dt.code}-empty\`, dt, period: null, doc: null, isUploaded: false });
              }

              return items.map(item => {
                const { key, dt, period, doc, isUploaded } = item;
                const isOpen = period?.isOpen;

                return (
                  <div key={key} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 p-2.5 rounded-xl transition-colors">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">{dt.name}</span>
                        {period ? (
                          <span className={\`px-2 py-0.5 border rounded-md text-[10px] font-semibold \${isOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}\`}>
                            {period.label} {isOpen ? '' : '(Kapalı)'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-md text-[10px] font-semibold">
                            Dönem Kapalı
                          </span>
                        )}
                        {doc && (
                          <StatusBadge
                            status={doc.status}
                            note={doc.rejectionNote}
                            onShowNote={setSelectedRejectionNote}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{dt.description || 'Açıklama belirtilmemiş.'}</p>

                      {doc && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 pt-1 flex-wrap">
                          <a
                            href={\`/\${doc.filePath}\`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1 font-medium truncate max-w-xs"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {doc.originalFileName}
                          </a>
                          <span>•</span>
                          <span>{format(new Date(doc.uploadedAt), 'dd.MM.yyyy HH:mm')}</span>
                          {typeDocs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHistoryModalDocType(dt)}
                              className="text-primary-600 hover:underline font-semibold ml-1 text-[11px] cursor-pointer inline-flex items-center gap-0.5"
                            >
                              Tüm Yükleme Geçmişi ({typeDocs.length}) &rarr;
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!readOnly && period && isOpen && (
                        <PeriodUploadButton
                          periods={[period]}
                          profileId={profile.id}
                          docType={dt}
                          onUploaded={onUpload}
                          isUploaded={isUploaded}
                        />
                      )}
                    </div>
                  </div>
                );
              });
            });
          })()}
        </div>
      </section>`;

const newCode = before + replacement + after;
fs.writeFileSync('frontend/src/components/ProfileTabs.tsx', newCode);
console.log('Successfully replaced logic!');
